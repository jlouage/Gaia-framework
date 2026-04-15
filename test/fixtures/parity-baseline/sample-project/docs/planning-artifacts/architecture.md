# Architecture — HelloCounter

## Overview

HelloCounter is a single POSIX shell script that reads an integer from
`counter.txt`, increments it, writes it back, and echoes the new value.

## Components

| Component | Responsibility |
|-----------|---------------|
| `counter.sh` | Entry point — read, increment, write, echo |
| `counter.txt` | Persistent state — a single line containing the current integer |

## Data Flow

```
run → read counter.txt → integer + 1 → write counter.txt → echo integer
```

## ADRs

- **ADR-001** Use POSIX shell (no bash-isms) to maximize portability of the parity fixture.
- **ADR-002** State is stored in a plain text file in the working directory — no config path resolution.

## Testing Strategy

- Unit: one bats test asserting the increment behavior across three consecutive runs (1 → 2 → 3).
- Integration: N/A — the script is the whole system.

## Risks

- `counter.txt` corruption: the script treats non-integer content as `0` and overwrites.
