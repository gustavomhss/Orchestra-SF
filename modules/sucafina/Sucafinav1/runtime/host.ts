import { createApplication } from "./application.ts"
import type { Application } from "./application.ts"

/** Compose before the installation's existing server binds. The customer module never enters Orchestra's product graph. */
export function composeWithOrchestra(
  orchestra: {
    handler: (request: Request) => Promise<Response>
    dispose: () => Promise<void>
  },
  mount: string,
  application: Application,
) {
  const module = createApplication(mount, application)
  return {
    handler: async (request: Request) => (await module(request)) ?? orchestra.handler(request),
    dispose: () => orchestra.dispose(),
  }
}
