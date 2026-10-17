import { TextFieldType } from './TextFieldType'

export class LongTextFieldType extends TextFieldType {
  readonly type = 'long_text'
  readonly name = '長文字'
}

export class PasswordFieldType extends TextFieldType {
  readonly type = 'password'
  readonly name = '密碼'
}

export class AiPromptFieldType extends TextFieldType {
  readonly type = 'ai_prompt'
  readonly name = 'AI 提示'
}
