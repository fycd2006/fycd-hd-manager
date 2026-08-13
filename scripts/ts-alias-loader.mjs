// Node ESM loader: resolves '@/...' to src/... and extensionless .ts imports
// so verification scripts can run directly on the project's TS sources.
import { pathToFileURL, fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve('src')
const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs']

function resolveFile(base) {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base
  for (const ext of EXTS) {
    if (fs.existsSync(base + ext)) return base + ext
  }
  for (const ext of EXTS) {
    const idx = path.join(base, 'index' + ext)
    if (fs.existsSync(idx)) return idx
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const found = resolveFile(path.join(SRC, specifier.slice(2)))
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
    const found = resolveFile(base)
    if (found && (found.endsWith('.ts') || found.endsWith('.tsx'))) {
      return { url: pathToFileURL(found).href, shortCircuit: true }
    }
  }
  return nextResolve(specifier, context)
}
