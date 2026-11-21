export default function installation({ origin }: { origin: string }) {
  const trusted = process.env.SF_TEST_TRUSTED_INGRESS === "1"
  const ingress = new URL(origin)
  ingress.hostname = "teams-ingress.example.test"
  return {
    ...(trusted ? { trustedIngress: {
      origin: ingress.origin,
      authorize: (proof: string | undefined) => proof === "synthetic-sf-ingress-proof",
    } } : {}),
    mount: "/sucafina",
    async handler(request: Request) {
      const url = new URL(request.url)
      if (url.pathname === "/sucafina/missing") return undefined
      if (url.pathname === "/sucafina/unavailable") throw new Error("Fixture unavailable")
      if (url.pathname === "/sucafina/reject") {
        const reader = request.body?.getReader()
        await reader?.read()
        await reader?.cancel()
        return new Response(null, { status: 413 })
      }
      if (url.pathname === "/sucafina/dashboard" || url.pathname === "/sucafina/teams/44444444-4444-4444-8444-444444444444/dashboard") {
        return Response.json((await request.arrayBuffer()).byteLength)
      }
      return Response.json({
        origin,
        path: url.pathname + url.search,
        ...(trusted ? {
          requestOrigin: url.origin,
          ingressProof: request.headers.get("x-sf-ingress-proof"),
          forwardingHeaders: [...request.headers.keys()].filter((name) => name === "forwarded" || name.startsWith("x-forwarded-")),
        } : {}),
        method: request.method,
        cookie: request.headers.get("cookie"),
        body: request.method === "POST" ? await request.text() : null,
      })
    },
    async dispose() { await Bun.write("installation-disposed", "yes") },
  }
}
