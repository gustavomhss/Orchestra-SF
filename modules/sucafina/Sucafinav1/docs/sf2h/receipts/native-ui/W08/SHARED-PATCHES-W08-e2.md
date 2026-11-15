# W08 e2 — patches de composição para114/W04 (INERTES)

Estes fragmentos **não foram aplicados** por W08. Antes de consumir, 114 reconcilia **preimages atualizadas, owners e autorização editorial**; não sobrescreve F03 ou outros autores. A composição I00 é responsável pelos registries, não W08.

## 1) F03: export público `SfSource` para consumidor S03

Arquivo: `packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/index.tsx`
Preimage observada em branch `sf-ux-w04`: blob `efd0e794526297be54f648315f8d6ad01e29198e`. F03 `frame/types.ts` já define `SfSource`; somente seu barrel público omite o alias. Aplicar via autor W04 e2 ou 114 após release explícita.

```diff
 export type {
   SfAction, SfChartFrameProps, SfContextBarProps, SfCopyKey, SfCoverage,
   SfDensity, SfDisplayValue, SfLayoutMode, SfMessage, SfPageFrameProps,
-  SfPlotSeries, SfRunStateProps, SfStatePanelProps, SfText, SfUiState,
+  SfPlotSeries, SfRunStateProps, SfSource, SfStatePanelProps, SfText, SfUiState,
 } from "./types"
```

S03 consome `import type { SfSource } from "../frame"` e **não** importa `../frame/types` privado.

## 2) Registro bilíngue I00 sem alteração de copy congelada

Arquivo: `packages/app-shell/src/i18n/orchestra.ts`. Preimage observada em `sf2-stack`: `2eeaa42e02a45b3301fc765c6c92635af5101079`. 114 integra no mesmo C com F03 `SF_COMMON_COPY/BR` e as folhas dos demais autores, com confirmação editorial das novas `sf.s03.*` (ausentes de `surface-manifest.json@50e2993`). **Nenhuma mudança de texto source English congelado**. Patch W08 proposto delimitado:

```diff
 import { FRONTEND_RECOVERY_COPY, FRONTEND_RECOVERY_COPY_BR } from "./frontend-recovery"
+import { SF_S03_COPY, SF_S03_COPY_BR } from "./orchestra-chapters/sf-s03"

 export const ORCHESTRA_COPY = {
@@
   ...FRONTEND_RECOVERY_COPY,
+  ...SF_S03_COPY,
 }

 export const ORCHESTRA_COPY_BR: Partial<Record<keyof typeof ORCHESTRA_COPY, string>> = {
@@
   ...FRONTEND_RECOVERY_COPY_BR,
+  ...SF_S03_COPY_BR,
 }
```

A localização de `...SF_S03_COPY` deve seguir os demais `SF_*` no patch consolidado 114, evitando duplicatas. Os rótulos `sf.common.currentSource` e `sf.common.proposedValues` são da F03 e já reusados por S03. As 22 entradas específicas `sf.s03.*` restantes são propostas editoriais bilíngues, não homologação COPY-01.

## 3) Injeção de draft em I00 / foundation-context-transport

Contrato de `host-signatures.ts` e `CONTRACTS.md §6.1`: 114 injeta `createSfDraft` de `shared/draft` em `SfContextDependencies.createDraft` para F01. O provider importa apenas tipo, e o registry F01 publica apenas `SfPublicDraftController`; os métodos `quarantine/restoreSameAuthority/revoke` permanecem **privados ao registry**. 114 faz composição no arquivo de host real confirmado no candidato. Não há patch material para arquivo inexistente/sem preimage confirmada e não foi criada factory F02 paralela.

## 4) Contratos de tipos dependentes

S03 importa `SfOwnerKey/SfEditScopeKey/SfRef/SfIntentRef/SfOperationRef/SfVersion/SurfaceId` como types diretamente de `@orchestra/schema/sucafina/context` (export públicos F01 encontrados em `sf-ux-w02`). Não precisa alterar `context/contracts.ts` para reexportar aliases. S03 importa `SfOperationId` somente de `@orchestra/schema/sucafina/common` quando a F02 real estiver presente. Nenhum stub é aceito.

## 5) Qualificação

120: após compor F01/F02/F03/S03/I00 no candidato mesmo C, selecionar `packages/app-shell/test-browser/sucafina-native/s03.test.ts` e consumidores transitivos, dedup de execução. 119: `bun typecheck` de app-shell e guards do candidato, Actions autorizado. W08 **não executou** testes ou typecheck; nenhum PASS presumido. Após isso, 114 confirma consumo dos seis blobs e publica consumer ACK com material tree e preimages efetivas.
