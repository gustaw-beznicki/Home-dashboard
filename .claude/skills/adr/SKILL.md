---
name: adr
description: Use when the user asks to "record this as an ADR", "write an ADR", "document this decision", "update the decision log", or "add to docs/adl" — and proactively whenever a decision with real architectural weight is made in this repo (new dependency, infra/auth/deploy-model change, a choice between real alternatives with lasting trade-offs). Not for routine bug fixes, styling, or reversible one-line tweaks.
---

# Architecture Decision Records for this repo

This repo keeps an architecture decision log (ADL) at `docs/adl/` — one architecture decision
record (ADR) per significant decision, plus an index. Background:
[architecture-decision-record/architecture-decision-record](https://github.com/architecture-decision-record/architecture-decision-record).

## When to record one

A decision is ADR-worthy if it has real alternatives and lasting consequences: choice of backend/
auth/deploy model, adding a new dependency or service, a security-relevant trade-off, anything a
future contributor would otherwise have to reconstruct from git archaeology. It is not ADR-worthy
for: bug fixes, refactors with no behavior change, styling, typo fixes, or anything easily reversed
with no real trade-off.

If in doubt, err toward recording it — a short ADR costs little; a missing one costs a future
session having to re-derive the reasoning from scratch.

## Workflow

1. Read `docs/adl/README.md` to find the highest existing number.
2. Create `docs/adl/NNNN-<title>.md` (next number, zero-padded to 4 digits) using `template.md` in
   this folder. Title is a present-tense imperative verb phrase, lowercase-dash-separated, matching
   the filename minus the number (e.g. `0008-switch-to-vitest-browser-mode.md`).
3. Fill in Context / Decision / Consequences from the actual conversation and code — don't
   speculate about alternatives that weren't really considered. Status is `Accepted` unless the
   decision is still being debated (`Proposed`) or explicitly reverses an earlier one
   (`Superseded by [NNNN](...)` — also go back and update that earlier record's own Status line).
4. Add one row to the table in `docs/adl/README.md`.
5. Don't ask permission before writing the ADR itself — it's a doc addition, low blast radius. Do
   mention in your response that you recorded it and where.

Writing the ADR doesn't replace normal commit/PR hygiene — it can ship in the same PR as the change
it documents, or (for backfilling past decisions) its own docs-only PR.
