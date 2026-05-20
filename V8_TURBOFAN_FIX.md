# V8 Turbofan renderer crash — Omnizen Desktop

**Symptom:** `npm run dev` boots, the Omnizen wrapper UI flashes for
~1 s, then the renderer process crashes and the window goes blank
(only titlebar + close button visible). Terminal log:

```
# Fatal error in , line 0
# RepresentationChangerError: node #512:Int32Sub of kRepWord32
# (Range(-9007199254740991, 9007199254740991)) cannot be changed to kRepWord32
…
Trace/breakpoint trap (core dumped)
```

Just before the crash, the log shows `Main window shown` — meaning the
prior window-show fallback (commit `9cef450`) is doing its job. The
crash is downstream of that.

## Root cause

Known **V8 Turbofan optimizer bug** in the V8 build shipped with
Electron 39 / Node 22.19. `RepresentationChangerError` on `Int32Sub`
with `Range(MIN_SAFE_INTEGER, MAX_SAFE_INTEGER)` is a known
miscompilation triggered by integer arithmetic that V8's type system
narrows to int32 while the actual operand range exceeds 32 bits
(date math, timestamp diffs, large `Math.min`/`Math.max`).

The offending function lives in upstream OpenWebUI's renderer bundle.
It doesn't trip the bug on the first paint because Turbofan takes
several JIT samples before promoting the function to optimised code
— which is why the UI flashes for ~1 s before the crash.

Crash is in the **renderer process** (PID matches the autofill log
line, which always comes from the renderer). The main process keeps
running — that's why the window stays open but blank.

## Mitigation — `--js-flags="--no-maglev"`

Disable V8's mid-tier compiler (Maglev) for the renderer via an
Electron command-line switch. Three options, ordered by perf cost:

1. `--js-flags="--no-maglev"` — disables only Maglev. Cheapest;
   often enough because Maglev is where these regressions first
   surface.
2. `--js-flags="--no-turbofan"` — disables top-tier Turbofan.
   Slower hot-path code, but the whole bug class disappears.
3. `--js-flags="--no-maglev --no-turbofan"` — bulletproof but
   measurably slower for heavy renderer work.

**Recommendation:** ship `--no-maglev` only; fall back to
`--no-turbofan` if the user still hits crashes.

### Where to add it

`src/main/index.ts`, near the existing `app.commandLine.appendSwitch(
'no-sandbox')` call (~line 74), so it's applied before app-ready:

```ts
// Workaround for a V8 Turbofan/Maglev miscompilation in the V8 build
// bundled with Electron 39 that crashes the renderer with a
// RepresentationChangerError on Int32Sub. Drop this once Electron
// rolls in the upstream V8 fix.
app.commandLine.appendSwitch('js-flags', '--no-maglev')
```

## Verification

1. Kill stale electron: `pkill -f node_modules/electron/dist/electron; sleep 1`
2. `npm run dev`
3. Wait ~60 s with the app idle — Turbofan hot-path optimisation
   normally triggers within the first 30 s. No
   `RepresentationChangerError` = fixed.
4. Click around (Settings, Connections sidebar, the Omnizen sign-in
   CTA once it renders) to exercise enough renderer code to trip any
   latent paths.
5. If `--no-maglev` alone doesn't hold, bump to
   `--no-maglev --no-turbofan`.

## Important: this fix is gated on a working GPU driver

If the host is still on nouveau (because the NVIDIA proprietary driver
isn't loading), even a clean renderer launch will eventually freeze
the whole desktop — that's a host-level issue, not a project one.
See `~/GPU_DRIVER_FIX.md`. **Apply the GPU fix first**, then verify
this V8 mitigation on a stable system.

## Out of scope

- Identifying the exact upstream OpenWebUI function that trips the V8
  bug — proper fix is at the V8 level, not the app level.
- Switching to Electron 40 (pre-release at time of writing).
- Pinning to Electron 38.x — that V8 build has different known
  crashes.

## Critical file

- `src/main/index.ts` — add `app.commandLine.appendSwitch('js-flags',
  '--no-maglev')` near line 74.
