# Original request context admission

Consumer: integrate the postimages under `post/` into their corresponding repository paths, only after checking the preimage blob IDs at base 81d183dd0ee520e1accf4543ed05de70c1c2d8b8:

- apps/cli/src/sucafina-product/native-ui/context.ts: 940f8fc612f7dee3a3c412075a8e16d3d6e21410
- apps/cli/src/sucafina-product/native-ui/live-context.ts: 1406e7aa7b4832ccf923cf02f1789b6a1defccce

The test postimage is new. Public context ingress keeps its exact binding query; the internal reader accepts only static registered native UI paths and method, retains the original Request, and leaves selectors to the route handler. Both paths re-admit through the existing authority and retain its revocation fences. Operational availability is unchanged and stays unavailable without evidence.

Validation: NOT RUN. The consumer must apply and run the scoped hosted tests, CLI typecheck and guardrails; no runtime or provider proof is claimed.
