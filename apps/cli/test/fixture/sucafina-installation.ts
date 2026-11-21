export default function installation({ origin }: { origin: string }) {
  return {
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
      if (url.pathname === "/sucafina/dashboard") return Response.json((await request.arrayBuffer()).byteLength)
      return Response.json({
        origin,
        path: url.pathname + url.search,
        method: request.method,
        cookie: request.headers.get("cookie"),
        body: request.method === "POST" ? await request.text() : null,
      })
    },
    async dispose() { await Bun.write("installation-disposed", "yes") },
  }
}
