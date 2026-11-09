import { describe, expect, test } from "bun:test"
import { listenerHosts } from "../src/commands/handlers/serve-host"

const defaults = ["localhost", "127.0.0.1", "[::1]"]
const info = { netmask: "", mac: "00:00:00:00:00:00", internal: false, cidr: null }

describe("listenerHosts", () => {
  test("keeps the defaults and brackets a raw IPv6 bind without duplicating loopback", () => {
    for (const hostname of ["localhost", "127.0.0.1", "::1", "[::1]"])
      expect(listenerHosts(hostname, [], {})).toEqual(defaults)
    expect(listenerHosts("orchestra.internal", [], {})).toEqual([...defaults, "orchestra.internal"])
    expect(listenerHosts("0.0.0.0", [], {})).toEqual([...defaults, "0.0.0.0"])
  })

  test("includes IPv4 and IPv6 interfaces and deduplicates aliases, bind and interface addresses", () => {
    expect(
      listenerHosts("::", ["proxy.example.test", "proxy.example.test", "[2001:db8::10]"], {
        missing: undefined,
        loopback: [
          { ...info, family: "IPv4", address: "127.0.0.1", internal: true },
          { ...info, family: "IPv6", address: "::1", internal: true, scopeid: 0 },
        ],
        ethernet: [
          { ...info, family: "IPv4", address: "192.0.2.10" },
          { ...info, family: "IPv6", address: "2001:db8::10", scopeid: 0 },
          { ...info, family: "IPv6", address: "2001:db8::10", scopeid: 0 },
        ],
      }),
    ).toEqual([...defaults, "[::]", "192.0.2.10", "[2001:db8::10]", "proxy.example.test"])
  })

  test("does not add unusable discovered addresses or attach the local scopeid", () => {
    expect(
      listenerHosts("localhost", [], {
        ethernet: [
          { ...info, family: "IPv4", address: "not-an-ip" },
          { ...info, family: "IPv6", address: "fe80::1%en0", scopeid: 7 },
          { ...info, family: "IPv6", address: "fe80::2", scopeid: 7 },
        ],
      }),
    ).toEqual([...defaults, "[fe80::2]"])
  })

  test("preserves invalid explicit bind names and aliases for Server validation", () => {
    const aliases = ["", " bad host ", "https://proxy.example.test", "bad/path", "[fe80::1%en0]"]
    expect(listenerHosts("bad/bind", aliases, {})).toEqual([...defaults, "bad/bind", ...aliases])
  })
})
