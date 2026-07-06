# CONSTRAINTS.md — Squint autonomous session rules

Read this in full before starting, and re-read before every retry loop.
TESTPLAN.md is the exit criteria — this file is the boundary/scope criteria.
If any planned action would violate a rule below, STOP, write the issue and
why to BLOCKED.md, and move to the next queued task instead of proceeding.

## Hard boundaries — never cross without explicit user approval
- No AI/LLM/API calls anywhere in src/. No new npm dependencies of any kind.
- No changes to popup UI, popup.html, popup.css, or the toggle UX/theme.
- No changes to the "Cleanse my eyes" single-toggle interaction model.
- No renaming/restructuring existing files. One concern per file stays as-is.
- No `any`, no dead code, no TODO placeholders left behind.
- Don't touch layout, spacing, font-family/size, images, or SVG fills
  (non-goals per architecture — this applies to Simplify mode too).
- Don't modify tests to make them pass — fix the code, not the assertion.
- Windows/PowerShell environment: use `Remove-Item -Recurse -Force`, not `rm -rf`.

## Scope for this session
Work ONLY the tasks in the ordered queue given in the prompt. If you discover
a new bug not in the queue, log it to BUGS_FOUND.md with repro steps — do not
fix it in this session.

## Definition of done (every task)
1. TESTPLAN.md Automated section passes in full (steps 1–6), self-run and
   self-verified — do not stop early or ask for confirmation mid-loop.
2. Write a short entry to SESSION_LOG.md: what was changed, why, which files.
3. Manual section of TESTPLAN.md is left as clear numbered instructions for
   the user to run themselves (you cannot open a real Chrome browser) —
   do not claim a manual step passed if you didn't/couldn't run it.

## Stop-and-ask triggers
Pause and write to BLOCKED.md (don't guess, don't proceed) if:
- Root-causing a bug seems to require touching popup UI or the toggle model.
- A fix seems to require a new dependency or any network/API call.
- Two consecutive fix attempts for the same bug fail TESTPLAN Automated —
  stop, summarize both attempts and current hypothesis, move to next task.
- You're unsure whether something counts as a "concern" boundary violation.

## Session hygiene
- Commit locally between tasks with clear messages (no push unless asked).
- Never delete TESTPLAN.md, CONSTRAINTS.md, or SESSION_LOG.md.
- If context runs low, write a handoff note to SESSION_LOG.md before stopping.