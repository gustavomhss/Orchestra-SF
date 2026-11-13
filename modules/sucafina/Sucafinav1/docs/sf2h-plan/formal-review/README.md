# Revisões adversariais formais

**Estado atual: RECHECK_PENDING.** Os três revisores independentes fecharam todos os dez achados originais. Na rodada 2, identificaram dois P1 e um P2 novos. As três correções estão integradas neste candidato e serão julgadas no novo SHA.

## Rodada 2 — primeira leitura e correções

Candidato examinado: `38986380cd7b5697c0be30c1f55d43eddee63045`. Os três relatórios preservam o mesmo SHA, fontes, contraexemplos e limites.

| Frente | Veredicto inicial | Originais | Novo achado |
| --- | --- | --- | --- |
| [Produto](round-2/initial/product.md) | REQUIRES_CHANGES | P-F01–P-F04 CLOSED | P-R2-01/P1: sete operações sem skill concedida |
| [Técnica](round-2/initial/contracts.md) | REQUIRES_CHANGES | T-F01–T-F03 CLOSED | T2-F01/P1: scanner no bundle não admitido |
| [Execução](round-2/initial/execution.md) | APPROVED_FOR_EXECUTION com disposição P2 | E-F01–E-F03 CLOSED | E2-F01/P2: path de handoff divergente |

O [mapa de correções](round-2/corrections.json) liga todos os achados à correção. A [especificação de packaging](../specs/atlas-packaging.md) detalha a rota técnica sem alterar guards; o manifesto declara as 39 rotas efetivamente autorizadas. Os revisores recebem o candidato commitado, não uma promessa de correção.

[Protocolo da rodada](round-2/PROTOCOL.md), [contraprovas do validador](round-2/validator-controls.json) e [guard do primeiro candidato](round-2/initial/guard/README.md). O último preserva um aviso consultivo de tamanho do JSON, sem dispensa de regra.

## Rodada 1 — preservada

[Consolidação](round-1/SUMMARY.md), [produto](round-1/product.md), [contratos](round-1/contracts.md), [execução](round-1/execution.md) e [checkpoint](round-1/checkpoint.json).

Veredicto histórico: REQUIRES_CHANGES sobre `ec9d36da2385007b64a0aa627582ce7e60629a44`. Foram 0 P0, 8 P1 e 2 P2 brutos, agrupados em seis frentes P1 e dois ajustes P2. Os documentos históricos não foram reescritos após a correção.

Aprovação do planejamento não é aceite do produto. Implementação e provas de produto: NOT_RUN. O prazo alvo de 120 minutos continua condicionado às observações da execução.
