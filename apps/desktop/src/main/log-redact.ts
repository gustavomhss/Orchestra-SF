/** Strips credentials from log text before writing it or including it in a debug export. */
export function redactLog(text: string) {
  return text
    .replace(/(\b[a-z][a-z\d+.-]*:\/\/)[^/\s?#"'\\]+@/gi, "$1[redacted]@")
    .replace(/(\b(?:auth_token|access_token|refresh_token|api_key)=)[^&#\s"'\\]+/gi, "$1[redacted]")
    .replace(
      /(\b(?:authorization|proxy-authorization|password|(?:x-)?api[-_]?key|auth_token|access_token|refresh_token)["'\x60]?[ \t]*[:=][ \t]*)(?:(["'\x60])(?:\\[\s\S]|(?!\2)[^\\])*\2|\[redacted\]|(?:(?:Basic|Bearer)[ \t]+)?[^\s"',}\\\]]+)/gi,
      (_, prefix: string, quote = "") => prefix + quote + "[redacted]" + quote,
    )
    .replace(/\b(Basic|Bearer)\s+[A-Za-z0-9+/=._~-]{8,}/gi, "$1 [redacted]")
}

const TEXT = /\.(log|netlog|txt|json|jsonl)(\.\d+)?$/i

/** Whether an exported file is text a person can read, so it is redacted; crash dumps are left as they are. */
export const isRedactable = (name: string) => TEXT.test(name)
