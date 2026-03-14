# Changelog

All notable changes to FluxStack will be documented in this file.

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
