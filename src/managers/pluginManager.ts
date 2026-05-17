export interface PluginModule {
  name: string
  import: () => Promise<{ default: any }>
  isLoaded: boolean
}

export class PluginManager {
  private plugins: Map<string, PluginModule> = new Map()
  private editor: any = null

  constructor() {
    this.initializeDefaultPlugins()
  }

  private initializeDefaultPlugins(): void {
    this.registerPlugin({
      name: '@milkdown/preset-commonmark',
      import: () => import('@milkdown/preset-commonmark'),
      isLoaded: true
    })

    this.registerPlugin({
      name: '@milkdown/preset-gfm',
      import: () => import('@milkdown/preset-gfm'),
      isLoaded: true
    })

    this.registerPlugin({
      name: '@milkdown/plugin-history',
      import: () => import('@milkdown/plugin-history'),
      isLoaded: true
    })

    this.registerPlugin({
      name: '@milkdown/plugin-clipboard',
      import: () => import('@milkdown/plugin-clipboard'),
      isLoaded: true
    })

    this.registerPlugin({
      name: '@milkdown/plugin-listener',
      import: () => import('@milkdown/plugin-listener'),
      isLoaded: true
    })

    this.registerAdvancedPlugins()
  }

  private initializeAdvancedPlugins(): void {
    const advancedPlugins: PluginModule[] = [
      {
        name: '@milkdown/plugin-math',
        import: () => import('@milkdown/plugin-math'),
        isLoaded: false
      },
      {
        name: '@milkdown/plugin-diagram',
        import: () => import('@milkdown/plugin-diagram'),
        isLoaded: false
      },
      {
        name: '@milkdown/plugin-slash',
        import: () => import('@milkdown/plugin-slash'),
        isLoaded: false
      },
      {
        name: '@milkdown/plugin-emoji',
        import: () => import('@milkdown/plugin-emoji'),
        isLoaded: false
      },
      {
        name: '@milkdown/plugin-history',
        import: () => import('@milkdown/plugin-history'),
        isLoaded: false
      }
    ]

    advancedPlugins.forEach(plugin => this.registerPlugin(plugin))
  }

  private advancedPlugins: PluginModule[] = [
    {
      name: '@milkdown/plugin-math',
      import: async () => {
        const mod = await import('@milkdown/plugin-math')
        return { default: mod.math }
      },
      isLoaded: false
    },
    {
      name: '@milkdown/plugin-diagram',
      import: async () => {
        const mod = await import('@milkdown/plugin-diagram')
        return { default: mod.diagram }
      },
      isLoaded: false
    },
    {
      name: '@milkdown/plugin-slash',
      import: async () => {
        const mod = await import('@milkdown/plugin-slash')
        return { default: mod.slash }
      },
      isLoaded: false
    }
  ]

  private registerPlugin(plugin: PluginModule): void {
    this.plugins.set(plugin.name, plugin)
  }

  async loadPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName)
    
    if (!plugin) {
      console.warn(`Plugin ${pluginName} not registered`)
      return false
    }

    if (plugin.isLoaded) {
      return true
    }

    try {
      const module = await plugin.import()
      plugin.isLoaded = true
      return true
    } catch (error) {
      console.error(`Failed to load plugin ${pluginName}:`, error)
      return false
    }
  }

  async loadPlugins(pluginNames: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>()
    
    const loadPromises = pluginNames.map(async (name) => {
      const success = await this.loadPlugin(name)
      results.set(name, success)
    })

    await Promise.all(loadPromises)
    return results
  }

  unloadPlugin(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName)
    
    if (!plugin) {
      return false
    }

    if (plugin.isLoaded) {
      plugin.isLoaded = false
      return true
    }

    return false
  }

  isPluginLoaded(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName)
    return plugin?.isLoaded || false
  }

  getLoadedPlugins(): string[] {
    return Array.from(this.plugins.entries())
      .filter(([_, plugin]) => plugin.isLoaded)
      .map(([name]) => name)
  }

  getAvailablePlugins(): string[] {
    return Array.from(this.plugins.keys())
  }

  getPluginStatus(): Map<string, boolean> {
    const status = new Map<string, boolean>()
    
    this.plugins.forEach((plugin, name) => {
      status.set(name, plugin.isLoaded)
    })

    return status
  }

  async lazyLoadAdvancedPlugins(): Promise<void> {
    const advancedPlugins = [
      '@milkdown/plugin-math',
      '@milkdown/plugin-diagram',
      '@milkdown/plugin-slash'
    ]

    for (const pluginName of advancedPlugins) {
      await this.loadPlugin(pluginName)
    }
  }

  clearCache(): void {
    this.plugins.forEach((plugin) => {
      plugin.isLoaded = false
    })
  }
}

export const pluginManager = new PluginManager()
