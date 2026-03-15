import type { Plugin } from "@elizaos/core";

import { launchAction } from "./actions/launch.js";
import { buyAction } from "./actions/buy.js";
import { sellAction } from "./actions/sell.js";
import { infoAction } from "./actions/info.js";
import { claimAction } from "./actions/claim.js";
import { protocolProvider } from "./providers/protocol.js";

export const thryxPlugin: Plugin = {
  name: "@thryx/elizaos-plugin",
  description:
    "ThryxProtocol plugin for ElizaOS — launch, buy, sell tokens and claim fees on Base mainnet. The AI Agent Launchpad.",
  actions: [launchAction, buyAction, sellAction, infoAction, claimAction],
  providers: [protocolProvider],
};

// Default export for ElizaOS plugin loader
export default thryxPlugin;

// Named exports for direct imports
export { launchAction, buyAction, sellAction, infoAction, claimAction };
export { protocolProvider };

// Re-export constants and utils for advanced usage
export {
  CHAIN_ID,
  RPC_URL,
  PROTOCOL_ADDRESS,
  THRYX_ADDRESS,
  WETH_ADDRESS,
  PROTOCOL_ABI,
  ERC20_ABI,
  DEFAULT_SLIPPAGE_BPS,
} from "./constants.js";

export {
  getProvider,
  getWallet,
  getProtocol,
  getERC20,
  applySlippage,
  formatTokenAmount,
  parseTokenAmount,
  isValidAddress,
  shortAddress,
  shortHash,
} from "./utils.js";
