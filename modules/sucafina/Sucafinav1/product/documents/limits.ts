/** Runtime bounds for authorized document parsing, independent of business policy. */
export const sfDocumentLimits = Object.freeze({
  version: "1",
  maxBytes: 20 * 1024 * 1024,
  maxTextLength: 1_000_000,
  maxPages: 500,
  maxXmlBytes: 8 * 1024 * 1024,
  maxZipEntries: 2000,
  timeoutMs: 15_000,
})
