declare module 'hot-formula-parser' {
  export class Parser {
    constructor()
    parse(expression: string): { result: any; error: string | null }
    setVariable(name: string, value: any): this
    getVariable(name: string): any
    setFunction(name: string, fn: Function): this
    on(event: 'callVariable', listener: (name: string, done: (val: any) => void) => void): this
    on(event: 'callFunction', listener: (name: string, params: any[], done: (val: any) => void) => void): this
    on(event: string, listener: Function): this
  }
}
