# WP11 — reconciliação de integração para S0

**Produto congelado:** `a3b57d475e7b564fa7b05932d3a81c5836e3e3c1` (W19), árvore `47e634b81b9a64fef462cb670373aa832b88b76b`. **Branch/target:** `astra-wp11` → `sf2-stack`. **Disposição:** DRAFT/BLOCKED para aceite integrado. Este documento é uma entrega concreta de fontes e evidências; não trata dependências ausentes como concluídas.

O mapa dos [83 critérios](CRITERIA.md) distingue 32 literais VERIFIED_SCOPED de 23 PARTIAL, 26 BLOCKED e 2 NOT_ESTABLISHED. As subprovas próprias são reais e têm SHAs/run IDs originais; a aceitação integrada exige os consumidores e recursos enumerados abaixo.

## Pins consultados e ownership

O último refresh de owners foi único, read-only, às **2026-11-14 13:22:02 UTC**. Os arquivos relevantes foram lidos no commit imutável e verificados por blob. Esses heads consultados não são automaticamente intakes nem herdam o CI próprio. A reconciliação completa está em [owner-integration-delta-r6.json](evidence/owner-integration-delta-r6.json).

| Frente | Pin exato consultado ou consumido | Disposição |
|---|---|---|
| WP11 final | `a3b57d475e7b564fa7b05932d3a81c5836e3e3c1` | Produto e testes próprios congelados. |
| WP10 compose | `9a475b5fb28655f1c4309cd3e68b6e4d76269a2e` | Fonte inspecionada; montagem e testemunho instalado pendentes. |
| Finance | `87e5164a1c87ac9f013d381d5e601ca5b4b6c677` | Refresh consultado; adoção do fence current-choice reconhecida, sem intake geral. |
| Intelligence / extensão histórica WP13 | `48486a2186c0cc07a3a5558e34e2aa94c89ad5e9` | Batch consumido reconhecido; extensão histórica opcional continua retida. |
| WP13 handoff de domínio | `eb5d411292b8892673cff751b3492a14146b7785` | Fonte/propostas do owner; não transferir oracle antigo de retry sem receipt. |
| WP13 same-version já consumido | `46c904ead4e9b363422f6739258e492913ae6e2e` | Intake anterior documentado e preservado. |
| WP04 prepared producer já consumido | `91e1f60bc6f7e85517e2b4f963eec5ac7da13e62` | Comandos suportados e receipts reais; approval-pending não demonstrado. |

O audit registra **157 cópias publicadas exatas**, inclusive quatro paths dentro do ownership WP11, e **160 configurações inalteradas**. A cópia de fonte estrangeira não se transforma em autoria WP11: o manifest mantém origem, blob e relação de cada path. Correções próprias em stores/mutações/retornos finais são identificadas separadamente. [candidate-audit.manifest.json](candidate-audit.manifest.json)

## O que já está presente e não precisa ser reimplementado

C11 já tem captura de capability verificada, operationIdentity native, associação exata de call/receipt/request e guarda de replay/binding no host publicado. C17 já tem verificadores de fontes e requests, replay canônico dos ancestrais, escopo histórico autorizado e guarda por chamada. O patch antigo de C17 está superado; falta a execução residente instalada, não reconstruir as fórmulas ou substituir os verificadores por callbacks permissivos.

WP10 já adotou os fences próprios de HotTopic, result-store e scenario-request-store por blob exato; mutations difere somente em comentários executivamente equivalentes. Finance já contém o fence final de current-choice `38f82f4b931682e255a18d52856e192f2ee43390`. Intelligence contém os três produtores batch consumidos. Esses fatos de fonte não transferem CI entre branches nem demonstram montagem.

No WP11 final, `case-port.ts` tem blob `206271d33bcfb7786ee80ef0dfad50eb80e4fee2`: o símbolo read conserva os bytes qualificados em H7; draft e prepareIntent têm cercas finais qualificadas em E1/E2. Não substituir pelos snapshots anteriores dos owners. Aplicação conserva reserva durável global por caso/encarnação/mudança, receipt primeiro, estado indeterminado e correlação estável.

## Deltas concretos para os owners

| Ação | Owner | Parcela ainda necessária |
|---|---|---|
| Montar current-choice | WP10 / S0 | Conectar preview e promoção aos serviços, HTTP e host reais, usando Planner/C10, fontes atuais, C08 e grants distintos. Não reimplementar o fence já publicado. |
| Montar três rotas restantes | WP10 / S0 | Expor divergência de premissa, rejeição e status de aplicação com a mesma autoridade/contratos dos serviços próprios. |
| Consumir case-port final | WP10 / S0 | Preservar read H7 e cercas draft/intent E1/E2; qualificar o consumidor afetado na montagem. |
| Qualificar C11/C17 instalado | WP10 / WP12 / S0 | Usar projeto, instalação, sessão, provider e skill carregada reais; registrar operationIdentity, requests, output digests, refs persistidas e receipts. Não há testemunho native positivo nestes testes. |
| Fechar readers opcionais WP13 | WP13 | Reobservar C08 e autoridade após o último callback de fonte/host nos readers históricos e reconciliation, com negativo real de CAS nessa janela. |
| Alinhar retry de handoff | WP13 / S0 | Rebasear o teste precommit no contrato da reserva durável. Sem receipt autoritativo, uma exceção não autoriza segundo dispatch. |
| Provar approval-pending | WP04 / S0 | Produzir estado canônico, adapter/review/receipt e papéis de aprovação reais. Save aplicado ou submit_pr não suportado não demonstram pendência. |
| Completar consumidores nomeados | WP01 / WP05 / WP12 / WP13 / WP10 / S0 | Consumir o mesmo resultado WP03/C10 em UI instalada, BI, crítica e portfólio não vazio. O renderer BI e seleções de fixture são subprovas delimitadas. |
| Corrigir composição WP01 do verificador | WP01 / WP10 / S0 | Fornecer o verificador canônico requerido na fixture/composição HTTP; não usar retorno incondicional true. Qualificar os exports afetados. |
| Revisar baseline estrangeiro | S0 / owners correspondentes | Resolver ou dispor explicitamente os 130 diagnósticos fora do ownership; zero próprios não autoriza declarar typecheck global verde. |

### Cadeia de montagem WP10

No pin inspecionado, os seis arquivos da cadeia manual de host/services/HTTP permanecem inalterados. As cinco rotas próprias ainda ausentes dessa cadeia são:

- `decision-choice-preview`
- `decision-choice-promote`
- `decision-assumption-divergence`
- `decision-reject-change`
- `decision-application-status`

Preview e promoção exigem payloads completos e grants distintos; preview não autoriza histórico indiscriminado. Retry histórico da promoção exige receipt exato já persistido. A fonte atual deve preservar a identidade/encarnação e o histórico original. Coverage complete não deve transformar operações hipotéticas em compromisso confirmado.

### Readers históricos e reconciliation WP13 retidos

Os blobs `e07714d6c390a655b6eac7f5c2d56193b7bbfc7b` (proof) e `caa3b783b41f95287bba8a4bab3c652c8375c320` (history-provenance) continuam com callback assíncrono após a última observação de caso/ledger. O reconciliation `aedc80310eee2752d067dd52afa6312a9558b87a` também termina com revalidação externa após suas leituras. Uma mudança C08 nesse callback pode escapar da comparação anterior com o lease global ainda válido. É achado estático independente, não um teste local executado nem uma falha corrigida pelo reader próprio.

Antes de consumir essas extensões, o owner precisa terminar os callbacks, reobservar membership/caso/escolha/ledger/resultado/receipt exatos sob a autoridade atual e testar a corrida. A nova cerca de case-port não cobre um await adicional feito pelo módulo externo depois que recebeu sua projeção. O bundle WP13 W15 NOT_APPLIED é uma proposta de fonte a reconciliar com o compose atual; não constitui intake nem estado READY.

### Retry sem receipt e aprovação

O teste publicado antigo de WP13 injeta falha Procurement antes do commit e espera um segundo dispatch. O runtime próprio atual reserva uma tentativa durável antes de despachar; receipt-not-found com reserva exige reconciliação. Um erro do driver ou rollback observado no processo não apaga esse marcador nem prova ausência durável de efeito em outra tentativa. O owner deve alinhar o oracle e o status receipt-required. Qualquer futura faixa segura de retry exige prova autoritativa publicada e revisão explícita.

O adapter prepared de domínio suporta os comandos comprovados. O estado approval-pending ainda precisa vir do produtor canônico de Procurement com os papéis e a revisão de aprovação. Não se deve fabricar esse estado em WP11 ou inferi-lo da recusa de submit_pr.

## Evidência disponível e fronteiras

H7 e B1B passaram no W17, E1 passou 21 testes no W18 e E2 passou 7 no W19. O audit final qualifica 100 nomes únicos: 7 diretos, 39 com grafo idêntico e 54 por revisão restrita/regressões. O SHA de cada execução permanece original. O grafo BI declara uma referência type-only estrangeira ausente. O check final é FAILURE por 130 diagnósticos estrangeiros, com zero próprios; guards passaram. [EXECUTION.md](EXECUTION.md) e [CI-INDEX.json](CI-INDEX.json)

A prova browser usa Chrome para um renderer alimentado por projeção canônica; não navega pela montagem instalada. As confirmações de fonte/escopo e vários seeds são declarados. Grants privados reais exercitados por testes não equivalem a aprovação de uma pessoa. A seleção usada no intervalo estrutural não é o consumidor de portfólio completo. Nenhuma saída de modelo substitui confirmação humana.

O orçamento original 180000 foi mantido. H7 terminou a história inteira em 177754,86 ms, sem promessa de margem geral ou otimização do host instalado. A proposta de materialização ampla de C08/WP10 permaneceu HOLD; não foi importada apenas para acelerar o teste.

## Disposição de entrega

Os literais próprios comprovados permanecem VERIFIED_SCOPED. As tasks e a entrega integrada continuam PARTIAL/DRAFT/BLOCKED onde o pack exige os recursos e fluxos não observados acima. S0 deve fixar os commits finais, reconciliar os deltas por ownership, executar os gates afetados na composição e revisar o mapa completo antes de integrar. Este bundle não declara READY, não faz merge em dev e não faz deploy.
