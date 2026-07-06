# Squint — Test Plan

Used as exit criteria for Claude Code prompts. Agent runs "Automated" sections itself, iterates until they pass, before reporting done. "Manual" sections require the user in Chrome.

## Automated (Claude Code can self-run, no browser needed)

1. Build: `node esbuild.config.mjs` — must complete with no errors, exit code 0.
2. Syntax check: `node --check dist\popup\popup.js` and `node --check dist\content-script.js` — must be silent.
3. Unit tests: `npm test` (or equivalent) — all 34+ tests must pass, 0 failing.
4. No stray AI/network calls: `Select-String -Path src\*.ts,src\**\*.ts -Pattern "fetch|api.anthropic|api.openai|apiKey"` — must return nothing.
5. No `any`, strict mode clean: `tsc --noEmit` — must be silent.
6. Grep for dead code / placeholders / TODO left behind — must return nothing unresolved.

If any automated check fails, fix and re-run before declaring done. Do not report back to user until 1–6 pass.

## Manual (user must run in real Chrome)

Only run after Automated section passes.

1. `chrome://extensions` → click reload icon on Squint (not remove/re-add).
2. Close test tab fully, open fresh tab to test site.
3. Right-click Squint icon → Inspect → Console tab (leave open before clicking anything).
4. Click "Cleanse my eyes." Record: fix count shown, any console errors.
5. Click again to undo. Record: does it revert cleanly, or "Undo failed"? Any console errors?
6. Repeat steps 4–5 once more (apply → undo → apply → undo, x2 total) — confirm no state drift, no crash on second cycle.
7. Repeat full 4–6 sequence on a second test site (badhtml.com + one other real-world site).

Report exact console output (or "empty") for every step — do not summarize as "worked" / "didn't work."

### Manual — image safety (Task 1)
8. On badhtml.com, before cleansing, note any logos/content `<img>` on screen.
   Click "Cleanse my eyes." Confirm NO image is flattened to a solid gray/color
   box — images must look identical before and after. Report any that change.

### Manual — shadow DOM (Task 2, cannot be automated without jsdom)
9. Open a page that uses open shadow roots / web components (e.g. any site built
   with Lit/Stencil, or a quick local page with a custom element whose shadow
   root contains low-contrast text). Cleanse. Confirm low-contrast text INSIDE
   the shadow root is recolored, and that undo reverts it. Report console output.

## Test sites
- badhtml.com — primary stress test, chaotic real CSS
- pnwx.com — known 0-failures case (correct behavior, not a bug)
- shadow DOM (open roots) — any web-component page; verifies scan + fix pierce
  open shadow roots. Closed shadow roots are unreachable by design (non-goal).

## Current known state (update as resolved)
- Undo bug: FIXED (code-verified; needs manual Chrome confirmation, steps 4–6).
  Real cause was observer ordering (already corrected in 209b49b: stopObserver
  runs before removeFixes). This session removed a leftover debug `console.error`
  in popup and rewrote the REMOVE_FIXES / SIMPLIFY_REMOVE branches so
  `sendResponse` always fires (previously swallowed in try/catch). MV3 note: the
  earlier "missing `return true`" theory does not apply — synchronous
  `sendResponse` delivers without `return true`.
- Simplify mode: BUILT (already existed: src/simplify.ts + src/simplify-apply.ts,
  independent attribute/style/observer/toggle).
- Simplify small-image heuristic flagged avatars: FIXED. Added generic
  cross-site `isLikelyAvatar` guard (circular render + avatar/profile keywords).
- YouTube "Fixed 3 elements, no visible change" (Cleanse): BLOCKED — needs live
  YouTube DOM inspection. See BLOCKED.md for hypotheses + user diagnostic steps.
- Logo/content images flattened to gray (Task 1): FIXED. dom-scanner now excludes
  any element that IS or CONTAINS an `<img>`/`<picture>` from selection, so no
  background fix is ever applied over image content. Unit-tested
  (`containsImageContent`). Manual step 8 confirms visually.
- Shadow DOM coverage (Task 2): IMPLEMENTED. dom-scanner pierces open shadow roots
  (`collectElementsDeep`); apply-fixes injects a scoped `<style>` per shadow root
  (document-level style cannot cross the boundary) and undo removes all of them.
  Open roots only — closed roots are a documented non-goal. Traversal unit-tested;
  real-shadow-root integration is manual step 9 (jsdom not installed, no-new-deps
  constraint — see BLOCKED.md).
- Automated 1–6: all pass (70 unit tests). Manual 1–9: not run (no browser).
