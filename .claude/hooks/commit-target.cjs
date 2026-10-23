// Works out which directory a `git commit` shell command commits in, so pre-commit-verify.mjs verifies that worktree.
// CommonJS so jest (src/__tests__/claude-hooks) can require it without ESM support.
const path = process.getBuiltinModule('node:path') // not require(): the repo lint forbids it

// `git`, optional global options, then the `commit` subcommand.
const COMMIT_RE = /\bgit((?:\s+(?:-C|-c)\s+(?:"[^"]*"|'[^']*'|\S+)|\s+--?[\w-]+(?:=\S+)?)*)\s+commit\b/
const DANGEROUS_BUILD_RE =
  /(?:^|[;&|]\s*)\s*(?:npm(?:\.cmd)?\s+run|pnpm(?:\s+run)?|yarn(?:\s+run)?)\s+build(?![:\w-])|(?:^|[;&|]\s*)\s*(?:npx(?:\.cmd)?\s+)?prisma\s+db\s+push\b[^;&|]*--accept-data-loss\b/i
const ARG = String.raw`("[^"]*"|'[^']*'|[^\s;&|]+)`
const CD_RE = new RegExp(String.raw`(?:^|[;&|]\s*)\s*(?:cd|Set-Location|pushd)\s+(?:-LiteralPath\s+|-Path\s+)?${ARG}`, 'g')
const DASH_C_RE = new RegExp(String.raw`(?:^|\s)-C\s+${ARG}`, 'g')

const unquote = (s) => s.replace(/^(["'])(.*)\1$/, '$2')
// Git Bash writes C:\dev as /c/dev; win32 path.resolve would read that as C:\c\dev.
const toNative = (p) => (process.platform === 'win32' ? p.replace(/^\/([a-zA-Z])(?=\/|$)/, (_, d) => `${d.toUpperCase()}:/`) : p)
const arg2path = (s) => toNative(unquote(s))

function isGitCommit(command) {
  return COMMIT_RE.test(command)
}

function isDangerousBuildOrPush(command) {
  return DANGEROUS_BUILD_RE.test(command)
}

// Returns the absolute directory git will commit in, or null when the command is not a `git commit`.
// Applies every `cd <dir>` before the git call, then each `git -C <dir>` in order, starting from cwd.
function resolveCommitDir(command, cwd) {
  const match = COMMIT_RE.exec(command)
  if (!match) return null
  let dir = cwd
  for (const [, arg] of command.slice(0, match.index).matchAll(CD_RE)) dir = path.resolve(dir, arg2path(arg))
  for (const [, arg] of match[1].matchAll(DASH_C_RE)) dir = path.resolve(dir, arg2path(arg))
  return dir
}

module.exports = { isGitCommit, isDangerousBuildOrPush, resolveCommitDir }
