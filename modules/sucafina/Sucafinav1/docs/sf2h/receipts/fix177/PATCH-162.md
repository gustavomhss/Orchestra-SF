# Missão 177 / A01 — patch seletivo e closure para a única integradora 162

**É um patch inerte, NÃO APLICADO em `sf2-stack` por 177.** Consumir somente os dois paths abaixo, preservando todo o resto da árvore atual. Não copiar a branch `sf-ux-w14` por inteiro.

## 1. Alteração efetiva em `domain.ts`

- Origem: `0da6973b636d98116d381a6902a2f85cd25d619e` (tree `404eb079f9f2f9b18816e4dc953bafef2f2a436c`)
- Preimage do arquivo: `1aa4a2360f94cadfdc49e7e0579f61fb97dfa0f4`
- Postimage de arquivo: `9c5eb4b4139315d20b5ae40a06d58f955984596a`
- O retorno da persistência recebe uma união discriminada explícita; o catálogo de rotas preserva as dez chaves literais já existentes no catálogo global.

```diff
--- a/apps/cli/src/sucafina-product/native-ui/domain.ts
+++ b/apps/cli/src/sucafina-product/native-ui/domain.ts
@@ -24,6 +24,35 @@ const actions: Readonly<Record<SfDomainCapability, readonly string[]>> = {
   CAP16: ["save", "save-item", "delete-item", "save-sub", "delete-sub"],
 }
 
+type SfDomainReadOutcome =
+  | Readonly<{ kind: "denied" }>
+  | Readonly<{ kind: "unavailable" }>
+  | Readonly<{
+      kind: "ok"
+      data: NonNullable<ReturnType<typeof projectSfDomainData>>
+      versions: ReturnType<typeof projectSfDomainVersions>
+      versionFence: string
+    }>
+
+// Pair each admitted capability with the exact frozen SfOperationId literal.
+// The mapped union rejects a mismatched CAP-to-operation pairing at compile time.
+type SfDomainPageRoute = {
+  [Capability in SfDomainCapability]: readonly [Capability, `domain.page.${Capability}`]
+}[SfDomainCapability]
+
+const domainPageRoutes: readonly SfDomainPageRoute[] = [
+  ["CAP01", "domain.page.CAP01"],
+  ["CAP03", "domain.page.CAP03"],
+  ["CAP04", "domain.page.CAP04"],
+  ["CAP05", "domain.page.CAP05"],
+  ["CAP09", "domain.page.CAP09"],
+  ["CAP10", "domain.page.CAP10"],
+  ["CAP13", "domain.page.CAP13"],
+  ["CAP14", "domain.page.CAP14"],
+  ["CAP15", "domain.page.CAP15"],
+  ["CAP16", "domain.page.CAP16"],
+]
+
 const json = (body: object, status: number) =>
   Response.json(body, { status, headers })
 const denied = () => json({ status: "denied" }, 403)
@@ -119,21 +148,21 @@ async function page(deps: SfNativeHostDependencies, request: Request, cap: SfDom
       ? (typeof selection.executiveMonth === "number" ? selection.executiveMonth
         : typeof selection.month === "number" ? selection.month : now.getMonth() + 1)
       : typeof selection.month === "number" ? selection.month : now.getMonth() + 1
-    const outcome = await deps.application.persistence.transaction("dashboard", async (snapshot) => {
+    const outcome = await deps.application.persistence.transaction<SfDomainReadOutcome>("dashboard", async (snapshot) => {
       const principal = await deps.application.authenticate(request, {
         surface: "dashboard", roleMap: roleMap(snapshot, "dashboard"),
       })
       const actor = authorizedActor(principal, snapshot.data)
       if (!actor || actor.id !== context.value.stamp.principalRef) {
-        return { commit: false, value: { kind: "denied" as const } }
+        return { commit: false, value: { kind: "denied" } }
       }
       const summaries = Array.isArray(snapshot.data.summaries)
         ? snapshot.data.summaries.filter((value): value is string => typeof value === "string") : []
       if (!dashboardPages(actor, summaries).includes(pageName)) {
-        return { commit: false, value: { kind: "denied" as const } }
+        return { commit: false, value: { kind: "denied" } }
       }
       const contribution = deps.application.domains.dashboard.find((item) => item.pages.includes(pageName))
-      if (!contribution) return { commit: false, value: { kind: "unavailable" as const } }
+      if (!contribution) return { commit: false, value: { kind: "unavailable" } }
 
       const beforeAudit = snapshot.audit.length
       // The producer owns visibility and business calculations. A private snapshot
@@ -142,14 +171,14 @@ async function page(deps: SfNativeHostDependencies, request: Request, cap: SfDom
         { ...snapshot, data: publicSfData(snapshot.data) }, actor, environment,
       )
       const data = projectSfDomainData(cap, publicSfData(view.data), year)
-      if (!data) return { commit: snapshot.audit.length > beforeAudit, value: { kind: "unavailable" as const } }
+      if (!data) return { commit: snapshot.audit.length > beforeAudit, value: { kind: "unavailable" } }
       const versions = projectSfDomainVersions(cap, view.versions)
       // This is a server-private fence, not a DTO. No actor, raw audit, role map,
       // full business snapshot, version.by or private data crosses the boundary.
       const versionFence = JSON.stringify(snapshot.versions)
       return {
         commit: snapshot.audit.length > beforeAudit,
-        value: { kind: "ok" as const, data, versions, versionFence },
+        value: { kind: "ok", data, versions, versionFence },
       }
     }, { signal: request.signal })
     if (outcome.kind === "denied") return denied()
@@ -233,9 +262,9 @@ async function localAdmin(deps: SfNativeHostDependencies, request: Request): Pro
 
 export function createSfDomainProjectionHandlers(deps: SfNativeHostDependencies): readonly SfProjectionHandler[] {
   return [
-    ...Object.keys(SF_DOMAIN_PAGES).map((cap) => ({
-      operationId: `domain.page.${cap}` as `domain.page.${SfDomainCapability}`,
-      handle: (request: Request) => page(deps, request, cap as SfDomainCapability),
+    ...domainPageRoutes.map(([cap, operationId]) => ({
+      operationId,
+      handle: (request: Request) => page(deps, request, cap),
     })),
     { operationId: "projection.local-admin", handle: (request: Request) => localAdmin(deps, request) },
   ]
```

## 2. Dependência real faltante (sem substitutos)

- Add **exatamente** `apps/cli/src/sucafina-product/native-ui/domain/projection.ts` com blob original W14 `eae532dae73f282d9cefd66228da15fc26b63040`; preimage do consumidor: ABSENT. Não reescrever o helper.
- O helper original importa `computeBudgetTotals` de `modules/sucafina/Sucafinav1/src/dashboard-accounts.ts` e `rows` de `runtime/contract.ts`; mantém o DTO permitido e os números/versões do produtor.
- O teste existente `modules/sucafina/Sucafinav1/test/native-ui-contract/domain.test.ts` já tem blob `1eca59606897df8c2a291bff860e51cb6e3f81ad` no consumidor e na origem; NÃO copiar novamente nem criar teste espelhado.
- Os demais A01 schema/client leaves (domain.ts, fields.ts, commands.ts, product.ts, operations.ts e client/domain.ts) já têm os mesmos blobs na origem e no consumidor; nenhuma importação ampla está autorizada.

## 3. Imagens e consumo proposto, SEM write no consumidor

- Consumer pre-HEAD observado: `913b6b8f143e6c3e869eee293d02f04259c7cdd1`
- Consumer pre-tree: `99d4788774ce548d4cd64a96c0f2481db1fb15eb`
- Consumer candidate post-tree **inerte** (apenas os dois paths): `532705345c67bcd82057729791c2452a41f94360`
- Consumer post-HEAD/commit efetivo: **PENDING_162_CAS**, não inferido pelo tree proposto.
- A 162 deve reler HEAD+blobs antes do apply; se HEAD mudou, reconciliar e recomputar tree somente com essas duas entradas. Atualização da branch exclusivamente 162, `expected_sha=<HEAD verificado>`, `force=false`.

```json
{
  "base_tree_sha": "99d4788774ce548d4cd64a96c0f2481db1fb15eb",
  "tree_elements": [
    {
      "path": "apps/cli/src/sucafina-product/native-ui/domain.ts",
      "mode": "100644",
      "type": "blob",
      "sha": "9c5eb4b4139315d20b5ae40a06d58f955984596a"
    },
    {
      "path": "apps/cli/src/sucafina-product/native-ui/domain/projection.ts",
      "mode": "100644",
      "type": "blob",
      "sha": "eae532dae73f282d9cefd66228da15fc26b63040"
    }
  ]
}
```

## 4. Shared seam / contratos (162 somente)

- `SfOperationIds` e `SfOperationRegistry` no material atual já listam `domain.page.CAP01/CAP03/CAP04/CAP05/CAP09/CAP10/CAP13/CAP14/CAP15/CAP16` e `projection.local-admin`. **Não alterá-los para mascarar TS2322.**
- `packages/schema/package.json` já possui `./sucafina/domain → ./src/sucafina/domain.ts` e `packages/client/package.json` já possui `./sucafina/domain → ./src/sucafina/domain.ts`. Sem patch de exports nesta correção.
- Respeitar `F01`/`F02`, `native-ui/router.ts`, identidade/grants/Request original e versão corrente; a 172 é dona de F01 live-context. `projection.local-admin` conserva 403 para não operadores e 503 `local-operator-reader-not-bound` para operador até existir reader autorizado, sem stub.

## 5. Validação e handoff

- 177: `NOT_RUN_BY_POLICY` (nenhum typecheck/test/parser/build local, nenhum dispatcher). Os logs de 163/164 em W690 são falhas anteriores, não prova sobre este patch.
- **163**, após 162 materializar um novo C/tree coerente: deduplicar a entrada (C/tree, selection, runtime, config); executar `bun typecheck` pelo executor hospedado em `apps/cli`, `packages/client` e `packages/schema` com os guards/SDK já previstos; verificar que TS2307/TS2345/TS18046/TS2322 de `native-ui/domain.ts` cessaram. Não reexecutar input antigo falho W690.
- **164**, após integração: usar só o dispatcher hospedado existente `test:ci/request` para `modules/sucafina/Sucafinav1/test/native-ui-contract/domain.test.ts` (oito checks já autorados); dedupe por C/tree/selection/runtime/config/fixture, preservar artefato e resultado reais. Nenhuma suite global ou browser A01 foi executada por 177.
- Aceites A01-AC01/02/03: source whitelist/zero-null-absence; operações fechadas/sem dispatch genérico; Request original/CAS/version fences. Evidência até aqui é inspeção de código + publicação de blobs; qualificação **NOT_RUN**.
- Goal nativa continua pausada; `GLOBAL_RELEASE=false`; PR65 e PR133 não devem ser mescladas por 177.
