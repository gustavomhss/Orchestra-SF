# FIN-IND-005 — diagnóstico entregue a finance-resume / S0

**READY_FOR_OWNER_REVIEW. FIN-IND-005 permanece OPEN.** A entrega usa a rota autorizada de diagnóstico causal com correção proposta ao owner. O único run novo terminou **0 pass / 1 fail / 18 expects**; a fronteira 15000/15001, a releitura histórica, o replay e a reabertura ainda não têm prova concluída.

PR: [#56 — finance-journey → finance-resume](https://github.com/gustavomhss/Orchestra-SF/pull/56). Sem merge. O head/tree final da entrega é registrado na PR após a criação do commit; a execução pertence exclusivamente ao W/S abaixo.

## Resultado discriminante

A falha foi localizada na **primeira qualificação de cobertura da avaliação confirmada**, na releitura final da autoridade após o replay canônico do preview. O solver exato confirmado e a gravação de samples confirmados **não foram chamados**. Portanto, o terminal não demonstra fórmula errada, falha de persistência confirmada ou sucesso da jornada.

| Fase observada | Resultado | Duração inclusiva |
| --- | --- | ---: |
| Construção da fixture | concluiu | 11.345 ms |
| Avaliação com treinamento omitido | concluiu | 44.978 ms |
| Registro da escolha | concluiu | 10.836 ms |
| Confirmação do treinamento | concluiu | 50.700 ms |
| Emissão do intervalo de cobertura confirmado | ok | 32.347 ms |
| Primeira qualificação do sample confirmado | deadline | 17.156 ms |
| Avaliação confirmada inteira | interrompida | 62.141 ms |

As duas últimas operações de cobertura estão dentro da avaliação confirmada. Tempos de operações aninhadas não devem ser somados como wall time.

A emissão terminou no decorrido 159.331 ms. O primeiro preview retornou em 162.847 ms; qualify começou em 162.848 ms. A validação inicial da autoridade e o replay do preview terminaram. A resolução final começou em 175.524 ms, units.resolve retornou em 179.968 ms e a leitura seguinte do caso encontrou o guard em 180.003 ms.

Entre a confirmação e o deadline houve **+790 leituras de cases**, +90 de preferences, +6.230 revalidações do host e +32 verificações de cobertura classificada. Não houve nova transação de cases/preferences. O mecanismo observado é amplificação de resolução/revalidação/prova; esses dados não isolam CPU, cópias, espera SQLite ou lock.

Fontes: [log hospedado](hosted-run-excerpt.txt), [resultado estruturado](result.json) e [run 43625830145](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625830145).

## O que passou e o que não foi alcançado

| Obrigação | Evidência nesta execução |
| --- | --- |
| Custo de renovação/baseline 240000; conhecido 210000; treinamento omitido permanece pending | Assertions passaram; total ainda null, nenhuma linha de treinamento |
| Análise anterior condicionada | Passou; certificado numérico observado 55000.000000000015, assertion preservada de proximidade a 55000 |
| Escolha original e versões de alternativa/base | Registro retornou e assertion passou no caso version4 |
| Mesmo caso e encarnação após confirmar treinamento | Passou; case/case-incarnation, version3 → escolha version4 → confirmação version6 |
| Treinamento40000; total250000; vantagem−10000; mínimo não atendido | Assertions passaram, cobertura complete |
| Teto confirmado15000 e witnesses15000/15001 | **NOT_REACHED** |
| Escolha histórica imutável após confirmação/reavaliação | **NOT_REACHED** |
| Replay autorizado sem nova escolha | **NOT_REACHED** |
| Fechamento real do writer, reabertura SQLite, colaborador, outsider e revogação | **NOT_REACHED** |

O digest original foi 077b2824dc68f8dbcb82604bb00bd0e402754c94715917dd56e45b1418b9929d. O checkpoint confirmado apenas repete esse valor em memória; não substitui a releitura histórica que ficou na cauda.

A assertion de 240000 verifica baselineResult.knownSubtotal na fixture de custo de renovação; não valida um campo de receita. Essa distinção limita o claim publicado, mesmo que a solicitação use o rótulo receita.

A orientação dos sinais permanece a do produtor: advantageComparison [selected,baseline] = −10000 após a confirmação. O preview da sensibilidade usa diferença de custo e regra lte −20000: espera-se 15000 → −20000/pass e 15001 → −19999/fail. A expectativa consta do teste, mas esses dois witnesses não executaram.

A cauda preserva todas as assertions originais e adiciona replay autorizado e history.restart(), que fecha o store/autoridade antigos antes de abrir outro reader. O replay é anterior ao restart; a nova sessão verifica leitura e revogação. O teste não pretende recertificar um envelope de sensibilidade persistido na composição WP10.

## Refinamento do finding original

O [run 43620619049](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620619049), job132525249982, snapshot c7a0956f850525a03ccd28b26cb8d90808f4d83f, parou com 0 pass /1 fail /10 expects.

createRenewalChoiceHistory **já havia retornado** após omitted em 11.386 ms. A avaliação anterior, a escolha e a confirmação também retornaram. O último checkpoint da fixture ficou em transition-confirmed:complete, 115.913 ms, enquanto código posterior continuou a executar. A pilha original termina no predicate isStillValid de cobertura, chamando issuer.revalidate; não na construção inicial da fixture.

O finding imutável não foi reescrito. Sua lacuna de evidência continua válida; apenas a atribuição causal foi refinada por [log e pilha originais](original-run-excerpt.txt). O novo run discrimina o custo entre validação, solver e persistência sem repetir a seleção antiga sem delta.

## Correção proposta ao owner — NOT_APPLIED

- Owner do produtor: **WP13 / S4-C**; WP11 mantém a jornada; **finance-resume / S0** fazem o intake; WP10 mantém sua composição.
- Arquivo alvo: modules/sucafina/Sucafinav1/product/portfolio/coverage-preview.ts.
- Preimage: commit 3ea9dc2efe0de8d283f9625774697e431f55a0d7; **Git blob 9f7e12113b38e73befb64f99a94fb8ca28d05eee**.
- [Patch textual](coverage-issue.NOT_APPLIED.patch.txt) e [manifesto, limites e contrapontos](coverage-issue.NOT_APPLIED.json).
- Aplicabilidade textual ao preimage exato: **PASS_TEXTUAL_ONLY**. Execução do candidato: **NOT_RUN**. Ganho de desempenho: **NOT_MEASURED**.

A proposta evita um predicate completo antecipado redundante no sucesso de issue. O trabalho fica em prepare(); o sucesso mantém o current() final original, com nova resolução, predicate e igualdade de identidade/certificado. Todo retorno não ok valida a autoridade **original** e seu digest antes de sair; autoridade inválida retorna stale e não pode entrar no fallback de unavailable do chamador. Mutação tardia do objeto original também recusa o sucesso e remove o intervalo provisório.

Uma simples remoção da primeira chamada seria insegura nesse fallback e foi descartada antes da entrega. Permanecem intactos prova estrutural, classificações, unidades, fórmulas, qualify/revalidate/verify e budgets.

A chamada antecipada observada custou 4.438 ms. Remover uma chamada não demonstra que a cauda inteira caberá no prazo. A revisão estática separada não encontrou defeito novo no diff, mas callbacks opacos podem depender de estado fora do digest: o owner deve qualificar a equivalência entre a autoridade original e a recém-resolvida. A proposta preserva o tratamento de TTL existente na entrada de current(), sem alegar novo fence após cada await.

### Contraprovas obrigatórias antes de aceitar o candidato

1. Jornada completa no mesmo caso/escolha, 250000/−10000, teto15000,15000 passa/15001 falha, histórico, replay e restart; mesmos budgets.
2. Autoridade inválida com unavailable antecipado ou estrutural: recusa, nenhum fallback condicionado nem novo sample.
3. Autoridade válida com cobertura incompleta real: comportamento condicionado preservado.
4. Mudança de caso/encarnação/fonte/classificação/base/critério/acesso durante a prova, inclusive mesmos valores com identidade diferente: recusa.
5. Mutação do objeto original durante await, em caminhos de falha e sucesso: recusa; intervalo provisório rejeitado não pode ser reutilizado.
6. Contexto revogado, escopo incorreto, intervalo expirado e reuso de token: preservação das recusas existentes.

A execução dessas contraprovas pertence ao owner após conferir o preimage e aplicar uma correção escolhida em sua fonte. A missão atual não possui autorização de escrita nesse produtor.

## Diagnósticos publicados durante esta tentativa

A observação inicial de preflight.md, sem delta publicado, foi superada pelas seguintes entregas. Os pins, handoffs, patches e logs posteriores foram consumidos antes desta conclusão; nenhum teste ou missão desses owners foi duplicado.

| Entrega consumida | Fase observada e implicação |
| --- | --- |
| [Calculation #59](https://github.com/gustavomhss/Orchestra-SF/pull/59), e80fdc933dfd25956a50c22dea76bf077e79815b | X27 run43623440133 alcançou results.write sensitivity ok em1.367ms e falhou na primeira recertificação do binding antes do commit. Proposta NOT_APPLIED reduz4→2 envelopes de fonte, preservando2 observações/6auth/4revalidate. Alvos são integration/source-lifecycle.ts e planner-sources.ts. |
| [Memory #55](https://github.com/gustavomhss/Orchestra-SF/pull/55), 0d7fb6f12ed053340391ff6e4f95b6f3c1276ea8 | A27 run43624030665 chegou a retry/stale.preserve e falhou por assertion aos182.124,35ms, sem timeout: captura corrompida recebeu preflight ok, esperado denied. Propostas NOT_APPLIED afetam somente instrumentação do teste histórico; probes finais de revogação não foram alcançados. |

Calculation atua em uma fase posterior do host e em resolução de fonte que esta fixture de renewal não usa. Memory trata instrumentação/captura. Não há sobreposição com o produtor coverage-preview proposto aqui nem transferência de aceite entre snapshots. As novas validações dos dois candidatos também estão NOT_RUN.

Em compose-resume@ad7fcdef7739e1bc471e42fac082452799de751b, coverage-preview.ts está ausente; product.ts é o blob antigo 8fc915379f153fdb437be09c2c84924d7d59b6ed. portfolio-services.ts, blob83c525e733b2cb21637734e3b1e07950e72f4f97, não injeta resolveCoverageAuthority/exactThreshold. S0 precisa consumir a dependência financeira e montar autoridade autenticada antes de atribuir esta hipótese ao host. O patch não deve ser aplicado cegamente àquela composição.

## Identidade da execução e protocolo

| Objeto | Identidade |
| --- | --- |
| Base solicitada / finance-resume observado | 3ea9dc2efe0de8d283f9625774697e431f55a0d7 |
| W executado | 1248dc6c5aaa83cb16c92697947fa5fea9699625 |
| W tree | 17105591e5a92ff792b676c61497c0c75a48d954 |
| S executado | b8f023e61983dbe33dc11f9e5dfd2000034ef4c0 |
| S tree | 525224251530ac6dd1e5fd2a4ca1dbba296e713b |
| Request SHA-256 | 4c722d670ce548d65145fb096d2b37767c417301b9b483336ce2582628b2305e |
| Run / attempt | 43625830145 /1 |
| Test job | [132541295004 — failure](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625830145/job/132541295004) |
| Cleanup job | [132542718708 — success](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625830145/job/132542718708) |
| Artefatos de Actions | 0; excertos do log publicados neste diretório |

W→S acrescenta somente .ci-run.json, blob d17151760cc63c5561fd96985aa82cadfac3802d. A request efetiva está em dispatch.json e result.json: apenas journey-phase.test.ts, CLI120000ms, caso300000ms e fixture180000ms. dispatch.json corrige uma configuração ainda não executada de selection.json; nenhum run foi lançado com o rascunho inicial.

Foi feito **um único dispatch novo**, com deduplicação e uma execução em voo nesta missão. Sem teste local, epic/full suite, rerun idêntico, mudança de timeout, skip ou alterações em workflow/runtime. A publicação final acrescenta somente recibos, sem modificar os quatro blobs de teste executados.

## Critérios e limites de aceitação

Lidos COMMON/mission no pin30e2215; AGENTS na base e no pina3d29d0 (mesmo blob); CI.md e WP11.pack.json **completo** no pina3d29d0; execution/COMMON.md, WP13.json completo e anexos product-acceptance/resident-runtime no normativo dbf9547. Os hashes completos estão em result.json.

WP11.T02.CHK.21, WP11.T03.CHK.20, WP13.T02.CHK.20, WP13.T03.CHK.20, C10, CAMP.QLT.06 e CAMP.CMP.04 **não recebem aceitação integral**. WP13.T02 também exige combinação/eligible-complete e paridade UI/BI/critique fora desta seleção. Os outros critérios dependem da cauda e de obrigações mais amplas.

Typecheck e guards: **NOT_RUN**. O ambiente contém fontes parciais materializadas via MCP, sem checkout completo/dependências; a request autorizada executa somente o teste selecionado. Não houve alteração de workflow nem execução local de produto para contornar esse limite. A execução Bun não equivale a bun typecheck ou bun run check:guards --base origin/dev.

Portas financeiras, C08 e SQLite são reais; grants, fontes/declarações, seleção e composição da autoridade são de fixture. Não há prova nativa AI/AM/perfil/provider/MCP/Atlas. Omni declarou not applicable, sem spawn nem delegação.

## Próxima ação para finance-resume / S0

Consumir apenas o delta desta PR, preservando a autoria e os namespaces dos outros owners. Encaminhar a proposta e os contrapontos ao owner WP13; reconciliar a dependência de composição sem importar árvores antigas completas dos diagnósticos. Após um delta efetivo de produto, congelar novo W/tree, executar contraprovas dirigidas e a seleção financeira preservada pelo protocolo CI.md, registrar S/run/jobs/checks e somente então reavaliar FIN-IND-005.

**Não repetir este run inalterado.** A próxima decisão precisa de correção aplicada pelo owner ou de hipótese nova que discrimine o custo residual.

