# Epics and Stories — HelloCounter

## Epic E1 — Core Counter

One epic, one story — the smallest viable breakdown.

### Story E1-S1 — Implement counter.sh

- **As a** HelloCounter user
- **I want** a command I can run that increments a counter
- **So that** I can see the run count grow over time
- **Acceptance Criteria:**
  - AC1: Running `counter.sh` for the first time prints `1` and creates `counter.txt`.
  - AC2: Each subsequent run prints the previous value plus one.
  - AC3: The script exits 0 on success.

Points: 2 (S). Status: done (captured as part of the parity baseline).
