import { ethers } from "ethers";
import type { IAgentRuntime } from "@elizaos/core";
import {
  CHAIN_ID,
  RPC_URL,
  PROTOCOL_ADDRESS,
  PROTOCOL_ABI,
  ERC20_ABI,
  DEFAULT_SLIPPAGE_BPS,
} from "./constants.js";

/**
 * Get the private key from runtime settings.
 * Checks THRYX_PRIVATE_KEY first, then falls back to EVM_PRIVATE_KEY.
 */
export function getPrivateKey(runtime: IAgentRuntime): string {
  const key =
    runtime.getSetting("THRYX_PRIVATE_KEY") ||
    runtime.getSetting("EVM_PRIVATE_KEY");
  if (!key || typeof key !== "string") {
    throw new Error(
      "No private key configured. Set THRYX_PRIVATE_KEY or EVM_PRIVATE_KEY in your agent settings."
    );
  }
  return key;
}

/**
 * Get a connected ethers provider for Base mainnet.
 */
export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, {
    staticNetwork: true,
  });
}

/**
 * Get a connected wallet signer from runtime settings.
 */
export function getWallet(runtime: IAgentRuntime): ethers.Wallet {
  const key = getPrivateKey(runtime);
  const provider = getProvider();
  return new ethers.Wallet(key, provider);
}

/**
 * Get a ThryxProtocol contract instance connected to a signer.
 */
export function getProtocol(signer: ethers.Wallet): ethers.Contract {
  return new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, signer);
}

/**
 * Get an ERC20 contract instance.
 */
export function getERC20(
  address: string,
  signerOrProvider: ethers.Wallet | ethers.JsonRpcProvider
): ethers.Contract {
  return new ethers.Contract(address, ERC20_ABI, signerOrProvider);
}

/**
 * Calculate minimum output with slippage protection.
 * Default 10% slippage (1000 bps).
 */
export function applySlippage(
  amount: bigint,
  slippageBps: number = DEFAULT_SLIPPAGE_BPS
): bigint {
  return (amount * BigInt(10000 - slippageBps)) / BigInt(10000);
}

/**
 * Format a bigint token amount to a human-readable string.
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number = 18
): string {
  return ethers.formatUnits(amount, decimals);
}

/**
 * Parse a human-readable amount to a bigint token amount.
 */
export function parseTokenAmount(
  amount: string,
  decimals: number = 18
): bigint {
  return ethers.parseUnits(amount, decimals);
}

/**
 * Extract text content from message, handling various formats.
 */
export function extractMessageText(
  content: Record<string, unknown>
): string {
  return (typeof content.text === "string" ? content.text : "").trim();
}

/**
 * Validate an Ethereum address.
 */
export function isValidAddress(address: string): boolean {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shorten an address for display: 0x1234...abcd
 */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Shorten a tx hash for display: 0x1234...abcd
 */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-4)}`;
}
