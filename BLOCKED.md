# BLOCKED

## YouTube — Cleanse reports "Fixed N elements" but no visible change

**Status:** blocked — requires live YouTube DOM inspection I cannot perform (no
real Chrome available in this environment). Per CONSTRAINTS stop-and-ask rules,
not blind-patching: a speculative fix risks a disguised site rule or a
cross-site regression.

**What I could verify from code (no browser):**
- The fix path injects one `<style id="squint-injected-style">` rule per failing
  element: `[data-squint-id="N"]{color:… !important;background-color:… !important;
  background-image:none !important;}` (`src/apply-fixes.ts:16`).
- The selector is a single attribute selector — specificity (0,1,0). Any site
  rule with higher specificity AND `!important` (e.g. `#id .cls{…!important}`)
  wins the cascade even though ours is `!important` and later in source order,
  because `!important` ties are broken by specificity first, source order only
  after. YouTube ships many such high-specificity `!important` rules.

**Ranked hypotheses for "fixed but invisible":**
1. **Cascade override (most likely):** the 3 matched elements are also targeted
   by a YouTube `!important` rule with higher specificity, so our color/bg never
   takes effect. Symptom fits: rule count is correct, paint is unchanged.
2. **Text painted by a descendant/pseudo, not the matched element:** we fix
   `color` on the element that owns the text node, but the visible glyphs are a
   child (e.g. `<span>` inside) whose own `color:!important` shadows the parent.
3. **Zero visible area at fix time:** element is collapsed/clipped
   (`overflow:hidden` + 0 height) or offscreen when scanned via the idle-batch
   path, so recoloring changes nothing on screen.
4. **Post-fix re-render:** YouTube's SPA re-renders the node, dropping the
   `data-squint-id` attribute (our selector then matches nothing). The
   persistence observer only re-adds the *style element* if removed — it does
   NOT re-stamp attributes onto re-created DOM nodes.

**Manual diagnostic for the user (run in Chrome DevTools on the YouTube page,
after clicking "Cleanse my eyes"):**
1. Console: `document.querySelectorAll('[data-squint-id]').length` — how many
   elements still carry the attribute? If far fewer than the reported count →
   hypothesis 4 (re-render dropped attributes).
2. Console: `[...document.querySelectorAll('[data-squint-id]')].map(e => e.outerHTML.slice(0,120))`
   — paste the actual 3 elements here so they can be traced.
3. For each, in the Elements panel select it → Styles pane → check whether the
   `[data-squint-id="N"]` rule shows any property struck through (overridden).
   Struck-through `color`/`background-color` → hypothesis 1 or 2.
4. Check computed `getBoundingClientRect()` for each — width/height 0 →
   hypothesis 3.

Once the actual 3 elements + which hypothesis holds are known, the fix is
targeted (e.g. boost selector specificity, or re-stamp attributes on the
observer's re-render callback) and can be done in a follow-up session without
guessing.

## Shadow-DOM integration test needs jsdom (blocked by no-new-deps)

**Status:** partial — code shipped, one requested test could not be added.
Task 2 asked for a unit fixture with "a custom element + shadow root containing
a low-contrast element, assert it's detected and fixed." That requires a DOM
environment with `attachShadow`/`ShadowRoot` — jsdom or happy-dom. Neither is
installed, and CONSTRAINTS forbids adding npm dependencies. Per the stop-and-ask
rule ("a fix seems to require a new dependency → pause and log"), the DOM
integration test is deferred.

**What was done instead (no new deps):**
- The shadow-traversal logic (`collectElementsDeep`) and the image-exclusion
  logic (`containsImageContent`) were extracted as pure/duck-typed seams and
  unit-tested in the existing node environment (`tests/dom-scanner.test.ts`,
  8 tests) — covering light DOM, single shadow root, nested shadow roots, and
  the absent/closed-root case.
- The real-DOM behavior (scan + scoped-style fix actually reaching inside a live
  shadow root, and undo removing the per-root style) is left as manual TESTPLAN
  step 9.

**To lift this block:** if the user approves adding `jsdom` (or `happy-dom`) as a
devDependency and a `vitest` config with `environment: 'jsdom'`, the integration
test can be written directly.
