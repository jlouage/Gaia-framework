# Bridge Toggle — Post-Complete Checklist

## Validation Items

- [ ] `bridge_enabled` flag in global.yaml is in the target state (true for enable, false for disable)
- [ ] All YAML comments in global.yaml are preserved after the write
- [ ] No other keys in global.yaml were modified (only `bridge_enabled` value changed)
- [ ] Idempotent behavior verified: invoking the same mode twice produces no write on the second invocation
- [ ] Post-toggle summary was displayed with previous state, new state, and next-step suggestion
- [ ] Summary includes reminder to run `/gaia-build-configs`
- [ ] For disable mode: post-flip checks section was skipped entirely
- [ ] Example file is present at `{project-root}/docs/test-artifacts/test-environment.yaml.example` post-install and post-update
