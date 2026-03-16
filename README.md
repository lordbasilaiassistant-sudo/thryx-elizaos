# @thryx/elizaos-plugin

ElizaOS plugin for **ThryxProtocol** — the AI Agent Launchpad on Base.

Launch tokens (gaslessly!), buy, sell, check info, and claim creator fees — all from within an ElizaOS agent.

## Install

```bash
npm install @thryx/elizaos-plugin
```

## Setup

Add the plugin to your ElizaOS agent character config:

```json
{
  "name": "MyAgent",
  "plugins": ["@thryx/elizaos-plugin"],
  "settings": {
    "secrets": {
      "PRIVATE_KEY": "0x..."
    }
  }
}
```

Or register it programmatically:

```typescript
import { thryxPlugin } from "@thryx/elizaos-plugin";

// In your agent setup
await runtime.registerPlugin(thryxPlugin);
```

### Settings

| Setting | Required | Description |
|---------|----------|-------------|
| `PRIVATE_KEY` | For write actions | Your wallet's private key. Gasless launches sign with your key but need no ETH — relay pays gas. Read-only actions work without it. |
| `EVM_PRIVATE_KEY` | Fallback | Used if `PRIVATE_KEY` is not set |

The plugin checks `PRIVATE_KEY` first, then falls back to `EVM_PRIVATE_KEY`.

## Actions

### THRYX_LAUNCH

Launch a new token on the bonding curve. **Gasless by default** — the relay pays for gas via EIP-712 meta-transactions. Falls back to direct on-chain launch (~$0.01 gas on Base) if the relay is unavailable.

```
"Launch Degen Cats with symbol DCAT"
"Create a token called Based AI Agent (BAIA)"
"Deploy a token named Moon Dog MDOG"
```

How gasless launch works:
1. Your agent signs an EIP-712 typed message off-chain (no gas spent)
2. The signature is submitted to the ThryxProtocol relay at `https://thryx-relay.thryx.workers.dev`
3. The relay submits the `metaLaunch` transaction on-chain, paying gas from the protocol paymaster
4. Your token is deployed and live on the bonding curve — zero cost to you

If the relay is down or rejects the request, the plugin automatically falls back to a direct `launch()` call (costs ~$0.01 gas on Base).

### THRYX_BUY

Buy tokens using ETH or THRYX. 10% slippage protection included.

```
"Buy 0.01 ETH worth of 0x1234...abcd"
"Buy 100 THRYX worth of 0x1234...abcd"
```

### THRYX_SELL

Sell tokens for THRYX. 10% slippage protection included.

```
"Sell all of 0x1234...abcd"
"Sell 500000 of token 0x1234...abcd"
```

### THRYX_INFO

Get bonding curve info for any token (read-only, no wallet needed).

```
"Get info on token 0x1234...abcd"
"Check token 0x1234...abcd"
```

### THRYX_CLAIM

Claim accumulated creator fees for tokens you deployed.

```
"Claim fees for 0x1234...abcd"
"Collect creator fees for 0x1234...abcd"
```

## Provider

### THRYX_PROTOCOL

Automatically provides ThryxProtocol stats as agent context:
- Total tokens launched and graduated
- Lifetime fees collected
- THRYX and ETH reserves
- Current ETH/THRYX rate

This context helps the agent make informed decisions about the protocol.

## Protocol Details

- **Contract**: `0x2F77b40c124645d25782CfBdfB1f54C1d76f2cCe` (Base mainnet, v2.4 Diamond)
- **THRYX token**: `0xc07E889e1816De2708BF718683e52150C20F3BA3`
- **Relay**: `https://thryx-relay.thryx.workers.dev` (gasless meta-launch)
- **Network**: Base (chainId 8453)
- **Trade fee**: 0.5% (70% creator / 30% protocol)
- **Launch cost**: Free via relay, or gas only (~$0.01) for direct launch

## Advanced Usage

Import individual utilities for custom integrations:

```typescript
import {
  // Core helpers
  getProvider,
  getProtocol,
  getERC20,
  applySlippage,
  // Gasless launch helpers
  signMetaLaunch,
  submitMetaLaunch,
  getMetaNonce,
  // Constants
  PROTOCOL_ADDRESS,
  THRYX_ADDRESS,
  RELAY_URL,
  PROTOCOL_ABI,
  META_LAUNCH_DOMAIN,
  META_LAUNCH_TYPES,
} from "@thryx/elizaos-plugin";
```

### Gasless Launch (standalone usage)

```typescript
import { ethers } from "ethers";
import { signMetaLaunch, submitMetaLaunch, RELAY_URL } from "@thryx/elizaos-plugin";

const wallet = new ethers.Wallet("0x...", new ethers.JsonRpcProvider("https://mainnet.base.org"));

// Sign EIP-712 typed data off-chain
const signed = await signMetaLaunch(wallet, "My Token", "MTK", 300);

// Submit to relay (zero gas cost)
const result = await submitMetaLaunch({
  name: signed.name,
  symbol: signed.symbol,
  user: signed.user,
  deadline: signed.deadline,
  v: signed.v,
  r: signed.r,
  s: signed.s,
});

console.log(result); // { success: true, txHash: "0x...", token: "0x..." }
```

## Images

The plugin requires logo and banner images for the ElizaOS registry:
- `images/logo.jpg` — Square logo (recommended 400x400)
- `images/banner.jpg` — Banner image (recommended 1200x400)

## License

MIT
