# Operations E2E — handoff de 14/11/2026

## Estado

**IMPLEMENTED_WITH_BLOCKED_DEPENDENCIES.** O spec obrigatório está publicado e a seleção nominal foi validada em Actions na configuração de produção real. Os cinco corpos de teste funcional permanecem **NOT_RUN**. A confirmação material C06 permanece **BLOCKED_DEPENDENCY**, sem teste substituto ou skip.

- Branch/PR preservadas: `astra-wp04`, [PR23](https://github.com/gustavomhss/Orchestra-SF/pull/23).
- Head inicial reconciliado: `91e1f60bc6f7e85517e2b4f963eec5ac7da13e62`.
- Código final W: [`70255998e3310652c4b7fce33f498e592be0bda9`](https://github.com/gustavomhss/Orchestra-SF/commit/70255998e3310652c4b7fce33f498e592be0bda9).
- Tree de W: `642e3662e01526823fe29652d05cd2e6d5a1f7e0`.
- Commit inicial de implementação: `9b3edf3651f309ce9693d8593ac3c691e03ec1e4`; W corrige somente os vínculos de critérios da primeira jornada.
- Este diretório é o recibo posterior a W. Sua adição não muda produto, testes, configuração ou fixtures. O head documental e o compare W→head ficam vinculados na descrição da PR.
- Sem merge, epic/full suite, mudança de produto/config/fixtures compartilhadas ou aprovação de C.

## Implementação

[operations.spec.ts](https://github.com/gustavomhss/Orchestra-SF/blob/70255998e3310652c4b7fce33f498e592be0bda9/packages/app-shell/e2e/sucafina/operations.spec.ts) contém cinco casos. Todos os helpers estão em `packages/app-shell/e2e/sucafina/operations-support/`.

| Caso | Assertions escritas | Execução funcional |
|---|---|---|
| OP-PROC-01 | Oracle J04 A/B/C literal; EUR 28000 → USD 30240 na projeção real; C excluída; ranking e premium; UUID/digest/versão C02 e drilldown do mesmo pedido | NOT_RUN |
| OP-PROC-02 | Pedido próprio submetido; sourcing pendente mantém 30240/1,08 após Settings EUR=2, enquanto a PO futura mostra 56000/2; CAS do pedido intacto; C02 e reload coerentes; restauração do FX pelo domínio | NOT_RUN |
| OP-PROC-03 | JPY sem taxa permanece Unavailable; submit 422 identifica exatamente o campo; quoteId/supplier/seleção, resumo, histórico e CAS persistem sem transição | NOT_RUN |
| OP-IMPORT-01 | XLSX real; preview preserva export/CAS; 72000→84000 e linha 518000 intacta; um Apply real, perda somente da entrega da resposta, recuperação do mesmo recibo por GET/Refresh/reload; nenhuma duplicação; logout revoga leitura | NOT_RUN |
| OP-DOC-01 | Supplier e upload próprios; bytes/digest/schema/segmento UTF-16 exatos; candidato 42 USD exige confirmação; identidade da referência persiste; exclusão da mesma fonte recusa asset 403/evidence 409 e limpa o card confirmado | NOT_RUN |

As assertions usam os entrypoints reais e o host existente, com matrículas únicas por cenário e IDs aleatórios para os registros de autoria do teste. O fixture inicia seu próprio SQLite isolado; os helpers não criam servidor, HTML de reprodução ou resposta sintética. O único route hook envia Apply ao produto real uma vez, captura sua resposta real e aborta somente a entrega. Não há fórmula financeira paralela, sleep, retry de mutação ou aumento de timeout.

O [mapa de cobertura](coverage.json) conserva os textos literais e a fatia efetiva de cada critério. Não há critério declarado concluído por uma execução ausente. O catálogo lido contém 111 critérios WP04, 140 WP06 e 50 de campanha; este spec não afirma cobertura integral dessa coleção.

## Provas executadas em Actions

| Prova | Resultado e identidade |
|---|---|
| Seleção final | [Run 43633572790](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43633572790), job 132565369277: **1 teste auxiliar PASS, 0 fail, 46 expectations; 5 casos Playwright listados, 0 executados**. S=`3e931409a87e88f73e6a631edfc45466d76b6656`; apenas `.ci-run.json` difere de W. |
| Configuração/validação | As funções reais `locateTestPackage`, `validateRequest`, `playwrightArgs` e `validateSelection` aceitaram `operations.spec.ts`. Config `e2e/playwright.production.config.ts`, bundle production, canal prod, Chromium, workers=1, retries=0, repeatEach=1. |
| Controle de processo | Omni positive control **pass**; 1 spawn, 0 delegated. O helper `selection.check.ts` fica fora do glob Playwright e roda como arquivo Bun explícito pelo workflow existente. |
| Checks no mesmo W | [Run 43633785874](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43633785874), job 132566019029: geração oficial de contratos/check/diff, `bun typecheck` de **modules/sucafina** e guards aprovados. |
| Guards | 78 regras, 654 paths contra a base da branch, **0 gate, 11 warn, 0 errors**. Todos os 11 avisos apontam paths herdados e intactos neste delta. `origin/dev` registrado=`a1d37698a7bb097c1578f827eba6a19b9917ef07`; merge-base=`9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`. |
| Typecheck de Operations | **NOT_RUN**: os projetos TypeScript atuais não incluem `e2e/sucafina/**`. O typecheck Sucafina e a transpilation/listagem Playwright não substituem essa prova. |

A primeira listagem, [run 43633311440](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43633311440), também passou no predecessor. Seu recibo foi preservado em [selection-a1.json](selection-a1.json); a validação final está em [selection-a2.json](selection-a2.json).

O runner Bun não aciona o upload de artefatos Playwright. A evidência completa e compacta da seleção está no log real do job e transcrita no recibo. O workflow de checks preservou [astra-wp04-checks](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43633785874/artifacts/14128498847), digest SHA256 `2e2766d07b69acc7190e261792216e3de8d2e7aa750093aa4fef4fa4e4459a14`. Os metadados e logs foram inspecionados; o ZIP não foi baixado.

## Dependências de integração

[dependencies.json](dependencies.json) registra owners, commits, blobs e ação necessária.

1. **Montagem pela seleção:** `wp04BrowserSelected` só inicia o host para o antigo `wp04/procurement.spec.ts`. `operations.spec.ts` não produz o manifesto privado do host. S0/owner da fixture deve corrigir essa montagem sem acrescentar outro spec ao request.
2. **Produto na base da PR23:** faltam as workbenches de importação/documentos e a apresentação monetária atual que os testes exercitam. As interfaces foram lidas no PR34 `15df31a67efab0aae6e2bff2b7eb8e5e59511324`, sem importá-las artificialmente para a branch.
3. **Composição do host:** o host atual recebe somente ProcurementModule/C02; não monta Planner nem o HTTP/serviços reais de importação/documentos, seus grants, assets e parser. S0/WP10 precisa compor essa cadeia e manter o isolamento/auth existentes.
4. **C06 material:** há código de factory do adaptador, mas o host inspecionado não o monta e a UI não oferece seleção/confirmação material Procurement. O produtor precisa emitir o escopo e a incarnation reais antes de prepare/confirm/project. [c06-dependency.json](c06-dependency.json) contém a prova e as assertions futuras. UUID C02 e confirmação de resposta de conversa não suprem esse contrato.
5. **TypeScript:** o owner precisa incluir o grafo Operations no projeto E2E e executar o check hospedado correspondente. Esta missão não altera tsconfig/workflows.

A watchlist de integração mantém separados o delta de exportações PR57, a recuperação de admissão PR58 e a intenção/Apply C12 PR60. PR34 não contém esses três deltas integralmente. Eles não são descritos como causas observadas de falha dos cinco casos não executados; tampouco seus greens são reaproveitados aqui. Preserve o runtime monetário e o caller WP14 já corrigidos em PR34 ao compor o candidato.

## Limites e próxima ação

A recuperação implementada é **leitura após um Apply**, sem segundo POST e sem reinício do host. Não qualifica replay idempotente de POST nem admissão interrompida entre blob e catálogo. O documento é texto UTF-8; não qualifica PDF, DOCX, OCR, busca lexical, troca de revisão ou dossiê WP09. Os casos não cobrem a matriz completa de papéis, formatos, cancelamento, conflitos, rollback e opções de importação. O [mapa](coverage.json) detalha esses limites por critério.

**Consumidor: S0 / integração.** Reconciliar os deltas de produto, delegar os paths compartilhados aos owners, expor C06 real e habilitar o grafo TypeScript. Depois, requalificar um único candidato e executar a seleção nominal de [nominal-ci-request.json](nominal-ci-request.json), pelo protocolo MCP de CI.md, uma vez e sem ampliar para epic/full. A prova auxiliar de listagem já existe; os efeitos funcionais e a jornada C06 ainda precisam de execução/implementação contra a montagem oferecida.

Provas native/AM, tempo humano de 30 segundos, aprovação de C e GLOBAL_RELEASE permanecem **NOT_RUN / não concedidos**.

