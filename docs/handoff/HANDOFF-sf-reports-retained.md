# HANDOFF — sf-reports-retained

## SHA e estado

- Branch: `sf-reports-retained`.
- Base recebida do integrador: `d5bd89238af3485b3327be3657b744abee7a30e2` (Reports observed).
- SHA de código deste recorte: `18e995771879cb67c144c87b61e7d17c6df9e917`.
- Tree de código: `883c21da44a9480d7e26cc65d3b670ccc25afb0c`.
- Estado: **PARTIAL — correção de retenção implementada e revisada; nenhuma execução Actions deste novo código; UI50 ainda unbound**.
- O commit documental é descendente direto do SHA de código acima. Nenhum PR, merge, dispatch ou rerun foi realizado neste recorte.

## Causa coberta

O run [44660375065](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660375065), attempt 1, snapshot `4cdba6118ff547d9ed23cd5cdb284e55e218d675` sobre `4ccf99576e6886b178c5502fc02bfa41bef6730c`, terminou com 0/4 cenários. O job de teste foi `136036842660`; o cleanup `136041216392` terminou success.

RPT-02 falhou ao recuperar o corpo original do preview em `review-flow.ts:140:38`; RPT-03/RPT-04 falharam na descoberta em `review-flow.ts:40:37`. A mensagem foi `Protocol error (Network.getResponseBody): No data found for resource with given identifier`. Chamar `.json()` assim que o evento Response chega ainda usa a recuperação posterior do corpo de Chromium: a implementação oficial espera a conclusão da resposta antes de chamar Network.getResponseBody. O log não prova se a perda original foi descarte do recurso ou cancelamento; este recorte não atribui uma causa produtiva não observada.

## Implementação

1. Novo `packages/app-shell/e2e/sucafina/reports-support/retained-response.ts`: uma sessão CDP limitada à ação e aos endpoints esperados habilita Fetch no estágio Response antes do clique/navegação.
2. Lê `Fetch.getResponseBody` enquanto a resposta original está pausada; somente depois usa `Fetch.continueResponse({ requestId })`. Não informa status, headers ou body novos. Não usa fulfill, refetch, replay, mocks, retry de clique ou escrita por API.
3. Pareia os bytes com o Response real aguardado pelo Playwright, conferindo método, URL inteira (incluindo query), payload original completo e status. Exige exatamente um Request, um Response, uma pausa e uma identidade Network por alvo. Rejeita ambiguidade, redirects, responseErrorReason, requestfailed, Network.loadingFailed, fechamento de página/sessão e ausência de identidade.
4. Confere o retorno de `response.finished()`, `request.failure()` e o evento Network antes de aceitar os bytes. A ação é invocada uma vez por `Promise.resolve().then(action)`, incluindo observação de erro síncrono. Cleanup aguarda as leituras em andamento antes de desabilitar Fetch e destacar a sessão.
5. Os métodos de metadados delegam ao Response original; JSON e binário usam somente os bytes retidos desse mesmo pedido. Mensagens novas são estáticas e não imprimem corpo, headers, cookies ou credenciais.

Os **18 waits de review-flow.ts** passam pelo mesmo mecanismo, em 15 grupos:

| Ação original | Respostas retidas |
| --- | ---: |
| Descoberta de seção autorizada | 1 |
| Preservação inicial | 1 |
| Preview de agenda, também reutilizado após remover um registro | 1 |
| Disponibilidade da revisão sucessora | 1 |
| Preview da revisão sucessora | 1 |
| Preservação da sucessora | 1 |
| Abertura da revisão preservada | 1 |
| Leitura inicial CAP04 | 1 |
| Aplicar forecast uma vez e reler CAP04 | 2 |
| Reload CAP04 | 1 |
| Criar relatório e receber GET review-download original | 2 |
| Abrir reunião | 1 |
| Reabrir reunião por reload | 1 |
| Reler revisão e resolver a origem autorizada | 2 |
| Abrir CAP03 atual pela origem autorizada | 1 |

`readSourceData` e `readReview` continuam leituras reais por APIRequestContext, que não usa o armazenamento de corpos de Chromium. Os demais helpers e `reports.spec.ts` não foram modificados.

## Contratos preservados e revisão

- Comparação textual do arquivo confirmou **232 linhas contendo expect(** antes/depois, com o mesmo multiset literal após remover apenas indentação. Nenhuma asserção, valor, identidade, versão, CAS ou verificação de conteúdo foi removida ou afrouxada.
- Preservadas as verificações 25/24 projetos, período, forecast 110/190 e valores agregados do corpus, imutabilidade da revisão anterior, payloads exatos e contagem de uma mutação.
- DOCX/PPTX continuam bytes do GET `?sf=review-download` original, com status, MIME, attachment, URL/artifactRef, hash de referência e inspeção OOXML/comentários existentes. `reviews.export.docx/pptx` continuam Schema.Never.
- Não foram alterados produto, host, instalação, portas, timeout/retries, assertions, workflow, seleção, suites.json, baseline, coverage ou digest.
- Revisões estáticas do integrador e do agente Reports confirmaram originalidade/pareamento e preservação das 232 linhas. Incorporados os dois ajustes de lifecycle pedidos: erro síncrono da ação observado e retorno de response.finished conferido.
- Somente leitura de fonte e readback por GitHub foram usados. **Não há resultado de teste verde deste SHA**.

Fontes oficiais verificadas na tag Playwright `v1.59.1`:

- [Protocol Fetch](https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright-core/types/protocol.d.ts): tipos `Fetch.getResponseBody`, `Fetch.continueResponse` e `Fetch.requestPaused`; blob `91b88b2107cd6a4f1fd5bbb379480a3fe7a99b23`. O comando continueResponse está tipado em CDPSession.send.
- [Tipos públicos](https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright-core/types/types.d.ts): `Response.finished(): Promise<null|Error>`; blob `2fbe9ef02a9c7411f94aea147f1dab9c031ffef1`.
- [Servidor de respostas](https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright-core/src/server/network.ts) e [Chromium network manager](https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright-core/src/server/chromium/crNetworkManager.ts): leitura antiga adiada até conclusão, seguida de Network.getResponseBody.

## Aberto / unbound

RPT-01 avançou pelos checks de preview/preservação e edição real do forecast, mas não montou UI50. Ponto original: `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:415:24`; neste recorte, a mesma asserção está em **`review-flow.ts:377`**.

O seletor UI50, form.report-form, labels e encodeReviewRef foram encontrados na UI original. O elemento UI50 é criado pelo componente antes do painel de conteúdo; sua ausência não demonstra erro do seletor de formulário. A admissão da rota exige `dashboard.dashboard-review`, `reviews.report.prepare` e `files.export.review`. Não existe ainda observação runtime que distinga o bloqueio no F01/owner/provider. O ECONNREFUSED próximo do teardown não é prova da causa. **Nenhum seletor, navegação ou produtor foi alterado para encobrir essa falha**; a triagem do artefato original segue com o integrador.

A execução integral de Reports, seus oracles C05 e a entrada UI50 continuam pendentes. Este handoff não qualifica a branch inteira como complete.

## CI, baseline e pacote

- Gate novo: **não disparado**; nenhum gate idêntico repetido.
- sf-ci: **não disparado neste recorte**; o integrador mantém uma única execução final após os merges.
- Artefato/baseline deste recorte: **nenhum produzido**. PENDING_REAL_COMPLETE_RUN permanece intacto.
- Pacote final e sha256: **pendentes do SHA congelado do integrador**; não há GO, deploy ou SF_ORCHESTRA_WEB_PACKAGE_VERIFIED.

## Como retomar

1. Ler os dois arquivos de código no SHA acima e este handoff; concluir a revisão independente e a classificação da falha UI50 usando apenas evidência real.
2. Incorporar eventual fix causal de UI50 em snapshot composto, preservando o recorte original e as asserções. Não alegar correção de admissão somente pela retenção de bytes.
3. O integrador deve coordenar o gate existente de CI-UI-REPORTS, em ci-run-* sem [skip ci] no snapshot, após fixes concretos, respeitando até dois gates simultâneos e uma execução por causa corrigida. A verificação de tipos deve usar os comandos existentes via Actions.
4. Registrar run/source/attempt/resultados e primeiro file:line real. Promover o handoff a complete somente com a qualificação correspondente; então integrar na ordem autorizada. Não mover a branch do pacote antes do freeze final.
