/** Strips credentials from log text before writing it or including it in a debug export. */
export function redactLog(text: string) {
  return text
    .replace(/(\b[a-z][a-z\d+.-]*:\/\/)[^/\s?#"'\\]+@/gi, "$1[redacted]@")
    .replace(/(\b(?:auth_token|access_token|refresh_token|api_key)=)[^&#\s"'\\]+/gi, "$1[redacted]")
    .replace(
      /(\b(?:authorization|proxy-authorization|password|(?:x-)?api[-_]?key|auth_token|access_token|refresh_token)["'\x60]?[ \t]*[:=][ \t]*)(?:(["'\x60])(?:\\[^\r\n]|(?!\2)[^\\\r\n])*(\2|\\?(?=[\r\n]|$))|\[redacted\]|(?:(?:Basic|Bearer)[ \t]+)?[^\s"',}\\\]]+)/gi,
      (_, prefix: string, opening = "", closing = "") => prefix + opening + "[redacted]" + closing,
    )
    .replace(/\b(Basic|Bearer)[ \t]+[A-Za-z0-9+/=._~-]{8,}/gi, "$1 [redacted]")
}

const SENSITIVE_KEY = /^(?:authorization|proxy-authorization|password|(?:x-)?api[-_]?key|auth_token|access_token|refresh_token)$/i
const JSON_VALUE = /("(?:\\[^\r\n]|[^"\\\r\n])*")(?:(\s*:\s*)("(?:\\[^\r\n]|[^"\\\r\n])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|null|true|false))?/g

// Keep untouched tokens, whitespace and numeric precision in exported JSON and netlogs.
function redactJSON(text: string) {
  return text.replace(JSON_VALUE, (match, token: string, separator?: string, value?: string) => {
    try {
      if (separator !== undefined && value !== undefined) {
        if (SENSITIVE_KEY.test(JSON.parse(token))) return token + separator + '"[redacted]"'
        return token + separator + redactJSONString(value)
      }
      return redactJSONString(token)
    } catch {
      return redactLog(match)
    }
  })
}

function redactJSONString(token: string) {
  if (!token.startsWith('"')) return token
  const text: string = JSON.parse(token)
  const clean = redactLog(text)
  return clean === text ? token : JSON.stringify(clean)
}

export function redactLogFile(name: string, text: string) {
  if (/\.jsonl(\.\d+)?$/i.test(name)) return text.split("\n").map(redactJSON).join("\n")
  if (/\.(json|netlog)(\.\d+)?$/i.test(name)) return redactJSON(text)
  return redactLog(text)
}

const TEXT = /\.(log|netlog|txt|json|jsonl)(\.\d+)?$/i

/** Whether an exported file is text a person can read, so it is redacted; crash dumps are left as they are. */
export const isRedactable = (name: string) => TEXT.test(name)
