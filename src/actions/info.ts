import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionExample,
} from "@elizaos/core";
import { ethers } from "ethers";
import {
  getProvider,
  getERC20,
  shortAddress,
  isValidAddress,
  formatTokenAmount,
} from "../utils.js";
import { PROTOCOL_ADDRESS, PROTOCOL_ABI } from "../constants.js";

const examples: ActionExample[][] = [
  [
    {
      name: "user",
      content: {
        text: "Get info on token 0x1234567890abcdef1234567890abcdef12345678",
      },
    },
    {
      name: "agent",
      content: {
        text: "Fetching curve info for 0x1234...5678...\n\nToken: DCAT\nDeployer: 0xabcd...efgh\nSpot price: 0.000001 THRYX\nProgress: 15.5%\nRaised: 155 THRYX / 1000 threshold\nTokens sold: 155M / 800M available\nGraduated: No",
        actions: ["THRYX_INFO"],
      },
    },
  ],
];

export const infoAction: Action = {
  name: "THRYX_INFO",
  description:
    "Get bonding curve info for a token on ThryxProtocol. Shows price, progress, liquidity raised, and graduation status.",
  similes: [
    "TOKEN_INFO",
    "THRYX_TOKEN_INFO",
    "GET_TOKEN_INFO",
    "CHECK_TOKEN",
    "TOKEN_STATUS",
    "CURVE_INFO",
  ],
  examples,

  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory
  ): Promise<boolean> => {
    // Info is read-only, no private key needed
    return true;
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    const text = (message.content.text as string) || "";

    // Extract token address
    const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
    const tokenAddress = addrMatch ? addrMatch[0] : null;

    if (!tokenAddress || !isValidAddress(tokenAddress)) {
      if (callback) {
        await callback({
          text: "I need a valid token address. Try:\n- \"Get info on 0x1234...abcd\"\n- \"Check token 0x1234...abcd\"",
        });
      }
      return { success: false, error: "No valid token address found" };
    }

    try {
      const provider = getProvider();
      const protocol = new ethers.Contract(
        PROTOCOL_ADDRESS,
        PROTOCOL_ABI,
        provider
      );

      const curveInfo = await protocol.getCurveInfo(tokenAddress);
      const [
        deployer,
        spotPrice,
        raised,
        threshold,
        progressBps,
        tokensSold,
        tokensAvailable,
        graduated,
        aeroPool,
        creatorFees,
        protocolFees,
      ] = curveInfo;

      // Try to get symbol
      let symbol = "UNKNOWN";
      try {
        const token = getERC20(tokenAddress, provider);
        symbol = await token.symbol();
      } catch {
        // Can't read symbol
      }

      const progressPct = (Number(progressBps) / 100).toFixed(1);

      const result = {
        success: true,
        token: tokenAddress,
        symbol,
        deployer: deployer as string,
        spotPrice: formatTokenAmount(spotPrice),
        raised: formatTokenAmount(raised),
        threshold: formatTokenAmount(threshold),
        progressPercent: progressPct,
        tokensSold: formatTokenAmount(tokensSold),
        tokensAvailable: formatTokenAmount(tokensAvailable),
        graduated: graduated as boolean,
        aeroPool: aeroPool as string,
        creatorFees: formatTokenAmount(creatorFees),
        protocolFees: formatTokenAmount(protocolFees),
      };

      if (callback) {
        const poolLine = graduated
          ? `Aerodrome pool: \`${shortAddress(aeroPool as string)}\``
          : "Not yet graduated";

        await callback({
          text: [
            `**${symbol}** — ${shortAddress(tokenAddress)}`,
            "",
            `Deployer: \`${shortAddress(deployer as string)}\``,
            `Spot price: ${formatTokenAmount(spotPrice)} THRYX`,
            `Progress: ${progressPct}% (${formatTokenAmount(raised)} / ${formatTokenAmount(threshold)} THRYX)`,
            `Tokens sold: ${formatTokenAmount(tokensSold)}`,
            `Tokens available: ${formatTokenAmount(tokensAvailable)}`,
            `Graduated: ${graduated ? "Yes" : "No"}`,
            poolLine,
            `Creator fees: ${formatTokenAmount(creatorFees)} THRYX`,
            `Protocol fees: ${formatTokenAmount(protocolFees)} THRYX`,
          ].join("\n"),
        });
      }

      return result;
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : String(error);

      if (callback) {
        await callback({
          text: `Failed to get token info: ${errMsg}`,
        });
      }
      return { success: false, error: errMsg };
    }
  },
};
