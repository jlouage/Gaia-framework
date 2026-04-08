# Figma Integration Skill

> Shared skill for Figma MCP integration. Sectioned loading — load only the sections needed.
> Architecture: ADR-024 (Section 10.17)

<!-- SECTION: detection -->

## 1. Detection

MCP availability probe — detect Figma MCP server at runtime.

- Probe via short-lived `figma_get_file` call with timeout (3 seconds)
- Mode selection: Generate (full MCP) / Import (file-based) / Skip (manual)
- If MCP unavailable: graceful fallback to ux-design.md text
- Consumer: `/gaia-create-ux`

<!-- /SECTION: detection -->

<!-- SECTION: tokens -->

## 2. Design Token Extraction

Extract design tokens from Figma via MCP and write W3C DTCG format.

- Call `figma_get_styles` to retrieve color, typography, spacing, border styles
- Transform to W3C DTCG draft specification format
- Output: `{planning_artifacts}/design-system/design-tokens.json`
- Cache responses in `{project-path}/.figma-cache/` (1-hour TTL)
- Consumer: all dev agents

<!-- /SECTION: tokens -->

<!-- SECTION: components -->

## 3. Component Spec Extraction

Extract component specifications from Figma and write tech-agnostic YAML.

- Call `figma_get_components` to retrieve component metadata
- Transform to intermediate `component-specs.yaml` format
- Include: typed props, layout, spacing, token refs, states, variants, responsive breakpoints, a11y metadata
- Output: `{planning_artifacts}/design-system/component-specs.yaml`
- Consumer: all dev agents

<!-- /SECTION: components -->

<!-- SECTION: frames -->

## 4. Frame Generation

Generate UI Kit and screen frames in Figma (Generate mode only).

- Create frames using `figma_create_frame` MCP tool
- Record node IDs in ux-design.md for traceability
- Consumer: `/gaia-create-ux` (Generate mode)

<!-- /SECTION: frames -->

<!-- SECTION: assets -->

## 5. Asset Export

Export icons, images, and multi-density assets from Figma.

- Call `figma_export_assets` for each asset node
- Support multi-density export (1x, 2x, 3x for mobile)
- Output: `{planning_artifacts}/design-system/assets/`
- Consumer: all dev agents, mobile agents

<!-- /SECTION: assets -->

<!-- SECTION: export -->

## 6. Per-Stack Token Resolution

Per-platform token resolution tables for stack-specific code generation.

- CSS custom properties: `var(--{token-path})` (Cleo / TypeScript)
- SCSS variables: `${token-path}` (Lena / Angular)
- ThemeData extensions: `Theme.of(context).extension<DesignTokens>()` (Freya / Flutter)
- Spring application properties: `design.tokens.{token-path}` (Hugo / Java)
- Python dict theme: `DESIGN_TOKENS["{token-path}"]` (Ravi / Python)
- React Native StyleSheet / Swift / Compose mappings (Talia / Mobile)
- Consumer: individual dev agents via `figma-integration:export`

<!-- /SECTION: export -->

<!-- SECTION: fidelity -->

## 7. Design-to-Implementation Fidelity Gate

Post-implementation verification layer that compares token values in generated code
against the approved `design-tokens.json` to detect and measure drift between design
intent and implementation. Addresses FR-171 and ADR-024 (Section 10.17).

### 7.1 Token Extraction from Generated Code

Scan generated code files for token references using platform-specific patterns:

- **CSS custom properties:** `var(--color-primary-500)` maps to `color.primary.500`
- **SCSS variables:** `$color-primary-500` maps to `color.primary.500`
- **ThemeData references:** `theme.colorPrimary500` maps to `color.primary.500`
- **Spring properties:** `design.tokens.color.primary.500`
- **Python dict:** `DESIGN_TOKENS["color.primary.500"]`
- **React Native / Swift / Compose:** platform-specific mappings

Use the per-platform token resolution tables from `component-specs.yaml` (Section 10.17.5)
to reverse-map platform-specific references back to canonical W3C DTCG paths before comparison.

### 7.2 Deep Comparison Engine

For each token reference extracted from code:

1. Look up the canonical W3C DTCG path in `{planning_artifacts}/design-system/design-tokens.json`
2. Compare the value used in code against the approved value in design-tokens.json
3. Classify each token as:
   - **matched** — value in code exactly matches design-tokens.json
   - **drifted** — token exists in design-tokens.json but value differs
   - **missing** — token referenced in code but absent from design-tokens.json

### 7.3 Per-Category Drift Reporting

Group all compared tokens by W3C DTCG top-level category:

- `color.*` — color palette, semantic colors, surface colors
- `typography.*` — font families, sizes, weights, line heights
- `spacing.*` — margins, paddings, gaps
- `border.*` / `radius.*` — border widths, styles, border-radius values

Calculate drift percentage per category using the formula:

```
drift_pct = (drifted + missing) / total x 100
```

Generate a structured fidelity report with a per-category breakdown table:

| Category | Total | Matched | Drifted | Missing | Drift % | Status |
|----------|-------|---------|---------|---------|---------|--------|
| color.*  | 20    | 18      | 1       | 1       | 10%     | WARN   |

### 7.4 Threshold-Based Gating

Two configurable thresholds (defaults from FR-171):

- **10% WARNING** — drift exceeds 10% in any category: raise a WARNING. Story may continue but issue is flagged.
- **25% BLOCK** — drift exceeds 25% in any category: story completion is BLOCKED and re-review is required.

**Edge case handling:**

- **Empty categories** — if a category has zero tokens referenced, skip it (do not report 0/0 as drift)
- **N=1 single-token categories** — if a category has only one token and it is drifted, flag with a note "Single-token category — flagged but not auto-blocked (N=1 exception)" instead of blocking. The N=1 exception prevents a single mismatched border-radius from blocking an entire story.
- **Missing design-tokens.json** — if `design-tokens.json` does not exist at the expected path, skip the fidelity check gracefully with a note: "Fidelity check skipped — design-tokens.json not found at {path}." No crash, no block.
- **Zero tokens consumed** — if generated code references zero tokens (no `figma:` block consumed or no token patterns found), report "N/A — no tokens consumed" and skip the fidelity check.

### 7.5 Report Persistence

Save the fidelity report to:
```
{implementation_artifacts}/reviews/{story_key}/fidelity-report.md
```

The report includes:
- **Timestamp** — ISO 8601 date of the fidelity check
- **Story key** — the story_key being checked
- **Token source file path** — path to the design-tokens.json used as baseline
- **Per-category breakdown table** (as shown in 7.3)
- **Overall drift percentage** — weighted average across all categories
- **Verdict** — PASS / WARNING / BLOCKED

After saving the report, write the overall drift percentage to the story file YAML frontmatter:

```yaml
figma:
  fidelity_drift_pct: 8.5
```

The `figma.fidelity_drift_pct` value is the weighted overall drift across all categories.

<!-- /SECTION: fidelity -->
