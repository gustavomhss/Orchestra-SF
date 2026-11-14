# Deltas delimitados para astra-compose e astra-interface

## Reconciliação posterior — COMPOSE6 / interface0c3d98

O estado atual está em [external-reconciliation.md](../../WP11/finance-20261114/external-reconciliation.md), nos pins COMPOSE `35b9fd4f532abeb1058f00281d4ad8885ca9966f` e interface `0c3d98dd1263a305ce294c78ad5939cdda110a78`. **C17 histórico está implementado em código para o caminho delimitado de ledger autorizado, capture Atlas anterior e closure record-only ainda fresh.** Primeiro capture depois do avanço, histórico nested/misto, assumptions/replacement e fonte materialmente alterada continuam fora desse helper; a execução composta ainda precisa de prova. F2/AsyncLocalStorage e o delta central WP13 também estão presentes; preservar a validação real de 55000/15000 e suas condições. O campo BI `advantageComparisonRef` ainda precisa do delta de seleção. Mensal contrato/HTTP/UI conservam os três blobs base do patch. W20 publica os fixes próprios de proof na promoção sem operações e snapshot Dashboard no Hot Topic, ainda com execução pendente nesta observação. O S12 passou os nove casos de reconciliação do apply W18, mas falhou como run: 17 pass / 5 fail. Não transferir esse resultado para outro head.

## Registro histórico abaixo — propostas e pins anteriores

As seções restantes preservam o diagnóstico e as propostas nos pins originais; o registro atual acima prevalece quando as supera. Os antigos gaps genéricos F1 de C17 e F2 de Map não são pendências atuais equivalentes, e patches COMPOSE4 não devem ser reaplicados automaticamente. Preservar as provas que ainda faltam sem declarar READY/DONE.

Estado: **PROPOSTO, NÃO APLICADO, NÃO EXECUTADO**. As propostas são arquivos `.diff.txt` nesta receipt; nenhum arquivo de outro owner foi alterado por WP03. Reconciliar os blobs exatos no intake e executar typecheck, guards e CI cirúrgico do owner antes de aceitar o consumidor. Não aplicar sobre arquivo dirty ou head divergente.

## Pins atuais observados

| Grupo | Commit base | Arquivos |
| --- | --- | --- |
| astra-compose | `4306b310e4d6dac77f9beab461adad4e8e924849` | Três arquivos WP13, host C17, business-services e contrato mensal |
| astra-interface | `a29565f763ddd90bc5bc3b8d298afb47ad84008d` | HTTP mensal e script montado mensal |

`external-source-pins.json` contém Git blob e SHA256 dos cinco arquivos de sensibilidade/C17. `monthly-consumer-pins.json` contém os três arquivos mensais, seus commits e os SHA256 propostos. Os snapshots anteriores `5866bcb2ed610f80138aaabc261acac4acf709cd` e `ff7a99753d1fd1bc8b68b4f2642fed26e3cadbdf` permanecem evidência histórica; não descrevem a composição C17 corrente.

## WP13: publicar e reproduzir threshold exato condicionado

Arquivos atuais:

| Arquivo em product/portfolio | Blob base |
| --- | --- |
| planner-sensitivity.ts | `57d7873b88e063038045db0f688dc650f6a82eea` |
| sensitivity.ts | `049f8d6cb23d444a29642a1d195519977635e40b` |
| verification.ts | `b7645ecd8043969fbfe18326bc64366e01b5e6cf` |

O patch aplicável está em `wp13-conditioned-threshold-proposal.diff.txt`. Foi regenerado sobre os bytes de COMPOSE4306, preservando os novos snapshots defensivos de requests, bindings, callbacks e resultados; a verificação de digests/ref do cenário; os guards de range e resultados duplicados. Não substitui essas proteções por código de um head anterior.

O consumidor ainda exige samples completos antes de chamar o solver. Probes que variam operações pelo preview canônico WP03 produzem `conditioned` e `total:null`. Mesmo sem essa primeira barreira, o evaluator apaga o threshold quando a cobertura está incompleta, o finalizer exige ausência de todas as condições e o replay em `verification.ts` repete a barreira. O caminho atual também exige um `replace` no request original, recusando a observação confirmada sem operações. Esses são bloqueios concretos para publicar e reproduzir os limites reais 55000/15000.

A proposta separa prova matemática e completude financeira. Chama o solver canônico, conserva null se quantificação, critério ou fonte estiverem ausentes, mantém as condições C10 e permite `thresholdEvidence.state=exact` junto a `comparisonStatus=conditioned`. O selo complete continua dependendo das verificações completas existentes. O patch discrimina a variante `pending` antes de ler `entry.evidenceRefs`. Não altera critério, fórmula, inventário, autorização ou valor de training.

Para um `source-scenario` sem operações e sem assumptions, o issuer WP03 publica um `parameterOperation` somente depois de comprovar um componente USD confirmado, corrente e igual à projeção de origem. A proposta encaminha esse campo no binding interno e o consome tanto na criação dos samples quanto no replay. Usa `plannerDirectUsdParameter`, exige identidade `source-scenario:*` e recusa parâmetro derivado para requests que já têm operações. O request original continua íntegro e cada variação permanece hipotética.

### CI cirúrgico proposto ao owner WP13

- Consumir a fixture composta real WP05/WP11: bridge 60000, implantation 45000, new service 105000, critério -20000 e limite 55000. Training pending admite threshold matemático exato condicionado, sem promover `total`.
- Training confirmado 40000 desloca o limite para 15000; zero confirmado mantém 55000; null, FX ausente e critério sem valor impedem prova exata. Todos os samples devem vir do Planner real.
- Usar a revisão de fonte do mesmo caso em `renewal-choice-history`: request sem operações, total confirmado 250000, diferença alternativa menos referência +10000 e vantagem -10000. A sensibilidade da mesma seleção varia apenas `implementation:11` e reproduz 15000. A ChoiceRecord anterior continua idêntica.
- Persistir e reabrir a sensibilidade, reproduzindo threshold, `costCoverageRefs`, condições, unidades e fontes. Revogar uma fonte ou mudar a regra depois do último sample deve impedir publicação/replay.
- Sem solver ou prova exata, conservar apenas o intervalo amostrado. Passos de amostragem não constituem uma fronteira exata.

## WP10: C17 nested já composto; gaps atuais delimitados

O host `apps/cli/src/sucafina-product/planner-calculation-services.ts` tem blob `48a9cdd2d38fad855d8a338f8dc119c64f81057f`; `business-services.ts` tem blob `611831c32ddbf58296b33e1930806185564189b9` no mesmo COMPOSE4306.

A leitura atual confirma uma instância de `createPlannerCalculationEvidence` com `nested.replayScenario` ligado ao Planner real e `nested.evidence` ao serviço canônico. O request store recebe `verifyCalculationRequestSources`; o result store recebe `verifyCalculationSources` via referência privada que recusa antes de ser preenchida. O wrapper de persistência reproduz a simulação, conserva captures/source fences e registra o request real. `resolveEvidence` admite as projeções tipadas de ledger/document/policy sem exigir `context.sourceRefs` de todas elas. O case context dos ancestrais é estabelecido por `withCalculationCase` e retido durante a operação.

Não permanece correto descrever esse head como record-only. A presença do wiring, contudo, não demonstra execução instalada. Permanecem dois deltas concretos para o owner:

1. **Concorrência não é ancestralidade.** O wrapper `issue` usa `replaying: Map<digest([call.kind, call.binding]), Set<runId>>` antes de `requests.read`. Duas chamadas independentes ao mesmo cálculo com o mesmo binding podem se rejeitar como `calculation-replay-cycle`. O guard do produtor foi corrigido no grupo W4 com contexto assíncrono privado por cadeia; o wrapper externo precisa da mesma distinção, sem cache de autorização nem remoção da proteção de ciclos. Prova necessária: duas emissões independentes concorrentes aceitas e self/ancestor cycle recusado, inclusive quando a primeira leitura dispara o request hook.
2. **Projeção confirmada rebaixada.** O helper `value` do host marca todo valor não nulo como `hypothetical`. Uma observação `source-scenario` completa, já reproduzida e autenticada, deve conservar seu estado confirmado na projeção e nos disclosures; previews com operações permanecem hypothetical. Não inferir completude pela ausência de operações isoladamente: consumir o estado canônico do resultado, sua cobertura e replay. Ausentes continuam ausentes e valor confirmado não implica ChoiceRecord aplicado.

O teste instalado do owner deve persistir A, produzir B que referencia A, reinicializar a composição no mesmo SQLite e abrir B pela rota C17 real. Incluir evento ledger suportado, fonte ancestral revogada, ciclo, request substituído, mudança de source fence, concorrência de leituras independentes e negativa sem lease. Incluir observação de fonte completa e preview hipotético. Os fixtures duráveis WP03/WP11 demonstram seus próprios stores/engine; seus callbacks de captura e concessão não demonstram os locks privados deste host.

## WP01/WP00: prévia mensal, operações e rebase explícito

Proposta aplicável: `monthly-consumer-proposal.diff.txt` (três arquivos). Pins completos: `monthly-consumer-pins.json`.

| Arquivo | Owner | Blob base |
| --- | --- | --- |
| product/contracts/host-context.ts | astra-compose / WP00 | `920fda293db553096f4d8ab7004fcd9652a69291` |
| product/interface/planner-http.ts | astra-interface / WP01 | `2befb1d4c7964b30830311abe1c93c7c575b8f70` |
| product/ui/planner-monthly.ts | astra-interface / WP01 | `3adef2d68f54f2e04f9532751f5ddc9bed7e4b60` |

A fonte própria `product/planner/monthly-host.ts` já aceita exatamente uma família entre drafts, operation, entity e setting, executa o domínio canônico e revalida a autoridade. Draft previews publicam `before`/`after` via `projectMonthlyGrid`. A prévia de annual/spread/reset publica `annualBefore`, `annualAfter`, `changedMonths`, valores mensais e marcas manual, sem expor o comando. A resposta de conflito conserva o texto local, `stored` sanitizado e a view corrente autorizada. Esses dados não precisam de uma segunda fórmula ou autorização no browser.

O HTTP atual ainda recusa operation/entity antes da admissão e o contrato compartilhado só tipa drafts. O script corrente conserva corretamente body/key de apply incerto, congela edição, trata revogação e compara a resposta com cada draft enviado. Essas proteções são preservadas na proposta.

### Mudanças propostas

- O contrato usa aliases dos tipos `MonthlyRequest`/`MonthlyResult` do produtor, expondo também before/after e operações sem copiar fórmulas ou regras de domínio.
- O HTTP reutiliza `validMonthlyRequest`; mantém os limites existentes de mês, corpo, origem, content-type, idempotency key, human admission e revalidação final. Cada request continua tendo uma única família. Entity/setting ficam tipados e admitidos pelo produtor existente; a proposta visual adiciona apenas annual/spread/reset.
- O script oferece annual/spread/reset para registros com campos budget disponíveis; mostra moeda, anual antes/depois, meses afetados e os 12 pares de valores/marcas retornados pelo produtor. A prévia de drafts mostra cada célula antes/depois, inclusive ausência, zero e forecast herdado. Não recalcula anuais ou FX no navegador. Save de drafts depende de receber a prévia before/after válida.
- A operação de budget recusa uma linha que já possui drafts locais; drafts de outras linhas permanecem. Aplicação confirmada marca apenas a linha aplicada para reload, como a UI corrente; não apaga drafts de terceiros.
- Após um conflito confirmado, um botão explícito troca apenas a revisão e as células salvas da linha corrente, conservando os textos de `changes`, inclusive outras linhas. A revisão vem de `value.view.versions[versionId + ':' + ('hrAF' ou 'lines') + ':' + rowId].version`, usando a linha corrente para determinar synthetic. Não vem de `result.version` nem de incremento local.
- Rebase invalida a prévia anterior, cria nova identidade de request e exige novo preview/admission antes de save. Ele não executa comando. Resultado incerto ou retry sem reconciliação permanece travado: não oferece rebase nem altera body/key do apply original.

### Validação obrigatória do owner, somente Actions

O patch foi preparado por leitura estática, sem execução ou typecheck próprios. Preservar o run existente e selecionar testes específicos aos três arquivos, com o produtor do grupo no SHA exato.

1. HTTP deve admitir drafts/operation/entity/setting válidos e recusar duas famílias, campos extras, revision inválida, mês fora de 1–12, cross-origin e payload/body fora do contrato. O human grant deve estar vinculado ao mesmo payload integral.
2. No browser instalado, preview de vazio/zero/forecast herdado deve apresentar os pares canônicos. Salvar sem prévia ou depois de editar uma célula deve ficar indisponível.
3. Annual, spread e reset devem percorrer a rota real, apresentar anual e meses afetados do produtor, preservar meses manuais conforme o domínio e persistir/reabrir o resultado. HR derivado não recebe operação budget indevida.
4. Dois operadores: um altera a linha depois da carga do outro; preview/apply do segundo recebe conflito, exibe current/local, preserva outra linha dirty e permite rebase explícito para a revisão publicada. O novo preview e save devem usar a revisão nova; a linha não conflitada deve permanecer intacta.
5. Repetir perda de resposta e retry: body e key idênticos, inputs congelados, nenhuma troca para rebase enquanto o resultado anterior estiver incerto. A revogação deve continuar removendo conteúdo autorizado, sem nova tentativa automática.

Critérios associados ao gap G1: WP03.T02.INV.02, WP03.T02.SUC.01, WP03.T02.SUC.03 e WP03.T02.CHK.03. Os testes de produtor `monthly-operations` e `monthly-host` são evidência de seu escopo; não substituem a prova montada solicitada acima.

## Overview e provas finais

O finding C2 do Overview legado recebeu correção própria publicada no grupo em `9913b0c622aa09da7914f231bd9f2ff54d872634`, tree `f43b8e39733c6d93048c4d48001af8d0f398ac5d`. `plannerActualMonth` qualifica o total já calculado com os mesmos dados de presença/FX usados pelo C02. Tabela e SVG deixam de decidir presença por `value === 0`. O teste novo usa `render('Overview', ...)` e Chromium, mas sua execução no SHA corrente e a montagem HTTP instalada ainda precisam ser demonstradas. Não há alteração do engine.

Montagem mensal/HR/catálogos/comparações, SessionV2/skill/provider nativos, revisão posterior às correções e C/D continuam obrigatórios. A matriz conserva os 112 critérios e estados históricos, sem promover uma proposta, teste isolado ou wiring não executado a aceite integrado.
