# Compare — sf-ops-composed

## Comparação congelada

- Base UI: `f732f10592fe00b04ddd8490fd3d0cade5d357d0`.
- Código composto: `6ed717338ab983c546da64d100ea9dfb00bbe5d6`.
- [Diff publicado na íntegra](https://github.com/gustavomhss/Orchestra-SF/compare/f732f10592fe00b04ddd8490fd3d0cade5d357d0...6ed717338ab983c546da64d100ea9dfb00bbe5d6).
- Fonte Operations: `c3866403562e462f55d527d592f19cbc817ed0cf`; [delta desde f7dd58](https://github.com/gustavomhss/Orchestra-SF/compare/f7dd58e32bc834f1485df20b91adbf759b4c4ad0...c3866403562e462f55d527d592f19cbc817ed0cf).
- A API de compare confirmou ahead 1 / behind 0, merge-base igual à base UI e pai único igual a `f732f10592fe00b04ddd8490fd3d0cade5d357d0`. É um commit de composição para qualificação, não um merge de PR.

## Sobreposições reconciliadas

### Requests/page.tsx

Preservado integralmente o anchor C02 da UI, inclusive request/hash, sourceRef, sourceDigest e sourceVersion. O delta Operations afeta somente o snapshot plain de PR/PO, seu uso no digest/envios e as verificações exatas após o hash. Todas as fences, IDs, CAS e ações permanecem.

### Sourcing/index.tsx

Preservados o `dl[data-sf-sourcing-selection]` da UI e os campos read-only supplierId/qty já presentes no futuro PO. A composição não duplica esses controles nem acrescenta o parágrafo equivalente de seleção da antiga branch Operations. Entram os deltas de snapshot plain, equality fence, total numérico/null, apresentação Unavailable e data-source-version do heading.

### Suppliers/index.tsx

Preservadas a reatividade dos campos bancários, a política original bankAuthorized, o mascaramento e o data-version tanto no editor quanto no detalhe. No detalhe:

```tsx
<div class="sf-u14-detail" data-sf-supplier-ref={id}
  data-version={version() ?? undefined}
  data-source-version={version() ?? undefined}>
```

Os dois atributos leem a mesma versão original. Entram snapshot plain, ausência de id:undefined e SfBoundAssets com refs/versão/allowedAction/releitura originais. Não há valor de versão derivado ou fabricado.

## Native producer: somente os dois deltas pedidos

Path: `apps/cli/src/sucafina-product/native-ui/procurement.ts`.

Fonte antiga: blob `59aee8f9602ab77f31d6cd3f33a5d84aeb6f4059`, da branch finish-operations. A base UI já contém qty/unitPrice e a identidade C02; essas partes permanecem exatamente como na UI.

```diff
-  CAP26: ["year", "month"],
+  CAP26: ["year", "month", "request"],
```

```tsx
if (Object.hasOwn(source, "attachments"))
  safe.attachments = rows(source.attachments).map((asset) =>
    pick(asset, ["id", "name", "type", "bytes", "size"]))
```

A projeção usa apenas o registro autorizado recebido por selectSupplier e sua whitelist de metadados. Nenhuma leitura de bytes, grant, cache de identidade ou política bancária foi criada.

## Dependência Files #393

São os dois blobs exatos do PR head `d8938c31cd818648cfc78828eb32bcb68c04165e`:

- `packages/client/src/sucafina/bindings.ts`: `dcf4229af5745da305906a2c1f7ce42427fd62bd`.
- `packages/client/test/sucafina/files-transport226/source-codecs.test.ts`: `072a58358f4057526a932d0a22981194e7786612`.

Ambos foram inseridos na árvore por SHA e a API confirmou igualdade após publicação. São dependências de qualificação incluídas no candidato; **esta composição não afirma que #393 foi mergeado**. Codec não é readiness, autorização ou prova de scanner. Nenhum baseline ou byte Office foi inventado.

## Inventário exato do diff

A comparação publicada contém **19 paths de código + 1 handoff histórico**. As duas documentações desta composição são acrescentadas no commit documental seguinte.

| Path | Proveniência | Blob resultante | Delta contra UI |
| --- | --- | --- | --- |
| `apps/cli/src/sucafina-product/native-ui/procurement.ts` | UI congelada + dois deltas de 59aee8 | `f7f9c9bbab4a1011b18a93fef5e9000270f6d3b7` | +3/-1 |
| `docs/handoff/HANDOFF-sf-continuation-ops.md` | Operations c386640: blob exato | `0f15eed5df7eddf651c418415e24331cd5c02517` | +97/-0 |
| `packages/app-shell/e2e/sucafina/operations-support/documents.ts` | Operations c386640: blob exato | `40ecc44afc88201345dfbb342b1fc61ef9cb7b6c` | +75/-58 |
| `packages/app-shell/e2e/sucafina/operations-support/imports.ts` | Operations c386640: blob exato | `9f50ba7e0386d10acd37d8ac7bf703b333be47ba` | +50/-38 |
| `packages/app-shell/e2e/sucafina/operations-support/procurement-comparison.ts` | Operations c386640: blob exato | `fd6e1237736ce05dc2e70740d61b96dbad262998` | +8/-7 |
| `packages/app-shell/e2e/sucafina/operations-support/procurement-refusal.ts` | Operations c386640: blob exato | `56cd9d2fde5d234b00879434b668051b7f586169` | +39/-48 |
| `packages/app-shell/e2e/sucafina/operations-support/procurement-snapshot.ts` | Operations c386640: blob exato | `1ffe483fc7ba069f919f8cc278267feb5db99e72` | +47/-56 |
| `packages/app-shell/e2e/sucafina/operations-support/procurement.ts` | Operations c386640: blob exato | `92a104398875e82a09a46b1e86016cbd783f6939` | +8/-6 |
| `packages/app-shell/e2e/sucafina/operations-support/runtime.ts` | Operations c386640: blob exato | `c078bb8864cf4138557ae2e88f86e93b3bea4a4a` | +117/-10 |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-u14.ts` | Operations c386640: blob exato | `1b5575458e1a521a3114a4b5dcfa0fff580e42e7` | +2/-0 |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/forms.tsx` | Operations c386640: blob exato | `0b42aa47b979443e796930459dace9485df9f960` | +2/-1 |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/model.ts` | Operations c386640: blob exato | `5907aee669ae44367cc61aa028ca135610e20dd3` | +33/-16 |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx` | UI congelada + delta Operations reconciliado | `99df259e5b0901ea216e4a8cac77278cbc20502f` | +16/-13 |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx` | UI congelada + delta Operations reconciliado | `480ab4022424ccbf7c1924890ce5218ba040d2fe` | +17/-12 |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/model.ts` | Operations c386640: blob exato | `2007f544e5f77e5ccf6439589808a7b1a1bacce2` | +10/-9 |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx` | UI congelada + delta Operations reconciliado | `b92d3b324e282a9511c349f79ae4f701cd1e8b2c` | +20/-9 |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/model.ts` | Operations c386640: blob exato | `6536b7cf8bcb72b09a87a922f0168d38a9098017` | +1/-1 |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/attachments/bound-assets.tsx` | Operations c386640: blob exato | `fcd382816615d1aeaf67585805903863fadb7e58` | +2/-2 |
| `packages/client/src/sucafina/bindings.ts` | #393: blob exato | `dcf4229af5745da305906a2c1f7ce42427fd62bd` | +16/-0 |
| `packages/client/test/sucafina/files-transport226/source-codecs.test.ts` | #393: blob exato | `072a58358f4057526a932d0a22981194e7786612` | +14/-9 |

## Limites da revisão

A verificação realizada foi leitura/diff pela API GitHub e conferência da identidade dos blobs. Não houve shell, compilação local, Actions, PR ou merge. Os arquivos de instalação/C12, runtime/application.ts, suites.json, configurações compartilhadas e host/WP04 permanecem os da base congelada.

A raiz continua responsável por compor a configuração compartilhada aprovada, ClamD real e o gate único de Operations antes de aceitar esta composição.
