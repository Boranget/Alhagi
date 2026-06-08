import type { ServiceIdentifier, ServiceDefinition, ServiceContainer } from '@/types/services'

class ServiceContainerImpl implements ServiceContainer {
  private services = new Map<ServiceIdentifier, ServiceDefinition<unknown>>()

  register<T>(id: ServiceIdentifier, factory: () => T, singleton: boolean = true): void {
    this.services.set(id, { factory, singleton })
  }

  resolve<T>(id: ServiceIdentifier): T | undefined {
    const definition = this.services.get(id)
    if (!definition) return undefined

    if (definition.singleton) {
      if (!definition.instance) {
        definition.instance = definition.factory()
      }
      return definition.instance as T
    }

    return definition.factory() as T
  }

  has(id: ServiceIdentifier): boolean {
    return this.services.has(id)
  }

  remove(id: ServiceIdentifier): void {
    this.services.delete(id)
  }

  clear(): void {
    this.services.clear()
  }
}

export const serviceContainer = new ServiceContainerImpl()

export function useService<T>(id: ServiceIdentifier): T | undefined {
  return serviceContainer.resolve<T>(id)
}

export function registerService<T>(
  id: ServiceIdentifier,
  factory: () => T,
  singleton: boolean = true
): void {
  serviceContainer.register(id, factory, singleton)
}