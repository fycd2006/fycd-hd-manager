export type ASTNode =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'variable'; name: string }
  | { type: 'binary'; op: string; left: ASTNode; right: ASTNode }
  | { type: 'function'; name: string; args: ASTNode[] }

type Token =
  | { type: 'LPAREN'; value: '(' }
  | { type: 'RPAREN'; value: ')' }
  | { type: 'COMMA'; value: ',' }
  | { type: 'OPERATOR'; value: '+' | '-' | '*' | '/' }
  | { type: 'STRING'; value: string }
  | { type: 'NUMBER'; value: number }
  | { type: 'VARIABLE'; value: string }
  | { type: 'IDENTIFIER'; value: string }

class Tokenizer {
  private input: string
  private pos: number = 0

  constructor(input: string) {
    this.input = input
  }

  tokenize(): Token[] {
    const tokens: Token[] = []
    while (this.pos < this.input.length) {
      const char = this.input[this.pos]
      if (/\s/.test(char)) {
        this.pos++
        continue
      }
      if (char === '(') {
        tokens.push({ type: 'LPAREN', value: '(' })
        this.pos++
        continue
      }
      if (char === ')') {
        tokens.push({ type: 'RPAREN', value: ')' })
        this.pos++
        continue
      }
      if (char === ',') {
        tokens.push({ type: 'COMMA', value: ',' })
        this.pos++
        continue
      }
      // Operators
      if (['+', '-', '*', '/'].includes(char)) {
        tokens.push({ type: 'OPERATOR', value: char as '+' | '-' | '*' | '/' })
        this.pos++
        continue
      }
      // String Literals
      if (char === '"' || char === "'") {
        const quote = char
        this.pos++
        let str = ''
        while (this.pos < this.input.length && this.input[this.pos] !== quote) {
          if (this.input[this.pos] === '\\') this.pos++
          str += this.input[this.pos]
          this.pos++
        }
        this.pos++ // consume closing quote
        tokens.push({ type: 'STRING', value: str })
        continue
      }
      // Numbers
      if (/\d/.test(char)) {
        let numStr = ''
        while (this.pos < this.input.length && /[\d.]/.test(this.input[this.pos])) {
          numStr += this.input[this.pos]
          this.pos++
        }
        tokens.push({ type: 'NUMBER', value: parseFloat(numStr) })
        continue
      }
      // Identifiers / Variables / Functions
      if (/[a-zA-Z_]/.test(char)) {
        let ident = ''
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
          ident += this.input[this.pos]
          this.pos++
        }
        if (ident.startsWith('field_')) {
          tokens.push({ type: 'VARIABLE', value: ident })
        } else {
          tokens.push({ type: 'IDENTIFIER', value: ident })
        }
        continue
      }
      // Unknown characters
      this.pos++
    }
    return tokens
  }
}

class Parser {
  private tokens: Token[]
  private pos: number = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek() {
    return this.tokens[this.pos]
  }

  private consume(expectedType?: string) {
    const token = this.tokens[this.pos]
    if (!token) throw new Error('Unexpected end of formula')
    if (expectedType && token.type !== expectedType) {
      throw new Error(`Expected token type ${expectedType} but got ${token.type}`)
    }
    this.pos++
    return token
  }

  parse(): ASTNode {
    return this.parseExpression()
  }

  private parseExpression(): ASTNode {
    return this.parseAdditive()
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative()
    while (this.peek() && this.peek().type === 'OPERATOR' && ['+', '-'].includes(String(this.peek().value))) {
      const op = String(this.consume().value)
      const right = this.parseMultiplicative()
      left = { type: 'binary', op, left, right }
    }
    return left
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parsePrimary()
    while (this.peek() && this.peek().type === 'OPERATOR' && ['*', '/'].includes(String(this.peek().value))) {
      const op = String(this.consume().value)
      const right = this.parsePrimary()
      left = { type: 'binary', op, left, right }
    }
    return left
  }

  private parsePrimary(): ASTNode {
    const token = this.peek()
    if (!token) throw new Error('Unexpected end of formula')

    if (token.type === 'OPERATOR' && (token.value === '-' || token.value === '+')) {
      const op = String(this.consume().value)
      const right = this.parsePrimary()
      return { type: 'binary', op, left: { type: 'number', value: 0 }, right }
    }

    if (token.type === 'NUMBER') {
      this.consume()
      return { type: 'number', value: token.value }
    }
    if (token.type === 'STRING') {
      this.consume()
      return { type: 'string', value: token.value }
    }
    if (token.type === 'VARIABLE') {
      this.consume()
      return { type: 'variable', name: token.value }
    }
    if (token.type === 'IDENTIFIER') {
      const name = String(this.consume().value)
      this.consume('LPAREN')
      const args: ASTNode[] = []
      if (this.peek() && this.peek().type !== 'RPAREN') {
        args.push(this.parseExpression())
        while (this.peek() && this.peek().type === 'COMMA') {
          this.consume('COMMA')
          args.push(this.parseExpression())
        }
      }
      this.consume('RPAREN')
      return { type: 'function', name, args }
    }
    if (token.type === 'LPAREN') {
      this.consume('LPAREN')
      const expr = this.parseExpression()
      this.consume('RPAREN')
      return expr
    }

    throw new Error(`Unexpected token in formula: ${token.value}`)
  }
}

export function parseFormula(formulaStr: string): ASTNode {
  const tokenizer = new Tokenizer(formulaStr)
  const tokens = tokenizer.tokenize()
  const parser = new Parser(tokens)
  return parser.parse()
}

export function evaluateFormula(node: ASTNode, variables: Record<string, string | number | boolean | null>): string | number | boolean | null {
  switch (node.type) {
    case 'number':
      return node.value
    case 'string':
      return node.value
    case 'variable': {
      const val = variables[node.name]
      if (val === undefined || val === null) return 0
      if (typeof val === 'string' && val.trim() === '') return ''
      const num = Number(val)
      return isNaN(num) ? val : num
    }
    case 'binary': {
      const left = evaluateFormula(node.left, variables)
      const right = evaluateFormula(node.right, variables)
      if (left == null || right == null) return null
      
      const numL = Number(left)
      const numR = Number(right)
      
      if (node.op === '+' && (typeof left === 'string' || typeof right === 'string')) {
        return String(left) + String(right)
      }

      switch (opToStandard(node.op)) {
        case '+': return numL + numR
        case '-': return numL - numR
        case '*': return numL * numR
        case '/': return numR === 0 ? 0 : numL / numR
        default: return null
      }
    }
    case 'function': {
      const resolvedArgs = node.args.map(arg => evaluateFormula(arg, variables))
      switch (node.name.toUpperCase()) {
        case 'CONCAT':
          return resolvedArgs.map(val => val == null ? '' : String(val)).join('')
        case 'UPPER':
          return String(resolvedArgs[0] ?? '').toUpperCase()
        case 'LOWER':
          return String(resolvedArgs[0] ?? '').toLowerCase()
        case 'IF':
          return resolvedArgs[0] ? resolvedArgs[1] : resolvedArgs[2]
        case 'CONTAINS': {
          const haystack = String(resolvedArgs[0] ?? '').toLowerCase()
          const needle = String(resolvedArgs[1] ?? '').toLowerCase()
          return haystack.includes(needle)
        }
        case 'ROUND': {
          const val = Number(resolvedArgs[0] ?? 0)
          const decimals = Number(resolvedArgs[1] ?? 0)
          const factor = Math.pow(10, decimals)
          return Math.round(val * factor) / factor
        }
        case 'ABS':
          return Math.abs(Number(resolvedArgs[0] ?? 0))
        case 'CEIL':
          return Math.ceil(Number(resolvedArgs[0] ?? 0))
        case 'FLOOR':
          return Math.floor(Number(resolvedArgs[0] ?? 0))
        case 'MOD': {
          const a = Number(resolvedArgs[0] ?? 0)
          const b = Number(resolvedArgs[1] ?? 1)
          return b === 0 ? 0 : a % b
        }
        case 'TODAY':
          return new Date().toISOString().split('T')[0]
        case 'YEAR': {
          const d = new Date(String(resolvedArgs[0]))
          return isNaN(d.getTime()) ? null : d.getFullYear()
        }
        case 'MONTH': {
          const d = new Date(String(resolvedArgs[0]))
          return isNaN(d.getTime()) ? null : d.getMonth() + 1
        }
        case 'DAY': {
          const d = new Date(String(resolvedArgs[0]))
          return isNaN(d.getTime()) ? null : d.getDate()
        }
        case 'DATE_DIFF': {
          const d1 = new Date(String(resolvedArgs[1] ?? resolvedArgs[0]))
          const d2 = new Date(String(resolvedArgs[2] ?? resolvedArgs[1]))
          if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0
          const diffMs = d2.getTime() - d1.getTime()
          return Math.floor(diffMs / (1000 * 60 * 60 * 24))
        }
        case 'AND': {
          const isTruthy = (v: any) => Boolean(v) && v !== 0 && v !== '0' && v !== 'false'
          return resolvedArgs.every(isTruthy)
        }
        case 'OR': {
          const isTruthy = (v: any) => Boolean(v) && v !== 0 && v !== '0' && v !== 'false'
          return resolvedArgs.some(isTruthy)
        }
        case 'NOT': {
          const isTruthy = (v: any) => Boolean(v) && v !== 0 && v !== '0' && v !== 'false'
          return !isTruthy(resolvedArgs[0])
        }
        case 'ISBLANK':
          return resolvedArgs[0] == null || String(resolvedArgs[0]).trim() === ''
        default:
          return null
      }
    }
    default:
      return null
  }
}

function opToStandard(op: string): string {
  return op
}

/**
 * Extract all variable names referenced in an AST node
 */
export function extractVariables(node: ASTNode): string[] {
  const vars = new Set<string>()
  function traverse(n: ASTNode) {
    if (n.type === 'variable') {
      vars.add(n.name)
    } else if (n.type === 'binary') {
      traverse(n.left)
      traverse(n.right)
    } else if (n.type === 'function') {
      n.args.forEach(traverse)
    }
  }
  traverse(node)
  return Array.from(vars)
}

/**
 * Detect circular dependencies in formula fields.
 * @param startField Current field name e.g. "field_1"
 * @param formulasMap Map of field names to formula expressions or ASTs
 * @returns true if circular dependency is detected
 */
export function detectCircularDependency(
  startField: string,
  formulasMap: Record<string, string | ASTNode>
): boolean {
  const visited = new Set<string>()
  const recStack = new Set<string>()

  function dfs(curr: string): boolean {
    visited.add(curr)
    recStack.add(curr)

    const rawExpr = formulasMap[curr]
    if (rawExpr) {
      let ast: ASTNode | null = null
      if (typeof rawExpr === 'string') {
        try {
          ast = parseFormula(rawExpr)
        } catch {
          ast = null
        }
      } else {
        ast = rawExpr
      }

      if (ast) {
        const referencedVars = extractVariables(ast)
        for (const neighbor of referencedVars) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) return true
          } else if (recStack.has(neighbor)) {
            return true
          }
        }
      }
    }

    recStack.delete(curr)
    return false
  }

  return dfs(startField)
}

