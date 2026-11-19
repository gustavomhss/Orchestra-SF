/** Accept transport attribute reordering without relaxing the operator session policy. */
export function readOperatorSessionCookie(headers: Headers, publicOrigin = "http://localhost:4110") {
  const origin = new URL(publicOrigin)
  if (origin.origin !== publicOrigin || origin.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))
    throw new Error("Operator cookie requires its actual loopback enrollment origin")
  const values = headers.getSetCookie()
  if (values.length !== 1) throw new Error("Production enrollment did not issue its scoped HttpOnly session")
  const parts = values[0]!.split(";").map((part) => part.trim())
  const issued = /^(sucafina_operator_[a-f0-9]{24})=([a-f0-9]{64})$/.exec(parts[0]!)
  const attributes = parts.slice(1)
  const required = ["Path=/sucafina", "HttpOnly", "SameSite=Lax", "Max-Age=28800"]
  if (!issued || attributes.length !== required.length || new Set(attributes).size !== required.length ||
    !required.every((attribute) => attributes.includes(attribute)))
    throw new Error("Production enrollment did not issue its scoped HttpOnly session")
  return { name: issued[1]!, value: issued[2]!, domain: origin.hostname, path: "/sucafina", httpOnly: true, secure: false, sameSite: "Lax" as const }
}
