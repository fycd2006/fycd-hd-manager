import { parseFormula, evaluateFormula, extractVariables, detectCircularDependency } from '../formula'

describe('parseFormula & evaluateFormula', () => {
  it('evaluates basic arithmetic expressions', () => {
    const ast = parseFormula('10 + 20 * 2')
    const result = evaluateFormula(ast, {})
    expect(result).toBe(50)
  })

  it('handles division by zero gracefully returning 0', () => {
    const ast = parseFormula('100 / 0')
    const result = evaluateFormula(ast, {})
    expect(result).toBe(0)
  })

  it('evaluates built-in functions: CONCAT, UPPER, IF', () => {
    const concatAst = parseFormula('CONCAT("Hello", " ", "World")')
    expect(evaluateFormula(concatAst, {})).toBe('Hello World')

    const upperAst = parseFormula('UPPER("test")')
    expect(evaluateFormula(upperAst, {})).toBe('TEST')

    const ifAst = parseFormula('IF(1, "yes", "no")')
    expect(evaluateFormula(ifAst, {})).toBe('yes')
  })

  it('evaluates variables accurately', () => {
    const ast = parseFormula('{field_1} + {field_2}')
    const result = evaluateFormula(ast, { field_1: 15, field_2: 25 })
    expect(result).toBe(40)
  })
})

describe('extractVariables', () => {
  it('extracts all referenced variables from AST', () => {
    const ast = parseFormula('IF({field_price}, {field_price} * {field_tax_rate}, 0)')
    const vars = extractVariables(ast)
    expect(vars.sort()).toEqual(['field_price', 'field_tax_rate'].sort())
  })
})

describe('detectCircularDependency', () => {
  it('detects direct circular dependency between fields', () => {
    const formulasMap = {
      field_1: '{field_2} + 10',
      field_2: '{field_1} * 2'
    }
    expect(detectCircularDependency('field_1', formulasMap)).toBe(true)
  })

  it('returns false for acyclic formula relationships', () => {
    const formulasMap = {
      field_1: '{field_2} + {field_3}',
      field_2: '{field_3} * 2',
      field_3: '100'
    }
    expect(detectCircularDependency('field_1', formulasMap)).toBe(false)
  })
})
