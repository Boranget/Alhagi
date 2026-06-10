// ============================================================
// Alhagi SearchService - ripgrep 集成
// ============================================================

import { spawn } from 'node:child_process'
import { rgPath } from '@vscode/ripgrep'
import { IPC_CHANNELS, IPCErrorCode, createSuccessResponse } from '../../electron-protocol'
import { registerHandler } from '../ipc-handler'

interface RipgrepMatch {
  filePath: string
  lineNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
}

interface SearchOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
  useRegex?: boolean
  excludePatterns?: string[]
}

export class SearchService {
  registerHandlers(): void {
    registerHandler(
      IPC_CHANNELS.FILE.SEARCH_IN_DIRECTORY,
      IPCErrorCode.UNKNOWN_ERROR,
      async (_, { dirPath, query, options }: { dirPath: string; query: string; options?: SearchOptions }) => {
        if (!query.trim()) return createSuccessResponse([])
        const results = await this.runRipgrep(dirPath, query, options)
        return createSuccessResponse(results)
      },
    )
  }

  private runRipgrep(dirPath: string, query: string, options?: SearchOptions): Promise<RipgrepMatch[]> {
    return new Promise((resolve) => {
      const args = ['--json']
      if (!options?.caseSensitive) args.push('-i')
      if (options?.wholeWord) args.push('-w')
      args.push('--glob', '*.md', '--glob', '*.markdown', '--glob', '*.txt')
      const excludePatterns = options?.excludePatterns || ['node_modules', '.git', 'dist', '__pycache__']
      excludePatterns.forEach((pattern) => args.push('--glob', `!${pattern}`))
      const searchPattern = options?.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      args.push(searchPattern, dirPath)

      let stdout = ''
      const rg = spawn(rgPath, args)
      rg.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      rg.on('error', () => resolve([]))
      rg.on('close', () => {
        const results: RipgrepMatch[] = []
        stdout
          .trim()
          .split('\n')
          .forEach((line) => {
            if (!line.trim()) return
            try {
              const json = JSON.parse(line)
              if (json.type === 'match') {
                const filePath = json.data.path.text
                const lineNumber = json.data.line_number
                const lineContent = json.data.lines.text.replace(/\r?\n$/, '')
                json.data.submatches.forEach((submatch: { start: number; end: number }) => {
                  results.push({
                    filePath,
                    lineNumber,
                    lineContent,
                    matchStart: submatch.start,
                    matchEnd: submatch.end,
                  })
                })
              }
            } catch {
              // Skip invalid JSON line
            }
          })
        resolve(results)
      })
    })
  }
}
