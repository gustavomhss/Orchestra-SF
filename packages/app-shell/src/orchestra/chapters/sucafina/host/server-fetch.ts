import type { ServerConnection } from "@/context/server"
import { authTokenFromCredentials } from "@/utils/server"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"

/** The selected shell connection authenticates only its own exact HTTP origin. */
export function createSfOwnerServerFetch(
  server: ServerConnection.HttpBase,
  fetcher: SfTransportFetch,
): SfTransportFetch {
  const origin = (() => {
    try {
      const url = new URL(server.url)
      if (!["http:", "https:"].includes(url.protocol) ||
          url.origin !== server.url.replace(/\/+$/, "") ||
          url.username || url.password || url.search || url.hash) return
      return url.origin
    } catch { return }
  })()
  const authorization = server.password
    ? "Basic " + authTokenFromCredentials({ username: server.username, password: server.password })
    : undefined
  return async (input, init) => {
    let url: URL
    try {
      url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
    } catch { throw new Error("SF_NATIVE_SERVER_ORIGIN_MISMATCH") }
    if (!origin || url.origin !== origin || url.username || url.password)
      throw new Error("SF_NATIVE_SERVER_ORIGIN_MISMATCH")
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value))
    if (authorization) headers.set("Authorization", authorization)
    // Keep the native cookie/method/body/signal policy; never forward these
    // server credentials through a redirect, including a different origin.
    return fetcher(input, { ...init, headers, redirect: "error" })
  }
}
