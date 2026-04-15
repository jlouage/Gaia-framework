# PRD — Parity Baseline Sample Project

> **Minimal PRD for the parity baseline golden fixture.**
> This is the smallest viable PRD used to drive the custom-engine end-to-end
> capture that seeds `v-parity-baseline`. It is intentionally trivial so that
> the Cluster 19 parity harness has a stable, tiny reference point.

## Product

**Name:** HelloCounter
**One-liner:** A command-line counter that increments an integer on each run.

## Why

We need a byte-level reproducible workflow to anchor the GAIA Native Conversion
program. HelloCounter is small enough that transcripts, artifacts, and
checkpoints fit well under the 5 MB fixture budget.

## Users

- Parity harness CI jobs (primary)
- GAIA contributors validating native plugin parity (secondary)

## Functional Requirements

- **FR-001** HelloCounter reads an integer from `counter.txt`, increments it by 1, and writes it back.
- **FR-002** First run initializes the counter to 1 if `counter.txt` is absent.
- **FR-003** Each run prints the new value to stdout.

## Non-Functional Requirements

- **NFR-001** No external dependencies beyond POSIX shell.
- **NFR-002** Single-file implementation (`counter.sh`).

## Out of Scope

- Concurrency, persistence across machines, UI, configuration.
