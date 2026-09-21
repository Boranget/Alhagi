import { container } from '@infrastructure/di/Container'
import { TYPES } from '@infrastructure/di/types'
import { CreateTab } from '@core/use-cases/tabs/CreateTab'
import { CloseTab } from '@core/use-cases/tabs/CloseTab'
import type { CreateTabOptions } from '@core/domain/ports/repositories/ITabRepository'
import type { Tab } from '@core/entities/Tab'

/**
 * Composable — 提供 CreateTab / CloseTab Use Case 的便捷访问。
 * UI 层（组件、composables、services）应使用此 composable 而非直接调用 store 方法。
 */
export function useTabActions() {
  const createTab = (options?: CreateTabOptions): Promise<Tab> => {
    const useCase = container.get<CreateTab>(TYPES.CreateTabUseCase)
    return useCase.execute(options)
  }

  const closeTab = (tabId: string): Promise<void> => {
    const useCase = container.get<CloseTab>(TYPES.CloseTabUseCase)
    return useCase.execute(tabId)
  }

  return { createTab, closeTab }
}
