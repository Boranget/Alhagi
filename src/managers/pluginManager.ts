export interface PluginModule {
  name: string
  import: () => Promise<any>
  isLoaded: boolean
}

export class PluginManager {
  private plugins: Map<string, PluginModule> = new Map()
  private editor: any = null

  constructor() {
    this.initializeDefaultPlugins()
  }

  private initializeDefaultPlugins(): void {
    const defaultPlugins: PluginModule[] = [
      {
        name: '@milkdown/preset-commonmark',
        import: async () => {
          const mod = await import('@milkdown/preset-commonmark')
          return mod.commonmark
        },
        isLoaded: true
      },
      {
        name: '@milkdown/preset-gfm',
        import: async () => {
          const mod = await import('@milkdown/preset-gfm')
          return mod.gfm
        },
        isLoaded: true
      },
      {
        name: '@milkdown/plugin-history',
        import: async () => {
          const mod = await import('@milkdown/plugin-history')
          return mod.history
        },
        isLoaded: true
      },
      {
        name: '@milkdown/plugin-clipboard',
        import: async () => {
          const mod = await import('@milkdown/plugin-clipboard')
          return mod.clipboard
        },
        isLoaded: true
      },
      {
        name: '@milkdown/plugin-listener',
        import: async () => {
          const mod = await import('@milkdown/plugin-listener')
          return mod.listener
        },
        isLoaded: true
      },
      {
        name: '@milkdown/plugin-prism',
        import: async () => {
          const mod = await import('@milkdown/plugin-prism')
          return mod.prism
        },
        isLoaded: true
      },
      {
        name: '@milkdown/plugin-block',
        import: async () => {
          const mod = await import('@milkdown/plugin-block')
          return mod.block
        },
        isLoaded: true
      }
    ]

    defaultPlugins.forEach(plugin => this.registerPlugin(plugin))
  }

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
      await plugin.import()
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

  clearCache(): void {
    this.plugins.forEach((plugin) => {
      plugin.isLoaded = false
    })
  }
}

export const pluginManager = new PluginManager()
