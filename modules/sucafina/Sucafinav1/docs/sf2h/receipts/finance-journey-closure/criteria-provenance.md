# Sessão 18 — critérios e resultados reconciliados

**FIN-IND-005: OPEN_IMPLEMENTED_NOT_CLOSED.** O código residual foi aplicado; a jornada longa S3 continua falhando na guarda original. Este mapa conserva o inventário Finance integral e distingue assertions alcançadas, controles selecionados e obrigações ainda não executadas.

## Escopo normativo preservado

| Pacote | Critérios | Tarefas | Checks |
| --- | ---: | ---: | ---: |
| WP03 | 112 | 5 | 26 |
| WP05 | 108 | 5 | 26 |
| WP11 | 83 | 4 | 19 |
| WP13 | 68 | 4 | 16 |
| Finance completo | 371 | 18 | 87 |

O JSON acompanhante conserva as 29 cláusulas literais de apoio, C08/C09/C10, o oráculo numérico, os 68 critérios e vínculos de prova S4-C e os pins de fonte. Os estados NOT_RUN/PLANNED do plano são metadados normativos, não veredictos atuais. Nenhum critério foi excluído ou dispensado. Campanha integral: 15 WPs,74 tarefas,17 contratos,1610 critérios. Não há aceite global.

## Oito obrigações

| ID | Obrigação | Resultado real neste W |
| --- | --- | --- |
| FJC-01 | Custo baseline240000; mesmo caso/encarnação/escolha até o fim | Parcial: baseline e case/case-incarnation em versões3→4→6 observados; sequência final não concluiu. |
| FJC-02 | Conhecido210000 com treinamento omitido/pending | Assertions passaram antes do timeout: totalnull, categoria training derivada faltante, threshold condicionado55000. |
| FJC-03 | Confirmar40000, recalcular250000 e diferença−10000 | Assertions passaram na versão6, com critério mínimo20000 falhando. |
| FJC-04 | Teto15000 atende20000;15001 produz19999 e falha | Não alcançado. Duas qualificações passaram; guarda expirou no início de exact→units.issue. |
| FJC-05 | Escolha histórica preservada e reavaliação atual | Reavaliação atual comprovada; releitura histórica posterior não alcançada. Digest retido não é leitura persistida. |
| FJC-06 | Replay autorizado sem efeito duplicado | Não alcançado na jornada. Controles isolados de recibo S2 não substituem esta obrigação. |
| FJC-07 | SQLite fechado/reaberto com nova autoridade | Não alcançado na jornada. S2 comprovou somente o ciclo dos recibos de resultado. |
| FJC-08 | Predicate original, mutabilidade, recusas, cleanup e cercas | coverage-preview permanece byte a byte; contraprova Afalse/Btrue recusa antes de preview em S1/S2. Seleção anterior afetada e novos controles passaram. Não é nova execução de todos os casos adversariais sugeridos pela PR50. |

Fontes/grants permanecem declarações sintéticas da fixture. Baseline240000 é **custo**, não receita provada. Não há prova de AM nativo, UI instalada, binding/composição WP10, C12/apply, ou liberação global.

## Actions

| Seleção | W / S | Run | Resultado |
| --- | --- | --- | --- |
| S1 | 9a2ab893 / e47c611a | 43634808031 | Vermelho discriminante esperado:1 pass/1 fail/10 assertions;12 envelopes contra6; predicate original PASS. |
| S2 | 5a029e77 / 8bf015c9 | 43635340065 | PASS43/350 assertions/0 fail;36 anteriores+7 novos;359,81s. |
| S3 | 5a029e77 / 5b82d9de | 43636137688 | FAIL1/18 assertions;180016,75ms; guarda180000 em confirmed.exact→units.issue→compareForecast. |
| CHECK-W2 | 5a029e77 | 43635795619 | FAIL:115 diagnósticos externos;43 gates/15 warnings;zero achados novos nos arquivos próprios. |

W2 completo: `5a029e77bfd9d8ba19494966a95c908e3f05043d`, árvore `a736cd370da6081c6010ffb26d66130fea94736f`. Cada S difere de W somente por .ci-run.json. Requests, jobs, árvores, hashes e extratos constam nos recibos e CI-LEDGER.json.

## Invariantes e limites do delta

Os pares de units compartilham somente envelopes do leitor canônico com proveniência privada. Retêm callbacks por ocorrência, duas fases, recertificações, Request/headers/binding/lease e a cronologia da regra. Facades opacas mantêm o paralelismo anterior; troca de facade recusa sem fallback tardio. Batch C08 não cria atomicidade entre fontes de domínios.

O recibo compacto guarda identidade e digest integral do StoredDecisionResult; o corpo completo permanece em decisionResults. write/readByRequest continuam exigindo leitura canônica autorizada. O produtor reconhece recibos legados completos sem migração. O código antigo não entende o novo recibo em readByRequest e falha fechado; rollback/mistura de versões após novas escritas não está comprovado.

A revisão de apoio não encontrou blocker estático e permanece distinta de aprovação independente. O scan de360 arquivos TypeScript (334 product+26 CLI) no handoff encontrou apenas result-store como consumidor da chave privada; não demonstra compatibilidade de consumidores futuros.

## Proveniência

Missão: a32285b2683b5000dafe93df99289547c7f410fb, blob c8129f55def8293a43595e9ab7beda44d66654b1.
Plano: dbf9547211d9b0fade619790de7c19c0869b7c7d.
Pack S4-C: blob c59d7593fe94808048a0377d365d0681482d7252.
Handoff recebido:454b97daf614176507711df889bd45743467f7af.
Revisão PR50:29356ad7a554309e9a905749dd84e3f6bd0900ea, coverage-preview blob71dbf3cec182e7f9295d9f36c01b7cac7dba582a.
Inventário371:blob380013db924473678353f56a7852de2f0133733e.
Cláusulas herdadas:blob58a6b2a55c820aeb9cc2f0d5597b93526028a5b8.

O JSON conserva URLs imutáveis e conteúdos literais pertinentes. O handoff final e integration-intake.json são a entrada para sessão14; não autorizam merge nem removem as obrigações não alcançadas.
