# Handoff — finish-protocol-20261119

SHA de código: 156996ba64fe25c9ae83e166bbecbc861d0d4c3f
Base: sf-join-four @ 8eb6c37106e12ac9e79644872e70c717df3db875
Data: 2026-11-19
Estado: complete

## Feito

- Integração isolada de24arquivos de contratos/clientes/testes, extraídos da composição qualificada. Nenhuma implementação financeira, instalação ou capítulo UI é incorporado por este ramo.
- Envelopes fechados de Planner/Procurement/Decisions/Reviews e os adaptadores de superfície literal verificados no produtor original. Mantidos todos os métodos, discriminadores, limites e campos do catálogo congelado; extensões posteriores são explícitas.
- Edição original de caso e leitura/preservação de reviews são operações literais. UI54 lê draft e resultado original por POST privado; leitura de resultado usa a chave original com os fences atuais, sem repetir efeito.
- F02 permite somente retry humano explícito do mesmo corpo/chave/digest/stamp retido para as operações qualificadas. Sem retry automático; revalidação do owner e recibo original continuam obrigatórios.
- Listas exatas dos contratos unitários foram ampliadas pelos IDs originais; o teste do catálogo inclui as duas leituras UI54 e mantém o blob305 original31dbec1726fd8147156b01dc545726650ffd49e1 inalterado.

## Pendente

- Nenhum item pendente neste escopo de contratos qualificados. O estado complete não qualifica as jornadas nativas de todos os WPs.
- packages/app-shell/e2e/sucafina/wp04/native-create.spec.ts:1 — gate44612655999 ainda em andamento no momento deste handoff, para identificar rejeição do input da UI antes do POST. O probe literal e contratos aprovados não substituem essa jornada.
- packages/app-shell/e2e/sucafina/reports.spec.ts:27 — preparação multidomínio/UI48 ainda unbound; checkpoint9b066 colhe o resultado real sem relaxar F02.
- packages/app-shell/e2e/sucafina/dashboard-installed/proposals.spec.ts:1 — gate44612824007 em andamento; não há claim de sucesso instalado UI54/CAP02.
- WPs completos, pacote, guards e único sf-ci final permanecem sob o handoff final da integração.

## Decisões e justificativas

- Asserções removidas: nenhuma. Os manifests continuam comparados por igualdade exata. A lista não usa prefixos nem aceita IDs arbitrários.
- Não houve edição de runtime/application.ts, grants/policy, catálogo305, baseline/coverage/digest ou bytes Office. reviews.export.docx/pptx permanecem Schema.Never; downloads são GET real.
- A composição usa os mesmos blobs de código que já passaram os gates abaixo; somente o teste metadata mais recente acrescenta dois IDs reais e foi executado em44612205026. Não se atribui aos testes unitários prova de comportamento nativo.
- As variantes diagnósticas CAP25/CAP27 do ramo finish-retry posteriores a f576 não são incorporadas aqui; este commit não contém logs adicionais de input.

## Como retomar

1. Integrar finish-protocol-20261119 no sf-join-four preservando este conjunto de24arquivos.
2. Continuar os WPs nativos com a composição26 fa6d8a86b3695301cba6fd7d539ad1d2d429ee9b, que usa estes contratos.
3. Registrar gates instalados e integrar só as folhas qualificadas; depois guards, pacote final e um sf-ci.

## Comandos e resultados

- test-ci44604361124 SUCCESS,19pass/380expect, snapshot9a541ff36821c6952aa2f5b7d0a26fef260f3ccd: dashboard-draft-read + human-retry. https://github.com/gustavomhss/Orchestra-SF/actions/runs/44604361124
- test-ci44594420036 SUCCESS,24pass/400expect: adaptadores originais de colaboração. https://github.com/gustavomhss/Orchestra-SF/actions/runs/44594420036
- test-ci44596513565 SUCCESS,5pass/162expect: rotas Decisions originais. https://github.com/gustavomhss/Orchestra-SF/actions/runs/44596513565
- test-ci44601578214 SUCCESS,17pass/339expect: política explícita C12/owner/corpo/chave. https://github.com/gustavomhss/Orchestra-SF/actions/runs/44601578214
- test-ci44594099624 SUCCESS,24pass/197expect: listas exatas/schema Decisions e Reviews. https://github.com/gustavomhss/Orchestra-SF/actions/runs/44594099624
- test-ci44612205026 SUCCESS,2pass/2277expect; snapshot3778d6b93e7b2b416f925f63125b68e01e0a468f; test135871472932 e cleanup135872761066SUCCESS. Catálogo congelado + extensões literais e política de mutação. https://github.com/gustavomhss/Orchestra-SF/actions/runs/44612205026
- bun run typecheck CLI/app/SF E2E: passaram em44606780612 com estes contratos; esse run teve1pass/4fail no navegador e não é sucesso do WP5. https://github.com/gustavomhss/Orchestra-SF/actions/runs/44606780612
- bun run check:guards --base origin/dev: não executado nesta integração de contratos; reservado ao fechamento.
- Sem shell/local, sem novo sf-ci.
