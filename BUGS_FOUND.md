# BUGS_FOUND

New bugs discovered this session that are OUT OF SCOPE for the current queue
(logged, not fixed — per CONSTRAINTS "Scope for this session").

## 1. `elementsById` map grows unbounded across scans (minor memory leak)
- File: `src/content-script.ts` (`elementsById`), `squintIdCounter` in
  `src/dom-scanner.ts`.
- `squintIdCounter` increments globally on every scan and `elementsById.set()`
  is never cleared, so repeated Cleanse cycles accumulate stale entries.
- Impact: memory only — NOT a functional/undo bug. `applyChosenPreset` reads
  only the current `failingElements`, so behavior stays correct.
- Repro: open popup, Cleanse/undo repeatedly on a large page; inspect
  `elementsById.size` — grows each cycle, never shrinks.
- Note: `runSimplifyScan()` already clears its own map/counter each run; the
  contrast-fix path does not. Fix would be to clear `elementsById` + reset the
  counter at the start of `runScan()` — deferred to avoid scope creep.
