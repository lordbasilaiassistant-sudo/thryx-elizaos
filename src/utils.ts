import { ethers } from "ethers";
import type { IAgentRuntime } from "@elizaos/core";
import {
  CHAIN_ID,
  RPC_URL,
  PROTOCOL_ADDRESS,
  PROTOCOL_ABI,
  ERC20_ABI,
  DEFAULT_SLIPPAGE_BPS,
  META_LAUNCH_DOMAIN,
  META_LAUNCH_TYPES,
  RELAY_URL,
} from "./constants.js";

/**
 * Get the private key from runtime settings.
 * Checks PRIVATE_KEY first, then falls back to EVM_PRIVATE_KEY.
 */
export function getPrivateKey(runtime: IAgentRuntime): string {
  const key =
    runtime.getSetting("PRIVATE_KEY") ||
    runtime.getSetting("EVM_PRIVATE_KEY");
  if (!key || typeof key !== "string") {
    throw new Error(
      "No private key configured. Set PRIVATE_KEY or EVM_PRIVATE_KEY in your agent settings."
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

/**
 * Get the on-chain metaNonce for gasless metaLaunch.
 */
export async function getMetaNonce(userAddress: string): Promise<bigint> {
  const provider = getProvider();
  const protocol = new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, provider);
  return protocol.metaNonce(userAddress);
}

/**
 * Sign EIP-712 typed data for a gasless metaLaunch.
 * Returns the signature components {v, r, s} and the message values.
 */
export async function signMetaLaunch(
  wallet: ethers.Wallet,
  name: string,
  symbol: string,
  deadlineSeconds: number = 300
): Promise<{
  name: string;
  symbol: string;
  user: string;
  nonce: string;
  deadline: string;
  v: number;
  r: string;
  s: string;
}> {
  const nonce = await getMetaNonce(wallet.address);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  const message = {
    name,
    symbol,
    user: wallet.address,
    nonce,
    deadline,
  };

  const sig = await wallet.signTypedData(
    META_LAUNCH_DOMAIN,
    META_LAUNCH_TYPES,
    message
  );
  const { v, r, s } = ethers.Signature.from(sig);

  return {
    name,
    symbol,
    user: wallet.address,
    nonce: nonce.toString(),
    deadline: deadline.toString(),
    v,
    r,
    s,
  };
}

/**
 * Submit a signed metaLaunch to the Cloudflare relay for gasless token deployment.
 * Returns the relay response (txHash, token address, etc).
 */
export async function submitMetaLaunch(payload: {
  name: string;
  symbol: string;
  user: string;
  deadline: string;
  v: number;
  r: string;
  s: string;
}): Promise<{
  success: boolean;
  txHash?: string;
  token?: string;
  error?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(`${RELAY_URL}/relay/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error || data.message || `Relay returned ${res.status}`,
      };
    }

    return {
      success: true,
      txHash: data.txHash || data.hash,
      token: data.token || data.tokenAddress,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) {
      return { success: false, error: "Relay request timed out (60s)" };
    }
    return { success: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}
