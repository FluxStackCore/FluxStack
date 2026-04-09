// FluxStack framework exports
export { FluxStackFramework } from "../framework/server"
export { vitePlugin } from "../plugins/built-in"
export { swaggerPlugin } from "../plugins/built-in/swagger"
export { PluginRegistry } from "../plugins/registry"
export * from "../types"

// Live Components exports
export { liveComponentsPlugin, liveServer, registerAuthProvider } from "./live"
export { LiveComponent } from "../types/types"

// Static Files Plugin
export { staticFilesPlugin } from "./plugins/static-files-plugin"

// Plugin Client Hooks
export { pluginClientHooks } from "./plugin-client-hooks"

export * from "../types/types"