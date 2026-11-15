# W15/A02 → 114 / I00 — patch de integração compartilhada e2

**Este arquivo é material de handoff, NÃO uma escrita nos shared paths.** O único compositor e registrador autorizado é a 114. Na branch e2 W15 ainda faltam F01/F02 e seus contratos; não fabricar stubs.

## 1. Schema I00: 39 codecs materiais, sem fallback

Em `packages/schema/src/sucafina/index.ts`, importar `SfPlanner` de `./planner` e inserir os 39 bindings no mapa `SfNativeOperationBindings` admitido. O helper `strictCodec` pode ser o helper genérico e privado **já definido por I00**, desde que ambos os lados usem `Schema.decodeUnknownEither(schema,{onExcessProperty:"error"})`, preservem `SfWireDecodeResult` e nunca substituam decoder ausente por `Schema.Unknown`, `Schema.Any` ou JSON sem codec. Exemplo completo das chaves a colar em objeto literal (nenhum laço no runtime):

```ts
import { SfPlanner } from "./planner"
// Dentro do SfNativeOperationBindings da 114:
  "domain.page.CAP17": strictCodec(SfPlanner.operations["domain.page.CAP17"]),
  "domain.command.CAP17.import-workbook": strictCodec(SfPlanner.operations["domain.command.CAP17.import-workbook"]),
  "domain.page.CAP18": strictCodec(SfPlanner.operations["domain.page.CAP18"]),
  "domain.command.CAP18.save": strictCodec(SfPlanner.operations["domain.command.CAP18.save"]),
  "domain.command.CAP18.delete": strictCodec(SfPlanner.operations["domain.command.CAP18.delete"]),
  "domain.command.CAP18.spread": strictCodec(SfPlanner.operations["domain.command.CAP18.spread"]),
  "domain.command.CAP18.reset": strictCodec(SfPlanner.operations["domain.command.CAP18.reset"]),
  "domain.command.CAP18.import-workbook": strictCodec(SfPlanner.operations["domain.command.CAP18.import-workbook"]),
  "domain.page.CAP19": strictCodec(SfPlanner.operations["domain.page.CAP19"]),
  "domain.command.CAP19.save": strictCodec(SfPlanner.operations["domain.command.CAP19.save"]),
  "domain.command.CAP19.delete": strictCodec(SfPlanner.operations["domain.command.CAP19.delete"]),
  "domain.command.CAP19.spread": strictCodec(SfPlanner.operations["domain.command.CAP19.spread"]),
  "domain.command.CAP19.reset": strictCodec(SfPlanner.operations["domain.command.CAP19.reset"]),
  "domain.command.CAP19.import-workbook": strictCodec(SfPlanner.operations["domain.command.CAP19.import-workbook"]),
  "domain.page.CAP20": strictCodec(SfPlanner.operations["domain.page.CAP20"]),
  "domain.command.CAP20.save": strictCodec(SfPlanner.operations["domain.command.CAP20.save"]),
  "domain.command.CAP20.delete": strictCodec(SfPlanner.operations["domain.command.CAP20.delete"]),
  "domain.command.CAP20.sync": strictCodec(SfPlanner.operations["domain.command.CAP20.sync"]),
  "domain.command.CAP20.import-workbook": strictCodec(SfPlanner.operations["domain.command.CAP20.import-workbook"]),
  "domain.page.CAP21": strictCodec(SfPlanner.operations["domain.page.CAP21"]),
  "domain.command.CAP21.save": strictCodec(SfPlanner.operations["domain.command.CAP21.save"]),
  "domain.command.CAP21.delete": strictCodec(SfPlanner.operations["domain.command.CAP21.delete"]),
  "domain.command.CAP21.common": strictCodec(SfPlanner.operations["domain.command.CAP21.common"]),
  "domain.command.CAP21.import-workbook": strictCodec(SfPlanner.operations["domain.command.CAP21.import-workbook"]),
  "domain.page.CAP22": strictCodec(SfPlanner.operations["domain.page.CAP22"]),
  "domain.command.CAP22.save": strictCodec(SfPlanner.operations["domain.command.CAP22.save"]),
  "domain.command.CAP22.delete": strictCodec(SfPlanner.operations["domain.command.CAP22.delete"]),
  "domain.command.CAP22.import-workbook": strictCodec(SfPlanner.operations["domain.command.CAP22.import-workbook"]),
  "domain.page.CAP23": strictCodec(SfPlanner.operations["domain.page.CAP23"]),
  "domain.command.CAP23.save": strictCodec(SfPlanner.operations["domain.command.CAP23.save"]),
  "domain.command.CAP23.copy": strictCodec(SfPlanner.operations["domain.command.CAP23.copy"]),
  "domain.command.CAP23.official": strictCodec(SfPlanner.operations["domain.command.CAP23.official"]),
  "domain.command.CAP23.lock": strictCodec(SfPlanner.operations["domain.command.CAP23.lock"]),
  "domain.command.CAP23.unlock": strictCodec(SfPlanner.operations["domain.command.CAP23.unlock"]),
  "domain.command.CAP23.delete": strictCodec(SfPlanner.operations["domain.command.CAP23.delete"]),
  "domain.command.CAP23.import-workbook": strictCodec(SfPlanner.operations["domain.command.CAP23.import-workbook"]),
  "planner.monthly.preview": strictCodec(SfPlanner.operations["planner.monthly.preview"]),
  "planner.monthly.apply": strictCodec(SfPlanner.operations["planner.monthly.apply"]),
  "planner.forecast.prepare": strictCodec(SfPlanner.operations["planner.forecast.prepare"]),
```

Cada `strictCodec(operation)` decodifica `operation.input` e `operation.output` reais; em erro retorna `{status:"invalid"}`, em sucesso retorna `{status:"ok",value:decoded}`, sem reconstrução, reautorização ou downgrade. Todas as 39 chaves precisam existir exatamente uma vez e permanecer sob o registry de admissão I00 (não exportar um registry paralelo do leaf).

## 2. Package export maps explícitos (114)

Em `packages/schema/package.json` incluir `"./sucafina/planner": "./src/sucafina/planner.ts"`; em `packages/client/package.json` incluir `"./sucafina/planner": "./src/sucafina/planner.ts"`. Não adicionar wildcard nem gerar SDK manualmente. Se houver export aggregation em `packages/client/src/sucafina/index.ts`, reexportar `createSfPlannerClient` e o helper mensal em `./planner/monthly` sem importar SSR/CLI pelo browser.

## 3. Router privado e instalação original (114/F02)

```ts
import { createSfPlannerProjectionHandlers } from "./planner"
// Dentro da composição existente, não num novo listener:
const handlers = [
  // handlers F01/F02 e os demais Axx já admitidos,
  ...createSfPlannerProjectionHandlers(deps),
]
mountSfNativeProjections({ mount: deps.mount, context, handlers })
```

`deps` é a única `SfNativeHostDependencies` privada da CLI, com `origin`, `mount`, `application`, `runtime`, `readContext` reais. `readContext` deve autorizar a Request GET de página recebida, e não um contexto fake com principal passado pelo renderer. Reusar exatamente a Request na autenticação e reler o stamp após snapshot. Manter roteamento das páginas `CAP17`–`CAP23` para `{mount}/api/ui/pages/CAPxx`.

No F02, `domain.command.CAPxx.action` continua em `POST {mount}/planner?page=<page-original>`, com `{page,action,id?,version,values,confirmed?}` exato. **Não** apontar commands para o novo handler de GET nem duplicar `domain.execute`. Para `planner.monthly.preview/apply` usar `POST {mount}/planner?sf=workbench-planner` e `{action,input:{page,versionId,drafts}}` sem `input.operation` ou `input.entity`. `planner.forecast.prepare` é a rota existente `POST {mount}/{surface}?sf=workbench-forecast`, surface resolvida por contexto autorizado, corpo `{baseRef,candidateRef,period,currency,caseRef}`, sem query/URL escolhida pelo cliente.

Preservar origem, limites e `Idempotency-Key`, `X-SF-Native-Owner` como **expectation**, com verificação de ator/contexto dentro da transação canônica; jamais tratá-lo como credencial. Divergência/401/403/409/422/503 seguem suas classes próprias e o transporte não pode repetir apply após estado desconhecido.

## 4. Dependências / gates

- I00 só publica `SfPlanner` após F01/F02 instalados e codec validado, mantém mapa estático de 305 operações e recusa ausência como `contract-unavailable`.
- **119** compiler/guards, sem testes locais da W15. **120** Actions cirúrgicos e probes de autenticação e isolamento hospedados. Nenhuma evidência local de fixture aprova P03/desktop.
- **P03=HOLD**; PR #116 continua draft, `GLOBAL_RELEASE=false`. Só 114 integra/shared.
