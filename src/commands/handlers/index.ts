import { getDispatcher } from '../dispatcher'
import { registerFileHandlers } from './FileCommandHandlers'
import { registerEditHandlers } from './EditCommandHandlers'
import { registerFormatHandlers } from './FormatCommandHandlers'
import { registerParagraphHandlers } from './ParagraphCommandHandlers'
import { registerTableHandlers } from './TableCommandHandlers'
import { registerViewHandlers } from './ViewCommandHandlers'
import { registerToolsHandlers } from './ToolsCommandHandlers'
import { registerHelpHandlers } from './HelpCommandHandlers'

export function initCommandHandlers(): void {
  const dispatcher = getDispatcher()

  registerFileHandlers(dispatcher)
  registerEditHandlers(dispatcher)
  registerFormatHandlers(dispatcher)
  registerParagraphHandlers(dispatcher)
  registerTableHandlers(dispatcher)
  registerViewHandlers(dispatcher)
  registerToolsHandlers(dispatcher)
  registerHelpHandlers(dispatcher)
}
