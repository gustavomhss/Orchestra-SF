# Triagem CI — handoff para integrador14 / S0

**PR documental única: [#63](https://github.com/gustavomhss/Orchestra-SF/pull/63), `sf2-ci-triage → sf2-control`. Sem merge.**

A fila corrente é [queue-003.json](queue-003.json): **40 itens**, com W/tree W, S/tree S, seleção, run/job, fase alcançada, erro, evidência, confiança, responsável, paths, dependência, próxima ação e recheck preparado. Os lotes 001/002 continuam como histórico imutável.

## Entradas para consumo

- [ledger-003.json](ledger-003.json): **32 execuções**, com os **32 logs completos dos jobs principais** lidos. A conclusão do job principal e o cleanup são campos separados; o cleanup C12 ainda estava em andamento na leitura final.
- [diagnostics-003.json](diagnostics-003.json): **353 ocorrências de typecheck, 114 assinaturas textuais exatas**, encaminhadas uma vez a 19 grupos de contrato/responsável, mais o grant WP14 já resolvido. A variante TC-0114 descreve a mesma chamada de TC-0061 com outra expansão de união; não é um novo defeito de produto.
- [READING-002.json](READING-002.json): AGENTS, COMMON/missão no commit `557adbd63f5700f487447cbb6167fe7c71e9bcdb`, pack **S0-A completo** e anexos obrigatórios concluídos.
- Listagem final de runs: **2026-11-14 20:09:04 UTC**. Leitura final dos jobs já identificados: **20:11:28 UTC**; os logs terminais foram incorporados depois. Não há promessa de monitoramento contínuo nem de observação de novos runs posteriores.

## Ordem de trabalho

| Prioridade / itens | Responsável e estado real | Próxima ação mínima |
|---|---|---|
| P0 — STACK-001 | Integrador14 + S0. `sf2-stack@47273c4f` está **COMPOSED_NOT_VALIDATED**. | Concluir intake por dependência, congelar C e preparar a prova do consumidor/autoridade/configuração/fixtures efetivamente compostos. |
| P1 — FIN-001 | Finance. S6 original continua bloqueado no guard de 180 s. A correção `5a029e77` passou **43/0, 350 assertions** na seleção focada S2. | Reutilizar S2; preparar a jornada original integral no delta material, mantendo 15000/15001, histórico, replay e restart. Não declarar a jornada encerrada. |
| P1 — X29-001; MEM-003 | WP10. X29 chegou ao guard de 285 s; Memory original, ao de 225 s. | Usar fases e contadores já registrados para discriminar custo. Reconciliar o candidato Memory mais novo; nenhuma conclusão de runtime vem de seu check estático. |
| P1 — R27-001…004 | WP10/S0-A. 13 falhas separadas em 7 de ordem, 4 respostas 403 de setup, 1 contador de oracle e 1 refresh expirado. | Corrigir o contador incondicional; confirmar contrato de ordem; obter motivo dos 403; atribuir o custo do refresh. Preservar ataques de autoridade ainda não alcançados. |
| P1 — C12-001/002 | C12/Operations + UI. Novo run **16/3, 373 assertions**. | Discriminar a falha de admissão do setup Planner; capturar o corpo real da resposta antes de a navegação invalidar o recurso CDP. Manter os dois casos UI completos. |
| P1 — TC-* | Integrador14 e responsáveis dos contratos. Finance novo: 115 diagnósticos; Memory novo: 13; ACK03: 9. | Consumir os pares produtor/caller já corrigidos antes de abrir implementação residual. O índice atribui cada assinatura a um único grupo. |
| P1 — ART-001 | Finance. Os mesmos **43 gates agent-scratch** persistem em `7a9a43b3` e `5a029e77`. | Excluir os logs brutos do intake; preservar recibos estruturados, URLs e integridade das evidências. Não relaxar nem contornar o guard. |

IDs completos usam o prefixo `TRIAGE-`. As ações acima são encaminhamentos por arquivo para os escritores existentes; a triagem não altera seus paths.

## Evidência que muda a decisão

**R27 — contador do próprio teste.** Em `bi-advantage-selection.test.ts`, `after?.(++calls.count, ...)` não avalia o incremento quando o baseline chama `observe()` sem callback. O zero observado não prova ausência de revalidação do produto. Incrementar antes da chamada opcional preserva o teste de autoridade. As outras 12 falhas não foram fundidas com esta causa.

**Finance — delta medido e provado apenas na seleção focada.** [S1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43634808031/job/132569165100) observou 12 envelopes C08 para a expectativa de 6, com callbacks de autoridade preservados. [S2](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43635340065/job/132570795422) passou os 43 casos e mediu 6 envelopes, mantendo 8 authorizeCase / 8 verifySources / 16 resultAuthority. A prova inclui replay de recibo legado e corrupção/revogação após SQLite reopen. Não inclui a jornada longa original. O [check estático de `5a029e77`](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43635795619/job/132572187686) permanece vermelho por 115 diagnósticos e 43 gates de artefato.

**Memory — integridade e jornada separadas.** A contraprova focada da captura original passou depois da correção de produto; o fixture de escrita aninhada também foi corrigido e rechecado. [mi04](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43633898208/job/132566360130) terminou **0/1, 1085 assertions**, no guard original: última fase registrada `stale.preserve`, retornando em 213857 ms. Não há prova de que o bloco posterior de corrupção original tenha sido alcançado. O [check posterior](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43635682967/job/132571841882), em `5d42e44f`, tem 13 erros de Sucafina; CLI, consumidores WP10, geração/boundary Atlas e guards passaram. Ele não executa a jornada.

**C12 — fase alcançada importa.** No [run novo](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43635717762/job/132571953924), os sete casos OPS-REV-02 passaram. A falha de domínio parcial ocorre em `fixture.ui("sf_context_read")`, antes da preparação Planner; o grant já lista essa operação, e a exceção genérica omite a causa. Nos dois casos UI, o status de recuperação já era 200: falha a leitura de `Response.json()` pelo CDP durante navegação. O primeiro já havia completado reopen, recuperação inicial e verificações de recibo/CAS; faltam as verificações finais da repetição.

## Não reabrir correções de outra árvore

- **WP14:** consumir a solução existente de Operations/PR34 com o **mesmo WeakSet** para autoridade e business services, preservando os dois cenários originais. [Check fonte](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43629903794/job/132553975834) passou. O erro antigo de `procurementEvidenceWrites` continua associado ao W antigo de sourcing-money.
- **Exports:** os dois defeitos de valores da descarga já têm correção e [11/0, 396 assertions](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43632315600/job/132561444043), com bytes CSV/HTML reais. Fazer intake da correção existente.
- **ACK:** loader, pagehide/pageshow e oracle de navegação estão corrigidos na fonte. [ACK03](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43634168745/job/132567207864): 6/1; a única falha é o gate de nove diagnósticos externos. [ACK04](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43634976272/job/132569688237): 1/0 **somente guards**; não substitui o typecheck.
- **Forecast:** Cancel/CSS e o oracle de limpeza do nó removido têm provas posteriores, inclusive recheck 4/0. Preservar o histórico 14/1; não convertê-lo em 15/0.
- **Colaboração:** reanexar os 20 testes do produtor e a seleção de três casos, sem somar nomes repetidos como cobertura nova. Os 69 diagnósticos do check são de sua árvore; os erros do produtor já ausentes não foram reabertos.

## Composição e limites

C observado: `47273c4f20c7c1af9b08537d26618901c36725e3`; tree `894074bb9436867979f81e93a8360bc900cf5f7a`. [Incremento 01](https://github.com/gustavomhss/Orchestra-SF/blob/47273c4f20c7c1af9b08537d26618901c36725e3/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/bundle-integrator-20261114/increment-01.json) compõe import admission recovery e declara testes/typecheck/guards/generation/native **NOT_RUN**. As implementações de consumidor, autoridade, SQLite e configuração diferem da fonte. Nenhum verde foi transferido para C.

Todos os rechecks são **PREPARED_NOT_DISPATCHED**. S0 mantém despacho e aceitação final; escopo, seleções obrigatórias, budgets e assertions permanecem os originais. Não foi demonstrada uma causa independente de **configuração**, portanto não há item inventado nessa classe. Artefatos foram verificados por metadados/upload; seus ZIPs não foram abertos.

Trabalho realizado somente por GitHub MCP e inspeção documental: nenhum produto/CI alterado, teste executado, run disparado/repetido/cancelado, agente criado, mensagem externa enviada ou merge feito. O transporte é esta branch; não há contato automático com os responsáveis.
