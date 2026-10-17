// PreToolUse (git commit): run `npm run verify` in the worktree being committed; exit 2 blocks the commit and shows Claude the failure.
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { resolveCommitDir } from './commit-target.cjs'

// The hook fires on every Bash/PowerShell call (a settings `if` filter misses forms like `git -C dir commit`),
// so resolveCommitDir is the only filter: it returns null for anything that is not a `git commit`.
const input = JSON.parse(readFileSync(0, 'utf8'))
const hookRoot = path.resolve(import.meta.dirname, '..', '..')
const dir = resolveCommitDir(input.tool_input?.command ?? '', input.cwd || hookRoot)
if (dir === null) process.exit(0)
if (!existsSync(dir)) {
  process.stderr.write(`解析出的 commit 目錄 ${dir} 不存在，無法確認要驗證哪個 worktree，已阻擋 commit。改用 git -C <存在的絕對路徑> commit。\n`)
  process.exit(2)
}

let root = hookRoot
try {
  root = path.resolve(execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim())
} catch {
  // Not a git directory (or the path could not be parsed): keep verifying the hook's own checkout.
}

if (!existsSync(path.join(root, 'node_modules'))) {
  process.stderr.write(`${root} 沒有 node_modules，無法在要 commit 的 worktree 跑 npm run verify，已阻擋 commit。先在該目錄執行 npm ci（不要用目錄連結共用 node_modules）。\n`)
  process.exit(2)
}

try {
  execSync('npm run verify', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
} catch (err) {
  const out = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim().split('\n')
  process.stderr.write(`npm run verify 失敗（${root}），已阻擋 commit。修到通過後再 commit。\n${out.slice(-40).join('\n')}\n`)
  process.exit(2)
}
