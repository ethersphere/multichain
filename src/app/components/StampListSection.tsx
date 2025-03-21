import React, { useState, useEffect } from "react";
import styles from "./css/StampListSection.module.css";
import { createPublicClient, http, formatUnits } from "viem";
import { gnosis } from "viem/chains";

import { GNOSIS_CUSTOM_REGISTRY_ADDRESS } from "./constants";
import { UploadStep } from "./types";

interface StampListSectionProps {
  setShowStampList: (show: boolean) => void;
  address: string | undefined;
  beeApiUrl: string;
  setPostageBatchId: (id: string) => void;
  setShowOverlay: (show: boolean) => void;
  setUploadStep: (step: UploadStep) => void;
}

interface BatchEvent {
  batchId: string;
  totalAmount: string;
  depth: number;
  timestamp?: number;
  utilization?: number;
  batchTTL?: number;
}

interface StampInfo {
  batchID: string;
  utilization: number;
  usable: boolean;
  label: string;
  depth: number;
  amount: string;
  bucketDepth: number;
  blockNumber: number;
  immutableFlag: boolean;
  exists: boolean;
  batchTTL: number;
}

const StampListSection: React.FC<StampListSectionProps> = ({
  setShowStampList,
  address,
  beeApiUrl,
  setPostageBatchId,
  setShowOverlay,
  setUploadStep,
}) => {
  const [stamps, setStamps] = useState<BatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const gnosisClient = createPublicClient({
    chain: gnosis,
    transport: http(),
  });

  const fetchStampInfo = async (batchId: string): Promise<StampInfo | null> => {
    try {
      const response = await fetch(`${beeApiUrl}/stamps/${batchId.slice(2)}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching stamp info for ${batchId}:`, error);
      return null;
    }
  };

  useEffect(() => {
    const fetchStamps = async () => {
      if (!address) return;

      try {
        const logs = await gnosisClient.getLogs({
          address: GNOSIS_CUSTOM_REGISTRY_ADDRESS,
          event: {
            anonymous: false,
            inputs: [
              { indexed: true, name: "batchId", type: "bytes32" },
              { indexed: false, name: "totalAmount", type: "uint256" },
              { indexed: false, name: "normalisedBalance", type: "uint256" },
              { indexed: true, name: "owner", type: "address" },
              { indexed: true, name: "payer", type: "address" },
              { indexed: false, name: "depth", type: "uint8" },
              { indexed: false, name: "bucketDepth", type: "uint8" },
              { indexed: false, name: "immutable", type: "bool" },
            ],
            name: "BatchCreated",
            type: "event",
          },
          args: {
            payer: address as `0x${string}`,
          },
          fromBlock: 25780238n,
          toBlock: "latest",
        });

        const stampEvents = await Promise.all(
          logs.map(async (log) => {
            const block = await gnosisClient.getBlock({
              blockNumber: log.blockNumber,
            });

            const batchId = log.args.batchId?.toString() || "";
            const stampInfo = await fetchStampInfo(batchId);

            return {
              batchId,
              totalAmount: formatUnits(log.args.totalAmount || 0n, 16),
              depth: Number(log.args.depth || 0),
              timestamp: Number(block.timestamp),
              utilization: stampInfo?.utilization,
              batchTTL: stampInfo?.batchTTL,
            };
          })
        );

        setStamps(
          stampEvents.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        );
      } catch (error) {
        console.error("Error fetching stamps:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStamps();
  }, [address, beeApiUrl]);

  const handleStampSelect = (stamp: any) => {
    setPostageBatchId(stamp.batchId.slice(2));
    setShowOverlay(true);
    setUploadStep("ready");
    setShowStampList(false);
  };

  return (
    <div className={styles.stampListContainer}>
      <div className={styles.stampListContent}>
        <div className={styles.stampListHeader}>
          <h2>Your Buckets</h2>
        </div>

        {isLoading ? (
          <div className={styles.stampListLoading}>Loading buckets...</div>
        ) : stamps.length === 0 ? (
          <div className={styles.stampListEmpty}>No buckets found</div>
        ) : (
          <>
            {stamps.map((stamp, index) => (
              <div key={index} className={styles.stampListItem}>
                <div className={styles.stampListId}>ID: {stamp.batchId}</div>
                <div className={styles.stampListDetails}>
                  <span>
                    Amount: {Number(stamp.totalAmount).toFixed(2)} BZZ
                  </span>
                  <span>Depth: {stamp.depth}</span>
                  {stamp.utilization !== undefined && (
                    <span>Utilization: {stamp.utilization}%</span>
                  )}
                  {stamp.batchTTL !== undefined && (
                    <span>
                      Expires: {Math.floor(stamp.batchTTL / 86400)} days
                    </span>
                  )}
                  {stamp.timestamp && (
                    <span>
                      Created:{" "}
                      {new Date(stamp.timestamp * 1000).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <button
                  className={styles.uploadWithStampButton}
                  onClick={() => {
                    handleStampSelect(stamp);
                  }}
                >
                  Upload to this bucket
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default StampListSection;
