/** @filedesc ComponentRegistry class and the global singleton used for plugin dispatch. */
import { ComponentPlugin } from './types';

/**
 * Map-based registry that dispatches component type strings to their
 * {@link ComponentPlugin} implementations.
 *
 * At render time the `FormspecRender` element looks up each component
 * descriptor's `component` field in the registry to find the plugin
 * responsible for building the corresponding DOM subtree.
 *
 * Built-in components are registered at module load via
 * `registerDefaultComponents()`. Custom plugins can be added at any
 * time by calling {@link register} on the {@link globalRegistry} singleton.
 */
export class ComponentRegistry {
    private plugins: Map<string, ComponentPlugin> = new Map();

    /**
     * Register a component plugin, keyed by its `type` string.
     * If a plugin with the same type already exists it is silently replaced.
     *
     * @param plugin - The plugin to register.
     */
    register(plugin: ComponentPlugin) {
        this.plugins.set(plugin.type, plugin);
    }

    /**
     * Look up a registered plugin by component type.
     *
     * @param type - Component type identifier (e.g. `"TextInput"`, `"Wizard"`).
     * @returns The matching plugin, or `undefined` if no plugin is registered for that type.
     */
    get(type: string): ComponentPlugin | undefined {
        return this.plugins.get(type);
    }

    /** The number of currently registered component plugins. */
    get size(): number {
        return this.plugins.size;
    }
}

/**
 * Application-wide singleton registry shared by all `<formspec-render>` instances.
 *
 * All 35 built-in component plugins are registered here at module load.
 * External code can register additional plugins via `globalRegistry.register(plugin)`.
 */
export const globalRegistry = new ComponentRegistry();
