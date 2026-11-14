import type { SfInstallation } from "../../src/sucafina-product/installation.ts"

// Router fixture only: it does not admit a person, run a provider or mutate SF.
export default function installation(): SfInstallation {
  return {
    mount: "/sucafina",
    handler: async (request) => new Response(request.method + " " + new URL(request.url).pathname),
    dispose: () => {},
  }
}
