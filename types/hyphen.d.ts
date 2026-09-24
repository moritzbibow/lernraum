declare module 'hyphen/de' {
  export function hyphenateSync(text: string, options?: { hyphenChar?: string; minWordLength?: number }): string
}
