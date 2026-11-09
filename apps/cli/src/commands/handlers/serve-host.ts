import { isIP } from "node:net"
import { networkInterfaces } from "node:os"

/**
 * The HTTP Host authorities this listener answers to: loopback names, the bind hostname, local interface
 * addresses and explicit aliases. Scheme-less Authorities are normalized and rejected by the server policy.
 */
export function listenerHosts(
  hostname: string,
  aliases: ReadonlyArray<string> = [],
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): ReadonlyArray<string> {
  const host = (address: string) => (isIP(address) === 6 ? `[${address}]` : address)
  const addresses = Object.values(interfaces)
    .flatMap((entries) => entries ?? [])
    .map((entry) => entry.address)
    // Interface-local zone identifiers cannot be used as HTTP Host authorities.
    .filter((address) => isIP(address) !== 0 && !address.includes("%"))

  // Preserve explicit aliases, including invalid values, for visible Server validation.
  return [...new Set(["localhost", "127.0.0.1", "[::1]", host(hostname), ...addresses.map(host), ...aliases])]
}

export * as ServeHost from "./serve-host"
