import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto"

export type TeamConnectionKey = Readonly<{ version: 1; bytes: Uint8Array }>
const domain = "Orchestra.SF.TeamConnections/1"

/** Derive from the already provisioned private installation key; never create a replacement key on loss. */
export function teamConnectionKey(sessionKey: Uint8Array): TeamConnectionKey {
  if (!(sessionKey instanceof Uint8Array) || sessionKey.byteLength !== 32) throw new Error("SF_TEAM_CONNECTION_KEY_UNAVAILABLE")
  return Object.freeze({ version: 1, bytes: new Uint8Array(createHmac("sha256", sessionKey).update(domain).digest()) })
}
export function teamConnectionCipher(input: TeamConnectionKey) {
  if (input.version !== 1 || !(input.bytes instanceof Uint8Array) || input.bytes.byteLength !== 32)
    throw new Error("SF_TEAM_CONNECTION_KEY_UNAVAILABLE")
  const key = Buffer.from(input.bytes)
  const fingerprint = createHmac("sha256", key).update(domain + "/fingerprint").digest("hex")
  return Object.freeze({
    version: 1 as const, fingerprint,
    seal: (plain: string, associated: string) => {
      const iv = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", key, iv)
      cipher.setAAD(Buffer.from(associated, "utf8"))
      const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
      return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64")
    },
    open: (sealed: string, associated: string) => {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(sealed)) throw new Error("SF_TEAM_CONNECTION_VALUE_UNAVAILABLE")
      const data = Buffer.from(sealed, "base64")
      if (data.length < 28 || data.toString("base64") !== sealed) throw new Error("SF_TEAM_CONNECTION_VALUE_UNAVAILABLE")
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12))
        decipher.setAAD(Buffer.from(associated, "utf8"))
        decipher.setAuthTag(data.subarray(12, 28))
        return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8")
      } catch {
        throw new Error("SF_TEAM_CONNECTION_VALUE_UNAVAILABLE")
      }
    },
  })
}
export const teamConnectionDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
