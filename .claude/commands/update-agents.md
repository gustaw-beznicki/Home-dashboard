---
description: Surgically update AGENTS.md to reflect the current state of the codebase
allowed-tools: Read, Bash, Edit, Write, Skill
---

# Update AGENTS.md

Keep AGENTS.md accurate and minimal. The goal is surgical updates — fix what's stale, add what's missing, delete what no longer exists. Never rewrite sections that are still correct.

## Phase 1 — Read the baseline

Read `AGENTS.md` in full before doing anything else. Treat every section as correct until proven otherwise. Note the structure, section order, and every specific claim (versions, paths, commands, patterns).

If AGENTS.md does not exist, skip to Phase 2 and create it from scratch at the end.

## Phase 2 — Discover AI convention sources

Glob for convention files, **excluding node_modules**:

```bash
find . -maxdepth 4 -not -path "*/node_modules/*" \( \
  -name "AGENTS.md" -o -name "AGENT.md" -o -name "CLAUDE.md" \
  -o -name ".cursorrules" -o -name ".windsurfrules" -o -name ".clinerules" \
  -o -name "copilot-instructions.md" -o -name "README.md" \
\) 2>/dev/null
```

Read any files found. Note: README.md may be aspirational — treat it as background context, not ground truth.

## Phase 3 — Audit the codebase for changes

Check only the things most likely to drift:

**Commands and tooling:**
- `package.json` → scripts, `packageManager` field, `engines`
- `pnpm-lock.yaml` line 1 → lockfileVersion (indicates pnpm major)
- `.github/workflows/` → CI steps, build commands

**Project structure:**
- Verify every directory/file path mentioned in AGENTS.md actually exists
- Check for new top-level dirs or renamed paths
- `src/pages/` → routing (new pages = new routes to document)
- `src/site.config.ts` → feature flags, exported types, new fields
- `sanity/schemas/` → schema files (if any were added)

**Environment variables:**
- `.env.example` → any new or removed vars; verify public/private split is still accurate

**Dependencies:**
- Check major versions only: `cat package.json | grep -E '"(astro|sanity|react|tailwindcss)"'`

**GitHub config:**
- `.github/CODEOWNERS`, `.github/dependabot.yml` → confirm branch/team names still match

## Phase 4 — Identify what needs updating

For each item audited, classify:

- **Stale** — something in AGENTS.md no longer matches the codebase (path moved, script removed, version major bump)
- **Missing** — something important in the codebase has no entry in AGENTS.md
- **Accurate** — leave it exactly as-is, do not rephrase

Only proceed with changes for Stale and Missing items.

**Do not add:**
- Anything sourced only from README.md that cannot be verified in actual files
- Generic advice ("write tests", "handle errors")
- Aspirational patterns not yet present in the code
- Patch versions anywhere — use major versions only (e.g. `10.x` not `10.33.3`); the `packageManager` field in `package.json` is the authoritative pin

## Phase 5 — Apply minimal updates

Make the smallest edits that make AGENTS.md accurate:

- Edit existing sentences in-place rather than adding new sections
- Place new content in the most logical existing section
- Remove entries for files/dirs that no longer exist
- Do not change section order or formatting style

## Phase 6 — Summarise changes

After updating, output a compact summary:

```markdown
## AGENTS.md update summary

**Updated:** <list of stale items fixed>
**Added:** <list of new items added>
**Removed:** <list of items removed>
**Unchanged:** <count> sections verified accurate, left as-is
```

If nothing needed changing, say so explicitly — a verified-accurate AGENTS.md is a good outcome.

## Phase 7 — Sync CLAUDE.md

After AGENTS.md is updated (or verified accurate), invoke the built-in `/init` skill to keep CLAUDE.md in sync with the same codebase snapshot.

```text
use Skill: init
```
