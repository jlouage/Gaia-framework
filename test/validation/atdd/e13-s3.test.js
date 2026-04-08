/**
 * ATDD — E13-S3: Define Intermediate Component Spec and Design Token Formats
 *
 * Red phase: all tests must FAIL because the implementation does not exist yet.
 * - AC1–AC7: design-tokens.json and component-specs.yaml do not exist
 *   at docs/planning-artifacts/design-system/
 *
 * Dependency: E13-S2 (shared Figma integration skill file)
 * Blocks: E13-S4 (generate mode), E13-S5 (dev agent consumption)
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const DESIGN_SYSTEM_DIR = path.join(PROJECT_ROOT, "docs", "planning-artifacts", "design-system");
const DESIGN_TOKENS_PATH = path.join(DESIGN_SYSTEM_DIR, "design-tokens.json");
const COMPONENT_SPECS_PATH = path.join(DESIGN_SYSTEM_DIR, "component-specs.yaml");

// ── Helpers ────────────────────────────────────────────────────────────────

function loadDesignTokens() {
  const raw = fs.readFileSync(DESIGN_TOKENS_PATH, "utf-8");
  return JSON.parse(raw);
}

function loadComponentSpecs() {
  const raw = fs.readFileSync(COMPONENT_SPECS_PATH, "utf-8");
  return yaml.load(raw);
}

describe("E13-S3: Define Intermediate Component Spec and Design Token Formats", () => {
  // ── AC1: design-tokens.json follows W3C DTCG draft spec ─────────────────

  describe("AC1: design-tokens.json follows W3C DTCG draft spec", () => {
    it("test_ac1_file_exists — design-tokens.json exists in planning-artifacts/design-system/", () => {
      expect(fs.existsSync(DESIGN_TOKENS_PATH)).toBe(true);
    });

    it("test_ac1_colors_with_semantic_aliases — tokens include color group with semantic alias tokens", () => {
      const tokens = loadDesignTokens();

      // Must have a color/semantic section (W3C DTCG uses nested groups)
      expect(tokens).toHaveProperty("color");
      // Each color token must have $type: 'color' per DTCG spec
      const colorGroup = tokens.color;
      const hasTypedToken = Object.values(colorGroup).some(
        (entry) => entry.$type === "color" || (typeof entry === "object" && entry.$value)
      );
      expect(hasTypedToken).toBe(true);
    });

    it("test_ac1_spacing_tokens — tokens include spacing group", () => {
      const tokens = loadDesignTokens();
      expect(tokens).toHaveProperty("spacing");
      // Spacing values must be present
      expect(Object.keys(tokens.spacing).length).toBeGreaterThan(0);
    });

    it("test_ac1_typography_as_composite — tokens include typography as composite type ($type: 'typography')", () => {
      const tokens = loadDesignTokens();
      expect(tokens).toHaveProperty("typography");
      const typGroup = tokens.typography;
      // At least one composite typography token
      const hasComposite = Object.values(typGroup).some(
        (entry) => entry.$type === "typography" && entry.$value
      );
      expect(hasComposite).toBe(true);
    });

    it("test_ac1_shadow_tokens — tokens include shadow group", () => {
      const tokens = loadDesignTokens();
      expect(tokens).toHaveProperty("shadow");
    });

    it("test_ac1_border_radius_tokens — tokens include border-radius group", () => {
      const tokens = loadDesignTokens();
      // Accept either 'borderRadius' or 'border-radius' as key
      const hasBorderRadius =
        tokens.hasOwnProperty("borderRadius") || tokens.hasOwnProperty("border-radius");
      expect(hasBorderRadius).toBe(true);
    });
  });

  // ── AC2: component-specs.yaml required fields ────────────────────────────

  describe("AC2: component-specs.yaml includes all required fields", () => {
    it("test_ac2_file_exists — component-specs.yaml exists in planning-artifacts/design-system/", () => {
      expect(fs.existsSync(COMPONENT_SPECS_PATH)).toBe(true);
    });

    it("test_ac2_name_field — each component spec includes 'name' field", () => {
      const specs = loadComponentSpecs();
      // Specs must be a list of component entries
      expect(Array.isArray(specs.components)).toBe(true);
      specs.components.forEach((comp) => {
        expect(comp).toHaveProperty("name");
        expect(typeof comp.name).toBe("string");
      });
    });

    it("test_ac2_typed_props — each component spec includes typed 'props' map", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        expect(comp).toHaveProperty("props");
        // Props should be an object/map
        expect(typeof comp.props).toBe("object");
      });
    });

    it("test_ac2_abstract_layout — each component spec includes abstract layout (row/column/stack/grid)", () => {
      const specs = loadComponentSpecs();
      const VALID_LAYOUTS = ["row", "column", "stack", "grid"];
      specs.components.forEach((comp) => {
        expect(comp).toHaveProperty("layout");
        expect(VALID_LAYOUTS).toContain(comp.layout);
      });
    });

    it("test_ac2_spacing_field — each component spec includes 'spacing' field", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        expect(comp).toHaveProperty("spacing");
      });
    });

    it("test_ac2_token_references — component specs use {token.path} reference syntax", () => {
      const raw = fs.readFileSync(COMPONENT_SPECS_PATH, "utf-8");
      // Must contain at least one token reference in {token.xxx} format
      expect(raw).toMatch(/\{[a-zA-Z][a-zA-Z0-9._-]*\}/);
    });

    it("test_ac2_states_field — each component spec includes 'states' list", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        expect(comp).toHaveProperty("states");
        expect(Array.isArray(comp.states)).toBe(true);
      });
    });

    it("test_ac2_children_field — each component spec includes 'children' field", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        expect(comp).toHaveProperty("children");
      });
    });

    it("test_ac2_variants_field — each component spec includes 'variants' field", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        expect(comp).toHaveProperty("variants");
      });
    });

    it("test_ac2_responsive_breakpoints — each component spec includes 'responsive_breakpoints' field", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        expect(comp).toHaveProperty("responsive_breakpoints");
      });
    });

    it("test_ac2_a11y_metadata — each component spec includes 'a11y' metadata field", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        expect(comp).toHaveProperty("a11y");
        // a11y should include at minimum role or aria fields
        expect(typeof comp.a11y).toBe("object");
      });
    });
  });

  // ── AC3: Per-stack token resolution table ───────────────────────────────

  describe("AC3: Per-stack token resolution table in component-specs.yaml", () => {
    it("test_ac3_stack_resolution_table_exists — component-specs.yaml includes stack_resolution_table section", () => {
      const specs = loadComponentSpecs();
      expect(specs).toHaveProperty("stack_resolution_table");
    });

    it("test_ac3_cleo_css_custom_properties — Cleo (TypeScript) stack maps to CSS custom properties", () => {
      const specs = loadComponentSpecs();
      const table = specs.stack_resolution_table;
      expect(table).toHaveProperty("cleo");
      expect(table.cleo.format).toMatch(/css.custom.propert/i);
    });

    it("test_ac3_lena_scss_variables — Lena (Angular) stack maps to SCSS variables", () => {
      const specs = loadComponentSpecs();
      const table = specs.stack_resolution_table;
      expect(table).toHaveProperty("lena");
      expect(table.lena.format).toMatch(/scss.variable/i);
    });

    it("test_ac3_freya_dart_themedata — Freya (Flutter) stack maps to Dart ThemeData", () => {
      const specs = loadComponentSpecs();
      const table = specs.stack_resolution_table;
      expect(table).toHaveProperty("freya");
      expect(table.freya.format).toMatch(/dart.themedata|ThemeData/i);
    });

    it("test_ac3_hugo_spring_properties — Hugo (Java) stack maps to Spring properties", () => {
      const specs = loadComponentSpecs();
      const table = specs.stack_resolution_table;
      expect(table).toHaveProperty("hugo");
      expect(table.hugo.format).toMatch(/spring.propert/i);
    });

    it("test_ac3_ravi_python_dict — Ravi (Python) stack maps to Python dict", () => {
      const specs = loadComponentSpecs();
      const table = specs.stack_resolution_table;
      expect(table).toHaveProperty("ravi");
      expect(table.ravi.format).toMatch(/python.dict/i);
    });

    it("test_ac3_talia_rn_swift_compose — Talia (Mobile) stack maps to RN StyleSheet / Swift extensions / Compose theme", () => {
      const specs = loadComponentSpecs();
      const table = specs.stack_resolution_table;
      expect(table).toHaveProperty("talia");
      const talia = table.talia;
      // Must list all 3 mobile targets
      const formatsStr = JSON.stringify(talia).toLowerCase();
      expect(formatsStr).toMatch(/stylesheet|react.native/);
      expect(formatsStr).toMatch(/swift/);
      expect(formatsStr).toMatch(/compose/);
    });
  });

  // ── AC4: schema_version in both formats ────────────────────────────────

  describe("AC4: Both formats include schema_version field", () => {
    it("test_ac4_design_tokens_schema_version — design-tokens.json includes $schema_version or schema_version field", () => {
      const tokens = loadDesignTokens();
      const hasVersion =
        tokens.hasOwnProperty("schema_version") ||
        tokens.hasOwnProperty("$schema_version") ||
        tokens.hasOwnProperty("$schema");
      expect(hasVersion).toBe(true);
    });

    it("test_ac4_component_specs_schema_version — component-specs.yaml includes schema_version field", () => {
      const specs = loadComponentSpecs();
      expect(specs).toHaveProperty("schema_version");
      expect(typeof specs.schema_version).toBe("string");
    });
  });

  // ── AC5: Files output to planning-artifacts/design-system/ ─────────────

  describe("AC5: Files output to planning-artifacts/design-system/", () => {
    it("test_ac5_design_system_dir_exists — design-system/ directory exists under planning-artifacts/", () => {
      expect(fs.existsSync(DESIGN_SYSTEM_DIR)).toBe(true);
      expect(fs.statSync(DESIGN_SYSTEM_DIR).isDirectory()).toBe(true);
    });

    it("test_ac5_design_tokens_in_correct_location — design-tokens.json is at planning-artifacts/design-system/design-tokens.json", () => {
      expect(fs.existsSync(DESIGN_TOKENS_PATH)).toBe(true);
    });

    it("test_ac5_component_specs_in_correct_location — component-specs.yaml is at planning-artifacts/design-system/component-specs.yaml", () => {
      expect(fs.existsSync(COMPONENT_SPECS_PATH)).toBe(true);
    });
  });

  // ── AC6: Per-platform token translation tables (FR-172) ─────────────────

  describe("AC6: component-specs.yaml includes per-platform token translation tables (FR-172)", () => {
    it("test_ac6_platform_translation_tables_exist — component-specs.yaml has platform_token_translations section", () => {
      const specs = loadComponentSpecs();
      expect(specs).toHaveProperty("platform_token_translations");
    });

    it("test_ac6_flutter_themedata_mapping — Flutter (ThemeData) mapping present in platform_token_translations", () => {
      const specs = loadComponentSpecs();
      const tables = specs.platform_token_translations;
      expect(tables).toHaveProperty("flutter");
      // Each entry maps a W3C DTCG token path to a ThemeData equivalent
      expect(typeof tables.flutter).toBe("object");
      expect(Object.keys(tables.flutter).length).toBeGreaterThan(0);
    });

    it("test_ac6_swift_uikit_mapping — Swift (UIKit) mapping present in platform_token_translations", () => {
      const specs = loadComponentSpecs();
      const tables = specs.platform_token_translations;
      expect(tables).toHaveProperty("swift");
      expect(Object.keys(tables.swift).length).toBeGreaterThan(0);
    });

    it("test_ac6_kotlin_compose_mapping — Kotlin (Compose) mapping present in platform_token_translations", () => {
      const specs = loadComponentSpecs();
      const tables = specs.platform_token_translations;
      expect(tables).toHaveProperty("kotlin");
      expect(Object.keys(tables.kotlin).length).toBeGreaterThan(0);
    });

    it("test_ac6_angular_scss_mapping — Angular (SCSS) mapping present in platform_token_translations", () => {
      const specs = loadComponentSpecs();
      const tables = specs.platform_token_translations;
      expect(tables).toHaveProperty("angular");
      expect(Object.keys(tables.angular).length).toBeGreaterThan(0);
    });

    it("test_ac6_react_css_in_js_mapping — React (CSS-in-JS) mapping present in platform_token_translations", () => {
      const specs = loadComponentSpecs();
      const tables = specs.platform_token_translations;
      expect(tables).toHaveProperty("react");
      expect(Object.keys(tables.react).length).toBeGreaterThan(0);
    });
  });

  // ── AC7: widget_hints per component per framework (FR-173) ──────────────

  describe("AC7: component-specs.yaml includes widget_hints per component (FR-173)", () => {
    it("test_ac7_widget_hints_field_present — each component spec includes 'widget_hints' map", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        expect(comp).toHaveProperty("widget_hints");
        expect(typeof comp.widget_hints).toBe("object");
      });
    });

    it("test_ac7_widget_hints_flutter_entry — widget_hints includes Flutter hints per component", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        expect(comp.widget_hints).toHaveProperty("flutter");
      });
    });

    it("test_ac7_widget_hints_swift_entry — widget_hints includes Swift hints per component", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        expect(comp.widget_hints).toHaveProperty("swift");
      });
    });

    it("test_ac7_widget_hints_angular_entry — widget_hints includes Angular hints per component", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        expect(comp.widget_hints).toHaveProperty("angular");
      });
    });

    it("test_ac7_widget_hints_react_entry — widget_hints includes React hints per component", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        expect(comp.widget_hints).toHaveProperty("react");
      });
    });

    it("test_ac7_widget_hints_structural_content — widget_hints values are non-empty structural descriptions", () => {
      const specs = loadComponentSpecs();
      specs.components.forEach((comp) => {
        Object.values(comp.widget_hints).forEach((hint) => {
          // Each hint must be a non-empty string describing the widget/component tree
          expect(typeof hint).toBe("string");
          expect(hint.length).toBeGreaterThan(0);
        });
      });
    });
  });
});
