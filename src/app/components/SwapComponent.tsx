"use client";

import React, { useState, useEffect } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from "wagmi";
import { watchChainId } from "@wagmi/core";
import { config } from "@/app/wagmi";
import {
  createConfig,
  EVM,
  getContractCallsQuote,
  ContractCallsQuoteRequest,
  convertQuoteToRoute,
  executeRoute,
  ChainId,
  ChainType,
  getTokens,
  getChains,
  TokensResponse,
  getTokenBalancesByChain,
  Chain,
  getQuote,
} from "@lifi/sdk";
import styles from "./css/SwapComponent.module.css";
import { parseAbi, encodeFunctionData, formatUnits } from "viem";
import { getAddress, createPublicClient, http } from "viem";

import { gnosis } from "viem/chains";
import {
  ExecutionStatus,
  UploadStep,
  GetGnosisQuoteParams,
  GetCrossChainQuoteParams,
} from "./types";
import {
  GNOSIS_PRICE_ORACLE_ADDRESS,
  GNOSIS_PRICE_ORACLE_ABI,
  DEFAULT_NODE_ADDRESS,
  GNOSIS_BZZ_ADDRESS,
  DEFAULT_SWARM_CONFIG,
  STORAGE_OPTIONS,
  BEE_GATEWAY_URL,
  GNOSIS_DESTINATION_TOKEN,
  DAY_OPTIONS,
  GNOSIS_CUSTOM_REGISTRY_ADDRESS,
  DEFAULT_BEE_API_URL,
  MIN_TOKEN_BALANCE_USD,
  LIFI_API_KEY,
} from "./constants";

import HelpSection from "./HelpSection";
import StampListSection from "./StampListSection";
import UploadHistorySection from "./UploadHistorySection";
import SearchableChainDropdown from "./SearchableChainDropdown";
import SearchableTokenDropdown from "./SearchableTokenDropdown";

import {
  formatErrorMessage,
  createBatchId,
  performWithRetry,
  formatTokenBalance,
  toChecksumAddress,
  logTokenRoute,
} from "./utils";

const SwapComponent: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [selectedChainId, setSelectedChainId] = useState(ChainId.DAI);
  const [fromToken, setFromToken] = useState(
    "0x0000000000000000000000000000000000000000"
  );
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [lifiConfigInitialized, setLifiConfigInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [isClientConnected, setIsClientConnected] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<bigint | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [selectedDepth, setSelectedDepth] = useState(20);
  const [nodeAddress, setNodeAddress] = useState<string>(DEFAULT_NODE_ADDRESS);
  const [isWebpageUpload, setIsWebpageUpload] = useState(false);
  const [isTarFile, setIsTarFile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [totalUsdAmount, setTotalUsdAmount] = useState<string | null>(null);
  const [availableChains, setAvailableChains] = useState<Chain[]>([]);
  const [isChainsLoading, setIsChainsLoading] = useState(true);
  const [liquidityError, setLiquidityError] = useState<boolean>(false);
  const [isPriceEstimating, setIsPriceEstimating] = useState(false);

  const [statusMessage, setStatusMessage] = useState<ExecutionStatus>({
    step: "",
    message: "",
  });
  const [showOverlay, setShowOverlay] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showStampList, setShowStampList] = useState(false);

  const [selectedTokenInfo, setSelectedTokenInfo] = useState<any>(null);
  const [availableTokens, setAvailableTokens] = useState<TokensResponse | null>(
    null
  );
  const [isTokensLoading, setIsTokensLoading] = useState(true);
  const [isWalletLoading, setIsWalletLoading] = useState(true);

  const [tokenBalances, setTokenBalances] = useState<any>(null);
  const [postageBatchId, setPostageBatchId] = useState<string>("");
  const [selectedStampTTL, setSelectedStampTTL] = useState<number>(0);
  const [beeApiUrl, setBeeApiUrl] = useState<string>(DEFAULT_BEE_API_URL);

  const [swarmConfig, setSwarmConfig] = useState(DEFAULT_SWARM_CONFIG);

  const [isCustomNode, setIsCustomNode] = useState(false);

  const [showUploadHistory, setShowUploadHistory] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const gnosisPublicClient = createPublicClient({
    chain: gnosis,
    transport: http(),
  });

  useEffect(() => {
    const init = async () => {
      setIsWalletLoading(true);
      if (isConnected && address) {
        setSelectedDays(null);
        await fetchTokensAndBalances();
        setFromToken("");
        setSelectedTokenInfo(null);
      }
      setIsWalletLoading(false);
    };

    init();
  }, [isConnected, address, selectedChainId]);

  useEffect(() => {
    setShowAddress(true);
    setIsClientConnected(isConnected);
  }, [isConnected]);

  useEffect(() => {
    if (chainId) {
      setSelectedChainId(chainId);
      setSelectedDays(null);
      setFromToken("");
      setSelectedTokenInfo(null);
      setTokenBalances(null);
      fetchTokensAndBalances();
    }
  }, [chainId]);

  useEffect(() => {
    const fetchAndSetNode = async () => {
      await fetchNodeWalletAddress();
    };
    fetchAndSetNode();
  }, [beeApiUrl]);

  useEffect(() => {
    if (isConnected && publicClient && walletClient) {
      // Reinitialize LiFi whenever the wallet changes
      initializeLiFi();
    } else {
      // Reset the initialization flag when disconnected
      setLifiConfigInitialized(false);
    }
  }, [isConnected, publicClient, walletClient, address]);

  useEffect(() => {
    // Execute first two functions immediately
    fetchCurrentPrice();
    fetchNodeWalletAddress();
  }, []);

  useEffect(() => {
    // Execute first two functions immediately
    fetchCurrentPrice();
    fetchNodeWalletAddress();
  }, [isConnected, address]);

  useEffect(() => {
    const fetchChains = async () => {
      try {
        setIsChainsLoading(true);
        const chains = await getChains({ chainTypes: [ChainType.EVM] });
        setAvailableChains(chains);
      } catch (error) {
        console.error("Error fetching chains:", error);
      } finally {
        setIsChainsLoading(false);
      }
    };

    fetchChains();
  }, []);

  useEffect(() => {
    if (!selectedDays || selectedDays === 0) {
      setTotalUsdAmount(null);
      setSwarmConfig(DEFAULT_SWARM_CONFIG);
      return;
    }

    if (!currentPrice) return;

    try {
      setIsPriceEstimating(true);
      const initialPaymentPerChunkPerDay = BigInt(currentPrice) * BigInt(17280);
      const totalPricePerDuration =
        BigInt(initialPaymentPerChunkPerDay) * BigInt(selectedDays);
      setSwarmConfig((prev) => ({
        ...prev,
        initialPaymentPerChunkPerDay,
        totalPricePerDuration,
      }));

      // Call updateSwarmBatchInitialBalance after setting config
      updateSwarmBatchInitialBalance();
    } catch (error) {
      console.error("Error calculating total cost:", error);
      setTotalUsdAmount(null);
      setSwarmConfig(DEFAULT_SWARM_CONFIG);
    } finally {
      setIsPriceEstimating(false);
    }
  }, [currentPrice, selectedDays, selectedDepth]);

  // Get PRICE estimation for currently choosen options
  useEffect(() => {
    if (!isConnected || !address || !fromToken) return;
    setTotalUsdAmount("0");
    setLiquidityError(false);
    setIsPriceEstimating(true); // Set to true when starting

    const updatePriceEstimate = async () => {
      try {
        // Generate a new nonce for the batch
        const newNonce =
          "0x" +
          Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        setSwarmConfig((prev) => ({
          ...prev,
          swarmBatchNonce: newNonce,
        }));

        const bzzAmount = calculateTotalAmount().toString();
        const gnosisSourceToken =
          selectedChainId === ChainId.DAI
            ? fromToken
            : GNOSIS_DESTINATION_TOKEN;

        const { gnosisContactCallsQuoteResponse } = await performWithRetry(
          () =>
            getGnosisQuote({
              gnosisSourceToken,
              address,
              bzzAmount,
              nodeAddress,
              swarmConfig,
            }),
          "getGnosisQuote"
        );

        let totalAmount = Number(
          gnosisContactCallsQuoteResponse.estimate.fromAmountUSD || 0
        );

        if (selectedChainId !== ChainId.DAI) {
          const { crossChainContractQuoteResponse } = await performWithRetry(
            () =>
              getCrossChainQuote({
                selectedChainId,
                fromToken,
                address,
                toAmount: gnosisContactCallsQuoteResponse.estimate.fromAmount,
                gnosisDestinationToken: GNOSIS_DESTINATION_TOKEN,
              }),
            "getCrossChainQuote"
          );

          // Add to total amount bridge fees
          const bridgeFees = crossChainContractQuoteResponse.estimate.feeCosts
            ? crossChainContractQuoteResponse.estimate.feeCosts.reduce(
                (total, fee) => total + Number(fee.amountUSD || 0),
                0
              )
            : 0;
          totalAmount += bridgeFees;
        }

        setTotalUsdAmount(totalAmount.toString());
      } catch (error) {
        console.error("Error getting price estimate after all retries:", error);
        setTotalUsdAmount(null);
        setLiquidityError(true);
      } finally {
        setIsPriceEstimating(false); // Set to false when done
      }
    };

    if (isConnected && selectedChainId && fromToken && selectedDays) {
      updatePriceEstimate();
    }
  }, [
    isConnected,
    address,
    swarmConfig.swarmBatchInitialBalance,
    selectedDepth,
    selectedDays,
  ]);

  // Initialize LiFi function
  const initializeLiFi = () => {
    // Create new config instead of modifying existing one
    createConfig({
      integrator: "Swarm",
      apiKey: LIFI_API_KEY,
      providers: [
        EVM({
          getWalletClient: async () => {
            const client = await walletClient;
            if (!client) throw new Error("Wallet client not available");
            return client;
          },
          switchChain: async (chainId) => {
            if (switchChain) {
              await switchChain({ chainId });
            }
            const client = await walletClient;
            if (!client) throw new Error("Wallet client not available");
            return client;
          },
        }),
      ],
    });
    setLifiConfigInitialized(true);
  };

  const fetchNodeWalletAddress = async () => {
    try {
      const response = await fetch(`${beeApiUrl}/wallet`, {
        signal: AbortSignal.timeout(15000),
      });
      setNodeAddress(DEFAULT_NODE_ADDRESS);
      if (response.ok) {
        const data = await response.json();
        if (data.walletAddress) {
          setNodeAddress(data.walletAddress);
          console.log("Node wallet address set:", data.walletAddress);
        }
      }
    } catch (error) {
      console.error("Error fetching node wallet address:", error);
    }
  };

  const fetchTokensAndBalances = async () => {
    if (!address || !isConnected) {
      setTokenBalances(null);
      setAvailableTokens(null);
      setFromToken("");
      setSelectedTokenInfo(null);
      return;
    }

    setIsTokensLoading(true);
    try {
      // First fetch all available tokens with retry
      const tokens = await performWithRetry(
        () =>
          getTokens({
            chains: [selectedChainId],
            chainTypes: [ChainType.EVM],
          }),
        "getTokens",
        (result) => Boolean(result?.tokens?.[selectedChainId]?.length)
      );
      console.log("Available tokens:", tokens);
      setAvailableTokens(tokens);

      // Then get balances for these tokens with retry
      const tokensByChain = {
        [selectedChainId]: tokens.tokens[selectedChainId],
      };

      const balances = await performWithRetry(
        () => getTokenBalancesByChain(address, tokensByChain),
        "getTokenBalances",
        (result) => {
          // Validate that we have a non-empty balance result for the selected chain
          const chainBalances = result?.[selectedChainId];
          return Boolean(chainBalances && chainBalances.length > 0);
        }
      );
      console.log("Token balances:", balances);
      setTokenBalances(balances);

      // Find tokens with balance
      if (balances?.[selectedChainId]) {
        const tokensWithBalance = balances[selectedChainId]
          .filter((t) => (t?.amount ?? 0n) > 0n)
          .sort((a, b) => {
            const aUsdValue =
              Number(formatUnits(a.amount || 0n, a.decimals)) *
              Number(a.priceUSD);
            const bUsdValue =
              Number(formatUnits(b.amount || 0n, b.decimals)) *
              Number(b.priceUSD);
            return bUsdValue - aUsdValue;
          });

        console.log("Tokens with balance:", tokensWithBalance);

        // Set initial token if we have any with balance
        if (tokensWithBalance.length > 0) {
          const checksumAddress = toChecksumAddress(
            tokensWithBalance[0].address
          );
          if (checksumAddress) {
            setFromToken(checksumAddress);
            setSelectedTokenInfo(tokensWithBalance[0]);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching tokens and balances:", error);
    } finally {
      setIsTokensLoading(false);
    }
  };

  const fetchCurrentPrice = async () => {
    if (publicClient) {
      try {
        const price = await gnosisPublicClient.readContract({
          address: GNOSIS_PRICE_ORACLE_ADDRESS as `0x${string}`,
          abi: GNOSIS_PRICE_ORACLE_ABI,
          functionName: "currentPrice",
        });
        console.log("price", price);
        setCurrentPrice(BigInt(price));
      } catch (error) {
        console.error("Error fetching current price:", error);
        setCurrentPrice(BigInt(28000));
      }
    } else {
      setCurrentPrice(BigInt(28000));
    }
  };

  const calculateTotalAmount = () => {
    return (
      BigInt(swarmConfig.swarmBatchInitialBalance) * BigInt(2 ** selectedDepth)
    );
  };

  const updateSwarmBatchInitialBalance = () => {
    if (currentPrice !== null) {
      const initialPaymentPerChunkPerDay = BigInt(currentPrice) * BigInt(17280);
      const totalPricePerDuration =
        BigInt(initialPaymentPerChunkPerDay) * BigInt(selectedDays || 1);
      setSwarmConfig((prev) => ({
        ...prev,
        swarmBatchInitialBalance: totalPricePerDuration.toString(),
      }));
    }
  };

  const handleDepthChange = (newDepth: number) => {
    setSelectedDepth(newDepth);
    setSwarmConfig((prev) => ({
      ...prev,
      swarmBatchDepth: newDepth.toString(),
    }));
  };

  const handleDirectBzzTransactions = async () => {
    if (!publicClient || !walletClient) {
      console.error("Clients not initialized");
      setStatusMessage({
        step: "Error",
        message: "Wallet not connected",
        isError: true,
      });
      return;
    }

    try {
      const bzzAmount = calculateTotalAmount().toString();
      console.log("BZZ amount for approval:", bzzAmount);

      setStatusMessage({
        step: "Approval",
        message: "Approving BZZ transfer...",
      });

      // First transaction: Approve - directly write contract without simulation
      const approveTxHash = await walletClient.writeContract({
        address: GNOSIS_BZZ_ADDRESS,
        abi: parseAbi([
          "function approve(address spender, uint256 amount) external returns (bool)",
        ]),
        functionName: "approve",
        args: [GNOSIS_CUSTOM_REGISTRY_ADDRESS, BigInt(bzzAmount)],
        account: address,
      });

      console.log("Approve transaction hash:", approveTxHash);

      setStatusMessage({
        step: "Approval",
        message: "Waiting for approval confirmation...",
      });

      // Wait for approval transaction to be mined
      const approveReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveTxHash,
      });

      if (approveReceipt.status === "success") {
        setStatusMessage({
          step: "Batch",
          message: "Buying storage...",
        });

        // Second transaction: Create Batch - directly write contract without simulation
        const createBatchTxHash = await walletClient.writeContract({
          address: GNOSIS_CUSTOM_REGISTRY_ADDRESS,
          abi: parseAbi(swarmConfig.swarmContractAbi),
          functionName: "createBatchRegistry",
          args: [
            address,
            nodeAddress,
            swarmConfig.swarmBatchInitialBalance,
            swarmConfig.swarmBatchDepth,
            swarmConfig.swarmBatchBucketDepth,
            swarmConfig.swarmBatchNonce,
            swarmConfig.swarmBatchImmutable,
          ],
          account: address,
        });

        console.log("Create batch transaction hash:", createBatchTxHash);

        // Wait for create batch transaction to be mined
        const createBatchReceipt = await publicClient.waitForTransactionReceipt(
          {
            hash: createBatchTxHash,
          }
        );

        if (createBatchReceipt.status === "success") {
          try {
            // Batch will be created from registry contract for all cases
            const batchId = await createBatchId(
              swarmConfig.swarmBatchNonce,
              GNOSIS_CUSTOM_REGISTRY_ADDRESS,
              setPostageBatchId
            );
            console.log("Created batch ID:", batchId);

            setStatusMessage({
              step: "Complete",
              message: "Storage Bought Successfully",
              isSuccess: true,
            });
            setUploadStep("ready");
          } catch (error) {
            console.error("Failed to create batch ID:", error);
            throw new Error("Failed to create batch ID");
          }
        } else {
          throw new Error("Batch creation failed");
        }
      } else {
        throw new Error("Approval failed");
      }
    } catch (error) {
      console.error("Error in direct BZZ transactions:", error);
      setStatusMessage({
        step: "Error",
        message: "Transactionfailed",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        isError: true,
      });
    }
  };

  const handleGnosisTokenSwap = async (contractCallsRoute: any) => {
    setStatusMessage({
      step: "Executing",
      message: "Executing contract calls...",
    });

    const executedRoute = await executeRoute(contractCallsRoute, {
      updateRouteHook: async (updatedRoute) => {
        console.log("Updated Route:", updatedRoute);
        const status = updatedRoute.steps[0]?.execution?.status;
        console.log(`Status: ${status}`);

        setStatusMessage({
          step: "Contract",
          message: `Status update: ${status?.replace(/_/g, " ")}`,
        });

        if (status === "DONE") {
          const txHash = updatedRoute.steps[0]?.execution?.process[0]?.txHash;
          console.log("Created new Batch at trx", txHash);

          try {
            // Batch will be created from registry contract for all cases
            const batchId = await createBatchId(
              swarmConfig.swarmBatchNonce,
              GNOSIS_CUSTOM_REGISTRY_ADDRESS,
              setPostageBatchId
            );
            console.log("Created batch ID:", batchId);
          } catch (error) {
            console.error("Failed to create batch ID:", error);
          }

          setStatusMessage({
            step: "Complete",
            message: "Storage Bought Successfully",
            isSuccess: true,
          });
          setUploadStep("ready");
        }
      },
    });
    console.log("Contract calls execution completed:", executedRoute);
  };

  const handleCrossChainSwap = async (
    gnosisContractCallsRoute: any,
    toAmount: any
  ) => {
    setStatusMessage({
      step: "Quote",
      message: "Getting quote...",
    });

    const { crossChainContractQuoteResponse, crossChainContractCallsRoute } =
      await getCrossChainQuote({
        selectedChainId,
        fromToken,
        address: address as string,
        toAmount,
        gnosisDestinationToken: GNOSIS_DESTINATION_TOKEN,
      });

    setStatusMessage({
      step: "Route",
      message: "Executing bridging transaction... This will take few minutes.",
    });

    const executedRoute = await executeRoute(crossChainContractCallsRoute, {
      updateRouteHook: async (crossChainContractCallsRoute) => {
        console.log("Updated Route 1:", crossChainContractCallsRoute);
        const step1Status =
          crossChainContractCallsRoute.steps[0]?.execution?.status;
        console.log(`Step 1 Status: ${step1Status}`);

        setStatusMessage({
          step: "Route",
          message: `Bridging in progress: ${step1Status?.replace(
            /_/g,
            " "
          )}. This can take few minutes.`,
        });

        if (step1Status === "DONE") {
          await handleChainSwitch(gnosisContractCallsRoute);
        }
      },
    });

    console.log("First route execution completed:", executedRoute);
  };

  const handleChainSwitch = async (contractCallsRoute: any) => {
    console.log("First route completed, triggering chain switch to Gnosis...");
    setStatusMessage({
      step: "Switch",
      message: "First route completed. Switching chain to Gnosis...",
    });

    const unwatch = watchChainId(config, {
      onChange: async (chainId) => {
        if (chainId === ChainId.DAI) {
          console.log("Detected switch to Gnosis, executing second route...");
          unwatch();
          await handleGnosisRoute(contractCallsRoute);
        }
      },
    });

    switchChain({ chainId: ChainId.DAI });
  };

  const handleGnosisRoute = async (contractCallsRoute: any) => {
    setStatusMessage({
      step: "Route",
      message: "Chain switched. Executing second route...",
    });

    try {
      const executedRoute2 = await executeRoute(contractCallsRoute, {
        updateRouteHook: async (contractCallsRoute) => {
          console.log("Updated Route 2:", contractCallsRoute);
          const step2Status = contractCallsRoute.steps[0]?.execution?.status;
          console.log(`Step 2 Status: ${step2Status}`);

          setStatusMessage({
            step: "Route",
            message: `Second route status: ${step2Status?.replace(/_/g, " ")}`,
          });

          if (step2Status === "DONE") {
            const txHash =
              contractCallsRoute.steps[0]?.execution?.process[1]?.txHash;
            console.log("Created new Batch", txHash);

            try {
              // Batch will be created from registry contract for all cases
              const batchId = await createBatchId(
                swarmConfig.swarmBatchNonce,
                GNOSIS_CUSTOM_REGISTRY_ADDRESS,
                setPostageBatchId
              );
              console.log("Created batch ID:", batchId);
            } catch (error) {
              console.error("Failed to create batch ID:", error);
            }

            setStatusMessage({
              step: "Complete",
              message: "Storage Bought Successfully",
              isSuccess: true,
            });
            setUploadStep("ready");
          }
        },
      });
      console.log("Second route execution completed:", executedRoute2);
    } catch (error) {
      console.error("Error executing second route:", error);
      setStatusMessage({
        step: "Error",
        message: "Error executing second route",
        error: "Second route execution failed. Check console for details.",
        isError: true,
      });
    }
  };

  const getGnosisQuote = async ({
    gnosisSourceToken,
    address,
    bzzAmount,
    nodeAddress,
    swarmConfig,
  }: GetGnosisQuoteParams) => {
    // Create postage stamp transaction data
    const postagStampTxData = encodeFunctionData({
      abi: parseAbi(swarmConfig.swarmContractAbi),
      functionName: "createBatchRegistry",
      args: [
        address,
        nodeAddress,
        swarmConfig.swarmBatchInitialBalance,
        swarmConfig.swarmBatchDepth,
        swarmConfig.swarmBatchBucketDepth,
        swarmConfig.swarmBatchNonce,
        swarmConfig.swarmBatchImmutable,
      ],
    });

    // Create quote request
    const gnosisContractCallsQuoteRequest: ContractCallsQuoteRequest = {
      fromChain: ChainId.DAI,
      fromToken: gnosisSourceToken,
      fromAddress: address,
      toChain: ChainId.DAI,
      toToken: swarmConfig.swarmToken,
      toAmount: bzzAmount,
      contractCalls: [
        {
          fromAmount: bzzAmount,
          fromTokenAddress: swarmConfig.swarmToken,
          toContractAddress: GNOSIS_CUSTOM_REGISTRY_ADDRESS,
          toContractCallData: postagStampTxData,
          toContractGasLimit: swarmConfig.swarmContractGasLimit,
        },
      ],
    };

    // Get quote
    const gnosisContactCallsQuoteResponse = await getContractCallsQuote(
      gnosisContractCallsQuoteRequest
    );

    console.info(">> Gnosis Calls Quote", gnosisContactCallsQuoteResponse);
    logTokenRoute(
      gnosisContactCallsQuoteResponse.includedSteps,
      "Gnosis Calls Quote"
    );

    return {
      gnosisContactCallsQuoteResponse,
      gnosisContractCallsRoute: convertQuoteToRoute(
        gnosisContactCallsQuoteResponse
      ),
    };
  };

  const getCrossChainQuote = async ({
    selectedChainId,
    fromToken,
    address,
    toAmount,
    gnosisDestinationToken,
  }: GetCrossChainQuoteParams) => {
    // First get a regular quote to calculate the required fromAmount
    const crossChainContractQuoteRequest: ContractCallsQuoteRequest = {
      fromChain: selectedChainId.toString(),
      fromToken: fromToken,
      fromAddress: address.toString(),
      toChain: ChainId.DAI.toString(),
      toToken: gnosisDestinationToken,
      toAmount: toAmount,
      contractCalls: [],
      slippage: 0.5,
    };

    const initialQuoteResponse = await getContractCallsQuote(
      crossChainContractQuoteRequest
    );

    console.info(">> Initial Cross Chain Quote", initialQuoteResponse);

    // Extract the fromAmount from the initial quote
    const requiredFromAmount = initialQuoteResponse.estimate.fromAmount;

    // Check if user has any balance on Gnosis for gas forwarding
    let fromAmountForGas = 0n;
    try {
      const gnosisProvider = createPublicClient({
        chain: gnosis,
        transport: http(),
      });

      const balance = await gnosisProvider.getBalance({
        address: address as `0x${string}`,
      });

      if (balance === 0n) {
        console.log("No balance on Gnosis, adding gas forwarding");

        const gasApiUrl = `https://li.quest/v1/gas/suggestion/100?fromChain=${selectedChainId}&fromToken=${fromToken}`;
        const gasResponse = await fetch(gasApiUrl);
        const gasData = await gasResponse.json();

        if (gasData.available && gasData.recommended) {
          // Double the recommended gas amount to ensure sufficient funds
          fromAmountForGas = BigInt(gasData.fromAmount) * 2n;
          console.log(
            `Adding gas forwarding: ${fromAmountForGas} (~ $${
              Number(gasData.recommended.amountUsd) * 2
            })`
          );
        }
      } else {
        console.log(
          "User already has balance on Gnosis, no gas forwarding needed"
        );
      }
    } catch (error) {
      console.error(
        "Error checking Gnosis balance or fetching gas suggestion:",
        error
      );
    }

    // Create the actual quote request with gas forwarding
    const quoteRequest = {
      fromChain: selectedChainId.toString(),
      fromToken: fromToken,
      fromAddress: address.toString(),
      fromAmount: requiredFromAmount,
      toChain: ChainId.DAI.toString(),
      toToken: gnosisDestinationToken,
      fromAmountForGas: fromAmountForGas,
      slippage: 0.5,
    };

    const crossChainContractQuoteResponse = await getQuote(quoteRequest);

    console.info(
      ">> Cross Chain Quote with Gas Forwarding",
      crossChainContractQuoteResponse
    );
    logTokenRoute(
      crossChainContractQuoteResponse.includedSteps,
      "Cross Chain Quote with Gas Forwarding"
    );

    return {
      crossChainContractQuoteResponse,
      crossChainContractCallsRoute: convertQuoteToRoute(
        crossChainContractQuoteResponse
      ),
    };
  };

  const handleSwap = async () => {
    if (!isConnected || !address || !publicClient || !walletClient) {
      console.error("Wallet not connected or clients not available");
      return;
    }

    // Set new nonce first
    setSwarmConfig((prev) => ({
      ...prev,
      swarmBatchNonce:
        "0x" +
        Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
    }));

    setIsLoading(true);
    setShowOverlay(true);
    setUploadStep("idle");
    setStatusMessage({
      step: "Initialization",
      message: "Preparing transaction...",
    });

    try {
      // Find the token in available tokens
      const selectedToken = availableTokens?.tokens[selectedChainId]?.find(
        (token) => {
          try {
            return (
              toChecksumAddress(token.address) === toChecksumAddress(fromToken)
            );
          } catch (error) {
            console.error("Error comparing token addresses:", error);
            return false;
          }
        }
      );

      if (!selectedToken || !selectedToken.address) {
        throw new Error("Selected token not found");
      }

      setStatusMessage({
        step: "Calculation",
        message: "Calculating amounts...",
      });

      const bzzAmount = calculateTotalAmount().toString();
      console.log("bzzAmount", bzzAmount);
      console.log("swarmBatchNonce", swarmConfig.swarmBatchNonce);

      // Deciding if we are buying stamp directly or swaping/bridging
      if (
        selectedChainId === ChainId.DAI &&
        getAddress(fromToken) === getAddress(GNOSIS_BZZ_ADDRESS)
      ) {
        await handleDirectBzzTransactions();
      } else {
        setStatusMessage({
          step: "Quoting",
          message: "Getting quote...",
        });

        const gnosisSourceToken =
          selectedChainId === ChainId.DAI
            ? fromToken
            : GNOSIS_DESTINATION_TOKEN;

        const { gnosisContactCallsQuoteResponse, gnosisContractCallsRoute } =
          await getGnosisQuote({
            gnosisSourceToken,
            address,
            bzzAmount,
            nodeAddress,
            swarmConfig,
          });

        // Check are we solving Gnosis chain or other chain Swap
        if (selectedChainId === ChainId.DAI) {
          await handleGnosisTokenSwap(gnosisContractCallsRoute);
        } else {
          // This is gnosisSourceToken/gnosisDesatinationToken amount value
          const toAmount = gnosisContactCallsQuoteResponse.estimate.fromAmount;
          await handleCrossChainSwap(gnosisContractCallsRoute, toAmount);
        }
      }
    } catch (error) {
      console.error("An error occurred:", error);
      setStatusMessage({
        step: "Error",
        message: "Execution failed",
        error: formatErrorMessage(error),
        isError: true,
      });
    }
  };

  const saveUploadReference = (
    reference: string,
    postageBatchId: string,
    expiryDate: number,
    filename?: string
  ) => {
    if (!address) return;

    const savedHistory = localStorage.getItem("uploadHistory");
    const history = savedHistory ? JSON.parse(savedHistory) : {};

    const addressHistory = history[address] || [];
    addressHistory.unshift({
      reference,
      timestamp: Date.now(),
      filename,
      stampId: postageBatchId,
      expiryDate,
    });

    history[address] = addressHistory;
    localStorage.setItem("uploadHistory", JSON.stringify(history));
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !postageBatchId || !walletClient || !publicClient) {
      console.error("Missing file, postage batch ID, or wallet");
      console.log("selectedFile", selectedFile);
      console.log("postageBatchId", postageBatchId);
      console.log("walletClient", walletClient);
      console.log("publicClient", publicClient);
      return;
    }

    const isLocalhost =
      beeApiUrl.includes("localhost") || beeApiUrl.includes("127.0.0.1");
    setUploadStep("uploading");
    setUploadProgress(0);

    interface XHRResponse {
      ok: boolean;
      status: number;
      text: () => Promise<string>;
    }

    interface StampResponse {
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

    const checkStampStatus = async (
      batchId: string
    ): Promise<StampResponse> => {
      console.log(`Checking stamp status for batch ${batchId}`);
      const response = await fetch(`${beeApiUrl}/stamps/${batchId}`);
      const data = await response.json();
      console.log("Stamp status response:", data);
      return data;
    };

    const uploadLargeFile = async (
      file: File,
      headers: Record<string, string>,
      url: string
    ): Promise<XHRResponse> => {
      console.log("Starting file upload...");
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open("POST", url);
        xhr.timeout = 3600000; // 1 hour timeout

        Object.entries(headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            setUploadProgress(Math.min(99, percent));
            console.log(`Upload progress: ${percent.toFixed(1)}%`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
          }
          console.log(`Upload completed with status: ${xhr.status}`);
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            text: () => Promise.resolve(xhr.responseText),
          });
        };

        xhr.onerror = (e) => {
          console.error("XHR Error:", e);
          reject(new Error("Network request failed"));
        };

        xhr.ontimeout = () => {
          console.error("Upload timed out");
          reject(new Error("Upload timed out"));
        };

        console.log("Sending file:", file.name, file.size);
        xhr.send(file);
      });
    };

    try {
      const messageToSign = `${selectedFile.name}:${postageBatchId}`;
      console.log("Message to sign:", messageToSign);

      const signedMessage = await walletClient.signMessage({
        message: messageToSign, // Just sign the plain string directly
      });

      const baseHeaders: Record<string, string> = {
        "Content-Type": isTarFile ? "application/x-tar" : selectedFile.type,
        "swarm-postage-batch-id": postageBatchId,
        "swarm-pin": "false",
        "registry-address": GNOSIS_CUSTOM_REGISTRY_ADDRESS,
      };

      if (isTarFile) {
        baseHeaders["swarm-collection"] = "true";
      }

      if (!isLocalhost) {
        baseHeaders["x-upload-signed-message"] = signedMessage;
        baseHeaders["x-uploader-address"] = address as string;
        baseHeaders["x-file-name"] = selectedFile.name;
        baseHeaders["x-message-content"] = messageToSign; // Send the original message for verification
      }

      if (isWebpageUpload && isTarFile) {
        baseHeaders["Swarm-Index-Document"] = "index.html";
        baseHeaders["Swarm-Error-Document"] = "error.html";
      }

      const waitForBatch = async (
        maxRetries404 = 50,
        maxRetries422 = 50,
        retryDelay404 = 3000,
        retryDelay422 = 3000
      ): Promise<void> => {
        // First wait for batch to exist
        for (let attempt404 = 1; attempt404 <= maxRetries404; attempt404++) {
          try {
            console.log(
              `Checking batch existence, attempt ${attempt404}/${maxRetries404}`
            );
            setStatusMessage({
              step: "404",
              message: "Searching for storage ID...",
            });

            const stampStatus = await checkStampStatus(postageBatchId);

            if (stampStatus.exists) {
              console.log("Batch exists, checking usability");

              // Now wait for batch to become usable
              for (
                let attempt422 = 1;
                attempt422 <= maxRetries422;
                attempt422++
              ) {
                console.log(
                  `Checking batch usability, attempt ${attempt422}/${maxRetries422}`
                );
                setStatusMessage({
                  step: "422",
                  message: "Waiting for storage to be usable...",
                });

                const usabilityStatus = await checkStampStatus(postageBatchId);

                if (usabilityStatus.usable) {
                  console.log("Batch is usable, ready for upload");
                  return;
                }

                console.log(
                  `Batch not usable yet, waiting ${retryDelay422}ms before next attempt`
                );
                await new Promise((resolve) =>
                  setTimeout(resolve, retryDelay422)
                );
              }
              throw new Error(
                "Batch never became usable after maximum retries"
              );
            }

            console.log(
              `Batch not found, waiting ${retryDelay404}ms before next attempt`
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay404));
          } catch (error) {
            console.error(`Error checking stamp status:`, error);
            if (attempt404 === maxRetries404) {
              throw new Error("Batch never found after maximum retries");
            }
            await new Promise((resolve) => setTimeout(resolve, retryDelay404));
          }
        }
        throw new Error("Maximum retry attempts reached");
      };

      // Wait for batch to be ready
      await waitForBatch();

      // Once batch is ready, proceed with upload
      console.log("Starting actual file upload");
      setStatusMessage({
        step: "Uploading",
        message: "Uploading file...",
      });

      const uploadResponse = await uploadLargeFile(
        selectedFile,
        baseHeaders,
        `${beeApiUrl}/bzz`
      );

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      const reference = await uploadResponse.text();
      const parsedReference = JSON.parse(reference);

      console.log("Upload successful, reference:", parsedReference);

      setStatusMessage({
        step: "Complete",
        message: `Upload Successful. Reference: ${parsedReference.reference.slice(
          0,
          6
        )}...${parsedReference.reference.slice(-4)}`,
        isSuccess: true,
        reference: parsedReference.reference,
      });

      setUploadStep("complete");
      setSelectedDays(null);
      setTimeout(() => {
        setUploadStep("idle");
        setShowOverlay(false);
        setIsLoading(false);
        setUploadProgress(0);
      }, 900000);

      if (parsedReference.reference) {
        const stamp = await checkStampStatus(postageBatchId);
        saveUploadReference(
          parsedReference.reference,
          postageBatchId,
          stamp.batchTTL,
          selectedFile?.name
        );
      }
    } catch (error) {
      console.error("Upload error:", error);
      setStatusMessage({
        step: "Error",
        message: "Upload failed",
        error: error instanceof Error ? error.message : "Unknown error",
        isError: true,
      });
      setUploadStep("idle");
      setUploadProgress(0);
    }
  };

  const displayTokenBalance = selectedTokenInfo && (
    <div className={styles.tokenBalance}>
      {(() => {
        const { formatted, usdValue } = formatTokenBalance(
          selectedTokenInfo.amount,
          selectedTokenInfo.decimals,
          selectedTokenInfo.priceUSD
        );
        return (
          <>
            <div className={styles.balanceAmount}>{formatted}</div>
            <div className={styles.balanceUsd}>${usdValue}</div>
          </>
        );
      })()}
    </div>
  );

  const handleOpenDropdown = (dropdownName: string) => {
    setActiveDropdown(dropdownName);
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabContainer}>
        <button
          className={`${styles.tabButton} ${
            !showHelp && !showStampList && !showUploadHistory
              ? styles.activeTab
              : ""
          }`}
          onClick={() => {
            setShowHelp(false);
            setShowStampList(false);
            setShowUploadHistory(false);
          }}
        >
          Buy
        </button>
        <button
          className={`${styles.tabButton} ${
            showStampList ? styles.activeTab : ""
          }`}
          onClick={() => {
            setShowHelp(false);
            setShowStampList(true);
            setShowUploadHistory(false);
          }}
        >
          Buckets
        </button>
        <button
          className={`${styles.tabButton} ${
            showUploadHistory ? styles.activeTab : ""
          }`}
          onClick={() => {
            setShowHelp(false);
            setShowStampList(false);
            setShowUploadHistory(true);
          }}
        >
          History
        </button>
        <button
          className={`${styles.tabButton} ${showHelp ? styles.activeTab : ""}`}
          onClick={() => {
            setShowHelp(true);
            setShowStampList(false);
            setShowUploadHistory(false);
          }}
          aria-label="Settings"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>

      {!showHelp && !showStampList && !showUploadHistory ? (
        <>
          <div className={styles.inputGroup}>
            <label className={styles.label}>From Chain:</label>
            <SearchableChainDropdown
              selectedChainId={selectedChainId}
              availableChains={availableChains}
              onChainSelect={(chainId) => {
                setSelectedChainId(chainId);
                switchChain?.({ chainId });
              }}
              isChainsLoading={isChainsLoading}
              isLoading={isChainsLoading}
              activeDropdown={activeDropdown}
              onOpenDropdown={handleOpenDropdown}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>From Token:</label>
            <SearchableTokenDropdown
              fromToken={fromToken}
              selectedChainId={selectedChainId}
              isWalletLoading={isWalletLoading}
              isTokensLoading={isTokensLoading}
              isConnected={isConnected}
              availableTokens={availableTokens}
              tokenBalances={tokenBalances}
              selectedTokenInfo={selectedTokenInfo}
              onTokenSelect={(address, token) => {
                setFromToken(address);
                setSelectedTokenInfo(token);
              }}
              minBalanceUsd={MIN_TOKEN_BALANCE_USD}
              activeDropdown={activeDropdown}
              onOpenDropdown={handleOpenDropdown}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Storage Bucket:</label>
            <select
              className={styles.select}
              value={selectedDepth}
              onChange={(e) => handleDepthChange(Number(e.target.value))}
            >
              {STORAGE_OPTIONS.map(({ depth, size }) => (
                <option key={depth} value={depth}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Number of Days:</label>
            <select
              className={styles.select}
              value={selectedDays || ""}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedDays(value === "" ? null : Number(value));
              }}
            >
              <option value="">Please select days</option>
              {DAY_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days} {days === 1 ? "day" : "days"}
                </option>
              ))}
            </select>
          </div>

          {selectedDays &&
            totalUsdAmount !== null &&
            Number(totalUsdAmount) !== 0 && (
              <p className={styles.priceInfo}>
                {liquidityError
                  ? "Not enough liquidity for this swap"
                  : `Total cost ~ $${Number(totalUsdAmount).toFixed(2)}`}
              </p>
            )}

          <button
            className={`${styles.button} ${
              !selectedDays ? styles.buttonDisabled : ""
            } ${isPriceEstimating ? styles.calculatingButton : ""}`}
            disabled={!selectedDays || isPriceEstimating}
            onClick={handleSwap}
          >
            {isLoading ? (
              <div>Loading...</div>
            ) : !selectedDays ? (
              "Choose Timespan"
            ) : isPriceEstimating ? (
              "Calculating Cost..."
            ) : liquidityError ? (
              "Cannot Swap - Can't Find Route"
            ) : (
              "Execute Swap"
            )}
          </button>

          {executionResult && (
            <pre className={styles.resultBox}>
              {JSON.stringify(executionResult, null, 2)}
            </pre>
          )}

          {(isLoading || (showOverlay && uploadStep !== "idle")) && (
            <div className={styles.overlay}>
              <div
                className={`${styles.statusBox} ${
                  statusMessage.isSuccess ? styles.success : ""
                }`}
              >
                {!["uploading", "ready"].includes(uploadStep) && (
                  <button
                    className={styles.closeButton}
                    onClick={() => {
                      setShowOverlay(false);
                      setStatusMessage({ step: "", message: "" });
                      setUploadStep("idle");
                      setIsLoading(false);
                      setExecutionResult(null);
                      setSelectedFile(null);
                    }}
                  >
                    ×
                  </button>
                )}

                {!["ready", "uploading"].includes(uploadStep) && (
                  <>
                    {isLoading && statusMessage.step !== "Complete" && (
                      <div className={styles.spinner}></div>
                    )}
                    <div className={styles.statusMessage}>
                      <h3
                        className={
                          statusMessage.isSuccess ? styles.success : ""
                        }
                      >
                        {statusMessage.message}
                      </h3>
                      {statusMessage.error && (
                        <div className={styles.errorMessage}>
                          {statusMessage.error}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {["ready", "uploading"].includes(uploadStep) && (
                  <div className={styles.uploadBox}>
                    <h3 className={styles.uploadTitle}>Upload File or TAR</h3>
                    {statusMessage.step === "waiting_creation" ||
                    statusMessage.step === "waiting_usable" ? (
                      <div className={styles.waitingMessage}>
                        <div className={styles.spinner}></div>
                        <p>{statusMessage.message}</p>
                      </div>
                    ) : (
                      <div className={styles.uploadForm}>
                        <div className={styles.fileInputWrapper}>
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setSelectedFile(file);
                              setIsTarFile(
                                file?.name.toLowerCase().endsWith(".tar") ??
                                  false
                              );
                            }}
                            className={styles.fileInput}
                            disabled={uploadStep === "uploading"}
                            id="file-upload"
                          />
                          <label
                            htmlFor="file-upload"
                            className={styles.fileInputLabel}
                          >
                            {selectedFile ? selectedFile.name : "Choose file"}
                          </label>
                        </div>

                        {isTarFile && (
                          <div className={styles.checkboxWrapper}>
                            <input
                              type="checkbox"
                              id="webpage-upload"
                              checked={isWebpageUpload}
                              onChange={(e) =>
                                setIsWebpageUpload(e.target.checked)
                              }
                              className={styles.checkbox}
                              disabled={uploadStep === "uploading"}
                            />
                            <label
                              htmlFor="webpage-upload"
                              className={styles.checkboxLabel}
                            >
                              Upload as webpage
                            </label>
                          </div>
                        )}

                        <button
                          onClick={handleFileUpload}
                          disabled={!selectedFile || uploadStep === "uploading"}
                          className={styles.uploadButton}
                        >
                          {uploadStep === "uploading" ? (
                            <>
                              <div className={styles.smallSpinner}></div>
                              {statusMessage.step === "404"
                                ? "Searching for batch ID..."
                                : statusMessage.step === "422"
                                ? "Waiting for batch to be usable..."
                                : statusMessage.step === "Uploading"
                                ? `Uploading... ${uploadProgress.toFixed(1)}%`
                                : "Processing..."}
                            </>
                          ) : (
                            "Upload"
                          )}
                        </button>
                        {uploadStep === "uploading" && (
                          <div className={styles.progressBarContainer}>
                            <div
                              className={styles.progressBar}
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {uploadStep === "complete" && (
                  <div className={styles.successMessage}>
                    <div className={styles.successIcon}>✓</div>
                    <h3>Upload Successful!</h3>
                    <div className={styles.referenceBox}>
                      <p>Reference:</p>
                      <code>{statusMessage.reference}</code>
                      <a
                        href={`${BEE_GATEWAY_URL}${statusMessage.reference}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.referenceLink}
                      >
                        Open in Gateway
                      </a>
                    </div>
                    <button
                      className={styles.closeSuccessButton}
                      onClick={() => {
                        setShowOverlay(false);
                        setUploadStep("idle");
                        setStatusMessage({ step: "", message: "" });
                        setIsLoading(false);
                        setExecutionResult(null);
                        setSelectedFile(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : showHelp ? (
        <HelpSection
          nodeAddress={nodeAddress}
          beeApiUrl={beeApiUrl}
          setNodeAddress={setNodeAddress}
          setBeeApiUrl={setBeeApiUrl}
          setShowHelp={setShowHelp}
          isCustomNode={isCustomNode}
          setIsCustomNode={setIsCustomNode}
        />
      ) : showStampList ? (
        <StampListSection
          setShowStampList={setShowStampList}
          address={address}
          beeApiUrl={beeApiUrl}
          setPostageBatchId={setPostageBatchId}
          setShowOverlay={setShowOverlay}
          setUploadStep={setUploadStep}
          setSelectedStampTTL={setSelectedStampTTL}
        />
      ) : showUploadHistory ? (
        <UploadHistorySection
          address={address}
          setShowUploadHistory={setShowUploadHistory}
        />
      ) : null}
    </div>
  );
};

export default SwapComponent;
