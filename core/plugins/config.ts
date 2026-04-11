/**
 * Thin shim over @fluxstack/plugin-kit's createPluginUtils.
 *
 * Historically this file was the canonical implementation of
 * `createPluginUtils` + the legacy `DefaultPluginConfigManager` class
 * (which existed only to validate the deprecated `Plugin.configSchema`
 * field). As of the plugin-kit extraction (phase 3.4), the impl lives
 * in @fluxstack/plugin-kit. The DefaultPluginConfigManager class was
 * dropped entirely — it referenced a Plugin field that was already
 * deprecated and removed in phase 2.2.
 */

export { createPluginUtils } from '@fluxstack/plugin-kit'
