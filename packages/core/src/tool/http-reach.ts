export * as HttpReach from "./http-reach"

import { isIP } from "node:net"

export type Reach = "public" | "loopback" | "private" | "link-local"

/** Where a host name or address literal points, as far as its text shows. A name is only `localhost` or `*.localhost`. */
export function reach(hostname: string): Reach {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "")
  if (host === "localhost" || host.endsWith(".localhost")) return "loopback"
  if (isIP(host) === 4) {
    const [a = 0, b = 0] = host.split(".").map(Number)
    return reachV4(a, b)
  }
  if (isIP(host) === 6) return reachV6(host)
  return "public"
}

function reachV4(a: number, b: number): Reach {
  if (a === 127) return "loopback"
  if (a === 169 && b === 254) return "link-local"
  if (a === 0 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "private"
  // Shared address space for carrier-grade NAT.
  if (a === 100 && b >= 64 && b <= 127) return "private"
  return "public"
}

function reachV6(host: string): Reach {
  const groups = expandV6(host)
  if (!groups) return "private"
  const [first = 0] = groups
  const leadingZero = groups.slice(0, 5).every((group) => group === 0)
  if (leadingZero && groups[5] === 0 && groups[6] === 0) return groups[7] === 1 ? "loopback" : "private"
  // IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible (::a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) carry an IPv4 address.
  const embedded =
    (leadingZero && (groups[5] === 0xffff || groups[5] === 0)) ||
    (first === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((group) => group === 0))
  if (embedded) {
    const high = groups[6] ?? 0
    return reachV4(high >> 8, high & 0xff)
  }
  if ((first & 0xffc0) === 0xfe80) return "link-local"
  if ((first & 0xfe00) === 0xfc00) return "private"
  return "public"
}

function expandV6(host: string) {
  const zone = host.indexOf("%")
  const text = zone === -1 ? host : host.slice(0, zone)
  const [head = "", tail, extra] = text.split("::")
  if (extra !== undefined) return undefined
  const parse = (part: string) => (part === "" ? [] : part.split(":").flatMap(hextets))
  const left = parse(head)
  const right = tail === undefined ? [] : parse(tail)
  const fill = 8 - left.length - right.length
  if (tail === undefined ? left.length !== 8 : fill < 0) return undefined
  return [...left, ...Array.from({ length: tail === undefined ? 0 : fill }, () => 0), ...right]
}

// A trailing dotted quad stands for two hextets.
function hextets(part: string) {
  if (part.includes(".")) {
    const quad = part.split(".").map(Number)
    return [(quad[0]! << 8) | quad[1]!, (quad[2]! << 8) | quad[3]!]
  }
  return [Number.parseInt(part, 16)]
}
