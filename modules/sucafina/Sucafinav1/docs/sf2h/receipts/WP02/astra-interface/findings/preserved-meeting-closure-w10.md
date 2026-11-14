# C05 — reunião preservada: produtor publicado e composição Dashboard pendente

## Resultado e fronteira

Atualização de 2026-11-14 ao finding histórico `preserved-meeting-history.md` / `analysis/c05-preserved-review-ff7-finding.md`. O documento anterior permanece como recibo da leitura no pin ff7; esta atualização não reescreve sua evidência.

**Há um produtor genérico publicado para recuperar o conteúdo original de uma reunião após edição ordinária da fonte, sob o mesmo escopo autorizado. A rota `dashboard-review` e a descoberta do Dashboard ainda usam outra composição, que exige a versão corrente exata.** Consumir apenas o histórico de registros do BusinessContext ou C12 não liga esse produtor à reunião preservada.

O cenário positivo HTTP do grupo foi executado no W8c e falhou com 403. A compatibilidade proposta com os helpers novos é uma inferência estática; não foi executada, compilada ou validada por esta revisão. Nenhum arquivo de produto, host, contrato ou teste C05 foi alterado. Não houve consulta de CI, dispatch, teste de produto, typecheck ou guard local por este agente.

- Repositório: `gustavomhss/Orchestra-SF`.
- Ownership da adaptação: integração `astra-compose`, composição privada de `business-services.ts` e `dashboard-services.ts`.
- Consumidor do grupo: Dashboard/workbench, preservação e recuperação de reunião, descoberta de históricos; contraprova em `test/product/wp01/meeting-number.test.ts`.
- Estado: falha positiva real na composição W8; leitor genérico publicado; montagem Dashboard pendente. Não declarar C05 ou o critério completo DONE.

## Requisitos e evidência executada

Fonte normativa imutável: [`docs/sf2h-plan/contracts.json` no pin dbf9547211d9b0fade619790de7c19c0869b7c7d](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json).

C05 exige seleção, seções, conteúdo preservado, competência, contagens e captura imutável autorizada de comentários C06 com referência/versão; conversa corrente permanece separada. A mudança da origem não pode mudar a revisão preservada, e o acesso deve ser revalidado na recuperação/exportação. WP01.T03.CHK.03 também exige que refresh não substitua formulário sujo nem mude o número estável da reunião. Estabilidade visual, histórico de registro e leitura da reunião persistida são provas distintas.

O recibo existente `analysis/product-43585747922.receipt.json`, produzido pelo agente de CI, registra:

| Campo | Valor exato |
|---|---|
| Run / job | [43585747922](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43585747922) / `132419730244` |
| Produto | `770ca62aa97f66deb70126a32d9819ddf7f32833` |
| Tree do produto | `de52a224e9468ce70ed442d5b6ccefe03cd6cfc1` |
| Snapshot de CI | `21ab870301a54b08fe9b2fb0f7adf46a3ce22238` |
| Tree do snapshot | `792590b89ed6a88421fb749027af210821094c3b` |
| Request SHA256 | `68b6155e363bd3971f17a3954e210af251ad462cc9025a469cf88cb4f2b96767` |
| Request blob | `8d838d3d0191c1073390404fceb0230c40a8f885` |
| Teste | `C05 reopens the same preserved financial meeting after a canonical budget change with its original authorized content` |
| Observação | Original `1300`; corrente `2400`; mesma encarnação da fonte; esperado HTTP200; recebido HTTP403, `denied/access-unavailable` |
| Assertion | `meeting-number.test.ts:233`, log decodificado linhas1224–1247 |
| Log SHA256 | `c3c9b9f75c6a1666ce99950482c6ed88ce6a3ee07143f28f62d8e3bbe9059e32` |

Os resultados pertencem ao produto W8 indicado, não aos heads de produtores reconciliados abaixo. O 403 desse caso não é uma contraprova negativa aceita: é a falha do comportamento positivo exigido. As demais falhas de bootstrap do mesmo run não impedem atribuir esta observação, cujo corpo executou e registrou os valores.

## Heads e blobs reconciliados por GitHub MCP

- PR32: head observado `a1e9eb62aa7fa862322622cc38474ef0ff5a7d09`, branch `astra-compose`.
- Reconciliação adicional de PR32: `35b9fd4f532abeb1058f00281d4ad8885ca9966f`. Leitura MCP dos seis arquivos `dashboard-services.ts`, `review-history.ts`, `review-calculation-history.ts`, `review-read-integrity.ts`, `review-services.ts` e `host-context.ts` confirmou os mesmos blobs da tabela. O avanço não liga o leitor histórico à rota Dashboard. A análise principal mantém o pin a1e9 para distinguir esta constatação das outras mudanças do head novo.
- PR33: pin solicitado `ea5a6f965c803d436202934872c3650ab8f8eb19`; head corrente observado `2784daafbb0d3b58b6019822288a07fa38e5c5b0`, branch `astra-collaboration`.
- O `reviews/port.ts` de PR33 é byte idêntico nos dois pins consultados. Ele não implementa a política de autorização da composição Dashboard; recebe os callbacks do host.

Todos os caminhos abaixo são relativos ao repositório. Os caminhos `product/...` e `test/...` na coluna resumida têm prefixo `modules/sucafina/Sucafinav1/`.

| Caminho | Pin | Blob |
|---|---|---|
| `apps/cli/src/sucafina-product/dashboard-http.ts` | PR32 a1e9 | `c6c24f4a66315c75dd8b0903ddd70c89b9b9e19c` |
| `apps/cli/src/sucafina-product/dashboard-services.ts` | PR32 a1e9 | `0891d178833165fff098e3c05f3a64c5f5b35043` |
| `apps/cli/src/sucafina-product/business-services.ts` | PR32 a1e9 | `4b96a408bd43e73a6e614977f959b6f58f9559e0` |
| `apps/cli/src/sucafina-product/host-context.ts` | PR32 a1e9 | `0d3abcf642deb3d2f6c6346cdddc8bfb40141532` |
| `apps/cli/src/sucafina-product/review-services.ts` | PR32 a1e9 | `e795aa2e8667a0da134a00ce6012fe1f7f1dc712` |
| `apps/cli/src/sucafina-product/review-history.ts` | PR32 a1e9 | `0c9a68225d114ba77617af4a0e3acc2607ea0e5a` |
| `apps/cli/src/sucafina-product/review-calculation-history.ts` | PR32 a1e9 | `012c83ed8b6382bebc0046526985f2f900f04035` |
| `apps/cli/src/sucafina-product/review-read-integrity.ts` | PR32 a1e9 | `2bd1fbd753e38f38ef58e4d71f364972ac22703e` |
| `product/integration/source-lifecycle.ts` | PR32 a1e9 | `65867a3e6aa9b5b85266bb637fb22cf1c6c6d539` |
| `product/reviews/port.ts` | PR32 a1e9 | `1b93fd89a1f544808455c15d12f9c06cc18e21f3` |
| `product/reviews/port.ts` | PR33 ea5 e 2784 | `62db836fd93e349f19d007e1933396420a3540ff` |
| `product/dashboard/historical-bindings.ts` | PR32 a1e9 | `01ab380bd9a2b0b4c8db0d62984492e12598c034` |
| `product/host-binding/business-context.ts` | PR32 a1e9 | `5f9a4761693beaf2fc0830d03ea8a2421de7f794` |
| `product/decision-memory/source-access.ts` | PR32 a1e9 | `41741c5131ea66242c881126c22c6d03cfd9c3c3` |
| `test/product/wp10/integration/review-history-composition.test.ts` | PR32 a1e9 | `1a68cba2878268f21a3f052bf802e965f55c2d91` |

## Cadeia causal da rota Dashboard

1. `dashboard-http.ts:59` encaminha GET `?sf=dashboard-review&id=...` a `runtime.dashboard.readReview(id, context)`. `dashboard-history`, na linha60, chama outro produtor, `runtime.dashboard.reopen`.
2. `business-services.ts:123–127` constrói a instância de Dashboard e `createSfDashboardServices`. `host-context.ts:296` fornece essa instância diretamente a `createSfDashboardHttp`.
3. `dashboard-services.ts:90–98` constrói seu próprio `createReviewPort`. O callback `authorizeSections` chama `revalidateSources`, e `revalidate` usa o mesmo callback.
4. `revalidateSources` exige `dashboardSourceCurrent` sob `transactionAll`. Essa função compara a versão corrente exata, identidade de escopo, autoridade, campos, competência e digest de projeção.
5. `resolveEvidence`, linhas46–53, compara o digest da evidência preservada com a evidência corrente emitida por `sources.resolveDashboardSource` ou `records.resolve`. Não chama o BusinessContext histórico.
6. O `ReviewPort.read` de a1e9 carrega o corpo imutável e pode retornar `denied/access-unavailable` no primeiro `authorizeSections`, antes de entregar esse corpo. Mesmo removendo só essa primeira exigência, os gates seguintes de `revalidate` e `revalidateEvidence` ainda negariam a versão antiga.
7. A descoberta também só lista uma reunião se `reviews.read(id, context)` retornar `ok`; portanto, trocar apenas o método público `readReview` deixa um segundo consumidor incompatível.

Uma mudança material incrementa a versão do escopo sem alterar sua encarnação quando a origem física é contínua. O gate de versão exata explica estaticamente o 403 observado, sem inferir revogação de acesso. Esta é uma cadeia causal específica, não uma alegação de que todo403 desse endpoint tenha a mesma causa.

## O leitor genérico que já existe

`createSfReviewServices` compõe `createSfReviewHistory` e usa `currentSource || historicalSource` ao autorizar suas fontes. A evidência das seções passa pelo resolvedor histórico. `protectSfReviewReads` protege a instância de leitura.

### Autorização e continuidade

`review-history.ts:21–51` resolve a encarnação original por `resolveScopedSource`; confere principal, revisão de acesso, política, tipo/id, papel, capacidade de escrita, digest do mapa de papéis, atribuições/domínios Dashboard, campos e competência. A versão atual pode ser maior ou igual à original, mas a encarnação resolvida deve ser a mesma.

Essa igualdade de encarnação não é inferida do ID textual. `source-lifecycle.ts:58–83` reabre o escopo autorizado e confere sua encarnação após resolver a fonte física atual. A sincronização de fontes e escopos, linhas148–192, troca a encarnação quando a fonte física é substituída. Uma exclusão/recriação não herda a identidade original apenas por repetir o ID.

### Corpo e recibo original

`review-history.ts:53–77` obtém as reuniões por C08 e exige recibo do namespace `reviews`, target de criação correto e digest do corpo. Reconhece recibos compactos `sf-review-receipt-v1` e recibos legados com a reunião inteira; não exige migrar ou sobrescrever recibos antigos. Repete a leitura do corpo e a resolução autorizada da fonte.

`review-history.ts:79–118` pode retornar `historical` com a projeção originalmente preservada numa seção. Exige referência exata contida no corpo protegido e prova das folhas de evidência; não troca os valores do corpo antigo pelos valores atuais. Cálculos passam adicionalmente por `review-calculation-history.ts`.

`review-read-integrity.ts` confere digest da reunião e recibo C08 antes e depois de uma segunda leitura autorizada. Deve permanecer aplicada à instância usada por consumidores públicos e descoberta.

### Limites que permanecem

- O helper exige que principal, `accessRevision` e política correspondam ao escopo capturado. O caso 1300→2400 mantém esse acesso; uma reautorização com novo grant ou outro principal não está provada por esse caminho.
- A captura histórica está vinculada ao principal do recibo/projeção. Não declarar leitura compartilhada entre autores apenas por existir um leitor atual autorizado.
- O teste publicado `review-history-composition.test.ts` declara edição ordinária de um registro OPEX, leitura/exportação do original, comparação, revogação, adulteração e exclusão/recriação. Sua implementação foi lida, mas seus runs não foram consultados nesta revisão.
- Esse teste não é o cenário de página `Budget Overview`, valor agregado 1300, endpoint `dashboard-review`, descoberta do workbench ou browser do grupo. Não transferir seu eventual verde.
- A montagem Dashboard atual admite comentários vazios. Resolver o positivo aqui não entrega, por si só, todos os comentários C06, exportações, capacidades nativas ou gates do contrato C05 completo.

## Distinção entre os três históricos

| Caminho | Original protegido | Validador/consumidor | Fecha esta falha de WholeReview? |
|---|---|---|---|
| `dashboard-history` | `sf-dashboard-historical-capture-v1` em preferences | `createDashboardHistoricalBindings`, C06 `prepareHistoricalReissue` | Não. Opera registro capturado e rejeita `dashboard-page`. |
| BusinessContext / C12 | Captura protegida de memória/Atlas ou produtor C12 | `createSfRecordHistory`, `dashboardEvidence.resolveEvidence` e provas de continuidade | Não por intake isolado. Não é a ligação usada pelo `ReviewPort` Dashboard, nem lê automaticamente a reunião em `state.reviews`. |
| Revisão genérica | Reunião imutável em `state.reviews` e recibo C08 | `createSfReviewHistory` + `protectSfReviewReads` | É a primitiva candidata; falta ligá-la à rota e à descoberta Dashboard. |

Em `business-context.ts:287–293`, os originais de `createSfRecordHistory` vêm de `caseForEvidence` e `memory.readOriginalCapture`. O fallback C12 é separado. A presença desse código novo não modifica os callbacks atuais de `dashboard-services.ts`.

## Proposta mínima para o owner astra-compose

Proposta de alteração privada, não patch aplicado nem autorização para alterar fontes estrangeiras nesta sessão.

### Inputs publicados a consumir

Os três helpers de a1e9 abaixo formam a menor closure de arquivos novos identificada para o caso Dashboard de evidência `record`:

1. `apps/cli/src/sucafina-product/review-history.ts` — blob `0c9a68225d114ba77617af4a0e3acc2607ea0e5a`.
2. `apps/cli/src/sucafina-product/review-calculation-history.ts` — blob `012c83ed8b6382bebc0046526985f2f900f04035`; import runtime obrigatório do helper, mesmo que este teste use somente `record`.
3. `apps/cli/src/sucafina-product/review-read-integrity.ts` — blob `2bd1fbd753e38f38ef58e4d71f364972ac22703e`.

Eles reutilizam autoridade C08, lifecycle e contratos canônicos já existentes. Não é necessário consumir toda a montagem genérica de BI/Portfolio/Review para o cenário isolado. A compatibilidade de tipos da closure final ainda requer o static gate de Actions do owner.

### Dois pontos de montagem a alterar pelo owner

**`business-services.ts`:** passar o `BusinessContextService` real para `createSfDashboardServices`. Na versão a1e9, Dashboard é construído na linha127 e o delegador `context` somente nas linhas147–153. A montagem deve respeitar essa ordem, movendo a criação para depois do delegador ou usando um getter privado resolvido no momento da leitura. Não criar um resolvedor permissivo, devolver `fresh` artificial ou ler dados por fora da autoridade.

**`dashboard-services.ts`:** compor `createSfReviewHistory({ authority, persistence: scopedSources, evidence: context })` para as leituras. Usar os produtores reais `currentSource` e `historicalSource` na autorização/revalidação das referências das seções; resolver evidências pelo `historical.evidence.resolve`, exigindo referência exata, revisão de acesso atual e estado autorizado `fresh` ou `historical`. Não substituir os valores ou SourceRefs do corpo preservado pelos valores atuais.

Aplicar `protectSfReviewReads` à instância antes de criar `readReview: reviews.read.bind(reviews)`. A descoberta deve chamar a mesma leitura protegida; alterar somente o método exposto deixa a reunião ausente no seletor.

**Preservar os gates de gravação atuais.** `select` continua reconstruindo a pauta atual autorizada. O wrapper de `reviewState.transaction`, linhas79–88, continua exigindo `dashboardSourceCurrent` das fontes da reunião alterada dentro da transação de gravação. Não remover globalmente a igualdade de versão: ela é necessária na preservação de uma nova revisão, mesmo que a leitura de uma revisão antiga aceite evolução legítima da fonte.

O leitor histórico pode autorizar uma fonte antiga porque ela está ancorada em uma revisão anterior. Isso não deve permitir que uma nova preservação grave seleção antiga: a seleção atual e o fence de escrita são obrigatórios. Recibos, objetos preservados e histórico C08 não são migrados ou regravados por essa adaptação.

Não identifiquei mudança necessária de `Protocol`, `Server HttpApi` ou `ReviewPort` para fechar este positivo específico; a proposta preserva `dashboard-review`, seu payload fechado e a autorização HTTP de saída. Mudanças adicionais em contrato exigiriam reavaliar essa conclusão.

## Contraprova e aceitação cirúrgica após publicação

Reutilizar o segundo teste existente de `meeting-number.test.ts`; não trocar a expectativa por denied, não mockar o leitor, não reemitir o corpo como conteúdo atual e não selecionar apenas o teste de capture.

1. Operador real, store, lifecycle, C08 e HTTP Dashboard reais.
2. Preservar a pauta de 2026 com total 1300; leitura inicial 200 do mesmo objeto, competência, contagem e versão 1.
3. Alterar o orçamento por comando canônico de 1200 para 2400; verificar versão 1 do registro e pauta corrente 2400.
4. Demonstrar mesma encarnação da fonte com versão maior.
5. Reabrir o mesmo reviewId por `dashboard-review`: HTTP200, `status: ok` e igualdade integral com o corpo originalmente capturado.
6. Descoberta autorizada volta a listar a mesma reunião preservada.
7. Manter contraprovas reais de revogação, adulteração e substituição física; histórico autorizado não pode reabrir fonte nova só porque o ID textual coincide.
8. Executar somente a seleção cirúrgica pertinente em GitHub Actions, no SHA publicado que contém a adaptação e com recibo exato. Typecheck usa `bun typecheck` no package, guards conforme AGENTS. Nenhum teste local ou epic do grupo.

O sucesso dessa seleção provará esse consumidor e essa composição. Não substitui prova nativa, outros critérios de C05, validação de exportação não exercitada, integração final ou epic de S0.

## Próxima ação e classificação no mapa

O owner `astra-compose` deve publicar a adaptação dos dois pontos de montagem, com os três helpers identificados ou uma composição equivalente dos mesmos produtores reais. O grupo consome os blobs publicados e conserva a contraprova positiva existente.

- **Componente publicado:** mecanismo genérico de história preservada com C08 e continuidade.
- **Falha real observada:** recuperação positiva de WholeReview pelo Dashboard W8c retorna 403 após mudança legítima de valor.
- **Integração pendente:** ligar os callbacks e a proteção do leitor histórico à instância Dashboard, incluindo discovery.
- **Não é lacuna de apresentação UI:** o endpoint e seu consumidor já existem; uma alteração de copy ou de assertion não fecha o caminho.
- **Não é apenas prova nativa pendente:** há um cenário HTTP real quebrado, a ser corrigido e executado antes de qualquer alegação de conclusão.
