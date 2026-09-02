import { parseFormula, evaluateFormula, extractVariables, detectCircularDependency, getSupportedFunctions } from '../formula'

describe('parseFormula (syntax validation)', () => {
  it('accepts valid arithmetic expressions', () => {
    expect(() => parseFormula('10 + 20 * 2')).not.toThrow()
  })

  it('accepts valid function calls', () => {
    expect(() => parseFormula('SUM(1, 2, 3)')).not.toThrow()
    expect(() => parseFormula('IF(1 > 2, "yes", "no")')).not.toThrow()
  })

  it('accepts comparison operators', () => {
    expect(() => parseFormula('1 > 2')).not.toThrow()
    expect(() => parseFormula('1 <> 2')).not.toThrow()
    expect(() => parseFormula('5 >= 3')).not.toThrow()
  })

  it('accepts empty expressions', () => {
    expect(() => parseFormula('')).not.toThrow()
    expect(() => parseFormula('   ')).not.toThrow()
  })

  it('throws on invalid syntax', () => {
    expect(() => parseFormula('SUM(1,,')).toThrow()
  })
})

describe('evaluateFormula', () => {
  it('evaluates basic arithmetic expressions', () => {
    const result = evaluateFormula('10 + 20 * 2', {})
    expect(result).toBe(50)
  })

  it('handles division by zero returning #DIV/0!', () => {
    const result = evaluateFormula('100 / 0', {})
    expect(result).toBe('#DIV/0!')
  })

  it('evaluates built-in functions: SUM, UPPER, IF', () => {
    expect(evaluateFormula('SUM(1, 2, 3)', {})).toBe(6)
    expect(evaluateFormula('UPPER("test")', {})).toBe('TEST')
    expect(evaluateFormula('IF(TRUE, "yes", "no")', {})).toBe('yes')
  })

  it('evaluates positive and negative numbers correctly', () => {
    expect(evaluateFormula('field_1 + 10', { field_1: -50 })).toBe(-40)
    expect(evaluateFormula('field_1 * -2', { field_1: 25 })).toBe(-50)
    expect(evaluateFormula('field_1 - field_2', { field_1: -10, field_2: -30 })).toBe(20)
  })

  it('handles formatted numeric strings with thousand separators or currency prefixes', () => {
    expect(evaluateFormula('field_1 + 100', { field_1: '4,545,454,555' })).toBe(4545454655)
    expect(evaluateFormula('field_1 * 2', { field_1: 'NT$ 1,200' })).toBe(2400)
    expect(evaluateFormula('field_1 - 50', { field_1: ' $ -200 ' })).toBe(-250)
  })

  it('supports bracketed field references {field_1}', () => {
    expect(evaluateFormula('{field_1} + {field_2}', { field_1: 100, field_2: 200 })).toBe(300)
  })

  it('supports short F1, F2 field aliases', () => {
    const rowVars = { field_101: 500, field_102: 10, field_103: 0.9 }
    expect(evaluateFormula('F1 * F2 * F3', rowVars)).toBe(4500)
    expect(evaluateFormula('IF(F1 > 100, F2 * 2, F2)', rowVars)).toBe(20)
  })

  it('returns null when referenced cells are empty/null to avoid ghost calculations on blank rows', () => {
    expect(evaluateFormula('field_1 * 10', { field_1: null })).toBe(null)
    expect(evaluateFormula('field_1 + 50', { field_1: '' })).toBe(null)
    expect(evaluateFormula('field_1 + field_2', { field_1: null, field_2: '' })).toBe(null)
    expect(evaluateFormula('F2', {})).toBe(null)
    expect(evaluateFormula('F2 + 2', {}, [1, 2])).toBe(null)
    expect(evaluateFormula('field_1 + field_2', { field_1: 10, field_2: null })).toBe(10)
  })

  it('handles IFERROR gracefully for division by zero', () => {
    expect(evaluateFormula('IFERROR(100 / 0, 0)', {})).toBe(0)
  })

  it('evaluates comparison operators', () => {
    expect(evaluateFormula('IF(field_1 > 10, "big", "small")', { field_1: 15 })).toBe('big')
    expect(evaluateFormula('IF(field_1 > 10, "big", "small")', { field_1: 5 })).toBe('small')
    expect(evaluateFormula('1 <> 2', {})).toBe(true)
    expect(evaluateFormula('5 >= 5', {})).toBe(true)
  })

  it('evaluates CONCAT via formulajs', () => {
    expect(evaluateFormula('CONCAT("Hello", " ", "World")', {})).toBe('Hello World')
  })

  it('evaluates LEFT/RIGHT/LEN', () => {
    expect(evaluateFormula('LEFT("hello", 3)', {})).toBe('hel')
    expect(evaluateFormula('RIGHT("hello", 2)', {})).toBe('lo')
    expect(evaluateFormula('LEN("test")', {})).toBe(4)
  })

  it('evaluates custom CONTAINS function', () => {
    expect(evaluateFormula('CONTAINS("Hello World", "world")', {})).toBe(true)
    expect(evaluateFormula('CONTAINS("Hello", "xyz")', {})).toBe(false)
  })

  it('evaluates custom ISBLANK function', () => {
    expect(evaluateFormula('ISBLANK("")', {})).toBe(true)
    expect(evaluateFormula('ISBLANK(0)', {})).toBe(true)
    expect(evaluateFormula('ISBLANK("text")', {})).toBe(false)
  })

  it('evaluates ROUND', () => {
    expect(evaluateFormula('ROUND(3.14159, 2)', {})).toBe(3.14)
  })

  it('evaluates ABS', () => {
    expect(evaluateFormula('ABS(-5)', {})).toBe(5)
  })

  it('returns null for empty expressions', () => {
    expect(evaluateFormula('', {})).toBe(null)
    expect(evaluateFormula('   ', {})).toBe(null)
  })
})

describe('extractVariables', () => {
  it('extracts all referenced variables from expression', () => {
    const vars = extractVariables('IF(field_1 > 0, field_1 * field_2, 0)')
    expect(vars.sort()).toEqual(['field_1', 'field_2'].sort())
  })

  it('returns empty array for no variables', () => {
    expect(extractVariables('SUM(1, 2, 3)')).toEqual([])
  })

  it('deduplicates repeated references', () => {
    const vars = extractVariables('field_1 + field_1 + field_2')
    expect(vars.sort()).toEqual(['field_1', 'field_2'].sort())
  })
})

describe('detectCircularDependency', () => {
  it('detects direct circular dependency between fields', () => {
    const formulasMap = {
      field_1: 'field_2 + 10',
      field_2: 'field_1 * 2'
    }
    expect(detectCircularDependency('field_1', formulasMap)).toBe(true)
  })

  it('returns false for acyclic formula relationships', () => {
    const formulasMap = {
      field_1: 'field_2 + field_3',
      field_2: 'field_3 * 2',
      field_3: '100'
    }
    expect(detectCircularDependency('field_1', formulasMap)).toBe(false)
  })
})

describe('getSupportedFunctions', () => {
  it('returns non-empty categories with functions', () => {
    const cats = getSupportedFunctions()
    expect(cats.length).toBeGreaterThan(0)
    cats.forEach(cat => {
      expect(cat.category).toBeTruthy()
      expect(cat.funcs.length).toBeGreaterThan(0)
      cat.funcs.forEach(fn => {
        expect(fn.name).toBeTruthy()
        expect(fn.doc).toBeTruthy()
        expect(fn.snippet).toBeTruthy()
      })
    })
  })
})
