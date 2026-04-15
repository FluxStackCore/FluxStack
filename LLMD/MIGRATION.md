# Migration Guide: ai-context/ → LLMD/

**Version:** 1.19.0 | **Updated:** 2026-04-14

## Overview

This document explains the migration from the old `ai-context/` documentation structure to the new `LLMD/` (LLM Documentation) structure. The new system is optimized for token efficiency, direct information access, and accurate reflection of the current codebase.

## Key Changes

### Philosophy Shift

**Old (`ai-context/`):**
- Mixed Portuguese and English content
- Verbose explanations with context
- Scattered information across multiple files
- Some outdated content from v1.9

**New (`LLMD/`):**
- English-only for consistency
- Direct, technical language without fluff
- Modular organization by domain
- Reflects current v1.11.0 codebase
- Single entrypoint (INDEX.md) for quick navigation

### Directory Structure Mapping

| Old Location | New Location | Notes |
|-------------|--------------|-------|
| `ai-context/00-QUICK-START.md` | `LLMD/INDEX.md` | Now a navigation hub |
| `ai-context/project/overview.md` | `LLMD/core/framework-lifecycle.md` | More detailed lifecycle |
| `ai-context/project/architecture.md` | `LLMD/core/plugin-system.md` | Split into focused docs |
| `ai-context/project/configuration.md` | `LLMD/config/declarative-system.md` | Expanded config docs |
| `ai-context/project/build-pipeline.md` | `LLMD/core/build-system.md` | Updated for v1.11.0 |
| `ai-context/development/patterns.md` | `LLMD/patterns/project-structure.md` | Split by topic |
| `ai-context/development/eden-treaty-guide.md` | `LLMD/resources/routes-eden.md` | Focused on route creation |
| `ai-context/development/plugins-guide.md` | `LLMD/resources/plugins-external.md` | Plugin development only |
| `ai-context/development/live-components.md` | `LLMD/resources/live-components.md` | Maintained |
| `ai-context/development/monitoring.md` | *(Removed)* | Not core framework feature |
| `ai-context/reference/environment-vars.md` | `LLMD/config/environment-vars.md` | Comprehensive table format |
| `ai-context/reference/cli-commands.md` | `LLMD/reference/cli-commands.md` | Complete command reference |
| `ai-context/reference/config-api.md` | `LLMD/config/runtime-reload.md` | Focused on reload mechanism |
| `ai-context/reference/troubleshooting.md` | `LLMD/reference/troubleshooting.md` | Updated for v1.11.0 |
| `ai-context/examples/crud-complete.md` | *(Integrated)* | Examples now inline in docs |
| `ai-context/recent-changes/` | *(Removed)* | Version tracking in each doc |

## Content Changes

### What's New in LLMD/

1. **Plugin Hooks Reference** (`reference/plugin-hooks.md`)
   - Complete hook reference table
   - Execution order documentation
   - Hook context interfaces

2. **Type Safety Patterns** (`patterns/type-safety.md`)
   - Eden Treaty type flow diagrams
   - Type inference examples
   - Common type issues

3. **Anti-Patterns** (`patterns/anti-patterns.md`)
   - Common mistakes and violations
   - What NOT to do
   - Framework rules enforcement

4. **Runtime Configuration** (`config/runtime-reload.md`)
   - ReactiveConfig usage
   - Hot reload mechanism
   - Watch callbacks

5. **Controllers Pattern** (`resources/controllers.md`)
   - Business logic separation
   - Service layer patterns
   - Error handling

### What's Removed

- **Monitoring documentation**: Not a core framework feature (plugin-specific)
- **Recent changes directory**: Version tracking now in each document
- **Verbose examples**: Replaced with minimal, inline examples
- **Portuguese content**: All content now in English

### What's Updated

- **Version**: All docs reflect v1.11.0
- **Code examples**: Validated against current codebase
- **Environment variables**: Complete and accurate list
- **CLI commands**: All current commands documented
- **Plugin system**: Updated with latest architecture

## Migration Timeline

### Phase 1: Coexistence (Current)
- Both `ai-context/` and `LLMD/` exist
- `ai-context/` marked as deprecated
- New content goes to `LLMD/`

### Phase 2: Transition (Future)
- Update all references to point to `LLMD/`
- Add redirects in `ai-context/` files
- Keep `ai-context/` for reference

### Phase 3: Deprecation (Future)
- Archive `ai-context/` to separate branch
- Remove from main branch
- `LLMD/` becomes primary documentation

## How to Use LLMD/

### For LLMs

1. **Start with INDEX.md**: Single entrypoint with navigation
2. **Load only what you need**: Modular files save tokens
3. **Check version**: Each doc includes version and update date
4. **Follow links**: Related docs are cross-referenced

### For Developers

1. **Quick reference**: INDEX.md has all critical rules
2. **Deep dive**: Follow links to specific topics
3. **Troubleshooting**: reference/troubleshooting.md for common issues
4. **Examples**: Inline examples in each resource doc

## Quick Reference Mapping

### Common Tasks

| Task | Old Path | New Path |
|------|----------|----------|
| Create a route | `development/eden-treaty-guide.md` | `resources/routes-eden.md` |
| Configure app | `project/configuration.md` | `config/declarative-system.md` |
| Create plugin | `development/plugins-guide.md` | `resources/plugins-external.md` |
| Fix errors | `reference/troubleshooting.md` | `reference/troubleshooting.md` |
| Understand lifecycle | `project/architecture.md` | `core/framework-lifecycle.md` |
| CLI commands | `reference/cli-commands.md` | `reference/cli-commands.md` |

### Critical Rules (Unchanged)

These rules remain the same in both documentation systems:

- **NEVER** modify files in `core/` (framework is read-only)
- **NEVER** wrap Eden Treaty in custom functions
- **NEVER** omit response schemas in routes
- **ALWAYS** work in `app/` directory
- **ALWAYS** use native Eden Treaty: `const { data, error } = await api.users.get()`
- **ALWAYS** define shared types in `app/shared/`

## Changes v1.12 to v1.19

This section documents the major changes that occurred between v1.12 and v1.19. All LLMD documents have been updated to reflect these changes.

### Plugin-Kit Extraction (v1.19)

- **Auto-discovery removed**: The automatic plugin discovery from `node_modules/` was removed in `@fluxstack/plugin-kit@0.4.0` because it broke silently in production bundles (`dist/node_modules/` does not exist).
- **Manual registration via `.use()`**: Every plugin the app wants to enable must now be explicitly imported and registered via `.use()` in `app/server/index.ts`.
- **Project plugins (`plugins/`)**: Also require explicit registration; the `PLUGINS_DISCOVER_PROJECT` env var no longer applies.
- **Example** (from `app/server/index.ts`):
  ```typescript
  import { csrfProtectionPlugin } from "@fluxstack/plugin-csrf-protection"

  const framework = new FluxStackFramework()
    .use(swaggerPlugin)
    .use(liveComponentsPlugin)
    .use(csrfProtectionPlugin)
  ```

### @fluxstack/live 0.7.2

- **Custom `generateId`**: LiveServer now accepts a custom ID generator function, allowing UUIDs, nanoid, or any other strategy.
- **WebSocket optimizations**: Reduced overhead on message encoding/decoding and improved reconnection logic.

### Reactive State Proxy (v1.12)

- State mutations auto-sync with the frontend via Proxy.
- `this.state.count++` triggers a `STATE_DELTA` automatically.
- `setState()` remains available for batch updates (multiple properties in a single emit).

### Static defaultState (v1.12)

- `defaultState` is now defined inside the class as a static property.
- Old pattern (`export const defaultState = {...}` outside the class) is deprecated.
- Less boilerplate, better encapsulation.

### Theme System (v1.18)

- Built-in theme support for the frontend with light/dark mode.
- Theme configuration via `config/client.config.ts`.

---

## Feedback

If you find outdated content or missing information in `LLMD/`, please update the relevant document and increment the update date.

## Related Documents

- [INDEX.md](INDEX.md) - Main navigation hub
- [requirements.md](../.kiro/specs/llm-docs-refactor/requirements.md) - Requirements for this refactor
- [design.md](../.kiro/specs/llm-docs-refactor/design.md) - Design decisions
