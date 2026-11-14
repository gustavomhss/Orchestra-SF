# Adendo independente — correção financeira W10

## Pin, independência e conclusão delimitada

- Produto revisado: **W10 `660db9a46e4c1d7ff87c23f6bb37f451cc703ccb`**, tree `bbc79890ba339e0fca0fb34f55bd4d1c69a7953e`, PR35 `astra-finance` contra `sf2-stack`.
- Snapshot imutável: `/workspace/scratch/a97ca4c53050/review-660db9a`; manifesto `review-660db9a-manifest.json`. Recalculei o Git blob de **todos os 734 arquivos não documentais** listados: zero divergências.
- Revisão anterior: W3 `66bbe152c145f04c16223a938589c63cedb3b716`, tree `f727ae5bfcef26383ff47a2b06bb65b161295dd2`; relatórios `review-financial-report.md/json` preservados.
- Planejamento: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campaign SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. AGENTS e packs WP03/WP05/WP11 são idênticos aos lidos na primeira revisão.
- Revisor independente, sem autoria. Nenhum produto, teste, build, typecheck ou CI foi executado/despachado pelo revisor; nenhuma fonte foi editada. Escrita limitada a este relatório intermediário e seu JSON.

**Conclusão:** o contraexemplo original de F1 — forecast explícito numa célula antes ausente — está corrigido estaticamente. Entretanto, **R1 mantém aberto um bloqueio próprio de qualificação de ausência**: o save de um mês normaliza o orçamento da linha inteira e a projeção do preview transforma outro mês intocado de ausência em zero estimado. G1 e G2 agora têm testes discriminantes adequados ao problema apontado. O log final de Test4 demonstra G1 e os casos originais de F1 passando no W7; G2 não foi selecionado nessa execução. A suite Test4 falhou por quatro timeouts, impedindo aceite agregado. A proposta documental WP13 posterior ao W10 aplica sobre sua base exata, sem equivaler a código integrado ou prova executada. Não há declaração global de READY, DONE ou aceite C/D.

## R1 — alta / bloqueio próprio aberto: mês não endereçado perde ausência

**Local principal:** `modules/sucafina/Sucafinav1/product/planner/scenario-port.ts`, linhas 84–89 e 114–118. A qualificação usa toda a projeção pós-comando e retira todas as condições derivadas de `originalMissing`; `changed` controla apenas o rótulo hypothetical. Não preserva a presença original de componentes não endereçados.

**Contraprova estática reproduzível:** Finance autorizado; FY2027 com `closed=9`; horizonte `2027-11-01` a `2027-12-31`; linha USD `missing`, `b=Array(12).fill(null)`, `a=[]`, `f=[]`. Executar cenário `{operations:[{kind:"replace",targetRef:"missing:11",amount:1000,currency:"USD"}], assumptions:[]}` sobre a mesma fonte. `include` no mesmo alvo também é admitido.

| Etapa | Resultado e evidência |
| --- | --- |
| Antes | `missing:11` e `missing:12` são `amount:null/evidenceState:absent`, com condição `missing:12:budget:missing`; `port.ts:162–180` consulta os campos brutos antes de aceitar o zero legado. |
| Comando pedido | `scenario.ts:24,42–54` envia apenas `save` com `f10=1000`; não pede nenhum valor para dezembro ou orçamento. |
| Efeito incidental do engine | `runtime/planner.ts:158–164` converte orçamento nulo em zero quando `numericMonths` é chamado; `:758–790` escolhe esse `base` mesmo para save só de forecast; `:798` atribui o vetor `b` inteiro à cópia. `:799–800` expande `a/f` preservando null: `f11` continua null, enquanto `b11` passa a zero. |
| Montante canônico | `runtime/planner.ts:263–271` e `src/planner-accounts.ts:57–60` calculam outlook de dezembro como zero por fallback ao orçamento normalizado. Não se propõe alterar essa aritmética. |
| Qualificação errada | `port.ts:162–180` passa a aceitar `missing:12=0/estimated`; `scenario-port.ts:88–89` conserva estimated porque só novembro está em `changed`. `:115–118` elimina a condição de ausência de dezembro. |

**Oráculo necessário:** novembro `1000/hypothetical`; dezembro `null/absent`, mantendo a condição de ausência; `total:null`, estado condicionado, request e snapshot fonte íntegros. Um segundo comando explícito que forneça zero a dezembro deve então produzir `0/hypothetical`. O montante interno zero do engine pode ser preservado sem convertê-lo em presença de evidência.

O erro não promove atualmente `total` a completo: o ramo de operação continua condicionado. Ainda assim altera o significado de dado ausente. O guard de `exact-threshold.ts:94–97` recusa `absent`/null, mas admite `estimated`; portanto ele também deixa de enxergar essa ausência quando recebe a projeção já mal qualificada. Não afirmo neste adendo que uma sensibilidade integrada foi publicada a partir dessa entrada.

**Por que o teste novo não o detecta:** `test/product/wp03/scenario-qualification.test.ts:26–58` usa horizonte apenas de novembro e verifica uma *outra linha* intocada. Não observa dezembro da linha salva.

**Correção delimitada proposta, a cargo do autor:** manter a projeção pós-comando e o subtotal canônicos; preservar `null/absent` da projeção original para componentes que não foram endereçados; preservar também seus missing originais, sem remover novos missing pós-comando. Para alvos explicitamente endereçados, usar a qualificação pós-comando, inclusive os guards de FX e a independência dos rates HR. Iterar os componentes pós-comando para não perder contribuições legitimamente introduzidas. Não restaurar indiscriminadamente o guard W3 que bloqueava o forecast recém-informado.

**Alvos legítimos:** replace/include/exclude endereçam apenas `targetRef`; defer endereça origem e destino (`scenario.ts:31–40`), ambos já contemplados em `changed` (`scenario-port.ts:88`). Vários comandos usam a união desses alvos. Este simulador não emite annual/spread/reset nem alteração de vetor budget. Para defer, origem/destino precisam ter effective numérico antes da execução (`scenario.ts:35–37`); o teste discriminante deve usar um terceiro mês ausente e verificar sua preservação. A normalização incidental dos demais meses não é uma autorização de presença.

## F1 original — correção estática confirmada, fechamento impedido por R1

`createPlannerPort` agora passa `buildPlannerFinancialProjection` a `simulateScenario` (`product/planner/port.ts:54–58`). `scenario.ts:7–8,56` projeta a cópia isolada após os comandos reais; `scenario-port.ts:80–89` qualifica essa projeção, em vez de iterar apenas os componentes antigos e eternizar seus nulls. `:115–118` atualiza as condições a partir da projeção nova — mudança necessária para alvos resolvidos, mas ampla demais para os demais meses, como descrito em R1.

O teste `scenario-qualification.test.ts` contém contraprovas próprias e comparação com `domain.execute` + `projectPlannerSource` + `buildPlannerFinancialProjection`:

- `:26–58`: replace/include de ausência por 1000 ou zero; subtotal 2000→3000 ou permanece 2000; alvo hypothetical; outra linha ausente permanece null; request, replay e snapshot preservados.
- `:60–87`: forecast EUR sem FX produz zero no engine legado, mas permanece null/absent na qualificação; mantém missing-fx.
- `:89–119`: forecast HR 1200 é quantificável apesar do budget rate ausente; subtotal 3200; budget permanece null/missing-rate e a ausência de outlook resolvida é retirada.
- `:121–148`: self-comparison observa a fonte uma vez por estágio, conserva objetos independentes e revalida revogação na segunda observação. Em `port.ts:74–128`, a deduplicação é local ao estágio, sem cache entre estágios.

Preservam-se os ramos: sem operações **e** sem assumptions observa a fonte e pode ser completo somente com cobertura/projeção correntes completas (`scenario-port.ts:101–112`); operações explícitas permanecem hypothetical/conditioned, mesmo que reproduzam o mesmo valor (`:114–119`).

A mudança de presença de actual também foi lida: `actual-presence.ts:4–11` qualifica o total canônico por presença/FX, sem depender de valor ser zero. C02 (`port.ts:203–207`) e Overview (`runtime/planner.ts:1854–1874`) consomem esse helper. `runtime-overview-presence.test.ts:26–65` verifica render real e SVG para ausência, zeros em meses abertos/fechados, FX ausente e actual HR independente do rate. O teste monta o HTML no browser da fixture; não prova a rota HTTP instalada ou sessão residente. Não foi executado pelo revisor.

## G1 — discriminante do fallback IEEE presente e PASS observado no Test4/W7

`test/product/wp03/exact-threshold-fallback.test.ts:12–67` usa componentes ordenados `[2**53,x]`, intervalo `[0,16]`, critério diferença `<=0`. As amostras monetárias passam pelo Planner real e `comparePlannerPreview`; apenas a admissão de unidades/regra é um harness declarado.

O teste exige fronteira `1`, mais de 18 chamadas de preview para discriminar o caminho curto, duas emissões de unidades e os últimos dois probes `[1,nextUp(1)]`. Confere diferença 0 no primeiro e 2 no adjacente, mantendo `total:null/conditioned`; exige fontes e imutabilidade de cenário/request/snapshot. Isso cobre o longo platô IEEE apontado no relatório W3. Após a leitura estática, o root disponibilizou o log final de Test4: li o registro PASS desse teste, com 3700,37 ms, no W7. Essa é prova executada positiva do discriminante naquele pin; não converte a suite com quatro falhas em PASS nem revalida o futuro fix R1. O solver continua usando o produtor canônico e testemunhas adjacentes; não encontrei fórmula financeira substituta neste delta.

## G2 — oráculo 70000→235000/5000 agora presente; execução pendente

`test/product/wp11/implementation-quote-history.test.ts:8–58` exercita revisão de quote no mesmo caso, com training bundled:

- Antes: subtotal 210000 e vantagem conhecida 30000. Depois de uma escolha humana registrada, revisão da fonte de implantação para 70000.
- Depois: request vazio de operações/assumptions, identidade `source-scenario`, componentes confirmados 60000 + 70000 + 105000, total 235000 completo; diferença alternativa menos baseline −5000 e vantagem +5000. O critério renewal-difference falha como esperado para esse limiar.
- Preserva os mesmos escopos de cobertura; implementation/migration/training compartilham uma única contribuição `implementation:11`; N/A permanece em contract_exit/internal_costs/other_relevant_costs. Não adiciona uma linha monetária training à soma.
- Preserva digest da ChoiceRecord e da fonte original, não cria preparedChanges/receipts e reabre SQLite para verificar caso/resultado persistidos.

A origem dos valores foi rastreada em `test/product/wp05/engine-revision-fixture.ts:23–47`: `domain.execute` copia a versão original, salva `f10=70000` na cópia e emite referência com digest da projeção canônica. `renewal-choice-fixture.ts` passa esse source a `preparePhase` com operações vazias. A fixture declara referências sintéticas/harness de digest, não um issuer instalado. Não há cálculo paralelo do total; os números literais do teste são oráculos. Não foi observada execução bem-sucedida neste corte.

## WP13 — composição externa, duas revisões documentais distintas

Base externa examinada: `/workspace/scratch/a97ca4c53050/foreign-intake/COMPOSE4`, commit **`4306b310e4d6dac77f9beab461adad4e8e924849`**, pin informado pelo root. Os três blobs foram conferidos independentemente contra `external-source-pins.json`:

| Arquivo em product/portfolio | Git blob |
| --- | --- |
| planner-sensitivity.ts | `57d7873b88e063038045db0f688dc650f6a82eea` |
| sensitivity.ts | `049f8d6cb23d444a29642a1d195519977635e40b` |
| verification.ts | `b7645ecd8043969fbfe18326bc64366e01b5e6cf` |

**Achado histórico do W10:** o patch em seu snapshot é baseado em `ff7a99753d1fd1bc8b68b4f2642fed26e3cadbdf`; SHA256 `6e81ef32100ae5b5861d2248d4e0cb9b9bcc4c0b6204a6c0915d18a8681aa21a`. `git apply --check` contra COMPOSE4 retornou 1, falhando em `planner-sensitivity.ts:52` e `sensitivity.ts:36`. COMPOSE4 contém verificações resultRef/resultDigest e clones defensivos que não existiam no contexto antigo. O risco de intake do patch histórico permanece documentado; não é defeito novo do namespace próprio W10.

**Proposta documental posterior, separadamente autorizada e congelada pelo root:** li exclusivamente os três documentos abaixo no checkout compartilhado, sem ler produto dirty. Não fazem parte do pin W10.

| Documento em docs/sf2h/receipts/WP03/finance-20261114 | SHA256 |
| --- | --- |
| wp13-conditioned-threshold-proposal.diff.txt | `837d5ff6b7896054cfd819e4b73a9865836f4dffea96e119f053185dc6586222` |
| external-source-pins.json | `4cb63839e4c0eda04191319c60cb1de6b7d42726797c4b47fe6d4a1d178b986a` |
| owner-deltas.md | `1228dc8f2339b5f5e8cc4c402751745aa301cf81d43d4368d7989b6d66620f42` |

Repeti os hashes no fim da leitura, sem mudança. **`git apply --check` da nova proposta contra os bytes COMPOSE4 retornou 0.** Não apliquei o patch.

A revisão estática confirma o rebase preservando resultRef/resultDigest, structuredClone, revalidações e guards de range/identidade. Writer e replay recebem a mesma derivação source-only: `parameterOperation` vem do issuer WP03; `plannerDirectUsdParameter` admite apenas o caso adequado; o request original continua sendo a entrada de `requestDigest`. O issuer (`sensitivity-units.ts:39–66,94–101`) exige alternativa atual, componente e forecast USD confirmados, igualdade com a projeção e fontes correntes; `:89` encaminha a operação derivada separadamente.

No evaluator, ausência/null/número não finito/fonte vazia continuam impedindo threshold. Cobertura pendente e componentes hipotéticos mantêm comparação condicionada e suas condições, enquanto a prova numérica pode ser exact. O finalizer separa exact de complete; o replay aplica a mesma política. O patch não altera a fórmula, o inventário C10 ou o request armazenado.

**Risco externo restante:** a composição COMPOSE4 ainda não recebeu essa proposta. Seus guards atuais recusam source-only sem replace (`planner-sensitivity.ts:58–59`), bloqueiam solver sobre samples condicionados (`:83` e `verification.ts:119`), e apagam threshold na incompletude (`sensitivity.ts:45`, finalizer `planner-sensitivity.ts:126–128`). A proposta é necessária, mas aplicabilidade textual não prova o fluxo persistido/reproduzido. O owner deve validar em Actions 55000→15000, zero/ausência/FX, replay, revogação após samples, regra alterada e mesma escolha preservada no pin integrado. R1 também deve ser corrigido antes de usar os guards de ausência dos samples como prova.

## Evidência executada, limites e escopo

Executado pelo revisor: leitura/diffs, hashes de 734 blobs, conferência de três blobs externos e hashes documentais, `git apply --check` histórico e atualizado e inspeção do log final Test4 disponibilizado pelo root. Nenhuma execução de produto ou testes.

**CI Test4 `43581792536`, job `132407886238`, concluído FAILURE:** li `/workspace/scratch/a97ca4c53050/test4-clean.log` após sua disponibilização pelo root. Resultado: **15 pass / 4 fail**, 19 testes em 7 arquivos, 378 expects, 1513,76 s. As quatro falhas são explicitamente timeouts. Pin produto informado pelo root: W7 `a274302…`; o log confirma o service commit `91cd4ee008b764d1e06d42a3a7fa2dce606ecdc1`. SHA256 do log bruto informado pelo root: `8d931c7742a974c2d80d096eff8159e3c5650a5c6972e9b662d428f71082a8d9`; a inspeção própria foi do log limpo, não do arquivo bruto.

| Grupo observado no log | Resultado delimitado |
| --- | --- |
| scenario-qualification, quatro casos originais F1 | PASS: 449,41 / 92,32 / 179,63 / 40,51 ms. Não inclui R1 de meses adjacentes. |
| exact-threshold-fallback, G1 | PASS: 3700,37 ms. |
| source-scenario, três casos | PASS: 47960,33 / 93392,60 / 46322,07 ms. |
| composed-threshold, training/zero/missing | Timeout 223637,08 ms, limite 180000 ms. |
| scenario-capability-parity | Timeout 63938,53 ms, limite 60000 ms; o marcador assertions:done aparece aos 63934 ms. Não é PASS. |
| engine-coverage, omitted→40000 | Timeout 219940,58 ms, limite 180000 ms. |
| composite-coverage, variantes | Timeout 227930,89 ms, limite 180000 ms. |
| implementation-quote-history, G2 | Não selecionado nos sete arquivos de Test4; execução permanece sem prova. |

As demais saídas positivas não autorizam ignorar as falhas ou elevar os timeouts. O root iniciou análise delimitada de desempenho. Não extrapolo a execução W7 para todo W10, para o futuro fix R1 ou para a proposta WP13. W11 foi descrito pelo root como mudança apenas de tipo na fixture WP05; não foi revisado. A nova diferença de vantagem BI ainda dirty foi excluída explicitamente.

Escopo deste adendo: deltas W3→W10 de scenario/source qualification, missing refresh, actual presence e ligação C02/Overview; testes F1/G1/G2 e suas fixtures reais; emissor de unidades e fronteiras exatas relevantes; revisão delimitada dos três consumidores WP13 externos e proposta documental por hash. Os packs e oráculos financeiros da primeira revisão permanecem referência, sem novo aceite integral de seus 303 critérios. Não revalidei mudanças não relacionadas de stores/autoridade, C17 instalado, contratos, artifact store, consumers UI montados ou sessões nativas; pertencem aos demais donos/revisores.

**Próximo fechamento financeiro delimitado:** autor corrige R1 no namespace próprio, adiciona regressão de meses adjacentes/terceiro mês de defer, executa via Actions no pin publicado e retorna o delta para revisão independente. G1 tem prova positiva delimitada ao W7; G2 ainda requer execução. Os quatro timeouts da suite devem ser resolvidos e revalidados sem aumentar os limites. WP13 depende do intake e do replay integrado do owner externo.
