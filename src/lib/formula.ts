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
