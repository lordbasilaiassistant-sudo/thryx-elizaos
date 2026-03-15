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
declare const PROTOCOL_ABI: string[];
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

declare const thryxPlugin: Plugin;

export { CHAIN_ID, DEFAULT_SLIPPAGE_BPS, ERC20_ABI, PROTOCOL_ABI, PROTOCOL_ADDRESS, RPC_URL, THRYX_ADDRESS, WETH_ADDRESS, applySlippage, buyAction, claimAction, thryxPlugin as default, formatTokenAmount, getERC20, getProtocol, getProvider, getWallet, infoAction, isValidAddress, launchAction, parseTokenAmount, protocolProvider, sellAction, shortAddress, shortHash, thryxPlugin };
