# Changelog

All notable changes to FluxStack will be documented in this file.

## [1.19.0] - 2026-04-11

### Major Refactor: Plugin System Extracted to `@fluxstack/plugin-kit`

The plugin system (manager, registry, executor, discovery, dependency
manager, module resolver, types) has been extracted from `core/plugins/`
into the new standalone package `@fluxstack/plugin-kit`. This is the
same playbook we used for `@fluxstack/live` in 1.16.0 — implementation
lives in the lib, `core/plugins/` is now a thin re-export shim layer
for backwards compatibility with existing `@core/plugins/*` imports.

**Impact:** ~3,300 lines of plugin system implementation deleted from
the app, `core/plugins/` went from 9 runtime files (4017 lines) to
2 thin shims (types.ts + index.ts, ~200 lines combined). Single
source of truth for plugin types and runtime is now
`@fluxstack/plugin-kit`.

### Breaking Changes

- **Auto-discovery removed from `PluginManager.initialize()`** (plugin-kit 0.4.0).
  The old code called `readdir('node_modules')` and `readdir('plugins')`
  at startup to discover plugins. This silently broke in production
  bundles where those directories don't exist, and prevented bundlers
  from statically including plugin code. Host apps must now register
  plugins explicitly via `framework.use(pluginObject)`. Dev and prod
  are now identical; the bundler can tree-shake.

- **`PluginManager` constructor requires `settings` and `clientHooks`**
  explicitly. These used to be read from the full config / imported
  as module-level singletons. Now they're injected:
  ```ts
  new PluginManager<FluxStackConfig>({
    config: fullConfig,
    settings: fullConfig.plugins,
    logger: pluginLogger,
    clientHooks: { register: (...) => pluginClientHooks.register(...) },
    app: this.app,
  })
  ```

- **`FluxStack.Plugin` generic over `TConfig`**. The legacy form
  (no generic) still works and defaults to `unknown`. FluxStack's
  shim specializes to `Plugin<FluxStackConfig>`.

- **Plugin classes discouraged, object literals are canonical**.
  All built-in plugins and `@fluxstack/plugin-csrf-protection` use
  `export const xxxPlugin: Plugin = { name, setup, ... }`. The
  `class X implements Plugin` form is retired from the generators
  but still technically accepted at runtime (it implements the
  same interface).

### Added

- **`@fluxstack/plugin-kit`** — new npm package. Types + runtime
  for the plugin system. Published at 0.4.0 as of this release.
  Used by FluxStack app and external plugin packages alike.
- **`tests/integration/framework/registered-plugins.test.ts`** (10 tests)
  — end-to-end verification that the four plugins registered via
  `framework.use()` in `app/server/index.ts` actually inject their
  hooks at runtime. Catches the class of bug where plugin objects
  are registered but no hook actually fires (the exact failure
  mode of the old auto-discovery in prod bundles).
- **Static plugin registration everywhere**. `app/server/index.ts`
  now imports `csrfProtectionPlugin` from `@fluxstack/plugin-csrf-protection`
  directly and registers via `.use()`. Same pattern as the built-ins.
- **Startup banner reads from the PluginRegistry**. The banner line
  `Plugins (N): ...` now lists exactly what `framework.getPluginRegistry().getAll()`
  returns, instead of relying on each plugin manually pushing itself
  to `globalThis.__fluxstackPlugins`. Backwards compatible — the old
  global is still read as a fallback.
- **`@fluxstack/sdk` deprecated on npm** with a message pointing
  users to `@fluxstack/plugin-kit`. The SDK was a static copy of
  plugin types + a duplicate of `@fluxstack/config`; both have
  canonical sources now.
- **`make:plugin` CLI** generates plain object literal plugins
  importing from `@fluxstack/plugin-kit`. Identifier generation
  fixed: `my-plugin` → `myPlugin` (not `myPluginPlugin`).

### Changed

- **`@fluxstack/live` family bumped** from `^0.6.0` to `^0.7.1`.
  Ships three follow-up bug fixes: opt-in `includeSelf` on `$room`
  proxy emit (#15), `deepAssign` clones plain objects to break
  external aliasing (#13), fail-loud protocol framing + telemetry (#7).
- **`create-fluxstack` README template**: removed the `loggerPlugin`
  example (that plugin was deleted), replaced class-based plugin
  example with object literal, added a hook reference table.
- **`plugins/README.md` template**: rewritten to reflect the static
  `.use()` model. Explicitly calls out that plugins are NOT
  auto-discovered. Points at `@fluxstack/plugin-csrf-protection`
  as the living reference implementation.
- **Bundle prod size** grew from ~2.46 MB to ~3.34 MB because
  `@fluxstack/plugin-csrf-protection` is now statically included.
  Before, it was dynamically loaded via `readdir('node_modules')`
  and the bundler couldn't see it.
- **Vite plugin startup banner label fixed** — `| Vite: embedded`
  only shows in development now. In production the vite plugin
  runs in static-fallback mode (serving `dist/client/`) and doesn't
  actually run a Vite dev server, so the label was misleading.

### Removed

- **6934 lines of dead test code** across 24 test files. Orphaned
  tests under `core/**/__tests__/*` never ran (vitest config was
  `include: tests/**/*.test.ts`) and 14 of 18 were broken on
  import when run directly. Also deleted 5 `describe.skip`'d test
  suites under `tests/` with abandoned TODOs pointing at APIs
  that were refactored away (Eden Treaty, ProjectCreator). Plus
  `vitest.config.live.ts`, an orphan config pointing at a
  directory that doesn't exist anymore.
- **`core/plugins/{manager,registry,executor,discovery,dependency-manager,module-resolver,config}.ts`**
  deleted from FluxStack app. Implementation lives in
  `@fluxstack/plugin-kit` now. `core/plugins/types.ts` and
  `core/plugins/index.ts` kept as thin shim barrels that re-export
  from the lib and specialize `<TConfig>` against `FluxStackConfig`.
- **Deprecated `configSchema` and `defaultConfig` fields** from the
  Plugin interface. Were marked `@deprecated` and had no call sites.
  Plugins use `@fluxstack/config` for declarative config instead.
- **`loggerPlugin`** — old built-in plugin that was already absent
  from the real codebase but still referenced in generated templates.
  Template references removed.

### Validation

- Typecheck (`bunx tsc --noEmit -p tsconfig.api-strict.json`) holds
  at the 60 pre-existing errors baseline throughout every step —
  zero regression across all four phases of the extraction.
- Full test suite: 42 test files, 652 passing, 5 skipped (all
  intentional individual `it.skip` TODOs).
- Dev and prod both show `Plugins (4): swagger, live-components,
  csrf-protection, vite` in the startup banner — identical output.

## [1.16.0] - 2026-03-13

### Major Refactor: Extract Live Components to Monorepo

Live Components code has been extracted from `core/` into standalone npm packages under the `@fluxstack/live` scope. This reduces the framework core by ~11,000 lines and allows the Live system to be versioned and published independently.

### Changed

- **Live Components are now npm packages**: `@fluxstack/live`, `@fluxstack/live-client`, `@fluxstack/live-react`, `@fluxstack/live-elysia`
- `core/server/live/` reduced from full implementation to thin re-exports from `@fluxstack/live` and `@fluxstack/live-elysia`
- `core/client/` reduced from full implementation to re-exports from `@fluxstack/live-client` and `@fluxstack/live-react`
- Vite config now includes source aliases for `@fluxstack/live`, `@fluxstack/live-client`, and `@fluxstack/live-react` (frontend dev uses TypeScript source directly)
- Tests migrated to v0.3.0 API: `setLiveComponentContext` DI pattern replaces `vi.mock`, async flush for `WsSendBatcher`
- CI Bun version updated to 1.3.2

### Added

- Typed LiveRoom demos: `LivePingPong`, `LiveSharedCounter` with dedicated Room classes (`ChatRoom`, `CounterRoom`, `DirectoryRoom`, `PingRoom`)
- `PingPongDemo.tsx`, `SharedCounterDemo.tsx` — new frontend demo components
- `LLMD/resources/live-binary-delta.md` — binary delta codec documentation
- `plugins/*/bun.lock` added to `.gitignore`
- Bundler now logs stdout/stderr on build failure for CI debugging

### Removed

- `core/server/live/ComponentRegistry.ts`, `WebSocketConnectionManager.ts`, `StateSignature.ts`, `LiveRoomManager.ts`, `RoomEventBus.ts`, `RoomStateManager.ts`, `FileUploadManager.ts`, `LiveComponentPerformanceMonitor.ts`, `LiveDebugger.ts`, `LiveLogger.ts` — moved to `@fluxstack/live`
- `core/server/live/auth/` — moved to `@fluxstack/live`
- `core/server/live/__tests__/` — moved to `fluxstack-live` monorepo
- `core/client/LiveComponentsProvider.tsx`, `Live.tsx`, `LiveDebugger.tsx` — moved to `@fluxstack/live-react`
- `core/client/hooks/useLiveComponent.ts`, `useRoom.ts`, `useRoomProxy.ts`, `useLiveDebugger.ts`, `useChunkedUpload.ts`, `useLiveChunkedUpload.ts`, `AdaptiveChunkSizer.ts`, `state-validator.ts` — moved to `@fluxstack/live-client`
- `core/build/vite-plugin-live-strip.ts` — moved to `@fluxstack/live`
- `LiveDebugger` UI and exports (removed entirely, not extracted)
- `LiveChat` and `LiveTodoList` demo components (replaced by new typed demos)
- `ChatDemo.tsx`, `TodoListDemo.tsx`, `LiveDebuggerPanel.tsx` — replaced by new demos
- `workspace.json` — stale config referencing non-existent `./packages/*`

### Fixed

- Bun bundler failing on Linux CI with `"Could not resolve: @fluxstack/live"` — caused by `"bun"` export condition in `@fluxstack/live@0.3.0` pointing to non-existent `src/` (fixed in `@fluxstack/live@0.3.1`)
- `live-components-generator.ts` basename extraction bug
- Vite aliases made conditional for CI compatibility

---

## [1.14.0] - 2026-02-15

### Security

- Harden Live Components against critical vulnerabilities: action whitelist enforcement, state prototype pollution guard, WebSocket message size limits, rate limiting
- Add `$private` server-only state with `TPrivate` generic for type-safe private data
- `ExtractActions` type now respects `publicActions` whitelist
- Harden static-files plugin with security headers, path traversal protection, streaming support

### Added

- **Live Component Debugger**: draggable floating window for real-time component inspection with rooms tab, collapsible JSON tree, settings panel (font size, compact mode, word wrap)
- Server-controlled debug activation (`DEBUG_LIVE` env var, defaults to `false`)
- Live component logs forwarded to debug panel as `LOG` events
- Two-channel logging architecture (LiveLogger for structured logs)
- Dynamic favicon and page title that change per route
- FluxStack logo in navbar with route-based hue shift and Live Docs button
- Mobile responsive layout with floating logo and adaptive sizing

### Fixed

- Prevent LiveDebugger from being imported in client-side bundle
- Normalize path separators in static file serving on Windows
- Handle undefined type from reactive config with nullish coalesce
- `setValue` added to `LiveForm.publicActions` to enable `$field()` sync
- Preserve active tab when selecting component in debugger
- Stop click propagation on expanded event details

### Changed

- Static-files plugin refactored to use Bun-native APIs instead of Node `fs`
- Debug config read from FluxStack config system instead of raw env vars
