import { Action, Provider, IAgentRuntime, Plugin } from '@elizaos/core';
import { ethers } from 'ethers';

declare const launchAction: Action;

declare const buyAction: Action;

declare const sellAction: Action;

declare const infoAction: Action;

declare const claimAction: Action;

declare const protocolProvider: Provider;

/**
 * ThryxProtocol constants for Base mainnet
 */
declare const CHAIN_ID = 8453;
declare const RPC_URL = "https://mainnet.base.org";
declare const PROTOCOL_ADDRESS = "0x2F77b40c124645d25782CfBdfB1f54C1d76f2cCe";
declare const THRYX_ADDRESS = "0xc07E889e1816De2708BF718683e52150C20F3BA3";
declare const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
/** Cloudflare relay for gasless metaLaunch */
declare const RELAY_URL = "https://thryx-relay.thryx.workers.dev";
declare const PROTOCOL_ABI: string[];
/** EIP-712 domain for gasless metaLaunch signing */
declare const META_LAUNCH_DOMAIN: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
};
/** EIP-712 types for gasless metaLaunch signing */
declare const META_LAUNCH_TYPES: Record<string, Array<{
    name: string;
    type: string;
}>>;
declare const ERC20_ABI: string[];
/** Default slippage: 10% */
declare const DEFAULT_SLIPPAGE_BPS = 1000;

/**
 * Get a connected ethers provider for Base mainnet.
 */
declare function getProvider(): ethers.JsonRpcProvider;
/**
 * Get a connected wallet signer from runtime settings.
 */
declare function getWallet(runtime: IAgentRuntime): ethers.Wallet;
/**
 * Get a ThryxProtocol contract instance connected to a signer.
 */
declare function getProtocol(signer: ethers.Wallet): ethers.Contract;
/**
 * Get an ERC20 contract instance.
 */
declare function getERC20(address: string, signerOrProvider: ethers.Wallet | ethers.JsonRpcProvider): ethers.Contract;
/**
 * Calculate minimum output with slippage protection.
 * Default 10% slippage (1000 bps).
 */
declare function applySlippage(amount: bigint, slippageBps?: number): bigint;
/**
 * Format a bigint token amount to a human-readable string.
 */
declare function formatTokenAmount(amount: bigint, decimals?: number): string;
/**
 * Parse a human-readable amount to a bigint token amount.
 */
declare function parseTokenAmount(amount: string, decimals?: number): bigint;
/**
 * Validate an Ethereum address.
 */
declare function isValidAddress(address: string): boolean;
/**
 * Shorten an address for display: 0x1234...abcd
 */
declare function shortAddress(address: string): string;
/**
 * Shorten a tx hash for display: 0x1234...abcd
 */
declare function shortHash(hash: string): string;
/**
 * Get the on-chain metaNonce for gasless metaLaunch.
 */
declare function getMetaNonce(userAddress: string): Promise<bigint>;
/**
 * Sign EIP-712 typed data for a gasless metaLaunch.
 * Returns the signature components {v, r, s} and the message values.
 */
declare function signMetaLaunch(wallet: ethers.Wallet, name: string, symbol: string, deadlineSeconds?: number): Promise<{
    name: string;
    symbol: string;
    user: string;
    nonce: string;
    deadline: string;
    v: number;
    r: string;
    s: string;
}>;
/**
 * Submit a signed metaLaunch to the Cloudflare relay for gasless token deployment.
 * Returns the relay response (txHash, token address, etc).
 */
declare function submitMetaLaunch(payload: {
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
}>;

declare const thryxPlugin: Plugin;

export { CHAIN_ID, DEFAULT_SLIPPAGE_BPS, ERC20_ABI, META_LAUNCH_DOMAIN, META_LAUNCH_TYPES, PROTOCOL_ABI, PROTOCOL_ADDRESS, RELAY_URL, RPC_URL, THRYX_ADDRESS, WETH_ADDRESS, applySlippage, buyAction, claimAction, thryxPlugin as default, formatTokenAmount, getERC20, getMetaNonce, getProtocol, getProvider, getWallet, infoAction, isValidAddress, launchAction, parseTokenAmount, protocolProvider, sellAction, shortAddress, shortHash, signMetaLaunch, submitMetaLaunch, thryxPlugin };
