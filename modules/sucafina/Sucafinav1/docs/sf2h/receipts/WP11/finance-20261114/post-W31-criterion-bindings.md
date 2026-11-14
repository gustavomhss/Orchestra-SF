# Adendo delimitado de critérios após W31

**Seis vínculos novos, cinco critérios literais, dois testes. Sem aceite integral.** A observação estática cobre os blobs candidatos de W32 que reconciliam a PR40 `dc9d4327d07db58d026e7672cf619717394f5ffd`, observada em 2026-11-14 às 12:47:36 UTC. A base Finance é W31 `c449efc092e507fca2b4f61d1e7ce057faf05c89`, tree `82ea6bff11f9647d14cac30587ccd2feb80c6950`. W32 foi publicado em `79531aefa2bf72a9d13deba5164f725ec7da0e0f`, tree `485a3ac2ac1322d03d7421a17eb1791153f11c1b`. O parent registra os snapshots e resultados afetados no [ledger de produto](product-tests.json).

Os textos abaixo foram copiados literalmente dos packs de WP03/WP11 no handoff `a3d29d011ba3607a57914701300f09117a3e2de9`, que preserva o plano imutável `dbf9547211d9b0fade619790de7c19c0869b7c7d`. O SHA256 de campaign.json é `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. Os 303 critérios e as 14 tarefas não são reescritos. O [mapa W21](task-delivery-map.md), suas obrigações e o [adendo anterior](post-W21-criterion-bindings.md) permanecem intactos.

## Arquivos observados

| Teste | Blob | Alcance autorado |
| --- | --- | --- |
| `current-choice-read-fence.test.ts` | `46b004a1b374229ad46077930134ba0469213087` | Duas variantes: retirada de participação e revogação da leitura de preferências durante a última autorização. |
| `renewal-source-admission.test.ts` | `4a5780b82989b9e8c3437bb3758779d7cfb76733` | Sete casos, incluindo source-CAS, revogação final e nove variantes de escopo. |

As contagens são de casos declarados no código, não de casos executados. Leitura positiva com escrita de preferências negada, corrida realmente aplicada e ausência de chamadas aos produtores são controles do primeiro teste. O segundo conserva as assertions de fonte realmente alterada e do orçamento positivo de duas resoluções, duas autenticações e três revalidações.

## Vínculos discriminantes

### WP11.POSTW31.01 — WP11.DOD.01

**Texto literal:** Caso e escolhas sobrevivem a reinício e são compartilhados conforme autorização.

**Propriedade exercitada:** A leitura do binding persistido exige participação e acesso atual de leitura ao namespace privado, mesmo com lease geral de UI válido.

**Teste:** `test/product/wp11/current-choice-read-fence.test.ts`; blob `46b004a1b374229ad46077930134ba0469213087`.

**Oráculos autorados:**

- A leitura positiva devolve o binding sem exigir permissão de escrita de preferências.
- Retirar a participação durante authorizeCase persiste a nova versão do caso e faz a leitura retornar stale, sem value.
- Revogar preferences read durante o mesmo callback faz a leitura retornar stale, sem value; a leitura direta do namespace também é denied.
- Em ambos os ramos o ChoiceRecord semeado permanece igual e preparedChanges/receipts continuam vazios.

**Consumidores reais:** `product/decisions/current-choice-preview.ts#createCurrentChoicePreview`, `product/decisions/result-store.ts#createSfDecisionResultStore`, `product/host-binding/state-provider.ts#createSfProductState`, `product/integration/ui-authority.ts#createSfUiAuthority`.

**Lacuna do critério completo:** Exercita somente o ramo de compartilhamento autorizado do leitor. Caso, escolha e binding são semeados; não cria escolha canônica, não reabre provider e não demonstra sessão instalada ou compartilhamento entre duas identidades reais.

### WP11.POSTW31.02 — WP11.T01.INV.01

**Texto literal:** Ator e autorização vêm do host; versão e histórico não são escolhidos pelo modelo nem importados como confiança.

**Propriedade exercitada:** A autorização atual do host e do namespace prevalece sobre o snapshot previamente autorizado e sobre o lease geral ainda válido.

**Teste:** `test/product/wp11/current-choice-read-fence.test.ts`; blob `46b004a1b374229ad46077930134ba0469213087`.

**Oráculos autorados:**

- A corrida executa exatamente duas autorizações do caso e exige race.applied=true.
- A autorização do snapshot recebido pode continuar true, mas a observação final conjunta de caso/resultados/binding suprime a leitura após a alteração.
- O teste verifica ui.revalidate(context)=true após a corrida, discriminando a mudança de participação/namespace de uma revogação global incidental.

**Consumidores reais:** `product/decisions/current-choice-preview.ts#createCurrentChoicePreview`, `product/decisions/result-store.ts#createSfDecisionResultStore`, `product/host-binding/state-provider.ts#createSfProductState`, `product/integration/ui-authority.ts#createSfUiAuthority`.

**Lacuna do critério completo:** Não demonstra importação não confiável de versão/histórico nem todas as chamadas C16/UI/native/MCP. As admissões são privadas da fixture; o vínculo não transfere qualificação de identidade instalada.

### WP11.POSTW31.03 — WP11.CMP.01

**Texto literal:** Cobrir intenção/alternativas/premissas/escolha/propostas/recibos, concorrência, import e revogação.

**Propriedade exercitada:** Concorrência e revogação entre a observação inicial e a última autorização do leitor são negativas discriminantes, com um controle positivo.

**Teste:** `test/product/wp11/current-choice-read-fence.test.ts`; blob `46b004a1b374229ad46077930134ba0469213087`.

**Oráculos autorados:**

- A alteração de participação usa uma transação real de C08, com versão, digest e resultado de commit exigidos.
- A revogação de leitura privada é observada novamente depois do callback externo.
- A leitura não chama cálculo, preparo, promoção ou dispatch: unexpectedProducerCalls permanece zero.

**Consumidores reais:** `product/decisions/current-choice-preview.ts#createCurrentChoicePreview`, `product/decisions/result-store.ts#createSfDecisionResultStore`, `product/host-binding/state-provider.ts#createSfProductState`, `product/integration/ui-authority.ts#createSfUiAuthority`.

**Lacuna do critério completo:** Cobre somente concorrência/revogação no leitor da escolha atual. Não cobre intenção, criação de alternativas, importação, escolha humana, propostas ou aplicação; esses ramos permanecem nas outras jornadas e nos gates de integração.

### WP11.POSTW31.04 — WP11.T01.INV.01

**Texto literal:** Ator e autorização vêm do host; versão e histórico não são escolhidos pelo modelo nem importados como confiança.

**Propriedade exercitada:** O helper de admissão usado pelas jornadas de renovação recusa autoridade revogada e referências fora do escopo, sem tratar a declaração sintética de fonte como autorização.

**Teste:** `test/product/wp11/renewal-source-admission.test.ts`; blob `4a5780b82989b9e8c3437bb3758779d7cfb76733`.

**Oráculos autorados:**

- O caso positivo exige duas resoluções, duas autenticações e três revalidações, sem ler cobertura nem environment no ramo vazio.
- Revogar o lease no último revalidate ou revogar o header no último authenticate retorna false e deixa requestFor indisponível.
- Nove variantes recusam installation, project, surface, record, fields, projection digest, período não mensal, ano divergente e refDigest inválido.

**Consumidores reais:** `test/product/wp11/renewal-operation-verifier.ts#createRenewalOperationVerifier`, `product/planner/port.ts#plannerSourceActor`, `product/planner/port.ts#projectPlannerSource`, `product/planner/operation-verifier.ts#createPlannerOperationVerifier`, `product/integration/ui-authority.ts#createSfUiAuthority`.

**Lacuna do critério completo:** É um helper de fixture que retorna apenas admissão booleana. Não produz avaliação C10, valor financeiro, ChoiceRecord ou aplicação; não substitui a autoridade do caso nem a prova da cadeia residente instalada.

### WP03.POSTW31.01 — WP03.INV.10

**Texto literal:** WP03 conserva autoridade, dados oficiais e ownership; não assume identidade técnica ou novo acesso empresarial.

**Propriedade exercitada:** Admissão de fonte observa novamente a projeção autorizada do Planner e conserva dados oficiais, recusando drift de fonte e escopo.

**Teste:** `test/product/wp11/renewal-source-admission.test.ts`; blob `4a5780b82989b9e8c3437bb3758779d7cfb76733`.

**Oráculos autorados:**

- Uma edição OPEX canônica muda a projeção enquanto a referência sintética permanece igual; a próxima verificação retorna false.
- As corridas do segundo resolve e do último revalidate exigem sourceCommitted=true fora do callback, impedindo falso positivo por comando engolido.
- O ramo de operações não vazias compara o digest do snapshot Planner antes/depois e exige ausência de gravação.
- As variantes de scope e a revogação final são recusadas, sem ampliar o acesso empresarial.

**Consumidores reais:** `test/product/wp11/renewal-operation-verifier.ts#createRenewalOperationVerifier`, `product/planner/port.ts#plannerSourceActor`, `product/planner/port.ts#projectPlannerSource`, `product/planner/operation-verifier.ts#createPlannerOperationVerifier`, `product/integration/ui-authority.ts#createSfUiAuthority`.

**Lacuna do critério completo:** A prova permanece no produtor e em fixtures autorizadas. Não cobre todos os comandos oficiais, UI mensal instalada, ownership de outras superfícies ou acesso empresarial real.

### WP03.POSTW31.02 — WP03.T01.INV.01

**Texto literal:** Toda projeção e simulação reutiliza o cálculo e a autorização do domínio; não existe fórmula financeira paralela.

**Propriedade exercitada:** Os ramos vazio e não vazio reutilizam o produtor Planner e sua transformação canônica de principal para Actor; admissão vazia não inventa cálculo financeiro.

**Teste:** `test/product/wp11/renewal-source-admission.test.ts`; blob `4a5780b82989b9e8c3437bb3758779d7cfb76733`.

**Oráculos autorados:**

- No ramo vazio, mapper plannerSourceActor e projectPlannerSource fornecem a mesma projeção autorizada usada pelo produtor; nenhuma cobertura ou environment é calculada.
- No ramo não vazio, as três operações passam pelo createPlannerOperationVerifier real e consomem coverage/environment.
- Um target inexistente implementation:13 é recusado, e o snapshot oficial permanece idêntico.
- A extração plannerSourceActor conserva os campos e recusas do mapper anteriormente privado de compareForecast; o teste não contém um segundo mapper de autorização.

**Consumidores reais:** `test/product/wp11/renewal-operation-verifier.ts#createRenewalOperationVerifier`, `product/planner/port.ts#plannerSourceActor`, `product/planner/port.ts#projectPlannerSource`, `product/planner/operation-verifier.ts#createPlannerOperationVerifier`, `product/integration/ui-authority.ts#createSfUiAuthority`.

**Lacuna do critério completo:** O vínculo sustenta o caminho de admissão e o verificador de operações, sem provar todos os cálculos, comandos ou exports do WP. A equivalência da extração é revisão estática pinada; regressões de forecast/HR/capability precisam do resultado Actions específico.

## Extração canônica e regressões existentes

O mapper `plannerSourceActor` foi extraído do próprio `compareForecast` para `product/planner/port.ts`, blob `8389709232225424b5905638d0951d8cdbb71dd7`. O produtor e o helper de renovação reutilizam a mesma implementação. O helper candidato é `f85c1c8e7196aff1381513b2d5ed2109641d6a45`; o leitor da escolha atual é `38f82f4b931682e255a18d52856e192f2ee43390`. Nenhuma fórmula financeira foi introduzida no helper.

Os testes existentes `port.test.ts`, `port-hr.test.ts`, `operation-verifier.test.ts` e `capability-parity.test.ts` são os alvos afetados de S24. Seus blobs estão no JSON. Esta referência não acrescenta aceite de critério e a fixture de bridge privado não comprova execução de um provider instalado.

## Execução e limites

- S22, S23 e S24 foram disparados em W32 e estavam em andamento na observação do parent às 13:00 UTC. Não há resultado concluído neste adendo; ele só pode ser atribuído pelo W/S e pelo case no ledger.
- O leitor semeia caso, escolha, resultados e binding. Seus valores financeiros são desconhecidos; ele comprova somente o comportamento de leitura autorizado quando executado.
- O helper de fonte retorna um boolean de admissão. Ele não cria C10, subtotal, total, ChoiceRecord nem recibo de aplicação.
- S19/S20/S21 qualificam seus próprios bytes. Este adendo não estende esses passes aos novos arquivos.
- Não houve teste local, mutação remota, alteração de critérios, mapa W21 ou adendo anterior pelo autor.
- Provas instaladas/nativas, C/D e o epic do bundle de S0 permanecem pendentes.

O [JSON correspondente](post-W31-criterion-bindings.json) contém texto literal, WP, ID, propriedade, oráculos, consumidores, lacuna restante, hashes e regras de resolução da evidência.

## Disparos observados, ainda sem resultado neste adendo

| Seleção | Run | Snapshot S |
| --- | --- | --- |
| S22 | [43597449806](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597449806) | `ef218e5c436f8518ee582232a820cd41048f8d3b` |
| S23 | [43597452709](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597452709) | `bdc5494e612353cc5d80bd32353dc9df6e20f450` |
| S24 | [43597456215](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597456215) | `b791d889a6f14ea0b9f9ff2b950bf10da4fe5090` |

Check15 também foi disparado sobre W32: [43597458293](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597458293). Esta anotação registra o despacho informado pelo parent, sem afirmar conclusão nem transferir os resultados de check14.
