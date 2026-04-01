# Config Contradiction Scanner — Subagent Prompt Template

> Brownfield deep analysis scan subagent for detecting contradictory configuration values across files.
> Reference: Architecture ADR-021, Section 10.15.2, 10.15.3, 10.15.5, ADR-022 §10.16.5
> Infra-awareness: E12-S6 — applies infra-specific patterns when project_type is infrastructure or platform.

## Subagent Invocation

**Input variables:**
- `{tech_stack}` — Detected technology stack from Step 1 discovery
- `{project-path}` — Absolute path to the project source code directory
- `{project_type}` — Project type: `application`, `infrastructure`, or `platform`

**Output file:** `{planning_artifacts}/brownfield-scan-config-contradiction.md`

## Subagent Prompt

```
You are a Config Contradiction Scanner for brownfield project analysis. Your task is to discover config files in the target project, build key-value maps, cross-reference values across files, and report contradictions using the standardized gap schema.

### Inputs
- Tech stack: {tech_stack}
- Project path: {project-path}
- Project type: {project_type}
- Gap schema reference: Read _gaia/lifecycle/templates/gap-entry-schema.md for the output format

### Step 1: Config File Discovery

Discover config files using glob patterns. Apply both generic and stack-specific patterns.

**Generic patterns (always apply):**
- `**/*.yaml`, `**/*.yml` — YAML config files
- `**/*.json` — JSON config files (exclude package-lock.json, yarn.lock)
- `**/*.env` and `**/.env*` — Environment variable files
- `**/*.toml` — TOML config files (exclude Pipfile.lock)
- `**/*.ini` — INI config files
- `**/*.properties` — Java properties files
- `**/config*.xml` — XML config files

**Exclusion patterns (always apply):**
- `node_modules/`, `vendor/`, `dist/`, `build/`, `.git/`
- Lock files: `package-lock.json`, `yarn.lock`, `Pipfile.lock`, `go.sum`, `pnpm-lock.yaml`
- Test fixtures and mock data directories

**Stack-specific patterns (apply based on {tech_stack}):**

#### Java/Spring
- `application.yml`, `application.properties`, `bootstrap.yml`
- `application-{profile}.yml`, `application-{profile}.properties`
- `src/main/resources/**/*.properties`, `src/main/resources/**/*.yml`

#### Node/Express
- `.env`, `.env.production`, `.env.development`, `.env.test`, `.env.local`
- `config/` directory contents
- `package.json` scripts section

#### Python/Django
- `settings.py`, `settings/*.py`
- `.env`, `pyproject.toml` tool sections
- `config.py`, `config/*.py`

#### Go/Gin
- `config.yaml`, `config.json`, `config.toml`
- `.env`
- Struct tags with `json:` / `mapstructure:` bindings

### Step 1b: Infrastructure Config File Discovery (E12-S6)

**Apply ONLY when {project_type} is `infrastructure` or `platform`.**

In addition to the generic and stack-specific patterns above, scan for infrastructure configuration files:

#### Terraform
- `**/*.tf` — Terraform configuration files
- `**/*.tfvars` — Terraform variable files (terraform.tfvars, *.auto.tfvars)
- `**/*.tfvars.json` — JSON-format Terraform variables
- `**/terraform.tfstate` — State files (check for drift, do not parse fully)
- `**/backend.tf` — Backend configuration

#### Helm / Kubernetes
- `**/values.yaml`, `**/values-*.yaml` — Helm values files (values.yaml, values-dev.yaml, values-prod.yaml)
- `**/Chart.yaml` — Helm chart metadata
- `**/templates/**/*.yaml` — Helm templates (scan for hardcoded values vs template refs)
- `**/*.yaml` in directories matching `k8s/`, `kubernetes/`, `manifests/`, `deploy/`

#### Kustomize
- `**/kustomization.yaml`, `**/kustomization.yml` — Kustomize configs
- `**/overlays/**/*.yaml` — Kustomize overlay patches (detect contradictions between base and overlays)
- `**/base/**/*.yaml` — Kustomize base resources

#### Docker / Compose
- `**/Dockerfile*` — Dockerfile variants
- `**/docker-compose*.yml`, `**/docker-compose*.yaml` — Compose files
- `**/.dockerignore` — Docker ignore files

#### CI/CD
- `.github/workflows/**/*.yml` — GitHub Actions workflows
- `**/.gitlab-ci.yml` — GitLab CI config
- `**/Jenkinsfile*` — Jenkins pipelines
- `**/.circleci/config.yml` — CircleCI config

**Infra contradiction detection focus areas:**
- Same variable defined differently across terraform.tfvars files for different environments
- Helm values.yaml contradicting kustomize overlay values for the same resource
- Port numbers, resource limits, replica counts, and image tags inconsistent across environments
- Backend configuration (S3 bucket, DynamoDB table) mismatched between Terraform state backends

### Step 2: Build Key-Value Maps

For each discovered config file, extract a key-value map:
- Parse structured formats (YAML, JSON, TOML, INI, properties) into nested key paths
- For .env files: parse KEY=VALUE pairs
- For Terraform files: extract variable defaults, locals, and resource attributes
- For Helm values: extract the full values tree
- For kustomize overlays: extract patch operations and their target values

### Step 3: Cross-Reference and Detect Contradictions

Compare key-value maps across files:
- Same key path with different values across files = contradiction
- Environment-specific overrides that conflict with defaults
- Port/host/URL mismatches between services
- For infra projects: resource specification mismatches between environments

### Step 4: Output

Format each contradiction as a gap entry using the standardized schema:
- category: `config-contradiction`
- For infra-specific contradictions (terraform.tfvars, values.yaml, kustomize): also tag with infra context in the description
- id: `GAP-CONFIG-{seq}` — sequential numbering starting at 001
- verified_by: `machine-detected`
- Budget: max 70 entries, truncate low-severity entries if exceeded
```

## Output File

Write all findings to: `{planning_artifacts}/brownfield-scan-config-contradiction.md`
