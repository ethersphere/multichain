"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./css/PriceTracker.module.css";
import { getGnosisPublicClient } from "./utils";

// Uniswap/Sushiswap V3 Pool ABI (only what we need for price)
const V3_POOL_ABI = [
  {
    inputs: [],
    name: "slot0",
    outputs: [
      { internalType: "uint160", name: "sqrtPriceX96", type: "uint160" },
      { internalType: "int24", name: "tick", type: "int24" },
      { internalType: "uint16", name: "observationIndex", type: "uint16" },
      {
        internalType: "uint16",
        name: "observationCardinality",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "observationCardinalityNext",
        type: "uint16",
      },
      { internalType: "uint8", name: "feeProtocol", type: "uint8" },
      { internalType: "bool", name: "unlocked", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "fee",
    outputs: [{ internalType: "uint24", name: "", type: "uint24" }],
    stateMutability: "view",
    type: "function",
  },
];

// Gnosis token addresses
const BZZ_ADDRESS = "0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da";
const WXDAI_ADDRESS = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";

// Sushiswap V3 Pool address for BZZ/WXDAI on Gnosis
const BZZ_WXDAI_POOL_ADDRESS = "0x7583b9c573fa4fb5ea21c83454939c4cf6aacbc3";

interface PriceInfo {
  token: string;
  price: string;
  previousPrice?: string;
  change?: "up" | "down" | "same";
}

const PriceTracker = () => {
  const [prices, setPrices] = useState<PriceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUpdated, setHasUpdated] = useState(false);
  const previousPrices = useRef<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchPrices = async () => {
      setLoading(true);
      try {
        // Get Gnosis client
        const publicClient = getGnosisPublicClient();

        // First, determine the token order in the pool (token0 vs token1)
        // This is important for calculating the price correctly
        const token0 = (await publicClient.readContract({
          address: BZZ_WXDAI_POOL_ADDRESS as `0x${string}`,
          abi: V3_POOL_ABI,
          functionName: "token0",
        })) as `0x${string}`;

        console.log("token0", token0);

        const token1 = (await publicClient.readContract({
          address: BZZ_WXDAI_POOL_ADDRESS as `0x${string}`,
          abi: V3_POOL_ABI,
          functionName: "token1",
        })) as `0x${string}`;

        console.log("token1", token1);

        const isBzzToken0 = token0.toLowerCase() === BZZ_ADDRESS.toLowerCase();

        console.log("isBzzToken0", isBzzToken0);

        // Get the current price from slot0
        const slot0Data = (await publicClient.readContract({
          address: BZZ_WXDAI_POOL_ADDRESS as `0x${string}`,
          abi: V3_POOL_ABI,
          functionName: "slot0",
        })) as [bigint, number, number, number, number, number, boolean];

        console.log("slot0Data", slot0Data);

        const sqrtPriceX96 = slot0Data[0];

        // Convert sqrtPriceX96 to price
        // Price = (sqrtPriceX96 / 2^96)^2
        const price = calculatePriceFromSqrtX96(sqrtPriceX96, isBzzToken0);

        // Format price with 5 decimal places
        const formattedPrice = price.toFixed(5);

        // Determine price change
        const newPrices = [
          {
            token: "BZZ",
            price: `$${formattedPrice}`,
            change: determineChange("BZZ", formattedPrice),
          },
        ];

        // Update previous prices for next comparison
        previousPrices.current = {
          BZZ: formattedPrice,
        };

        setPrices(newPrices);
        setError(null);
        setHasUpdated(true);

        // Reset update animation after 2 seconds
        setTimeout(() => setHasUpdated(false), 2000);
      } catch (error) {
        console.error("Error fetching BZZ price from V3 pool:", error);
        setError("Unable to fetch BZZ price from SushiSwap V3 pool");
      } finally {
        setLoading(false);
      }
    };

    // Calculate price from sqrtPriceX96
    const calculatePriceFromSqrtX96 = (
      sqrtPriceX96: bigint,
      isBzzToken0: boolean
    ): number => {
      // Price = (sqrtPriceX96 / 2^96)^2
      const Q96 = 2n ** 96n;

      // Calculate the price with maximum precision
      const priceX192 = sqrtPriceX96 * sqrtPriceX96;
      const price = Number(priceX192) / Number(Q96 * Q96);

      // If BZZ is token0, price is in WXDAI per BZZ
      // If BZZ is token1, price is in BZZ per WXDAI, so we need to invert
      if (isBzzToken0) {
        // If BZZ is token0, the price is WXDAI/BZZ
        return price / 100; // Corrected decimal adjustment
      } else {
        // If BZZ is token1, the price is BZZ/WXDAI, so invert to get WXDAI/BZZ
        return 1 / (price * 100); // Corrected decimal adjustment with inversion
      }
    };

    const determineChange = (
      token: string,
      currentPrice: string
    ): "up" | "down" | "same" => {
      const previous = previousPrices.current[token];
      if (!previous) return "same";

      const current = parseFloat(currentPrice);
      const prev = parseFloat(previous);

      if (current > prev) return "up";
      if (current < prev) return "down";
      return "same";
    };

    fetchPrices();

    // Refresh every 60 seconds
    const intervalId = setInterval(fetchPrices, 60000);

    return () => clearInterval(intervalId);
  }, []);

  if ((loading && prices.length === 0) || error) return null;

  return (
    <div
      className={`${styles.priceTrackerContainer} ${
        hasUpdated ? styles.updated : ""
      }`}
    >
      {loading ? (
        <div className={styles.loading}>Updating...</div>
      ) : (
        <div className={styles.priceData}>
          {prices.map((item, index) => (
            <span
              key={item.token}
              className={`${styles.priceItem} ${
                item.change === "up"
                  ? styles.priceUp
                  : item.change === "down"
                  ? styles.priceDown
                  : ""
              }`}
              title="Price from SushiSwap V3 (WXDAI/BZZ)"
            >
              {item.token}: {item.price}
              {item.change === "up" && <span className={styles.arrow}>↑</span>}
              {item.change === "down" && (
                <span className={styles.arrow}>↓</span>
              )}
              {index < prices.length - 1 && " • "}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default PriceTracker;
