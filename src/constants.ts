/**
 * ThryxProtocol constants for Base mainnet
 */

export const CHAIN_ID = 8453;
export const RPC_URL = "https://mainnet.base.org";

export const PROTOCOL_ADDRESS = "0x2F77b40c124645d25782CfBdfB1f54C1d76f2cCe";
export const THRYX_ADDRESS = "0xc07E889e1816De2708BF718683e52150C20F3BA3";
export const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

export const PROTOCOL_ABI = [
  "function launch(string name, string symbol) external returns (address)",
  "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut) external payable returns (uint256)",
  "function estimateSwap(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)",
  "function getCurveInfo(address token) external view returns (address deployer, uint256 spotPrice, uint256 raised, uint256 threshold, uint256 progressBps, uint256 tokensSold, uint256 tokensAvailable, bool graduated, address aeroPool, uint256 creatorFees, uint256 protocolFees)",
  "function getProtocolStats() external view returns (uint256 launched, uint256 graduated, uint256 lifetimeFees, uint256 thryxReserves, uint256 ethReserves, uint256 ethRate)",
  "function claimCreatorFees(address token) external returns (uint256)",
];

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

/** Default slippage: 10% */
export const DEFAULT_SLIPPAGE_BPS = 1000;
