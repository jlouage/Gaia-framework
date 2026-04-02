import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");
const GAIA_DIR = join(PROJECT_ROOT, "_gaia");
const TEMPLATES_DIR = join(GAIA_DIR, "lifecycle", "templates");
const PROMPT_FILE = join(TEMPLATES_DIR, "brownfield-scan-security-prompt.md");

function loadFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

describe("E11-S17: Non-REST API Security Scanning (GraphQL, gRPC)", () => {
  describe("AC1: GraphQL endpoint detection patterns", () => {
    it("detects .graphql/.gql schema files", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/\.graphql|\.gql/);
    });

    it("detects code-first resolver definitions (typeDefs, type Query, type Mutation)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/typeDefs|type\s+Query|type\s+Mutation/);
    });

    it("detects resolver patterns (@Resolver, resolvers objects)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/@Resolver|resolvers/);
    });

    it("detects GraphQL middleware chains (graphql-shield, @UseGuards, Apollo plugins)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/graphql-shield|@UseGuards|Apollo.*plugin/i);
    });

    it("supports multiple GraphQL frameworks (Apollo, Yoga, Mercurius, Strawberry, gqlgen, Ariadne)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/Apollo\s+Server/i);
      expect(prompt).toMatch(/Yoga|GraphQL\s+Yoga/i);
      expect(prompt).toMatch(/Mercurius/i);
      expect(prompt).toMatch(/Strawberry/i);
      expect(prompt).toMatch(/gqlgen/i);
      expect(prompt).toMatch(/Ariadne/i);
    });
  });

  describe("AC2: GraphQL security gap detection", () => {
    it("detects queries/mutations missing auth directives", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/@auth|@authenticated|@HasPermission/);
    });

    it("detects introspection enabled in production", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/introspection/i);
    });

    it("detects mutations without authorization checks", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/mutation.*authorization|authorization.*mutation/i);
    });

    it("detects field-level authorization gaps on sensitive fields", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/field.level\s+auth/i);
    });
  });

  describe("AC3: gRPC endpoint detection patterns", () => {
    it("parses .proto service definitions", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/\.proto/);
    });

    it("detects rpc method definitions and stream annotations", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/\brpc\b/);
      expect(prompt).toMatch(/\bstream\b/);
    });

    it("detects server interceptor patterns across stacks", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/ServerInterceptor|UnaryInterceptor|server_interceptor|addService/i);
    });

    it("detects gRPC middleware chains (@GrpcMethod, metadata extractors)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/@GrpcMethod|metadata/i);
    });
  });

  describe("AC4: gRPC security gap detection", () => {
    it("detects services missing auth interceptors", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/missing\s+auth\s+interceptor/i);
    });

    it("detects unary RPCs without authorization metadata", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/unary.*authorization|authorization.*metadata/i);
    });

    it("detects streaming RPCs without per-message auth", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/stream.*auth|per.message\s+auth/i);
    });

    it("detects TLS configuration gaps (insecure port/credentials)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/insecure_port|createInsecure|TLS/i);
    });

    it("detects gRPC reflection enabled in production", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/grpc\.reflection|reflection.*service/i);
    });
  });

  describe("AC5: Gap schema integration with protocol field", () => {
    it("gap entries use category security-endpoint", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/security-endpoint/);
    });

    it("includes protocol field in evidence metadata (rest, graphql, grpc)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/protocol:\s*["']?(rest|graphql|grpc)/i);
    });

    it("GraphQL gap examples include protocol: graphql", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/protocol:\s*["']?graphql/i);
    });

    it("gRPC gap examples include protocol: grpc", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/protocol:\s*["']?grpc/i);
    });

    it("references standardized gap schema (gap-entry-schema.md)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/gap-entry-schema\.md/);
    });
  });

  describe("AC6: Security prompt covers GraphQL and gRPC protocols", () => {
    it("prompt contains dedicated GraphQL endpoint discovery phase", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/GraphQL\s+Endpoint\s+Discovery/i);
    });

    it("prompt contains dedicated gRPC endpoint discovery phase", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/gRPC\s+Endpoint\s+Discovery/i);
    });

    it("prompt covers at least 3 protocol types (REST, GraphQL, gRPC)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/REST/i);
      expect(prompt).toMatch(/GraphQL/i);
      expect(prompt).toMatch(/gRPC/i);
    });
  });

  describe("Integration: no regression in existing REST scanning", () => {
    it("still contains Java/Spring endpoint patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/@GetMapping|@PostMapping/);
    });

    it("still contains Node/Express endpoint patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/app\.get\(\)|router\.get\(\)/);
    });

    it("still contains Python/Django endpoint patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/@api_view/);
    });

    it("still contains Go/Gin endpoint patterns", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/r\.GET\(\)/);
    });

    it("still contains infrastructure security patterns (Phase 4)", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/Phase 4.*Infrastructure/i);
    });
  });

  describe("Edge cases: mixed-protocol and federation", () => {
    it("mentions mixed-protocol project handling", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/mixed.protocol|REST.*GraphQL.*gRPC|multiple\s+protocol/i);
    });

    it("mentions GraphQL federation detection", () => {
      const prompt = loadFile(PROMPT_FILE);
      expect(prompt).not.toBeNull();
      expect(prompt).toMatch(/federation|schema\s+stitching/i);
    });
  });
});
