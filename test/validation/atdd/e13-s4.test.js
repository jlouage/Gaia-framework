/**
 * ATDD — E13-S4: Implement Generate Mode in /gaia-create-ux
 *
 * Red phase: all tests must FAIL because the implementation does not exist yet.
 *
 * E13-S4 adds Figma MCP Generate Mode to /gaia-create-ux. When Figma MCP is
 * available, the workflow must:
 *   AC1: Create a Figma UI Kit page with design system tokens
 *   AC2: Generate per-screen frames for 3 viewports (375/768/1280)
 *   AC3: Set up prototype flow links from PRD user journeys
 *   AC4: Configure asset export settings (PNG 1x/2x/3x + SVG)
 *   AC5: Record all Figma node IDs in ux-design.md
 *   AC6: Enhance ux-design.md with figma: frontmatter + 4 required sections
 *   AC7: MCP operations are read-heavy/write-light (FR-140)
 *   AC8: Support 3 additional viewports: 280px, 600px, 1024px (FR-174)
 *   AC9: Platform-specific asset catalogs: iOS .xcassets + Android drawable-* (FR-175)
 *
 * Dependency surfaces:
 *   - _gaia/lifecycle/workflows/2-planning/create-ux-design/instructions.xml (Generate Mode step)
 *   - _gaia/dev/skills/figma-integration.md (shared Figma skill from E13-S2)
 *   - ux-design.md template (figma: frontmatter + sections)
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");

const CREATE_UX_INSTRUCTIONS = path.join(
  PROJECT_ROOT,
  "_gaia",
  "lifecycle",
  "workflows",
  "2-planning",
  "create-ux-design",
  "instructions.xml"
);

const FIGMA_SKILL = path.join(PROJECT_ROOT, "_gaia", "dev", "skills", "figma-integration.md");

// ── Helpers ─────────────────────────────────────────────────────────────────

function readXml(filePath) {
  return fs.readFileSync(filePath, "utf-8");
}

// ── AC1: Figma UI Kit page with design system tokens ─────────────────────────

describe("AC1: Creates Figma UI Kit page with design system tokens", () => {
  it("test_ac1_instructions_reference_ui_kit_creation — instructions.xml contains a Generate Mode step that creates a UI Kit page", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    // Must reference creating a UI Kit page in Figma
    expect(content).toMatch(/UI\s*Kit/i);
    // Must reference design system tokens
    expect(content).toMatch(/design.{0,20}token/i);
  });

  it("test_ac1_ui_kit_includes_colors_typography_spacing — instructions reference colors, typography, and spacing", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/color/i);
    expect(content).toMatch(/typograph/i);
    expect(content).toMatch(/spacing/i);
  });

  it("test_ac1_ui_kit_includes_base_components_with_states — instructions reference base components with state variants", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    // Must reference components and state variants
    expect(content).toMatch(/component/i);
    expect(content).toMatch(/state\s*variant|variant\s*state|states/i);
  });
});

// ── AC2: Per-screen frames across 3 viewports ────────────────────────────────

describe("AC2: Generates per-screen Figma frames for 3 viewports", () => {
  it("test_ac2_viewport_375_mobile — instructions reference 375px mobile viewport", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/375/);
  });

  it("test_ac2_viewport_768_tablet — instructions reference 768px tablet viewport", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/768/);
  });

  it("test_ac2_viewport_1280_desktop — instructions reference 1280px desktop viewport", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/1280/);
  });
});

// ── AC3: Prototype flow links from PRD user journeys ─────────────────────────

describe("AC3: Sets up prototype flow links based on PRD user journeys", () => {
  it("test_ac3_prototype_flow_links_referenced — instructions contain action to create prototype flows", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    // Must reference prototype links or flows
    expect(content).toMatch(/prototype/i);
    // Must trace to PRD user journeys
    expect(content).toMatch(/user.{0,10}journey|journey/i);
  });

  it("test_ac3_figma_skill_tokens_section_exists — figma-integration.md has a tokens section for MCP operations", () => {
    // Figma skill from E13-S2 must exist and have a tokens section
    expect(fs.existsSync(FIGMA_SKILL)).toBe(true);
    const content = fs.readFileSync(FIGMA_SKILL, "utf-8");
    expect(content).toMatch(/SECTION:\s*tokens/i);
  });
});

// ── AC4: Asset export settings PNG 1x/2x/3x + SVG ───────────────────────────

describe("AC4: Configures asset export settings", () => {
  it("test_ac4_png_export_1x_2x_3x — instructions reference PNG export at 1x, 2x, 3x", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/PNG/i);
    expect(content).toMatch(/1x|1\.0x/i);
    expect(content).toMatch(/2x|2\.0x/i);
    expect(content).toMatch(/3x|3\.0x/i);
  });

  it("test_ac4_svg_export_for_icons — instructions reference SVG export for icons", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/SVG/i);
    expect(content).toMatch(/icon/i);
  });
});

// ── AC5: Record Figma node IDs in ux-design.md ───────────────────────────────

describe("AC5: Records all Figma node IDs in ux-design.md", () => {
  it("test_ac5_instructions_write_node_ids — instructions contain action to record Figma node IDs", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    // Must reference node IDs
    expect(content).toMatch(/node.{0,10}id|figma.{0,20}id/i);
    // Must target ux-design.md as the write destination
    expect(content).toMatch(/ux-design\.md/i);
  });

  it("test_ac5_figma_skill_assets_section_exists — figma-integration.md has an assets section", () => {
    expect(fs.existsSync(FIGMA_SKILL)).toBe(true);
    const content = fs.readFileSync(FIGMA_SKILL, "utf-8");
    expect(content).toMatch(/SECTION:\s*assets/i);
  });
});

// ── AC6: ux-design.md with figma: frontmatter and required sections ───────────

describe("AC6: ux-design.md enhanced with figma frontmatter and required sections", () => {
  it("test_ac6_figma_frontmatter_written — instructions write figma: key to ux-design.md YAML frontmatter", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    // Must write figma: key in frontmatter
    expect(content).toMatch(/figma:/i);
  });

  it("test_ac6_design_tokens_section — instructions add or reference a Design Tokens section", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/Design\s*Tokens/i);
  });

  it("test_ac6_component_inventory_section — instructions add or reference a Component Inventory section", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/Component\s*Inventory/i);
  });

  it("test_ac6_screen_to_frame_mapping_section — instructions add or reference a Screen-to-Frame mapping section", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/Screen.{0,10}Frame|Frame.{0,10}Screen/i);
  });
});

// ── AC7: MCP operations are read-heavy/write-light (FR-140) ──────────────────

describe("AC7: MCP operations are read-heavy/write-light per FR-140", () => {
  it("test_ac7_fr140_traced_in_instructions — instructions.xml or workflow.yaml traces to FR-140", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    // FR-140 governs the read-heavy/write-light constraint
    expect(content).toMatch(/FR-140/);
  });

  it("test_ac7_figma_skill_read_heavy_constraint — figma-integration.md documents read-heavy/write-light constraint", () => {
    expect(fs.existsSync(FIGMA_SKILL)).toBe(true);
    const content = fs.readFileSync(FIGMA_SKILL, "utf-8");

    // Skill must document the read-heavy constraint from FR-140
    expect(content).toMatch(/read.{0,20}heavy|write.{0,20}light|FR-140/i);
  });
});

// ── AC8: Additional viewports 280/600/1024 (FR-174) ──────────────────────────

describe("AC8: Generate mode supports additional viewports", () => {
  it("test_ac8_viewport_280_foldable_inner — instructions reference 280px viewport", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/280/);
  });

  it("test_ac8_viewport_600_foldable_outer — instructions reference 600px viewport", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/600/);
  });

  it("test_ac8_viewport_1024_tablet_landscape — instructions reference 1024px viewport", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/1024/);
  });

  it("test_ac8_fr174_traced — instructions or workflow traces to FR-174", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/FR-174/);
  });
});

// ── AC9: Platform-specific asset catalogs (FR-175) ───────────────────────────

describe("AC9: Exports platform-specific asset catalogs", () => {
  it("test_ac9_ios_xcassets_catalog — instructions reference iOS .xcassets asset catalog generation", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/xcassets|iOS\s*Asset\s*Catalog/i);
  });

  it("test_ac9_android_drawable_directories — instructions reference Android drawable-* directories", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/drawable|Android/i);
  });

  it("test_ac9_fr175_traced — instructions or workflow traces to FR-175", () => {
    const content = readXml(CREATE_UX_INSTRUCTIONS);

    expect(content).toMatch(/FR-175/);
  });
});
