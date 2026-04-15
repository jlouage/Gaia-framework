---
key: "E1-S1"
title: "Implement counter.sh"
epic: "E1 — Core Counter"
status: done
points: 2
risk: low
---

# Story E1-S1 — Implement counter.sh

## User Story

As a HelloCounter user, I want a command that increments a counter, so that I can see the run count grow over time.

## Acceptance Criteria

- [x] AC1: First run prints `1` and creates `counter.txt`.
- [x] AC2: Subsequent runs print previous + 1.
- [x] AC3: Exit code 0 on success.

## Tasks

- [x] Write failing bats test (RED)
- [x] Implement `counter.sh` (GREEN)
- [x] Extract helper function (REFACTOR)

## Dev Agent Record

Captured as part of the v-parity-baseline golden fixture run. See transcripts/
for the raw workflow stdout and stderr.

## Review Gate

| Review | Status |
|--------|--------|
| Code Review | PASSED |
| QA Tests | PASSED |
| Security Review | PASSED |
| Test Automation | PASSED |
| Test Review | PASSED |
| Performance Review | PASSED |
