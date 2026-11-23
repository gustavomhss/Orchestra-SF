/**
 * Playwright's fetch errors can include private request headers in their call log.
 * Keep the failure category, endpoint and useful assertion text, but construct a
 * new error so neither the original stack nor a nested cause reaches the reporter.
 */
export function forwardError(error: unknown, method: "GET" | "POST", requestURL: string) {
  const original = error instanceof Error ? error.message : typeof error === "string" ? error : "Original response observation failed"
  const message = original.split(/\r?\nCall log:/i)[0]!
    .replace(/^.*\b(?:cookie|set-cookie|authorization|proxy-authorization)["']?\s*[:=][^\r\n]*$/gim, "[credential header redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/g, "[request URL]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, "[credential]")
    .replace(/\b(code|token|password|secret)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s&,]+)/gi, "$1=[redacted]")
    .replace(/[a-f0-9]{64}/gi, "[redacted]")
  const endpoint = new URL(requestURL).pathname.replace(/[a-f0-9]{64}/gi, "[redacted]")
  const safe = new Error(method + " " + endpoint + ": " + message)
  safe.name = error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name) ? error.name : "Error"
  return safe
}
