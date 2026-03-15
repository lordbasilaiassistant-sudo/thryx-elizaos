import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import { ethers } from "ethers";
import { getProvider, formatTokenAmount } from "../utils.js";
import { PROTOCOL_ADDRESS, PROTOCOL_ABI } from "../constants.js";

export const protocolProvider: Provider = {
  name: "THRYX_PROTOCOL",
  description:
    "Provides ThryxProtocol stats (tokens launched, graduated, fees, reserves) as context for the agent.",

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<ProviderResult> => {
    try {
      const provider = getProvider();
      const protocol = new ethers.Contract(
        PROTOCOL_ADDRESS,
        PROTOCOL_ABI,
        provider
      );

      const stats = await protocol.getProtocolStats();
      const [launched, graduated, lifetimeFees, thryxReserves, ethReserves, ethRate] = stats;

      const data = {
        launched: Number(launched),
        graduated: Number(graduated),
        lifetimeFees: formatTokenAmount(lifetimeFees),
        thryxReserves: formatTokenAmount(thryxReserves),
        ethReserves: formatTokenAmount(ethReserves),
        ethRate: formatTokenAmount(ethRate),
        contract: PROTOCOL_ADDRESS,
        network: "Base mainnet",
        chainId: 8453,
        fee: "0.5%",
        feeSplit: "70% creator / 30% protocol",
      };

      const text = [
        "ThryxProtocol v2.3 (Base mainnet)",
        `Contract: ${PROTOCOL_ADDRESS}`,
        `Tokens launched: ${data.launched}`,
        `Tokens graduated: ${data.graduated}`,
        `Lifetime fees: ${data.lifetimeFees} THRYX`,
        `THRYX reserves: ${data.thryxReserves}`,
        `ETH reserves: ${data.ethReserves}`,
        `ETH/THRYX rate: ${data.ethRate}`,
        `Trade fee: 0.5% (70% creator / 30% protocol)`,
        `Launch cost: gas only (~$0.01 on Base)`,
      ].join("\n");

      return { text, data, values: data as unknown as Record<string, unknown> };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        text: `ThryxProtocol stats unavailable: ${errMsg}`,
        data: { error: errMsg },
      };
    }
  },
};
