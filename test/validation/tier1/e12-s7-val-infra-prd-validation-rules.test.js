import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { PROJECT_ROOT } from "../../helpers/project-root.js";

const RULESETS_PATH = `${PROJECT_ROOT}/_gaia/lifecycle/skills/document-rulesets.md`;
const content = readFileSync(RULESETS_PATH, "utf8");

describe("E12-S7: Val Infra PRD Validation Rules", () => {
  // AC1: All 13 required sections checked for presence
  describe("AC1: Infra-prd-rules checks all 13 required sections", () => {
    it("should have an infra-prd-rules section", () => {
      expect(content).toContain("<!-- SECTION: infra-prd-rules -->");
      expect(content).toContain("<!-- END SECTION -->");
    });

    it("should list all 13 required infra PRD sections", () => {
      const sectionMatch = content.match(
        /<!-- SECTION: infra-prd-rules -->([\s\S]*?)<!-- END SECTION -->/,
      );
      expect(sectionMatch, "infra-prd-rules section not found").toBeTruthy();
      const ruleContent = sectionMatch[1];

      const requiredSections = [
        "Overview & Scope",
        "Goals and Non-Goals",
        "Platform Capabilities",
        "Resource Specifications",
        "Operational SLOs",
        "Security Posture",
        "Environment Strategy & Developer Experience",
        "Dependencies & Provider Constraints",
        "Cost Model",
        "Verification Strategy",
        "Operational Runbooks",
        "Requirements Summary",
        "Open Questions",
      ];

      for (const section of requiredSections) {
        expect(
          ruleContent,
          `Missing required section: ${section}`,
        ).toContain(section);
      }
    });

    it("should flag missing sections as CRITICAL", () => {
      const sectionMatch = content.match(
        /<!-- SECTION: infra-prd-rules -->([\s\S]*?)<!-- END SECTION -->/,
      );
      const ruleContent = sectionMatch[1];
      expect(ruleContent).toMatch(/CRITICAL/i);
    });
  });

  // AC2: IR/OR/SR ID uniqueness enforcement
  describe("AC2: IR/OR/SR ID uniqueness within each prefix family", () => {
    it("should define ID uniqueness validation for IR/OR/SR prefixes", () => {
      const sectionMatch = content.match(
        /<!-- SECTION: infra-prd-rules -->([\s\S]*?)<!-- END SECTION -->/,
      );
      const ruleContent = sectionMatch[1];
      expect(ruleContent).toMatch(/IR/);
      expect(ruleContent).toMatch(/OR/);
      expect(ruleContent).toMatch(/SR/);
      expect(ruleContent).toMatch(/uniqueness|unique|duplicate/i);
    });
  });

  // AC3: Security Posture section must be non-empty (mandatory)
  describe("AC3: Security Posture mandatory non-empty", () => {
    it("should have a rule that Security Posture must be non-empty", () => {
      const sectionMatch = content.match(
        /<!-- SECTION: infra-prd-rules -->([\s\S]*?)<!-- END SECTION -->/,
      );
      const ruleContent = sectionMatch[1];
      expect(ruleContent).toMatch(/Security Posture/);
      expect(ruleContent).toMatch(/non-empty|mandatory|must not be empty/i);
    });
  });

  // AC4: Cost Model per-environment estimates
  describe("AC4: Cost Model per-environment cost estimates", () => {
    it("should require per-environment cost estimates in Cost Model", () => {
      const sectionMatch = content.match(
        /<!-- SECTION: infra-prd-rules -->([\s\S]*?)<!-- END SECTION -->/,
      );
      const ruleContent = sectionMatch[1];
      expect(ruleContent).toMatch(/Cost Model/);
      expect(ruleContent).toMatch(/per-environment/i);
    });
  });

  // AC5: Verification Strategy references policy-as-code tool
  describe("AC5: Verification Strategy references policy-as-code tool", () => {
    it("should require at least one policy-as-code tool reference", () => {
      const sectionMatch = content.match(
        /<!-- SECTION: infra-prd-rules -->([\s\S]*?)<!-- END SECTION -->/,
      );
      const ruleContent = sectionMatch[1];
      expect(ruleContent).toMatch(/Verification Strategy/);
      expect(ruleContent).toMatch(/policy-as-code/i);
    });

    it("should list recognized policy-as-code tools", () => {
      const sectionMatch = content.match(
        /<!-- SECTION: infra-prd-rules -->([\s\S]*?)<!-- END SECTION -->/,
      );
      const ruleContent = sectionMatch[1];
      expect(ruleContent).toMatch(/OPA|Rego/);
      expect(ruleContent).toMatch(/Checkov|tfsec|Sentinel/);
    });
  });

  // AC6: Platform Capabilities format validation
  describe('AC6: Platform Capabilities "Enable {team} to {capability} with {SLO}" format', () => {
    it("should define Platform Capabilities format validation", () => {
      const sectionMatch = content.match(
        /<!-- SECTION: infra-prd-rules -->([\s\S]*?)<!-- END SECTION -->/,
      );
      const ruleContent = sectionMatch[1];
      expect(ruleContent).toMatch(/Platform Capabilities/);
      expect(ruleContent).toMatch(/Enable.*\{.*\}.*to.*\{.*\}.*with.*\{.*\}/i);
    });
  });

  // AC7: Auto-detection from frontmatter template field
  describe("AC7: Auto-detect artifact type from frontmatter", () => {
    it("should have frontmatter-based detection in type-detection section", () => {
      const typeMatch = content.match(
        /<!-- SECTION: type-detection -->([\s\S]*?)<!-- END SECTION -->/,
      );
      expect(typeMatch, "type-detection section not found").toBeTruthy();
      const typeContent = typeMatch[1];
      expect(typeContent).toMatch(/frontmatter/i);
      expect(typeContent).toMatch(/template/i);
    });

    it("should map template: 'prd' to prd-rules", () => {
      const typeMatch = content.match(
        /<!-- SECTION: type-detection -->([\s\S]*?)<!-- END SECTION -->/,
      );
      const typeContent = typeMatch[1];
      expect(typeContent).toMatch(/['"`]prd['"`].*prd-rules/i);
    });

    it("should map template: 'infra-prd' to infra-prd-rules", () => {
      const typeMatch = content.match(
        /<!-- SECTION: type-detection -->([\s\S]*?)<!-- END SECTION -->/,
      );
      const typeContent = typeMatch[1];
      expect(typeContent).toMatch(/['"`]infra-prd['"`].*infra-prd-rules/i);
    });

    it("should map template: 'platform-prd' to both prd-rules and infra-prd-rules", () => {
      const typeMatch = content.match(
        /<!-- SECTION: type-detection -->([\s\S]*?)<!-- END SECTION -->/,
      );
      const typeContent = typeMatch[1];
      expect(typeContent).toMatch(/['"`]platform-prd['"`]/i);
      expect(typeContent).toMatch(/prd-rules.*infra-prd-rules/i);
    });

    it("should give frontmatter detection higher priority than filename detection", () => {
      const typeMatch = content.match(
        /<!-- SECTION: type-detection -->([\s\S]*?)<!-- END SECTION -->/,
      );
      const typeContent = typeMatch[1];
      expect(typeContent).toMatch(
        /frontmatter.*prior|frontmatter.*first|check frontmatter.*before|frontmatter.*higher/i,
      );
    });
  });

  // AC7 continued: Platform PRD composite validation
  describe("AC7: Platform PRD validates against both rulesets", () => {
    it("should have a platform-prd-rules section", () => {
      expect(content).toContain("<!-- SECTION: platform-prd-rules -->");
    });

    it("should require both prd-rules and infra-prd-rules for platform PRDs", () => {
      const platformMatch = content.match(
        /<!-- SECTION: platform-prd-rules -->([\s\S]*?)<!-- END SECTION -->/,
      );
      expect(
        platformMatch,
        "platform-prd-rules section not found",
      ).toBeTruthy();
      const platformContent = platformMatch[1];
      expect(platformContent).toMatch(/prd-rules/);
      expect(platformContent).toMatch(/infra-prd-rules/);
    });

    it("should validate both FR/NFR and IR/OR/SR ID schemes for platform PRDs", () => {
      const platformMatch = content.match(
        /<!-- SECTION: platform-prd-rules -->([\s\S]*?)<!-- END SECTION -->/,
      );
      const platformContent = platformMatch[1];
      expect(platformContent).toMatch(/FR.*NFR/);
      expect(platformContent).toMatch(/IR.*OR.*SR/);
    });
  });

  // Structural: sections list in frontmatter includes new sections
  describe("Structural: Frontmatter sections list updated", () => {
    it("should list infra-prd-rules in the frontmatter sections array", () => {
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      expect(frontmatterMatch, "No YAML frontmatter found").toBeTruthy();
      const frontmatter = frontmatterMatch[1];
      expect(frontmatter).toContain("infra-prd-rules");
    });

    it("should list platform-prd-rules in the frontmatter sections array", () => {
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = frontmatterMatch[1];
      expect(frontmatter).toContain("platform-prd-rules");
    });
  });
});
