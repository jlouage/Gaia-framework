---
name: figma-integration
version: '1.0'
requires_mcp: design-tool
applicable_agents: [typescript-dev, angular-dev, flutter-dev, java-dev, python-dev, mobile-dev]
test_scenarios:
  - scenario: Figma MCP server available and healthy
    expected: Mode selection (Generate/Import/Skip) presented to user
  - scenario: Figma MCP server not installed
    expected: Silent fallback to markdown-only, no error or warning
  - scenario: Figma MCP server not running
    expected: Silent fallback to markdown-only, no error or warning
  - scenario: Figma API token expired
    expected: Warning displayed, fallback to markdown-only
  - scenario: Rate limited (429)
    expected: Single retry after delay, fallback with warning if retry fails
  - scenario: Timeout exceeding 5 seconds
    expected: Fallback with warning, continue markdown-only
  - scenario: Design tool detection via MCP probe
    expected: Correct adapter selected based on available MCP tool prefix
  - scenario: Token extraction produces W3C DTCG format
    expected: design-tokens.json contains $type/$value structure with semantic aliases
  - scenario: Component spec extraction
    expected: component-specs.yaml contains typed props, abstract layout, and states
---

**DesignToolProvider Interface** — abstract interface for design tool integrations. Adapters implement these 5 operations:

| Operation | Description | Returns |
|-----------|-------------|---------|
| `detect()` | Probe MCP tools to identify available design tool | Adapter instance or null |
| `getTokens()` | Extract design tokens from the design file | W3C DTCG JSON (`design-tokens.json`) |
| `getComponents()` | Extract component specifications | YAML spec (`component-specs.yaml`) |
| `getFrames()` | Generate UI kit frames across viewports | Frame metadata for UI kit page |
| `exportAssets()` | Export images and icons at required densities | Asset files in `assets/` directory |

**Adapter Implementations:**
- **FigmaAdapter** (active) — wraps `figma_*` / `figma/` MCP tools (e.g., `figma/get_file`, `figma/get_styles`, `figma/get_components`). Detected when MCP tools matching prefix `figma` are available.
- **PenpotAdapter** (planned) — will wrap `penpot_*` MCP tools. Detected via `penpot_` prefix. Not yet implemented.
- **SketchAdapter** (planned) — will wrap `sketch_*` MCP tools. Detected via `sketch_` prefix. Not yet implemented.

**Selection logic:** probe MCP tool list for known prefixes in order: `figma_` / `figma/` → `penpot_` → `sketch_`. Use the first match. If none found, report "No design tool MCP server detected."

**MCP constraint (FR-140):** operations are read-heavy/write-light. Most interactions read design data (tokens, components, styles). Write operations are limited to frame generation and are clearly documented per section.

<!-- SECTION: detection -->
## Detection Probe

Detect Figma MCP server availability using a lightweight, read-only probe call.
This section is consumed by `/gaia-create-ux` at workflow start.

> **Security mandate:** NEVER persist Figma API tokens in any GAIA file — checkpoints, sidecars, logs, or artifacts. MCP auth is handled by the MCP server process; GAIA does not touch tokens.

> **Detection-only mandate:** GAIA MUST never install, configure, or modify the MCP server. Detection is read-only — probe for availability via `figma/get_user_info` or tool listing, nothing more.

### Probe Call

Use `figma/get_user_info` as the detection probe:
- Read-only, lightweight, validates both connectivity and token validity
- 5-second hard timeout (NFR-026 compliance)
- Zero added latency when MCP is not available (silent skip)

### Detection Flow

1. **Attempt probe:** call `figma/get_user_info` with a 5-second hard timeout
2. **On success:** set `figma_mcp_available = true`, proceed to mode selection
3. **On failure:** classify the failure and handle per the failure mode table below

### Failure Mode Handling

| Failure | Detection Signal | Behavior |
|---------|-----------------|----------|
| **Not installed** (AC5) | Tool not found / tool not available | Silent fallback to markdown-only mode — no error, no warning, no prompt |
| **Not running** (AC6) | Connection refused / connection error | Silent fallback to markdown-only mode — no error, no warning, no prompt |
| **Token expired** (AC7) | 401 or 403 response from `figma/get_user_info` | Warn: "Figma token expired — falling back to markdown" then continue markdown-only |
| **Rate limited** (AC8) | 429 response | Retry once after `Retry-After` header delay (default: 2 seconds). If retry also fails, warn and fallback to markdown-only |
| **Timeout** (AC9) | No response within 5-second hard timeout | Warn: "Figma MCP did not respond within 5 seconds — falling back to markdown" then continue markdown-only |
| **Malformed response** | Unexpected or partial data | Treat as unavailable — silent fallback to markdown-only |

### Mode Selection (on success)

When `figma_mcp_available == true`, present the user with:

```
Figma MCP detected. Select UX design mode:
  [g] Generate — AI-generated UX with Figma export
  [i] Import  — Import existing Figma designs into GAIA
  [s] Skip    — Proceed with markdown-only (ignore Figma)
```

### Minimum API Scopes

The Figma API token used by the MCP server requires these minimum scopes:

| Scope | Required For | Mode |
|-------|-------------|------|
| `files:read` | Reading design files, styles, components | Default (all modes) |
| `file_content:read` | Reading file content, nodes, images | Default (all modes) |
| `files:write` | Creating frames, writing to design files | Generate mode only |

Scope enforcement is the MCP server's responsibility — GAIA documents scope expectations only and does not validate or request token scopes.

### Error Sanitization Rules

All error messages from MCP operations MUST follow this safe error format:

```
Figma MCP error: {status_code} — {generic_description}. Falling back to markdown-only workflow.
```

**Disallowed content in error messages:** Figma file URLs, file keys, node IDs, design data, access tokens, or any dynamic content from the Figma API response.

| Status Code | Generic Description |
|-------------|-------------------|
| 401 | Authentication failed |
| 403 | Access denied |
| 404 | Resource not found |
| 429 | Rate limit exceeded — retry once, then fallback |
| 500 | Server error |

### Security Boundary

- The Figma API token lives exclusively in the MCP server configuration (ADR-024)
- GAIA files must NEVER contain or log Figma tokens, API keys, or credentials
- Detection probe interacts through MCP tool abstraction only — no direct HTTP calls

### Traceability

- FR-132: Figma MCP detection probe requirement
- FR-143: Graceful MCP failure handling
- NFR-026: MCP detection latency < 5 seconds
- ADR-024: Figma MCP integration via shared skill

<!-- SECTION: tokens -->
## Design Token Extraction

> **Security mandate:** MCP auth is handled by the MCP server — NEVER persist or reference Figma API tokens in extraction outputs, logs, or GAIA files.

Extract design tokens from the connected design tool and output in W3C DTCG format.

### Extraction Steps

1. **Fetch styles** — call `figma/get_styles` to retrieve all published styles (colors, typography, effects, grids)
2. **Map to W3C DTCG** — transform each style into the W3C Design Tokens Community Group draft format:
   ```json
   {
     "color": {
       "primary": { "$type": "color", "$value": "#3B82F6", "$description": "Brand primary" }
     },
     "spacing": {
       "sm": { "$type": "dimension", "$value": "8px" }
     },
     "typography": {
       "heading-1": {
         "$type": "typography",
         "$value": { "fontFamily": "Inter", "fontSize": "32px", "fontWeight": 700, "lineHeight": 1.2 }
       }
     }
   }
   ```
3. **Include semantic aliases** — map raw tokens to semantic names (e.g., `color.surface.primary` → `color.blue.500`)
4. **Add composite tokens** — typography composites, shadow composites, border-radius scales
5. **Write output** — save to `{planning_artifacts}/design-system/design-tokens.json` with `"schema_version": "1.0"`

<!-- SECTION: components -->
## Component Spec Extraction

> **Security mandate:** MCP auth is handled by the MCP server — NEVER include Figma API tokens in component specs, logs, or any GAIA output files.

Extract component specifications into a tech-agnostic intermediate format.

### Extraction Steps

1. **Fetch components** — call `figma/get_components` to list all published components and variants
2. **For each component**, extract:
   - **name** — component name (PascalCase)
   - **props** — typed properties: `{ name: string, type: "string"|"number"|"boolean"|"enum", values?: string[] }`
   - **layout** — abstract layout type: `row | column | stack | grid` with spacing via token references (`{spacing.sm}`)
   - **states** — `[default, hover, active, disabled, focus]` with visual diff per state
   - **children** — nested component references with slot definitions
   - **variants** — named variants with their property overrides
   - **responsive** — breakpoint behavior at 375px, 768px, 1280px
   - **a11y** — role, aria-label pattern, description, keyboard interaction
3. **Write output** — save to `{planning_artifacts}/design-system/component-specs.yaml` with `schema_version: "1.0"`

### Output Schema

```yaml
schema_version: "1.0"
components:
  - name: Button
    props:
      - { name: label, type: string }
      - { name: variant, type: enum, values: [primary, secondary, ghost] }
      - { name: disabled, type: boolean }
    layout: { type: row, gap: "{spacing.sm}" }
    states: [default, hover, active, disabled, focus]
    a11y: { role: button, label: "{props.label}" }
```

<!-- SECTION: frames -->
## Frame Generation

> **Security mandate:** MCP auth is handled by the MCP server — NEVER persist Figma API tokens in frame metadata, logs, or any GAIA output files.

Create UI kit frames in the design tool across standard viewports.

### Generation Steps

1. **Create UI Kit page** — create a dedicated page named "UI Kit — Generated" in the design file
2. **For each screen** defined in the UX design:
   - Create 3 viewport frames: mobile (375px), tablet (768px), desktop (1280px)
   - Apply auto-layout with responsive constraints from component specs
   - Place components using the extracted component specs and token values
3. **Add prototype flows** — link frames with interaction flows matching the UX navigation spec
4. **Label frames** — use naming convention: `{ScreenName}/{Viewport}` (e.g., `Dashboard/Desktop`)

### Output

Frame metadata logged for verification. No file output — frames are created directly in the design tool via MCP calls (`figma/create_frame`, `figma/create_component_instance`).

<!-- SECTION: assets -->
## Asset Export

> **Security mandate:** MCP auth is handled by the MCP server — NEVER include Figma API tokens in asset manifests, export logs, or any GAIA output files.

Export raster and vector assets from the design tool at required densities.

### Export Steps

1. **Identify exportable nodes** — scan the design file for nodes marked as exportable (icons, images, illustrations)
2. **Export icons** as SVG — call `figma/get_images` with `format: svg` for all icon nodes
3. **Export images** as PNG at 3 densities — call `figma/get_images` with `format: png` and `scale: 1`, `scale: 2`, `scale: 3` for image nodes
4. **Organize output** into directory structure:
   ```
   {planning_artifacts}/design-system/assets/
   ├── icons/          # SVG icons
   │   ├── icon-name.svg
   ├── images/         # PNG images at 1x/2x/3x
   │   ├── image-name@1x.png
   │   ├── image-name@2x.png
   │   └── image-name@3x.png
   ```
5. **Generate asset manifest** — list all exported assets with dimensions and file sizes

<!-- SECTION: export -->
## Per-Stack Token Resolution

> **Security mandate:** MCP auth is handled by the MCP server — NEVER embed Figma API tokens in generated token files, stack outputs, or any GAIA output files.

Maps abstract design tokens to framework-specific implementations. Each dev agent uses this table to generate native code from `design-tokens.json`.

| Agent | Stack | Token Format | Example |
|-------|-------|-------------|---------|
| Cleo | TypeScript/React | CSS custom properties | `--color-primary: #3B82F6;` in `:root {}` |
| Lena | Angular | SCSS variables + CSS custom properties | `$color-primary: #3B82F6;` in `_tokens.scss` |
| Freya | Flutter/Dart | ThemeData extensions | `ThemeData(primaryColor: Color(0xFF3B82F6))` |
| Hugo | Java/Spring | Spring properties + Java constants | `design.color.primary=#3B82F6` in `application.properties` |
| Ravi | Python | Python dict constants | `TOKENS = {"color": {"primary": "#3B82F6"}}` in `design_tokens.py` |
| Talia | Mobile (RN/Swift/Compose) | RN StyleSheet / Swift extensions / Compose theme | `StyleSheet.create({primary: '#3B82F6'})` or `extension UIColor { static let primary = UIColor(hex: "3B82F6") }` or `val Primary = Color(0xFF3B82F6)` |

### Resolution Process

1. Read `design-tokens.json` (W3C DTCG format) from `{planning_artifacts}/design-system/`
2. Read `component-specs.yaml` from the same directory for component definitions and widget hints
3. Identify the active dev agent's stack from the agent persona
4. For each token, generate the stack-native representation using the table above
5. For each component, use the `widget_hints` field to guide framework-specific widget/component tree generation
6. Output token files to the project's design system directory (stack-specific path)

### Token Path Resolution Rules

Token paths use `{group.token}` syntax. The resolution pattern per stack:

| Stack | Pattern | Example Path | Resolved Output |
|-------|---------|-------------|-----------------|
| TypeScript/React | `--{group}-{token}` | `{color.blue-500}` | `var(--color-blue-500)` |
| Angular | `${group}-{token}` | `{spacing.4}` | `$spacing-4` |
| Flutter/Dart | `AppTokens.{group}.{token}` | `{typography.body}` | `AppTokens.typography.body` |
| Java/Spring | `design.{group}.{token}` | `{color.interactive-primary}` | `design.color.interactive-primary` |
| Python | `TOKENS['{group}']['{token}']` | `{shadow.md}` | `TOKENS['shadow']['md']` |
| Mobile (RN) | `tokens.{group}.{token}` | `{borderRadius.md}` | `tokens.borderRadius.md` |
| Mobile (Swift) | `DesignTokens.{group}.{token}` | `{color.blue-500}` | `DesignTokens.color.blue500` |
| Mobile (Compose) | `AppTheme.{group}.{token}` | `{spacing.2}` | `AppTheme.spacing.s2` |

### Semantic Alias Resolution

Semantic tokens reference primitives via `{group.token}` syntax in their `$value` field. When generating stack-specific code, resolve the alias chain to produce the final value. Example:

```
"interactive-primary": { "$type": "color", "$value": "{color.blue-500}" }
→ resolves to → #3B82F6
→ CSS: --color-interactive-primary: #3B82F6;
→ SCSS: $color-interactive-primary: #3B82F6;
→ Dart: static const interactivePrimary = Color(0xFF3B82F6);
```
