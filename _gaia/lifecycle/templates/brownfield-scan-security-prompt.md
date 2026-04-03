# Security Endpoint Audit Scanner — Subagent Prompt

> Brownfield deep analysis scan subagent. Detects security gaps in API endpoints and infrastructure security configurations.
> Reference: Architecture ADR-021, Section 10.15.2, Section 10.15.5, ADR-022 §10.16.5
> Infra-awareness: E12-S6 — applies infra-specific patterns when project_type is infrastructure or platform.
> Non-REST protocols: E11-S17 — GraphQL and gRPC endpoint detection and security gap scanning.

## Objective

Scan the codebase at `{project-path}` to catalog all API endpoints and infrastructure security configurations, and identify security gaps.

**Input variables:**
- `{tech_stack}` — Detected technology stack from Step 1 discovery
- `{project-path}` — Absolute path to the project source code directory
- `{project_type}` — Project type: `application`, `infrastructure`, or `platform`

**Output format:** Follow the gap entry schema at `{project-root}/_gaia/lifecycle/templates/gap-entry-schema.md` exactly.

## Phase 1: Endpoint Discovery (Application Patterns)

Catalog all API endpoints. For each endpoint, record: route path, HTTP method, authentication, authorization, handler function.

### Stack-Aware Endpoint Discovery Patterns

Apply framework-specific patterns based on {tech_stack}:

#### Java/Spring
- `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`
- `@RequestMapping(method = RequestMethod.GET)`
- `RouterFunction<ServerResponse>` (Spring WebFlux)
- `@RestController` class-level `@RequestMapping`

#### Node/Express
- `app.get()`, `app.post()`, `app.put()`, `app.delete()`, `app.patch()`
- `router.get()`, `router.post()`, `router.put()`, `router.delete()`
- `app.route().get().post()`
- `app.all()`

#### Python/Django
- `path()`, `re_path()` in `urls.py`
- `@api_view(['GET', 'POST'])`
- `class XxxViewSet(viewsets.ModelViewSet)`
- `class XxxView(APIView)`

#### Go/Gin
- `r.GET()`, `r.POST()`, `r.PUT()`, `r.DELETE()`, `r.PATCH()`
- `group.GET()`, `group.POST()`
- `http.HandleFunc()`, `http.Handle()`
- `mux.HandleFunc()`, `mux.Handle()`

### Graceful Exit — No API Endpoints

If no API endpoints are detected, output a summary note and zero gap entries for the application phase.

## Phase 1b: GraphQL Endpoint Discovery

Catalog all GraphQL endpoints. For each endpoint, record: operation type (query/mutation/subscription), resolver function, authentication directives, authorization checks.

### Schema-First Detection Patterns

- `.graphql` and `.gql` schema files
- `type Query { ... }` and `type Mutation { ... }` blocks in schema files
- `typeDefs` variable definitions in JS/TS files (template literals with SDL)

### Code-First Detection Patterns

- `@Resolver()` decorators (NestJS, TypeGraphQL)
- `@Query()` and `@Mutation()` decorators
- `resolvers` objects exported from modules
- Python class-based resolvers (Strawberry `@strawberry.type`, Ariadne `@query_type.field`)
- Go resolver structs (gqlgen `resolver.go` files)

### GraphQL Framework Variants

Apply framework-specific patterns based on detected GraphQL library:

| Framework | Language | Detection Pattern |
|---|---|---|
| Apollo Server | Node/TS | `ApolloServer`, `@apollo/server`, Apollo plugins |
| GraphQL Yoga | Node/TS | `createYoga`, `@graphql-yoga/node` |
| Mercurius | Node/TS (Fastify) | `mercurius`, `app.graphql` |
| Strawberry | Python | `strawberry.Schema`, `@strawberry.type` |
| gqlgen | Go | `gqlgen.yml`, `generated.go`, resolver structs |
| Ariadne | Python | `ariadne`, `make_executable_schema` |
| NestJS GraphQL | Node/TS | `@nestjs/graphql`, `@Resolver()`, `@Query()`, `@Mutation()` |

### GraphQL Middleware Chain Detection

- `graphql-shield` rule trees (`const permissions = shield({ ... })`)
- `@UseGuards(AuthGuard)` decorators (NestJS)
- Apollo Server plugins (`ApolloServerPlugin` implementing `requestDidStart`)
- Yoga plugins (`useAuth`, custom `envelop` plugins)
- Custom context resolvers setting `context.user` from auth headers

### Graceful Exit — No GraphQL Endpoints

If no GraphQL schema files, resolver definitions, or GraphQL framework imports are detected, skip Phase 1b and Phase 2b entirely. Output a summary note and zero gap entries for GraphQL.

## Phase 1c: gRPC Endpoint Discovery

Catalog all gRPC endpoints. For each endpoint, record: service name, RPC method name, request/response message types, streaming type (unary/server/client/bidirectional), interceptor chain.

### Proto Service Parsing

- `.proto` files with `service` blocks defining `rpc` methods
- `stream` annotations on request or response types (server streaming, client streaming, bidirectional streaming)
- `package` declarations for service namespace

### Server Interceptor Detection

| Language | Interceptor Pattern |
|---|---|
| Java | `ServerInterceptor` interface, `@GrpcService` (Spring gRPC), interceptor registry |
| Go | `grpc.UnaryInterceptor()`, `grpc.StreamInterceptor()`, `grpc.ChainUnaryInterceptor()` |
| Python | `grpc.server_interceptor`, `intercept_service()` |
| Node/TS | `addService()` calls, `@GrpcMethod` decorators (NestJS), `grpc-js` server options |

### gRPC Middleware Chain Detection

- Interceptor chains in server setup (ordered middleware)
- `@GrpcMethod` decorators with guard annotations (NestJS)
- Metadata extractors for authentication tokens
- Health check service registration (`grpc.health.v1`)

### Graceful Exit — No gRPC Endpoints

If no `.proto` files, gRPC server setup, or gRPC framework imports are detected, skip Phase 1c and Phase 2c entirely. Output a summary note and zero gap entries for gRPC.

## Phase 1d: Mixed-Protocol Detection

A single codebase may expose REST + GraphQL + gRPC endpoints simultaneously. When multiple protocols are detected:

1. Scan all three protocols independently
2. Identify shared authentication middleware (e.g., a JWT validator used by both Express routes and Apollo context)
3. Do not double-count shared middleware as separate gaps — if auth middleware covers both REST and GraphQL, count it once
4. Note in findings when multiple protocols share infrastructure

## Phase 2: Security Gap Detection — Application Rules

### 1. Missing Authentication Middleware (AC3a)

Detect endpoints with no authentication middleware. Mutating endpoints (POST, PUT, PATCH, DELETE) missing auth are `critical`. Read endpoints (GET) missing auth that return non-public data are `high`.

### 2. IDOR Vulnerability Detection (AC3b)

Detect endpoints where path parameters reference resources without ownership validation. IDOR vulnerabilities are `critical` severity.

### 3. Rate Limiting Gap Detection (AC3c)

Detect endpoints without rate limiting at the application level. Missing rate limiting is `high` severity.

**Note:** Reverse proxy or API gateway rate limiting is not visible to static code analysis. Verify infrastructure-level rate limiting separately.

### 4. Sensitive Data Exposure Detection (AC3d)

Detect endpoints whose response objects contain fields that should be filtered:
- `password`, `password_hash`, `hashed_password`
- `token`, `access_token`, `refresh_token`, `api_key`, `secret`
- `ssn`, `social_security`, `national_id`
- `credit_card`, `card_number`, `cvv`, `expiry`
- Any field matching patterns: `*_secret`, `*_key`, `*_token`

Sensitive data exposure is `high` severity.

### 5. Missing Input Validation on Mutating Endpoints (AC3e)

Detect POST/PUT/PATCH/DELETE endpoints that accept a request body but have no input validation. Missing input validation is `high` severity.

## Phase 2b: GraphQL Security Gap Detection

### 1. Queries/Mutations Missing Auth Directives

Detect GraphQL operations missing authentication. Look for:
- Resolvers without `@auth`, `@authenticated`, `@HasPermission`, or `@UseGuards(AuthGuard)` directives
- Schema types without `@auth` directive when other types have it (inconsistent protection)
- Mutation resolvers with no authorization checks are `critical` severity
- Query resolvers returning non-public data without auth are `high` severity

### 2. Introspection Enabled in Production

Detect GraphQL introspection configuration that may leak schema in production:
- `introspection: true` in Apollo Server config without `NODE_ENV` conditional
- Missing introspection disable in production configuration
- Yoga/Mercurius default introspection without explicit disable

Introspection in production is `medium` severity.

### 3. Mutations Without Authorization Checks

Detect mutation resolvers that lack authorization logic:
- Mutation handlers with no permission checks, guard decorators, or authorization middleware
- `graphql-shield` rules that allow mutations without role checks
- NestJS mutations without `@UseGuards()` when other mutations have guards

Missing mutation authorization is `critical` severity.

### 4. Field-Level Authorization Gaps

Detect sensitive fields exposed without field-level auth controls:
- Fields named `email`, `password`, `ssn`, `token`, `secret`, `creditCard` without `@Authorized` or field-level resolvers
- Resolver types exposing sensitive nested objects without per-field permission checks
- User types exposing admin-only fields to all authenticated users

Field-level authorization gaps are `high` severity.

### 5. GraphQL Federation and Schema Stitching

When Apollo Federation or schema stitching is detected:
- Note gateway-level auth that may mask per-service gaps
- Flag subgraph services that rely solely on gateway auth without their own validation
- Detect `@external` fields without authorization in the owning subgraph

Federation auth gaps are `medium` severity with a note about gateway-level coverage.

## Phase 2c: gRPC Security Gap Detection

### 1. Services Missing Auth Interceptors

Detect gRPC server setup without authentication interceptors:
- Server initialization without `AuthInterceptor` or equivalent in the interceptor chain
- Services registered via `addService` with no auth middleware applied
- Spring gRPC services without `@GrpcService` security configuration

Missing auth interceptor is `critical` severity.

### 2. Unary RPCs Without Authorization Metadata

Detect unary RPC methods that do not validate authorization metadata:
- `rpc` method handlers that do not extract or validate `metadata` authorization headers
- Handler functions that skip token/credential validation from gRPC metadata
- Methods that do not check caller identity or roles from request context

Missing unary authorization is `high` severity.

### 3. Streaming RPCs Without Per-Message Auth

Detect bidirectional and server streaming RPCs without per-message authentication:
- Stream handlers that authenticate only at connection start but not per-message
- Bidirectional streams without per-message auth validation
- Server streaming RPCs that do not re-validate authorization on long-lived connections

Missing stream auth is `high` severity.

### 4. TLS Configuration Gaps

Detect insecure gRPC transport configuration:
- `grpc.insecure_port` usage in non-development configuration
- `ServerCredentials.createInsecure()` in production server setup
- Missing TLS certificate configuration in production gRPC servers
- Plaintext gRPC channels in production client configuration

Insecure TLS is `critical` severity.

### 5. gRPC Reflection Enabled in Production

Detect gRPC reflection service that may expose service definitions:
- `grpc.reflection.v1alpha` or `grpc.reflection.v1` service registered without environment guard
- Reflection service enabled unconditionally (similar risk to GraphQL introspection)

Reflection in production is `medium` severity.

## Phase 3: False-Positive Mitigation — Inherited Auth

Before flagging an endpoint as "missing authentication middleware," trace the middleware chain upward:

#### Java/Spring Security
- `HttpSecurity.authorizeRequests().anyRequest().authenticated()` — app-level
- `@PreAuthorize` on controller class — class-level
- `SecurityFilterChain` bean — app-level
- `.antMatchers("/api/**").authenticated()` — path-level

#### Node/Express Middleware
- `app.use(authMiddleware)` — app-level
- `router.use(passport.authenticate('jwt'))` — router-level
- `app.use('/api', authMiddleware, apiRouter)` — path-level

#### Django Permissions
- `REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES: [IsAuthenticated]` — app-level
- `LoginRequiredMixin` — class-level
- `@login_required` — function-level

#### Go/Gin Middleware
- `r.Use(JWTAuth())` — app-level
- `group := r.Group("/api"); group.Use(AuthMiddleware())` — group-level

#### GraphQL Inherited Auth
- Apollo Server `context` function that validates JWT and sets `context.user` — app-level
- `graphql-shield` rule tree applied via `applyMiddleware` — schema-level
- NestJS `@UseGuards(AuthGuard)` on resolver class — class-level
- Apollo Federation gateway-level auth that validates before routing to subgraphs — gateway-level

#### gRPC Inherited Auth
- Global auth interceptor registered via `grpc.UnaryInterceptor(authInterceptor)` — server-level
- `ServerInterceptor` added to server builder interceptor chain — server-level
- Per-service interceptor applied at `addService` — service-level
- TLS mutual authentication (mTLS) at transport level — transport-level

## Phase 4: Infrastructure Security Patterns (E12-S6)

**Apply ONLY when {project_type} is `infrastructure` or `platform`.**

### 4a. Exposed Ports in Kubernetes Manifests

Detect Kubernetes Services and Pods that expose ports unnecessarily or without documentation.

**Flag these:**
- `NodePort` services exposing ports to external traffic without documented justification
- `hostPort` usage in Pod specs (exposes container port on the node's IP)
- Services with `type: LoadBalancer` without IP whitelisting or security group restrictions
- Pods with `hostNetwork: true` (shares the node's network namespace)
- Containers listening on privileged ports (< 1024) without documented need

**Severity:** `high` for NodePort/LoadBalancer exposure, `critical` for hostNetwork/hostPort

### 4b. Permissive Ingress Rules

Detect overly permissive network ingress rules in Kubernetes Ingress resources, cloud security groups, and firewall rules.

**Flag these:**
- Kubernetes Ingress resources without TLS configuration
- Ingress rules with wildcard hosts: `host: "*"` or missing host field
- AWS Security Groups with `0.0.0.0/0` ingress on non-standard ports
- Terraform `aws_security_group_rule` with `cidr_blocks = ["0.0.0.0/0"]` on ports other than 80/443
- GCP firewall rules with `source_ranges = ["0.0.0.0/0"]` without service account filtering
- Azure NSG rules with `source_address_prefix = "*"` on sensitive ports

**Severity:** `critical` for `0.0.0.0/0` on sensitive ports (SSH/22, DB/3306/5432, admin ports), `high` for permissive ingress on standard ports

### 4c. Overly Broad RBAC Bindings

Detect Kubernetes RBAC configurations that grant excessive permissions.

**Flag these:**
- `ClusterRoleBinding` bound to `cluster-admin` for non-system service accounts
- `RoleBinding` or `ClusterRoleBinding` with `resources: ["*"]` and `verbs: ["*"]`
- Service accounts with `automountServiceAccountToken: true` when not needed
- `ClusterRole` with `apiGroups: ["*"]` granting access to all API groups
- Roles that grant `create`, `delete`, or `patch` on `secrets` without namespace scoping
- Default service account with non-default permissions

**Severity:** `critical` for cluster-admin bindings and wildcard permissions, `high` for broad secret access

### 4d. Missing NetworkPolicy

Detect Kubernetes namespaces and workloads without NetworkPolicy enforcement.

**Flag these:**
- Namespaces with no NetworkPolicy resources defined (all traffic allowed by default)
- Pods in namespaces where NetworkPolicy exists but does not select them (via label selectors)
- NetworkPolicy with empty `ingress` or `egress` rules (allows all traffic of that type)
- Workloads in production namespaces without both ingress AND egress NetworkPolicy
- Multi-tenant clusters without namespace-level network isolation

**Severity:** `high` for missing NetworkPolicy in production, `medium` for missing in non-production

## Output Format

### Gap Entry Structure

Each finding MUST use the standardized gap schema from `gap-entry-schema.md`:

```yaml
gap:
  id: "GAP-SECURITY-{seq}"
  category: "security-endpoint"
  severity: "{critical|high}"
  title: "Short description (max 80 chars)"
  description: "What was found, why it matters, what security implication it has"
  evidence:
    file: "relative/path/to/file"
    line: 42
    protocol: "rest"
  recommendation: "Actionable fix — add middleware, validate input, filter response"
  verified_by: "machine-detected"
  confidence: "{high|medium|low}"
```

**Protocol field:** Every gap entry MUST include a `protocol` field in the evidence section indicating which API protocol the finding applies to: `rest`, `graphql`, or `grpc`. This enables downstream consumers to filter and route findings by protocol.

#### GraphQL Gap Example

```yaml
gap:
  id: "GAP-SECURITY-015"
  category: "security-endpoint"
  severity: "critical"
  title: "Mutation resolver missing authorization checks"
  description: "createUser mutation has no @auth directive or guard. Any authenticated user can create accounts."
  evidence:
    file: "src/graphql/resolvers/user.resolver.ts"
    line: 42
    protocol: "graphql"
  recommendation: "Add @UseGuards(AuthGuard, RolesGuard) or @auth directive to the createUser mutation."
  verified_by: "machine-detected"
  confidence: "high"
```

#### gRPC Gap Example

```yaml
gap:
  id: "GAP-SECURITY-022"
  category: "security-endpoint"
  severity: "critical"
  title: "gRPC server missing auth interceptor in production config"
  description: "Server setup uses grpc.insecure_port without TLS. No auth interceptor in interceptor chain."
  evidence:
    file: "cmd/server/main.go"
    line: 58
    protocol: "grpc"
  recommendation: "Add TLS credentials and an auth interceptor to the gRPC server configuration."
  verified_by: "machine-detected"
  confidence: "high"
```

### Confidence Classification

- **high** — exact pattern match (e.g., no auth decorator/annotation on a `@PostMapping` handler)
- **medium** — heuristic match (e.g., handler accesses path parameter without obvious ownership check)
- **low** — ambiguous case (e.g., custom auth mechanism not recognized by pattern table)

### Budget Enforcement

Each gap entry should average approximately 100 tokens in structured YAML format.
Maximum output: 70 gap entries per scan.

If more than 70 gaps are detected:
1. Sort all findings by severity (critical > high)
2. Within same severity, sort by confidence (high > medium > low)
3. Keep the top 70 entries
4. Append a budget summary section:

```markdown
## Budget Summary
Total gaps detected: {N}. Showing top 70 by severity. Omitted: {N-70} entries.
```

## Output File

Write all findings to: `{planning_artifacts}/brownfield-scan-security.md`
