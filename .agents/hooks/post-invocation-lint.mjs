// PostInvocation (Antigravity): checks if `post-edit-lint.mjs` recorded any unfixed ESLint errors during the turn.
// If errors exist, injects an ephemeralMessage and forces the agent loop to continue and fix them immediately.
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let input = {}
try {
  const raw = readFileSync(0, 'utf8').trim()
  if (raw) input = JSON.parse(raw)
} catch {
  process.stdout.write('{}')
  process.exit(0)
}

const pendingPath = path.join(os.tmpdir(), `agy-lint-${input.conversationId || 'default'}.json`)
if (!existsSync(pendingPath)) {
  process.stdout.write('{}')
  process.exit(0)
}

let pending = {}
try {
  pending = JSON.parse(readFileSync(pendingPath, 'utf8'))
  unlinkSync(pendingPath)
} catch {
  process.stdout.write('{}')
  process.exit(0)
}

const allLines = Object.values(pending).flat()
if (allLines.length === 0) {
  process.stdout.write('{}')
  process.exit(0)
}

process.stdout.write(
  JSON.stringify({
    injectSteps: [
      {
        ephemeralMessage: `eslint --fix 後仍有 ${allLines.length} 個錯誤，請立即修正：\n${allLines.join('\n')}`,
      },
    ],
    terminationBehavior: 'force_continue',
  })
)
