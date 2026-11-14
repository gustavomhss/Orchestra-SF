# C05: recuperação de reunião preservada após mudança material

## Resultado e escopo

**Finding de integração confirmado por leitura estática do produtor publicado; cenário de contraprova proposto, ainda não executado.** Não é um resultado de teste FAIL nem um gate global. O consumidor de captura histórica de registro tem um caminho distinto e não fecha este finding da reunião inteira.

- Repositório: `gustavomhss/Orchestra-SF`.
- Produtor: PR32 `astra-compose`, commit `ff7a99753d1fd1bc8b68b4f2642fed26e3cadbdf`.
- Cópias imutáveis obtidas pelo GitHub MCP em `analysis/compose-ff7-c05`; os seis blobs foram recalculados localmente e coincidem com os SHAs GitHub. O índice contém também SHA256.
- Ownership: host/composição e produtor C05/WP07. Nenhum desses arquivos foi alterado por esta revisão.
- Consumidor relevante: Dashboard `dashboard-workbench`, seletor de histórico de reuniões e retratos.
- Novo teste WP01 `meeting-number.test.ts` cobre estabilidade da pauta financeira e recuperação de **capture de registro**, não `PreservedReview` após alteração material.

## Contrato imutável

Fonte `dbf9547211d9b0fade619790de7c19c0869b7c7d`, `docs/sf2h-plan/contracts.json`, contrato C05:

> Seleção, seções, conteúdo preservado, competência, contagens e captura imutável autorizada de comentários C06 com referência/versão; conversa corrente é separada. Revisão anterior preservada.

Prova exigida:

> Origem alterada não muda a revisão; acesso revalidado na recuperação/export.

WP01.T03.CHK.03 exige também: “Refresh de dados não substitui formulário sujo nem muda o número estável de reunião.” A estabilidade visual da pauta não prova, sozinha, a recuperação de uma reunião persistida após mudança da origem.

## Caminho completo no commit publicado

| Arquivo / blob | Caminho observado | Efeito |
|---|---|---|
| `apps/cli/src/sucafina-product/dashboard-http.ts` / `c6c24f4a66315c75dd8b0903ddd70c89b9b9e19c` | Linha59: `dashboard-review` chama `runtime.dashboard.readReview`; linha 60: `dashboard-history` chama `runtime.dashboard.reopen` | São dois endpoints/produtores distintos. |
| `apps/cli/src/sucafina-product/dashboard-services.ts` / `0891d178833165fff098e3c05f3a64c5f5b35043` | Linha234: `readReview: reviews.read.bind(reviews)`; linhas 55–61: `revalidateSources`; linha 95: `authorizeSections` usa esse callback; linha 98: `revalidate` também usa esse callback | A leitura histórica de reunião não passa por reissue antes da validação das fontes antigas. |
| Mesmo host | Linhas273–279: `dashboardSourceCurrent` exige `entry.version === ref.version`, identidade de escopo e digest corrente | Uma mudança material da projeção torna a fonte preservada incompatível com o validador de fonte corrente. |
| `modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts` / `65867a3e6aa9b5b85266bb637fb22cf1c6c6d539` | `synchronizeScopes` incrementa a versão quando a projeção/digest muda, mantendo a encarnação física contínua | Mesmo ator, mesmo acesso e mesmo registro legítimo podem receber uma versão maior sem perda de autorização. |
| `modules/sucafina/Sucafinav1/product/reviews/port.ts` / `1b93fd89a1f544808455c15d12f9c06cc18e21f3` | `read`, linhas 124–153: carrega o corpo imutável; chama `authorizeSections` logo após validar a forma; em seguida `revalidate` e `revalidateEvidence`; falha retorna `denied/access-unavailable` | A leitura rejeita o corpo preservado antes de chegar ao retorno; não há transformação/reissue histórico intermediário. |
| Mesmo ReviewPort | `reopenReviewReceipt` chama `read` e verifica a identidade/digest do recibo | O recibo imutável novo protege replay; não elimina a dependência da leitura histórica no validador de fonte corrente. |
| `modules/sucafina/Sucafinav1/product/dashboard/historical-bindings.ts` / `01ab380bd9a2b0b4c8db0d62984492e12598c034` | `reopen`, linhas 47–65, verifica recibo protegido e chama `prepareHistoricalReissue` na linha 56; explicitamente rejeita `dashboard-page` | A recuperação autorizada de capture de registro funciona por outro caminho e não recebe o objeto `PreservedReview`. |
| `modules/sucafina/Sucafinav1/product/dashboard/confirmation.ts` / `fefdb4b7814be4953e1a5e7f12e2385e0a6a03c4` | `prepareHistoricalReissue` reemite sob acesso atual, verifica continuidade, competência e fence sob transação final | Existe primitiva relevante, mas ela não é chamada no caminho `readReview`. O observer em si admite fontes de página; a restrição `dashboard-page` citada acima pertence ao capture binding. |

Há ainda efeito na descoberta: o host só adiciona a reunião em `historyOptions` quando `reviews.read(id, context)` retorna `ok` (linhas 192–197). Uma reunião legítima pode desaparecer do seletor após atualização da origem, sem explicação de perda de acesso porque a autorização não necessariamente mudou.

## Evidência antiga que não fecha a lacuna

`host-workbench.test.ts` preserva uma reunião e um retrato, altera o Hot Topic e seleciona o primeiro histórico. A resposta observada nesse trecho é `sf=dashboard-history`; as assertions “Original action” e ausência de “Current revised action” são de um capture. O teste não chama `dashboard-review` após mudança material.

`historical-reissue.test.ts` valida a primitiva `prepareHistoricalReissue`, com registros reais do store, mas não atravessa a composição `reviews.read` do host. `historical-bindings.test.ts` valida a recuperação de capture. Esses componentes são úteis e preservados; não se deve transferir seu verde para a reunião inteira.

## Contraprova mínima proposta para Actions do owner

A contraprova abaixo pode usar a fixture HTTP real `test/product/wp02/workbench-recovery-fixture.ts`, já publicada pelo grupo em 903, como dependência de reprodução após composição com o host do owner. O cenário não foi adicionado ao produto nem executado localmente; a falha descrita continua sendo uma inferência rastreável do caminho completo.

1. Autorizar o operador real e montar uma pauta `Budget Overview` de2026 com valor1300; preservar a reunião pelo HTTP real.
2. Recuperar por `dashboard-review`, identificando o mesmo reviewId e conteúdo1300.
3. Alterar o orçamento anual do mesmo registro de1200 para2400 pelo comando canônico `/dashboard?page=OPEX+Detail&year=2026`, versão0; verificar versão1 e origem contínua.
4. Com o mesmo operador ainda autorizado, recuperar o mesmo reviewId: deve retornar `ok` com corpo/valor1300 e competência originais. Nova pauta corrente deve retornar2400. **Inferência do código atual:** o passo4 devolve `denied/access-unavailable` devido ao callback descrito, sem passar por reissue histórico.
5. Regressões necessárias no patch do owner: revogação nega sem conteúdo, exclusão/recriação do mesmo id não autentica a origem antiga, e replay de preservação não duplica o objeto nem altera o corpo histórico.

## Correção recomendada ao owner

Separar autorização de leitura histórica da exigência de frescor usada para preservar/aplicar uma nova revisão. A leitura deve obter prova atual de acesso e continuidade da identidade física de cada fonte protegida, preservando integralmente os valores, competência, contagens, comentários capturados e digests do corpo original. A prova precisa manter os fences finais sob a mesma transação, sem transformar um novo registro de mesmo id na origem histórica.

Não remover o comparador de versão globalmente: preview/preservação novos continuam exigindo origem corrente. Não reescrever a revisão preservada com `SourceRef` ou valores atuais para obter aprovação do validador. A reautorização atual deve ser uma prova separada sobre o corpo imutável autorizado.

## Classificação para o mapa

- Pauta estável e capture histórico: componente implementado; prova nova `meeting-number.test.ts` aguardando Actions no novo head.
- Reunião `PreservedReview` após mudança material: **lacuna real de integração/host C05**, não “prova nativa pendente” e não “consumer UI ausente”.
- Revalidação de acesso histórico: manter gate; nunca declarar este finding resolvido apenas por aceitar qualquer versão antiga.
