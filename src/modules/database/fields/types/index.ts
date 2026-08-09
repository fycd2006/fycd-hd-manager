import { FieldRegistry } from '../FieldRegistry'
import { TextFieldType } from './TextFieldType'
import { NumberFieldType } from './NumberFieldType'
import { DateFieldType } from './DateFieldType'
import { SingleSelectFieldType } from './SingleSelectFieldType'

// Initialize the core registry with built-in types
export function initializeFieldRegistry() {
  FieldRegistry.register(new TextFieldType())
  FieldRegistry.register(new NumberFieldType())
  FieldRegistry.register(new DateFieldType())
  FieldRegistry.register(new SingleSelectFieldType())
  
  // Future types to implement:
  // LinkRowFieldType
  // MultipleSelectFieldType
  // FormulaFieldType
}

// Call it immediately so it's ready when imported
initializeFieldRegistry()

export { FieldRegistry } from '../FieldRegistry'
