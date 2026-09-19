// ============================================================
// DI Types — 依赖注入令牌
// ============================================================
//
// 定义所有依赖的类型令牌，用于 InversifyJS 容器。

export const TYPES = {
  // Domain Ports
  EditorProvider: Symbol.for('EditorProvider'),
  EditorCommands: Symbol.for('EditorCommands'),
  TabRepository: Symbol.for('TabRepository'),
  EventBus: Symbol.for('EventBus'),
  FileSystem: Symbol.for('FileSystem'),
  ScrollService: Symbol.for('ScrollService'),
  ViewModeGateway: Symbol.for('ViewModeGateway'),

  // Use Cases
  CreateTabUseCase: Symbol.for('CreateTabUseCase'),
  CloseTabUseCase: Symbol.for('CloseTabUseCase'),
  SwitchTabUseCase: Symbol.for('SwitchTabUseCase'),
  UpdateTabUseCase: Symbol.for('UpdateTabUseCase'),
  ExecuteEditorCommandUseCase: Symbol.for('ExecuteEditorCommandUseCase'),
  ToggleTypewriterModeUseCase: Symbol.for('ToggleTypewriterModeUseCase'),
  ToggleFocusModeUseCase: Symbol.for('ToggleFocusModeUseCase'),
}
