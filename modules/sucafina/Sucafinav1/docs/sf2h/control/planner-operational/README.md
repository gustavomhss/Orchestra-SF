# Planner operational observation intake

Base: bd97460230ce73a823e4a13b16ddd751ff78aa69. Apply postimages only after verifying each shared preimage blob:

- apps/cli/src/sucafina-product/native-ui/work.ts: fde98b609f88d5bdb3ca472bddc4b373092da2a6
- apps/cli/src/sucafina-product/native-ui/planner.ts: fee901b48a7c9bd612abb547b0465f5e04ce355e
- apps/cli/src/sucafina-product/host-context.ts: eb21646d079e4f3a6006208ded8548c14b597183
- modules/sucafina/Sucafinav1/local/entry.ts: 0075a06fcafca75030741bc50ce2cdd53f00d3d0
- modules/sucafina/Sucafinav1/product/contracts/host-context.ts: d21526bdfb2f48877a1ca77463ef8bcef6cdf87d

The local installation supplies the callback only after the router mounts the actual Planner handlers. The probe uses the original request, real environment, authenticated read transaction, Planner domain view, default selection, same projection and response schema; it never commits. The live context retains its repeated authority and observation fences. The mounted home producer is also executed with the original Request, with landing binding and response-schema checks. Only home, CAP17 and CAP23 have observations; other operations stay unavailable. This is a default-selection availability observation, not authorization for a command or a guarantee about every selector.

Validation: NOT RUN. Consumer must review and run scoped hosted tests, CLI typecheck and guardrails before claiming readiness.
