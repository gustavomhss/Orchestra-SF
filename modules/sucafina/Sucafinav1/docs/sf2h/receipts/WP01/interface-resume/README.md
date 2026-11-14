# Interface resume — WP01 / WP02

## Estado para revisão de S0

Entrega na [PR #43](https://github.com/gustavomhss/Orchestra-SF/pull/43), `interface-resume → sf2-stack`, originada da [PR #31](https://github.com/gustavomhss/Orchestra-SF/pull/31). Os três gaps próprios corrigidos nesta retomada têm prova browser no produto W2: ACK do Dashboard, propagação da revogação para o shell inteiro e estado acessível do editor ao fechar com Escape. O resultado cirúrgico é **31 PASS / 1 FAIL**, 548 assertions, 32 testes em oito arquivos. A falha restante é o consumidor original C12 após resposta perdida e reload.

**Não é uma declaração de DONE.** F04, C05, C12, os demais limites de produtor/composição e a qualificação nativa/global continuam explícitos. A PR permanece em draft para S0; nenhuma PR anterior foi fechada e não houve merge.

Verificação estática final: **pendente de anexar o check do commit documental**. O primeiro check teve 14 diagnósticos estrangeiros e três próprios nas novas assertions. As três chamadas foram corrigidas com argumentos de tipo `unknown`, mantendo os mesmos operandos e comparações; o resultado antigo continua FAIL.

## Identidade e cadeia de publicação

| Parcela | Commit | Tree |
|---|---|---|
| Input publicado / origem #31 | `9d65ea8fcd8ce6ea1249dc669e0fcc248b540241` | `cbf56c2c58b4a7a3cb89b7b2de3a18953ae6e7b0` |
| W1 — ACK e revogação | `b1a477cd2346be755e10caec2941b1ba11171430` | `0d2010e9f5fe5dff4d902f8b305a4b082bce245d` |
| W2 — Escape e tipos das assertions | `ad94fd2d78be47cecfb91f801ce7764127667b60` | `2677e5209f65a1b5dd26f50803ca98a760e6e40f` |
| S1 — snapshot de W1 | `60bdbe5b1d9978d1880c48319064ab889335ee0c` | `496e56b432a247ba63ed5310a2e8cf6fc22bd879` |
| S2 — snapshot de W2 | `519571ec1c90454b8a1eacf94f156dcc9c296f9f` | `bddad5d5a9ce9c99b2834c62d593c015681c488d` |

Os compares remotos W1→S1 e W2→S2 mostram **somente `.ci-run.json`**. Cada snapshot tem o respectivo W como pai. Request SHA256 S1: `8dee1fc4ba04461b4420239da72c04c2a2bd8fac8d238c4d21d1857f16ed5a7d`; S2: `0e5a6ed717643836a6100376db735f69ee09780837b5355a9a3fb2afd5086cd8`.

O commit que contém este handoff acrescenta documentação ao W2. Seu SHA/tree e a relação exata com os checks estão na PR e em `verification.json`; os SHAs de produto/testes não são confundidos com os envelopes de CI.

## Deltas próprios

### ACKs e tentativa congelada

`product/interface/dashboard-workbench.ts` passa a validar os retornos antes de limpar mutation, dirty guard ou correlação:

- Capture exige o identificador canônico do retrato.
- Review exige identidade, versão, data e as seções pedidas, na ordem preservada pelo produtor.
- Draft exige a referência canônica e a próxima versão esperada.
- Prepare exige o mesmo caso/incarnation, escolha e próxima versão, além do identificador da alteração.
- Apply exige o formato completo de `CommandReceipt` e a união real de resultado.

Uma resposta vazia, incompleta ou incompatível mantém a tentativa inconclusiva, os campos bloqueados e o mesmo corpo/chave para retry. A chave HTTP e a chave de domínio do recibo têm funções diferentes: o browser não inventa uma igualdade entre elas. A autoridade continua responsável pelo vínculo semântico do recibo ao comando.

Os seis novos consumidores usam operador, HTTP, C08, SQLite e produtores reais. `route.fetch()` executa a transação original; os negativos corrompem apenas o ACK entregue depois do commit. Capture, review, draft e prepare comprovam rejeição, retry idêntico e unicidade no estado real. Apply tem um negativo de recibo incompleto depois do commit e um positivo separado que recebe o ACK integral, sem resposta sintética de replay. Nenhum desses casos substitui C12 reload.

### Revogação e resposta tardia

`product/ui/shell-state.ts` agora consome `sf-access-revoked` emitido por componentes. Fecha imediatamente a admissão, invalida generation, aborta a leitura e limpa HTML/foco pendentes. A remoção do body e de `history.state` acontece em microtask, depois de os listeners síncronos limparem controles conectados e estado privado. Isso preserva consumidores que usam `isConnected` durante a purga.

As assertions antigas de My work e Dashboard recovery continuam verificando o nó original por `ElementHandle`, mesmo depois de destacado. Foram adicionadas as condições de página global indisponível, ausência de controles e histórico nulo. As transações, versões/incarnations, sequência 503/logout/403, body/key, retorno autorizado e rejeição de resposta tardia permanecem exigidos.

### Fechamento acessível do editor

W1 revelou dois FAIL no teste existente de teclado: em 768/1440 px, o dialog já estava oculto, mas o opener ainda anunciava `aria-expanded=true` até o evento `close` enfileirado. W2 sincroniza o atributo no cancelamento admitido. A guarda de comando pendente continua primeiro; recusar descarte continua impedindo o fechamento antes de qualquer alteração no atributo. O listener de close, o foco e o handler do botão de fechar foram preservados.

Os testes de 320/768/1440 px mantêm as assertions originais e agora também exigem `aria-expanded=true` enquanto o dialog está aberto. Os três passaram em W2. O consumidor real de edição mensal confirmou conflito, preservação do draft, comparação dos três valores e navegação de volta ao registro.

## Runs e limites de evidência

| Run / job | Produto | Resultado |
|---|---|---|
| [43615877759](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43615877759) / `132510708217` | W1 / S1 | 28 PASS, 3 FAIL, 498 assertions; dois FAIL de Escape e C12 |
| [43616465145](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43616465145) / `132512490370` | W2 / S2 | **31 PASS, 1 FAIL**, 548 assertions; somente C12 |
| [43615878780](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43615878780) / `132510711501` | W1 | Typecheck FAIL: 14 ocorrências estrangeiras + 3 próprias; guards PASS |
| [43605201442](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43605201442) / `132478265438` | Composição W17 `9048e0e…` | BI: 5 PASS, 0 FAIL, 114 assertions; prova externa |
| [43595658990](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43595658990) / `132449464415` | WP10 `d357de0…` | Dois PASS C05 nomeados; agregado **FAIL**, 105 PASS / 17 FAIL / 1 error |

O segundo run ocorreu depois da correção material do editor; acrescentou apenas o consumidor real de edição Dashboard aos sete arquivos anteriores. Não foi repetição do mesmo produto. A busca de equivalência não encontrou run dos candidatos/requests antes dos disparos. Nenhum teste de produto foi executado localmente, nenhum epic foi disparado e só houve um run de produto em voo por vez.

Omni: W1 **6 declarações / 6 spawns / 0 delegated**; W2 **7 / 7 / 0**, ambos PASS. Cleanup dos snapshots: jobs `132511784304` e `132513497267`, ambos success. Os relatórios físicos detalhados estão em [evidence.json](evidence.json), com Node/Chromium, contexts, bridge, EOF, WS, socket e diretório. Harness, deadlines, leases e assertions físicas permanecem intactos.

Há um limite explícito no consumidor C12 que falha: seu `close()` executa no `finally`, valida o fechamento e registra saída Node 0, mas `report()` após o bloco não é alcançado. Portanto não é contado um relatório físico JSON completo adicional desse caso. A evidência de fechamento por log/fluxo da fonte e a ausência do relatório serializado são registradas separadamente; cleanup não transforma a jornada falha em PASS.

## Mapa integral dos critérios e consumidores

- [Mapa legível dos 153 critérios](criteria/index.md).
- [WP01: 75 critérios](criteria/WP01.json).
- [WP02: 78 critérios](criteria/WP02.json).
- [Catálogo da retomada, observações nomeadas e checks](evidence.json).
- [Findings e pendências por owner](owner-findings.json).
- [Reconciliação de pins e avanços das origens](reconciliation.json).
- [Verificação de integridade](verification.json).

Cada registro conserva ID/texto, aponta para seu original por JSON pointer/SHA256 e resolve testes, consumidores e runs históricos no catálogo publicado imutável. Os arquivos anteriores não foram reescritos. **16 critérios WP01 e 25 WP02 recebem contribuição parcial nova**; os demais conservam o alcance das observações anteriores. Isso não converte critérios inteiros em PASS. Todos os 153 continuam sem declaração de DONE.

Edição/rebase com dois atores, threads, saved views, agenda financeira e captures já tinham provas componentes na #31. A revisão de impacto não encontrou outra assertion de painel conectado a migrar: case edit e views usam purga local nesses cenários; a fixture real de threads não monta o shell global. Seus resultados continuam nos SHAs registrados. Não foram trocados por mocks ou por uma alegação genérica de equivalência com W2.

## Pendências por owner

| Assunto | Owner / ação necessária |
|---|---|
| F04 — retirar somente escrita sem perder draft legível | WP10/composição e provider da origem: publicar reautorização segura da origem, preservando identidade física. O positivo de retenção existente não foi alterado para aceitar purga. |
| C05 — WholeReview financeiro original | WP10/composição/Review: compor os quatro helpers publicados com mount compatível e executar o positivo original 1300→2400. Os dois PASS externos não substituem esse consumidor. |
| C12 — apply com resposta perdida e reload | WP10/composição/C12: fechar discovery e recibo histórico no host consumido. A falha original permanece executada em W2. |
| Primeiro save perdido antes de receber draftRef | Composição: lookup autorizado da intenção. A UI não recupera por título/posição nem persiste texto privado em history. |
| Hot Topic CREATE / incarnation | Provider de source lifecycle e produtor: bind atômico da incarnation física na correlação. Sem segundo write ou identidade inferida. |
| Draft replay depois de avanço do caso | Produtor de drafts/composição: a ordenação da autorização de versão antes da consulta de recibo continua finding estático; não é confundida com o FAIL runtime C12. |
| G03 — primeira recusa CAS conhecida | Colaboração/composição: o input retido ainda mapeia `product-state-changed` para 503. A origem avançou para `20821df310ebc6ea08ccab27e829008d72a04de6` e publicou a correção do mapeamento e um teste SQLite real. Compor esse delta e provar o ramo UI de revisão com 409; nenhum PASS novo é inferido. |
| Tipos compartilhados | WP10/composição: união de resultado em host-context; Colaboração/WP07: callers ReviewHost retidos. Correções publicadas em outra origem requerem composição e evidência, não substituição silenciosa. |
| BI | Composição/WP10: reanexado W17 com seus cinco PASS. O shell novo difere transitivamente; revalidar a composição ao consumir este delta. |
| Documentos/importação | Operações mantém `import-http.ts`, `document-http.ts` e serviços. Nenhum desses paths foi escrito nesta retomada. |
| Aceite global | S0/WP10/WP12/native owners: cinco perfis, 18 skills, inferência real/output persistido após reload, AM01–AM06, C/G7, D/G8 e oito seleções finais/epic integrado. |

### Proposta mínima C05 ao owner

[Patch C05](patches/c05-owner-mount.patch) e [metadados](patches/c05-owner-mount.json): um hunk, uma linha removida/adicionada, move a montagem Dashboard para depois de `context` e passa `evidence: context`. Preimage BCS `b289a4a376f937c2cf4b56a00a6c1247152c5798`; postimage **proposto, não aplicado** `95d4cec147d4ee8969884797905805348991bab5`. SHA256 do patch: `39a3f18267702582bd6af3bc673d7950990f029c89fb69b3e10c49c28ea6a33c`.

Ele depende dos quatro blobs exatos publicados por WP10, listados nos metadados. A assinatura antiga não aceita o argumento isoladamente. O owner deve adaptar a proposta ao seu BCS atual, preservando os deltas próprios; nenhum snapshot completo foi copiado e nenhuma fonte de host/contrato/IA foi escrita aqui.

## Reconciliação e preservação

A origem #31 permaneceu no input. #25/#21 continuam representadas pela história e pelos recibos consolidados da entrega anterior. O plano imutável, os packs completos, handoff consolidado, auditoria independente e resultados da #31 orientaram o recorte; não houve nova descoberta ampla do produto.

As leituras de WP10/composição e das lanes registram pins anteriores e avanços separadamente. O avanço WP10 W24→W25 não mudou os helpers C05 ou BCS. Colaboração primeiro alterou schedule/fixtures; na leitura final de 16:40:45 UTC, avançou para `20821df…` com a correção CAS e outros produtores de colaboração/review. O root leu o hunk exato e o teste novo: blob do produtor `cd9a67887f41986243809672572c972440c832ec`, teste `f19984edc18de56e1f97a60f538a25983cd9e367`. Sua execução e o consumo pelo browser Interface não foram presumidos. Finance avançou para `88b9b6bff53a4f64d37d04ddc868f1443cecf5b3`, com deltas de case/portfolio/history e seus testes. Nada foi sobrescrito ou incorporado fora do ownership desta branch.

As branches anteriores, os testes positivos pendentes, os controles de autorização e todos os artefatos históricos foram preservados. Não houve force push, reset/clean destrutivo, exclusão de worktree, deploy, alterações de engines/Azure/identidade/políticas financeiras ou reinício de desktop/server.
