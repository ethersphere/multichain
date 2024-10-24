"use client";

import { createWeb3Modal, defaultConfig } from "@web3modal/ethers/react";
const projectId = "247742c461bf62a2ec613859bc84a937";

/// Chains
const Sepolia = {
  chainId: 11155111,
  name: "Sepolia",
  currency: "SepoliaETH",
  explorerUrl: "https://sepolia.etherscan.io/",
  rpcUrl: "https://sepolia.infura.io/v3/d80826b52dc64616b60d3e45082332f9",
};

const Gnosis = {
  chainId: 100,
  name: "Gnosis",
  currency: "xDai",
  explorerUrl: "https://gnosisscan.io/",
  rpcUrl: "https://rpc.gnosischain.com",
};

//Create a metadata object
const metadata = {
  name: "My Website",
  description: "My Website description",
  url: "https://mywebsite.com", // origin must match your domain & subdomain
  icons: ["https://avatars.mywebsite.com/"],
};
// Create Ethers config
const ethersConfig = defaultConfig({
  /*Required*/
  metadata,

  /*Optional*/
  enableEIP6963: true, // true by default
  enableInjected: true, // true by default
  enableCoinbase: true, // true by default
  rpcUrl: "...", // used for the Coinbase SDK
  defaultChainId: 1, // used for the Coinbase SDK
});

// Create a AppKit instance
createWeb3Modal({
  ethersConfig,
  chains: [Gnosis, Sepolia],
  defaultChain: Sepolia,
  projectId,
  enableAnalytics: true, // Optional - defaults to your Cloud configuration
});

export function AppKit({ children }: { children: React.ReactNode }) {
  return children;
}
