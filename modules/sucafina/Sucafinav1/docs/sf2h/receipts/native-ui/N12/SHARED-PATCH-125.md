# N12 — patch de integração compartilhada para a 125

**Status:** PROPOSTO / INERTE. Não aplicado em arquivos compartilhados. Entregar somente após fencing e integração dos produtores reais. Autor exclusivo da integração: **125**.

**Escopo:** U02 (CAP01 + CAP03), U38 (CAP02 + UI54). Branch autora: `sf-ux-n12`; destino `sf2-stack`. Todos os arquivos próprios já são conteúdo de produto, sem backend alternativo ou novo dispatcher.

## Patch 1 — dictionary `packages/app-shell/src/i18n/orchestra.ts`

**Preimage remoto verificado em `sf2-stack` antes deste handoff:** blob `91e526cd53e2c020f36efacb60ecad250a4da11b`. O HEAD final pode ter mudado: a 125 DEVE conferir novo blob e recompor sobre o próprio HEAD, sem aplicar cegamente se diferente.

```diff
@@ após o import de "./orchestra-chapters/sf-s05":
+import { SF_U02_COPY, SF_U02_COPY_BR } from "./orchestra-chapters/sf-u02"
+import { SF_U38_COPY, SF_U38_COPY_BR } from "./orchestra-chapters/sf-u38"
@@ no registro EN junto às demais chaves SF:
+  ...SF_U02_COPY,
+  ...SF_U38_COPY,
@@ no registro PT-BR junto às demais chaves SF:
+  ...SF_U02_COPY_BR,
+  ...SF_U38_COPY_BR,
```

Os quatro exports existem em:
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u02.ts` (82 chaves iguais EN/BR);
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u38.ts` (72 chaves iguais EN/BR).

O dictionary é de responsabilidade exclusiva da 125: verificar ausência de duplicatas/colisões, tipo do registro e cobertura de chaves antes de integrar. Não adicionar armazenamento próprio de traduções.

## Patch 2 — registro fechado de rotas I00

**Preimage:** não existe implementação I00 compartilhada no HEAD de origem N12; contrato imutável vem de `surface-manifest.json` e `route-signatures.ts`. Evitar escolher/criar outro dispatcher.

Adicionar aos casos do dispatcher existente, *somente* após F01 resolver o `SfResolvedRoute`, autenticar owner e liberar capability:

| Surface | Route(s) congelada(s) | Export tipado de produto |
| --- | --- | --- |
| CAP01 | `/orchestra/sf-dashboard/executive` | `SfDashboardExecutiveView` de `./dashboard/executive` |
| CAP03 | `/orchestra/sf-dashboard/budget` | `SfDashboardBudgetView` de `./dashboard/budget` |
| CAP02 | `/orchestra/sf-dashboard/hot-topics`, `/new`, `/:topicRef`, `/:topicRef/edit` | `SfHotTopicsView` de `./dashboard/hot-topics` |
| UI54 | `/orchestra/sf-dashboard/hot-topics/proposals/:proposalRef` | `SfHotTopicProposalView` de `./dashboard/hot-topics/proposals` |

Imports propostos, conforme o local final que a 125 escolher para I00:

```ts
import { SfDashboardExecutiveView } from "./dashboard/executive"
import { SfDashboardBudgetView } from "./dashboard/budget"
import { SfHotTopicsView } from "./dashboard/hot-topics"
import { SfHotTopicProposalView } from "./dashboard/hot-topics/proposals"
```

Renderizar via `SfSurfaceProps<"CAP01" | "CAP03" | "CAP02" | "UI54">` especializado em cada `case` e **nunca** por um registro genérico que esqueça a discriminação de `surfaceId`. O F01 valida ref original, query e owner. Não gerar parâmetros pela UI, não trocar a seleção do usuário, não inventar fallback. CAP02 usa o codec público `encodeSfRouteRef` de F01 para construir links internos após seleção de owner; I00 continua sendo o único resolvedor de autorização.

## Patch 3 — dependências/fencing/CI

- F01 entrega `SfSurfaceProps`, `useSfContext()`, geração, drafts e codec de ref.
- F02/F03 entregam transporte, `SfPageFrame`, `SfStatePanel`, cópia congelada.
- A01 entrega `createSfDomainClient`: CAP01, CAP03 e operações C12 `dashboard.dashboard-*`.
- A10 entrega `createSfPeopleClient` CAP02.
- S03/S05 entregam revisão de comandos, drafts, apresentação e tabelas.
- A13 é consumidor indireto do contexto colaborativo dos casos UI54; não substituir seu produtor.
- 125 deve verificar que cada dependência exportada foi incorporada no mesmo candidato C, sem reproduzir código de outra autoria.
- CI **120**, somente depois de `INTEGRATED`, executa jornadas `u02.spec.ts`, `u38.spec.ts` com fixture realmente autorizada; compiler **119** executa `bun typecheck` em `packages/app-shell`. Nenhuma execução local por N12.
- A integração/permissão não é aprovada por este patch. Não mergear em `dev`, não publicar/deployar nem retomar Goal.

## Prova pré-/pós-imagem

- Os produtos N12 tinham preimage `ABSENT` no HEAD `526e7204b310756e552196bbf3d64037dbbf047c`.
- O arquivo `orchestra.ts` permanece **inalterado pela N12**; pós-imagem compartilhada proposta está representada pelo diff acima e deve ser criada/verificada exclusivamente pela 125.
- O recibo `HANDOFF.json` registra os blobs de cada produto/ESPEC e todos os estados de aceite sem alegar PASS.
