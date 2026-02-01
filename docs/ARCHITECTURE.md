# OpenClaw Architecture Documentation

A comprehensive guide to understanding the OpenClaw codebase, its architecture, and deployment.

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Gateway Server](#gateway-server)
5. [Channel System](#channel-system)
6. [Agent System](#agent-system)
7. [Configuration System](#configuration-system)
8. [CLI Architecture](#cli-architecture)
9. [Plugin System](#plugin-system)
10. [Auto-Reply Pipeline](#auto-reply-pipeline)
11. [Technology Stack](#technology-stack)
12. [Data Storage](#data-storage)
13. [Deployment](#deployment)
14. [Development Workflow](#development-workflow)

---

## Overview

**OpenClaw** is a personal AI assistant that runs on your own devices and integrates with messaging platforms you already use. It's a locally-hosted, single-user AI agent that can interact via multiple messaging channels.

### Key Features

- **Multi-channel**: Single assistant answers on 15+ messaging platforms (WhatsApp, Telegram, Discord, Slack, Signal, iMessage, etc.)
- **Privacy-first**: Runs on user hardware; no cloud lock-in
- **Model-agnostic**: Supports Anthropic, OpenAI, Google, AWS Bedrock, and local models
- **Extensible**: Plugin system for channels, auth providers, tools, and skills
- **Cross-platform**: CLI (macOS/Linux/Windows WSL), native mobile apps (iOS/Android), macOS menubar app

### Design Principles

1. **Single-user design**: No multi-tenancy; config is per-machine/gateway
2. **Local-first**: Gateway runs on user's device; channels connect outbound
3. **Plugin-first channels**: All messaging integrations are extensible plugins
4. **Config-driven**: Behavior customizable via YAML without code changes
5. **Graceful degradation**: Channels can fail independently; gateway continues

---

## Project Structure

```
openclaw/
├── src/                    # Core source code
│   ├── cli/                # Command-line interface wiring
│   ├── commands/           # CLI command implementations
│   ├── gateway/            # WebSocket/HTTP server
│   ├── agents/             # Agent execution runtime
│   ├── channels/           # Channel plugin registry
│   ├── config/             # Configuration system
│   ├── auto-reply/         # Message routing & templates
│   ├── media/              # Media handling (audio, images, PDF)
│   ├── plugins/            # Plugin runtime system
│   ├── providers/          # Auth integrations (OAuth, API keys)
│   ├── routing/            # Session key resolution
│   ├── infra/              # Infrastructure utilities
│   ├── hooks/              # Webhook/automation hooks
│   ├── memory/             # Vector DB integration
│   ├── canvas-host/        # Live Canvas rendering
│   ├── daemon/             # Background service management
│   ├── telegram/           # Telegram channel implementation
│   ├── discord/            # Discord channel implementation
│   ├── slack/              # Slack channel implementation
│   ├── signal/             # Signal channel implementation
│   ├── imessage/           # iMessage channel implementation
│   ├── web/                # WhatsApp Web channel
│   └── plugin-sdk/         # SDK exports for plugins
│
├── apps/                   # Native applications
│   ├── macos/              # Swift/SwiftUI macOS app
│   ├── ios/                # Swift iOS app
│   └── android/            # Kotlin Android app
│
├── extensions/             # Channel & feature plugins
│   ├── discord/            # Discord plugin
│   ├── telegram/           # Telegram plugin
│   ├── msteams/            # Microsoft Teams plugin
│   ├── matrix/             # Matrix plugin
│   ├── zalo/               # Zalo plugin
│   ├── mattermost/         # Mattermost plugin
│   ├── voice-call/         # Voice call plugin
│   ├── memory-lancedb/     # LanceDB memory plugin
│   └── ...                 # Other extensions
│
├── skills/                 # Pre-built integrations (~30+)
│   ├── apple-notes/
│   ├── apple-reminders/
│   ├── 1password/
│   ├── github/
│   └── ...
│
├── ui/                     # Control UI (web interface)
├── docs/                   # Documentation (Mintlify)
├── scripts/                # Build & utility scripts
├── patches/                # pnpm patches for dependencies
└── dist/                   # Built output
```

---

## Core Components

### Entry Points

| File | Purpose |
|------|---------|
| `openclaw.mjs` | CLI bootstrap (handles NODE_OPTIONS respawning) |
| `src/entry.ts` | Main CLI program loader |
| `src/index.ts` | Main module export + public SDK |
| `src/cli/program/build-program.ts` | Commander program setup |
| `src/gateway/server.impl.ts` | Gateway server factory |

### Module Overview

| Module | Purpose |
|--------|---------|
| `cli/` | Command-line interface with 50+ commands |
| `gateway/` | WebSocket/HTTP server managing channels & agents |
| `agents/` | Agent execution with model failover & tools |
| `channels/` | Plugin registry for messaging adapters |
| `config/` | YAML-based configuration with validation |
| `auto-reply/` | Message routing, templates, command detection |
| `media/` | Audio, image, PDF handling |
| `plugins/` | Extensibility runtime |
| `providers/` | Auth integrations (OAuth, Anthropic, OpenAI, etc.) |

---

## Gateway Server

The gateway is the central hub of OpenClaw, implemented in `src/gateway/server.impl.ts`.

### Responsibilities

- **WebSocket Server**: Real-time communication with clients (CLI, mobile apps, web UI)
- **HTTP Server**: REST endpoints for hooks, OpenAI-compatible API, control UI
- **Channel Coordination**: Starts/stops messaging channel adapters
- **Agent Management**: Routes messages to AI agents, handles responses
- **Config Hot-Reload**: Watches config file and applies changes without restart
- **Discovery**: Bonjour/mDNS for local network discovery, Tailscale for remote

### HTTP Routes

The gateway HTTP server (`src/gateway/server-http.ts`) handles:

| Route | Purpose |
|-------|---------|
| `/` | Control UI (web interface) |
| `/hooks/*` | Webhook endpoints for automation |
| `/v1/chat/completions` | OpenAI-compatible API (optional) |
| `/v1/responses` | OpenResponses API (optional) |
| `/slack/*` | Slack event subscriptions |
| `/canvas/*` | Live Canvas hosting |
| Plugin routes | Custom routes from plugins |

### WebSocket Protocol

Clients connect via WebSocket and exchange JSON-RPC style messages:

```typescript
// Request
{ "method": "agent.run", "params": { "message": "Hello" }, "id": 1 }

// Response
{ "result": { "response": "Hi there!" }, "id": 1 }

// Event (server push)
{ "event": "agent.delta", "payload": { "text": "..." } }
```

### Starting the Gateway

```bash
# CLI command
openclaw gateway run --port 18789 --bind loopback

# Programmatic
import { startGatewayServer } from "./gateway/server.impl.js";
const server = await startGatewayServer(18789, { bind: "loopback" });
```

### Bind Modes

| Mode | Address | Use Case |
|------|---------|----------|
| `loopback` | 127.0.0.1 | Local-only access (default) |
| `lan` | 0.0.0.0 | LAN access, containers |
| `tailnet` | Tailscale IP | Remote access via Tailscale |
| `auto` | Prefer loopback | Fallback to LAN |

---

## Channel System

Channels are messaging platform integrations implemented as plugins.

### Channel Plugin Interface

Each channel implements these adapters (`src/channels/plugins/`):

```typescript
interface ChannelMessagingAdapter {
  sendMessage(target: string, message: Message): Promise<void>;
  onMessage(handler: MessageHandler): void;
}

interface ChannelSetupAdapter {
  authenticate(config: ChannelConfig): Promise<AuthResult>;
  disconnect(): Promise<void>;
}

interface ChannelOutboundAdapter {
  resolveTarget(query: string): Promise<Target | null>;
}

interface ChannelStatusAdapter {
  getStatus(): Promise<ChannelStatus>;
  probe(): Promise<ProbeResult>;
}

// Optional adapters
interface ChannelSecurityAdapter { /* DM/group policies */ }
interface ChannelThreadingAdapter { /* Thread support */ }
interface ChannelReactionsAdapter { /* Emoji reactions */ }
```

### Built-in Channels

| Channel | Location | Protocol |
|---------|----------|----------|
| Telegram | `src/telegram/` | Grammy bot API |
| WhatsApp | `src/web/` | Baileys (Web API) |
| Discord | `src/discord/` | Discord.js |
| Slack | `src/slack/` | Bolt SDK |
| Signal | `src/signal/` | signal-cli |
| iMessage | `src/imessage/` | AppleScript/sqlite |
| LINE | `src/channels/plugins/line/` | LINE Bot SDK |
| Google Chat | `src/channels/plugins/google-chat/` | Google API |

### Extension Channels

Located in `extensions/`:
- Microsoft Teams (`extensions/msteams/`)
- Matrix (`extensions/matrix/`)
- Zalo (`extensions/zalo/`)
- Mattermost (`extensions/mattermost/`)
- Nextcloud Talk (`extensions/nextcloud-talk/`)

### Channel Lifecycle

```
1. Gateway starts
2. Load channel configs from config.yaml
3. For each enabled channel:
   a. Load channel plugin
   b. Call setupAdapter.authenticate()
   c. Start message listener
   d. Register with channel manager
4. On message received:
   a. Route through auto-reply pipeline
   b. Send to agent if applicable
   c. Deliver response via messagingAdapter
```

---

## Agent System

The agent system (`src/agents/`) manages AI model interactions.

### Agent Runtime

```typescript
interface AgentRuntime {
  run(message: string, options: AgentOptions): AsyncIterable<AgentEvent>;
  abort(runId: string): void;
}

interface AgentOptions {
  sessionKey: string;
  model?: string;
  thinking?: "low" | "medium" | "high";
  tools?: Tool[];
  timeout?: number;
}
```

### Model Failover

Agents support multiple auth profiles with automatic failover:

```yaml
# config.yaml
agents:
  default:
    authProfiles:
      - provider: anthropic
        profile: pro
      - provider: openai
        profile: default
    failover:
      strategy: round-robin
      cooldownMs: 60000
```

### Auth Profiles

| Provider | Config Location | Authentication |
|----------|-----------------|----------------|
| Anthropic | `auth.anthropic.*` | API key |
| OpenAI | `auth.openai.*` | API key |
| Google | `auth.google.*` | OAuth / API key |
| AWS Bedrock | `auth.bedrock.*` | AWS credentials |
| Local (Ollama) | `auth.ollama.*` | None |

### Tool Execution

Agents can execute tools (bash, file operations, etc.):

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(params: unknown): Promise<ToolResult>;
}
```

Tool approval is managed by `ExecApprovalManager` for security.

### Thinking Modes

| Mode | Description |
|------|-------------|
| `low` | Fast responses, minimal reasoning |
| `medium` | Balanced (default) |
| `high` | Deep reasoning, slower |

---

## Configuration System

Configuration is YAML-based, stored at `~/.openclaw/config.yaml`.

### Config Schema

```yaml
# Gateway settings
gateway:
  bind: loopback          # loopback | lan | tailnet | auto
  port: 18789
  auth:
    enabled: true
    token: "your-secret-token"
  controlUi:
    enabled: true
    basePath: "/"
  tls:
    enabled: false
    cert: /path/to/cert.pem
    key: /path/to/key.pem

# Channel configurations
channels:
  telegram:
    enabled: true
    token: "bot-token"
  whatsapp:
    enabled: true
  discord:
    enabled: true
    token: "bot-token"

# Agent defaults
agents:
  default:
    model: claude-sonnet-4-20250514
    thinking: medium
    authProfiles:
      - provider: anthropic
        profile: default

# Session settings
session:
  scope: per-sender       # per-sender | per-group | global
  mainKey: "main"

# Auth profiles
auth:
  anthropic:
    default:
      apiKey: "sk-ant-..."
  openai:
    default:
      apiKey: "sk-..."

# Auto-reply rules
autoReply:
  enabled: true
  rules:
    - match: "^!help"
      response: "Available commands: ..."

# Hooks (webhooks)
hooks:
  enabled: true
  basePath: "/hooks"
  token: "webhook-secret"

# Cron jobs
cron:
  jobs:
    - name: daily-summary
      schedule: "0 9 * * *"
      action:
        type: agent
        message: "Generate daily summary"
```

### Config Loading

```typescript
// src/config/config.ts
import { loadConfig, writeConfigFile } from "./config/config.js";

const config = loadConfig();  // Reads and validates config.yaml
await writeConfigFile(newConfig);  // Writes with validation
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENCLAW_STATE_DIR` | Override state directory (default: `~/.openclaw`) |
| `OPENCLAW_WORKSPACE_DIR` | Override workspace directory |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway auth token |
| `OPENCLAW_GATEWAY_PORT` | Gateway port |
| `ANTHROPIC_API_KEY` | Anthropic API key (fallback) |
| `OPENAI_API_KEY` | OpenAI API key (fallback) |

### Config Validation

Config is validated using Zod schemas (`src/config/schema.ts`):

```typescript
const configSchema = z.object({
  gateway: gatewaySchema.optional(),
  channels: channelsSchema.optional(),
  agents: agentsSchema.optional(),
  // ...
});
```

---

## CLI Architecture

The CLI is built with Commander.js (`src/cli/`).

### Command Structure

```
openclaw
├── gateway
│   ├── run          # Start gateway server
│   └── status       # Show gateway status
├── agent
│   ├── run          # Run agent with message
│   └── list         # List agents
├── message
│   ├── send         # Send message to channel
│   └── list         # List recent messages
├── channels
│   ├── status       # Show channel status
│   ├── start        # Start a channel
│   └── stop         # Stop a channel
├── config
│   ├── get          # Get config value
│   ├── set          # Set config value
│   └── edit         # Open config in editor
├── onboard          # Interactive setup wizard
├── doctor           # Diagnose issues
├── status           # Overall status
└── ...              # 50+ more commands
```

### Command Registration

Commands are registered in `src/cli/program/command-registry.ts`:

```typescript
export const COMMAND_REGISTRY = [
  { name: "gateway", register: registerGatewayCommands },
  { name: "agent", register: registerAgentCommands },
  { name: "message", register: registerMessageCommands },
  // ...
];
```

### Dependency Injection

Commands receive dependencies via `createDefaultDeps()`:

```typescript
// src/cli/deps.ts
export function createDefaultDeps(): CliDeps {
  return {
    loadConfig,
    writeConfig,
    fetch: globalThis.fetch,
    // ...
  };
}
```

---

## Plugin System

Plugins extend OpenClaw functionality (`src/plugins/`).

### Plugin Structure

```
extensions/my-plugin/
├── package.json
├── src/
│   └── index.ts     # Plugin entry point
├── tsconfig.json
└── README.md
```

### Plugin Manifest

```json
{
  "name": "openclaw-plugin-example",
  "version": "1.0.0",
  "openclaw": {
    "type": "channel",
    "id": "my-channel"
  },
  "main": "dist/index.js"
}
```

### Plugin SDK

Plugins import from the SDK (`src/plugin-sdk/index.ts`):

```typescript
import {
  defineChannelPlugin,
  type ChannelMessagingAdapter,
  type ChannelConfig,
} from "openclaw/plugin-sdk";

export default defineChannelPlugin({
  id: "my-channel",
  name: "My Channel",

  createMessagingAdapter(config: ChannelConfig): ChannelMessagingAdapter {
    return {
      async sendMessage(target, message) { /* ... */ },
      onMessage(handler) { /* ... */ },
    };
  },
});
```

### Plugin Types

| Type | Purpose |
|------|---------|
| `channel` | Messaging platform integration |
| `auth` | Authentication provider |
| `tool` | Agent tool |
| `hook` | Webhook handler |
| `memory` | Memory/vector storage |

---

## Auto-Reply Pipeline

The auto-reply system (`src/auto-reply/`) processes incoming messages.

### Pipeline Stages

```
1. Message received from channel
2. Command detection (!status, !help, etc.)
3. Group activation check (is agent mentioned?)
4. Rate limiting / deduplication
5. Session key resolution
6. Agent invocation
7. Response templating
8. Delivery back to channel
```

### Command Detection

Built-in commands (`src/auto-reply/commands.ts`):

| Command | Purpose |
|---------|---------|
| `!status` | Show agent status |
| `!help` | Show help |
| `!compact` | Compact session history |
| `!clear` | Clear session |
| `!model` | Change model |
| `!thinking` | Change thinking mode |

### Thinking Directives

Inline directives in messages:

```
[thinking:high] Analyze this complex problem...
[model:claude-opus-4-5-20251101] Use Opus for this...
```

### Group Activation

Agents respond in groups when:
- Mentioned by name (`@assistant`)
- Reply to agent's message
- Matches activation pattern
- `groupActivation: always` in config

---

## Technology Stack

### Runtime

| Technology | Purpose |
|------------|---------|
| Node.js 22+ | Runtime (required) |
| TypeScript | Language (strict mode, ESM) |
| Bun | Optional dev runtime (faster) |

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `commander` | CLI framework |
| `express` | HTTP server (v5) |
| `ws` | WebSocket server |
| `zod` | Schema validation |
| `grammy` | Telegram bot API |
| `@whiskeysockets/baileys` | WhatsApp Web API |
| `@slack/bolt` | Slack bot framework |
| `sharp` | Image processing |
| `pdfjs-dist` | PDF parsing |
| `sqlite-vec` | Vector storage |
| `tslog` | Structured logging |

### Build Tools

| Tool | Purpose |
|------|---------|
| `tsc` | TypeScript compiler |
| `pnpm` | Package manager |
| `vitest` | Test framework |
| `oxlint` | Linter |
| `oxfmt` | Formatter |
| `rolldown` | Bundler (extensions) |

---

## Data Storage

### File Locations

| Path | Purpose |
|------|---------|
| `~/.openclaw/config.yaml` | Main configuration |
| `~/.openclaw/sessions/` | Session logs (JSONL) |
| `~/.openclaw/credentials/` | OAuth tokens, API keys |
| `~/.openclaw/media/` | Media cache |
| `~/.openclaw/agents/` | Per-agent data |

### Session Storage

Sessions are stored as JSONL files:

```
~/.openclaw/sessions/
├── main.jsonl           # Main session
├── telegram-123.jsonl   # Per-sender sessions
└── discord-456.jsonl
```

### Credentials

```
~/.openclaw/credentials/
├── anthropic.json
├── openai.json
├── google-oauth.json
└── ...
```

---

## Deployment

### Local Development

```bash
# Install dependencies
pnpm install

# Run in development
pnpm dev

# Or with gateway
pnpm gateway:dev
```

### Docker

```dockerfile
FROM node:22-bookworm

# Install pnpm
RUN corepack enable

WORKDIR /app

# Copy and install
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Start gateway
CMD ["node", "dist/index.js", "gateway", "run", "--port", "8080", "--bind", "lan"]
```

### Railway Deployment

**Required Settings:**

1. **Environment Variables:**
   ```
   PORT=8080
   OPENCLAW_STATE_DIR=/data/.openclaw
   OPENCLAW_WORKSPACE_DIR=/data/workspace
   OPENCLAW_GATEWAY_TOKEN=your-secret-token
   ```

2. **Start Command:**
   ```
   sh -c "mkdir -p /data/.openclaw /data/workspace && node dist/index.js gateway run --port 8080 --bind lan"
   ```

3. **Healthcheck Path:** `/`

4. **Volume:** Mount persistent storage at `/data` for session persistence.

### Environment Variables for Deployment

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Port for HTTP server |
| `OPENCLAW_GATEWAY_TOKEN` | Yes | Auth token for gateway |
| `OPENCLAW_STATE_DIR` | No | State directory path |
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key |

*At least one AI provider API key is required.

### Systemd Service

```ini
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/home/openclaw
ExecStart=/usr/bin/node /usr/lib/node_modules/openclaw/dist/index.js gateway run --port 18789 --bind loopback
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

---

## Development Workflow

### Commands

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Type check only
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format:fix

# Test
pnpm test

# Test with coverage
pnpm test:coverage

# Run CLI in dev mode
pnpm openclaw <command>

# Run gateway in dev mode
pnpm gateway:dev
```

### Testing

- **Framework:** Vitest with 70% coverage thresholds
- **Unit tests:** `*.test.ts` colocated with source
- **E2E tests:** `*.e2e.test.ts`
- **Live tests:** `LIVE=1 pnpm test:live`

### Pre-commit Hooks

```bash
# Install hooks
prek install

# Runs: lint, typecheck, test
```

### Commit Guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`, etc.
- Keep commits focused and atomic
- Reference issues/PRs in commit messages

---

## Troubleshooting

### Common Issues

**Gateway won't start:**
```bash
openclaw doctor  # Run diagnostics
```

**Channel disconnected:**
```bash
openclaw channels status --probe  # Check all channels
openclaw channels start telegram  # Restart specific channel
```

**Config validation errors:**
```bash
openclaw config validate  # Validate config.yaml
openclaw doctor          # Auto-fix common issues
```

### Logs

```bash
# Gateway logs (if running as service)
journalctl -u openclaw -f

# macOS logs
./scripts/clawlog.sh -f

# Debug mode
DEBUG=openclaw:* openclaw gateway run
```

### Health Check

```bash
# Check gateway health
curl http://localhost:18789/

# Check via CLI
openclaw status --all
```

---

## Further Reading

- [Configuration Reference](/configuration)
- [Channel Setup Guides](/channels)
- [Plugin Development](/plugins)
- [API Reference](/api)
- [Troubleshooting Guide](/troubleshooting)
