# Draw.io MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for programmatic diagram generation using [Draw.io](https://www.drawio.com/) (Diagrams.net). This server generates Draw.io XML directly — no browser extension or Draw.io instance required.

[![Build project](https://github.com/lgazo/drawio-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/lgazo/drawio-mcp-server/actions/workflows/ci.yml)

## Features

- **700+ Azure Architecture Icons** — Official Microsoft icons with embedded SVG data, organized into ~20 categories (Compute, Networking, Storage, Databases, AI + ML, Security, and more)
- **Basic Shapes** — Rectangles, ellipses, diamonds, parallelograms, and other flowchart primitives
- **Fuzzy Search** — Find shapes by partial name across the entire icon library
- **Batch Operations** — Create and update multiple cells in a single call for better performance
- **Layer Management** — Create, list, and organize cells across layers
- **Style Presets** — Built-in Azure, flowchart, and general color presets
- **Multiple Transports** — stdio (default) and streamable HTTP
- **XML Export** — Standard Draw.io XML format compatible with Draw.io desktop and web

## Requirements

- **Node.js** v24 or higher
- **pnpm** (recommended) or npm

## Quick Start

### Using npx

```sh
npx -y drawio-mcp-server
```

### MCP Client Configuration

Configure your MCP client (Claude Desktop, VS Code, Codex, etc.) to use the server:

<details>
<summary><b>Claude Desktop</b></summary>

Edit `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server"]
    }
  }
}
```
</details>

<details>
<summary><b>VS Code</b></summary>

Add to your VS Code settings or `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server"]
    }
  }
}
```
</details>

<details>
<summary><b>Zed</b></summary>

In the Assistant settings, add a Context Server:

```json
{
  "drawio": {
    "command": "npx",
    "args": ["-y", "drawio-mcp-server"],
    "env": {}
  }
}
```
</details>

<details>
<summary><b>Codex</b></summary>

Edit `~/.codex/config.toml`:

```toml
[mcp_servers.drawio]
command = "npx"
args = ["-y", "drawio-mcp-server"]
```

For a locally running HTTP transport:

```toml
[mcp_servers.drawio]
url = "http://localhost:8080/mcp"
```
</details>

<details>
<summary><b>oterm (Ollama)</b></summary>

Edit `~/.local/share/oterm/config.json`:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server"]
    }
  }
}
```
</details>

> **Tip**: Replace `npx` / `"-y"` with `pnpm` / `"dlx"` if you prefer pnpm.

## Configuration

### Transport Selection

The `--transport` flag controls which transports to start. Default is `stdio`.

| Flag | Description |
|---|---|
| `--transport stdio` | stdio only (default) |
| `--transport http` | HTTP only |
| `--transport stdio,http` | Both transports |

### HTTP Transport

The HTTP transport exposes a streamable HTTP endpoint at `/mcp` (default port 8080).

```sh
npx -y drawio-mcp-server --transport http --http-port 4000
```

MCP client configuration for HTTP:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--transport", "http", "--http-port", "4000"]
    }
  }
}
```

Health check: `curl http://localhost:8080/health`

### Docker

```sh
# Build
docker build -t drawio-mcp-server .

# Run (exposes HTTP on port 8080)
docker run -d --name drawio-mcp-server -p 8080:8080 drawio-mcp-server
```

#### Docker Compose

```sh
cp .env.example .env   # Configure REGISTRY and IMAGE_VERSION
docker compose up -d
```

The `.env` file supports:
- `REGISTRY` — Docker registry URL (e.g., `docker.io/myusername`)
- `IMAGE_VERSION` — Semantic version for image tags (e.g., `1.0.0`)

## Tools

> **Performance tip**: Prefer batch tools (`batch-add-cells`, `batch-add-cells-of-shape`, `batch-edit-cells`) and array parameters (`queries`, `cells`) over repeated single-call usage.

### Shape Discovery

| Tool | Description |
|---|---|
| `search-shapes` | Fuzzy search for shapes including 700+ Azure icons. Supports `queries` array for batch lookup. |
| `get-shape-categories` | List all shape categories (General, Flowchart, Azure categories). |
| `get-shapes-in-category` | List all shapes in a category by `category_id`. |
| `get-shape-by-name` | Get a specific shape by exact name. |
| `get-style-presets` | Get built-in style presets (Azure colors, flowchart shapes, edge styles). |

### Diagram Modification

| Tool | Description |
|---|---|
| `batch-add-cells` | Add multiple raw vertex and edge cells in one call. Supports `temp_id` for within-batch references. |
| `batch-add-cells-of-shape` | Add multiple shape-library cells (Azure icons, basic shapes) in one call. |
| `batch-edit-cells` | Update multiple vertex cells' properties in one call. |
| `add-cell-of-shape` | Add a vertex cell using a shape from the library. |
| `add-rectangle` | Add a rectangle vertex cell with custom position, size, text, and style. |
| `add-edge` | Create an edge (connection) between two vertex cells. |
| `set-cell-shape` | Apply a library shape's style to an existing cell. Supports `cells` array for batch updates. |
| `edit-cell` | Update a vertex cell's properties (position, size, text, style). |
| `edit-edge` | Update an edge's properties (text, source, target, style). |
| `delete-cell-by-id` | Remove a cell (vertex or edge) by ID. |

### Diagram Inspection

| Tool | Description |
|---|---|
| `list-paged-model` | Paginated view of all cells with filtering by type and attributes. |
| `get-diagram-stats` | Statistics about cell counts, bounds, and layer distribution. |
| `export-diagram` | Export the diagram as Draw.io XML. |
| `clear-diagram` | Clear all cells and reset the diagram. |

### Layer Management

| Tool | Description |
|---|---|
| `list-layers` | List all layers with IDs, names, and visibility. |
| `get-active-layer` | Get the currently active layer. |
| `set-active-layer` | Set the active layer for new elements. |
| `create-layer` | Create a new layer. |
| `move-cell-to-layer` | Move a cell to a different layer. |

### Batch Add Example

```json
{
  "cells": [
    { "type": "vertex", "temp_id": "web", "x": 100, "y": 100, "width": 60, "height": 60, "text": "Web", "style": "aspect=fixed;html=1;image;image=img/lib/azure2/compute/Container_Instances.svg;" },
    { "type": "vertex", "temp_id": "api", "x": 220, "y": 100, "width": 60, "height": 60, "text": "API", "style": "aspect=fixed;html=1;image;image=img/lib/azure2/compute/Container_Instances.svg;" },
    { "type": "edge", "source_id": "web", "target_id": "api", "text": "HTTPS" }
  ]
}
```

## Azure Icon Library

The server includes **700+ official Azure architecture icons** from [dwarfered/azure-architecture-icons-for-drawio](https://github.com/dwarfered/azure-architecture-icons-for-drawio), organized into categories:

| Category | Examples |
|---|---|
| AI + Machine Learning | Cognitive Services, Azure OpenAI, Bot Service, Machine Learning |
| Analytics | Synapse Analytics, Databricks, Data Factory, Event Hubs |
| App Services | App Service, Static Web Apps |
| Compute | Virtual Machines, Functions, AKS, Container Instances, Batch |
| Containers | Container Registry, Container Instances, AKS |
| Databases | SQL Database, Cosmos DB, Cache for Redis, PostgreSQL |
| DevOps | Azure DevOps, Pipelines, Repos |
| Identity | Azure AD, Key Vault |
| Integration | Service Bus, Logic Apps, API Management, Event Grid |
| Management + Governance | Monitor, Automation, Policy, Log Analytics |
| Networking | Front Door, Load Balancer, Application Gateway, VPN Gateway, Firewall |
| Security | Sentinel, Security Center |
| Storage | Storage Account, Blob Storage, File Storage, Disk Storage |

Icons use **embedded base64 SVG data** — no external dependencies, works fully offline with correct Azure branding and colors.

The library loads lazily on first access (singleton pattern). Search operations are <5ms after initial load.

## Development

### Setup

```sh
git clone https://github.com/lgazo/drawio-mcp-server.git
cd drawio-mcp-server
pnpm install
pnpm build
```

### Common Commands

| Command | Description |
|---|---|
| `pnpm build` | Clean build (removes `build/` first, then compiles) |
| `pnpm dev` | Watch mode — auto-rebuild on changes |
| `pnpm start` | Start with stdio transport |
| `pnpm start:http` | Start with HTTP transport |
| `pnpm start:both` | Start with both transports |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm lint` | Type-check without emitting |

### MCP Inspector

Use the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) to debug the server:

```sh
pnpm inspect
```

After rebuilding, **Restart** the Inspector. After changing tool definitions, **Clear** and **List** the tools again.

To enable Node.js debugging, set the Inspector arguments to `--inspect build/index.js` and connect via `chrome://inspect`.

## License

[MIT](LICENSE.md)
