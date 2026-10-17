import { FieldRegistry } from '../FieldRegistry'
import { TextFieldType } from './TextFieldType'
import { NumberFieldType } from './NumberFieldType'
import { DateFieldType } from './DateFieldType'
import { SingleSelectFieldType } from './SingleSelectFieldType'
import { MultipleSelectFieldType } from './MultipleSelectFieldType'
import { BooleanFieldType } from './BooleanFieldType'
import { RatingFieldType } from './RatingFieldType'
import { LongTextFieldType, PasswordFieldType, AiPromptFieldType } from './TextLikeFieldTypes'
import { EmailFieldType } from './EmailFieldType'
import { UrlFieldType } from './UrlFieldType'
import { PhoneNumberFieldType } from './PhoneNumberFieldType'
import { DurationFieldType } from './DurationFieldType'
import { LinkRowFieldType } from './LinkRowFieldType'
import { CollaboratorsFieldType } from './CollaboratorsFieldType'
import { AttachmentFieldType } from './AttachmentFieldType'
import { LatestCommentFieldType, parseLatestCommentEntries, type CommentLogEntry } from './LatestCommentFieldType'

// Initialize the core registry with built-in types
export function initializeFieldRegistry() {
  FieldRegistry.register(new TextFieldType())
  FieldRegistry.register(new NumberFieldType())
  FieldRegistry.register(new DateFieldType())
  FieldRegistry.register(new SingleSelectFieldType())
  FieldRegistry.register(new MultipleSelectFieldType())
  FieldRegistry.register(new BooleanFieldType())
  FieldRegistry.register(new RatingFieldType())
  FieldRegistry.register(new LongTextFieldType())
  FieldRegistry.register(new PasswordFieldType())
  FieldRegistry.register(new AiPromptFieldType())
  FieldRegistry.register(new EmailFieldType())
  FieldRegistry.register(new UrlFieldType())
  FieldRegistry.register(new PhoneNumberFieldType(), 'phone')
  FieldRegistry.register(new DurationFieldType())
  FieldRegistry.register(new LinkRowFieldType())
  FieldRegistry.register(new CollaboratorsFieldType(), 'collaborator')
  FieldRegistry.register(new AttachmentFieldType(), 'file')
  FieldRegistry.register(new LatestCommentFieldType())
  

  // Future types to implement:
  // LinkRowFieldType
  // FormulaFieldType
}

// Call it immediately so it's ready when imported
initializeFieldRegistry()

export { FieldRegistry } from '../FieldRegistry'
export { extractChoices } from './SingleSelectFieldType'
export { BooleanFieldType } from './BooleanFieldType'
export { RatingFieldType } from './RatingFieldType'
export { LatestCommentFieldType, parseLatestCommentEntries, type CommentLogEntry }
