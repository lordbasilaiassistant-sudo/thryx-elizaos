# @thryx/elizaos-plugin

ElizaOS plugin for **ThryxProtocol** — the AI Agent Launchpad on Base.

Launch tokens, buy, sell, check info, and claim creator fees — all from within an ElizaOS agent.

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
      "THRYX_PRIVATE_KEY": "0x..."
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

### Required Settings

| Setting | Description |
|---------|-------------|
| `THRYX_PRIVATE_KEY` | Private key for the wallet that will interact with ThryxProtocol |
| `EVM_PRIVATE_KEY` | Fallback if `THRYX_PRIVATE_KEY` is not set |

Only one of the above is required. The plugin checks `THRYX_PRIVATE_KEY` first.

## Actions

### THRYX_LAUNCH

Launch a new token on the bonding curve. Costs only gas (~$0.01 on Base).

```
"Launch Degen Cats with symbol DCAT"
"Create a token called Based AI Agent (BAIA)"
"Deploy a token named Moon Dog MDOG"
```

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
- **Network**: Base (chainId 8453)
- **Trade fee**: 0.5% (70% creator / 30% protocol)
- **Launch cost**: Gas only (~$0.01)
- **Slippage**: 10% default protection on all trades

## Advanced Usage

Import individual utilities for custom integrations:

```typescript
import {
  getProvider,
  getProtocol,
  getERC20,
  applySlippage,
  PROTOCOL_ADDRESS,
  THRYX_ADDRESS,
  PROTOCOL_ABI,
} from "@thryx/elizaos-plugin";
```

## Images

The plugin requires logo and banner images for the ElizaOS registry:
- `images/logo.jpg` — Square logo (recommended 400x400)
- `images/banner.jpg` — Banner image (recommended 1200x400)

## License

MIT
