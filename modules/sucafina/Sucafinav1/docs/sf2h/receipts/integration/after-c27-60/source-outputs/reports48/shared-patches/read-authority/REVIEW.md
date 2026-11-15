# Missão48 — rebase inerte de 21 patches sobre C27

## Estado

Esta proposta preserva C27 `b10c424a6b318879fc30f11d03ba1cfeffda7d1a`, tree `31be8f81803b77f03e9089e09118f78218b26262`, e reaplica o contrato48 a 21 paths compartilhados. O root é o único writer remoto desta missão. O handoff solicitado continua destinado ao integrador47, reconhecendo a sucessão autorizada57 e seu C27. Nenhuma branch, fonte ativa, path Agenda39 ou workflow foi editado por este agente.

Os 21 preimages são conferidos contra o ledger MCP do root `C27-target-preimages.json`. Dezenove são idênticos aos preimages C19 e seus postimages48 permanecem byte a byte iguais ao bundle anterior. Somente `extended-browser.ts` e `extended-http.ts` receberam a composição de deltas. Ambas as mesclas de três vias foram sem conflito; a ordem inversa da mescla produz exatamente os mesmos bytes. Isso é verificação de artefatos, sem execução, compilação ou teste do produto.

## Mesclas e invariantes

Em `extended-browser.ts`, permanecem os imports de descoberta Agenda39, a factory `createReviewAgendaDiscoveryBrowser`, o `discoveryPeriod`, o callback `discover` e a nova condição de inert para agendas vazias. O delta48 continua restrito ao accessRevision capturado e ao focus probe: um header ausente não demonstra revogação; 401/403 ou header presente e diferente purgam e propagam o evento de revogação.

Em `extended-http.ts`, permanecem os imports, a dependência opcional `reviewAgenda`, o `agendaHttp` anterior ao dispatcher de revisão e o campo `period` do bootstrap C27. O delta48 preserva o formulário Reports instalado, o mapa de status de leituras corrigidas, o cuidado com exceções antes do consumo de `ui.validate`, os três callsites de `reviewCycle.update` e os finally.finish. Os fluxos BI não recebem mudanças adicionais.

O restante do contrato48 é exatamente o bundle21 anterior: negativa real de autoridade/alvo/escopo é denied403; drift autorizado é stale409; incerteza de I/O/evidência é unavailable503 sem value; produtores diretos mantêm PortResult; revalidação falsa real prevalece; drafts e intenção/chave sobrevivem à reconciliação recuperável; logout/revogação/mudança comprovada de binding purgam. Não há repetição automática de mutações nem concessão de novos grants. As probes legadas de reissue permanecem separadas dos checks estritos de leitura.

## Runtime56 e a hipótese de transporte

O commit C27 incorpora Runtime56 e sua adaptação revisada do oráculo de cópias frescas. O source release é `8cfbf59067b44df166d4b0550dfb4ea9aa73362e`; seu produto W é `b6b8f664c3ba6766891731267177ba541dbe47b6`. O delta de produção é `runtime/local-store.ts`: cópias independentes dos snapshots não-alvo aquecidos passam a ser materializadas a partir de planos imutáveis já admitidos. O alvo mutável, as três observações SQL por root, os fences de autoridade/capability e transactionAll são preservados. Não há alteração de transporte ou timeout nesse delta.

Os receipts `DESIGN.json`, `ACCEPTANCE.json` e `metrics/comparison.json` limitam a evidência de ganho a uma carga sintética SQLite/runtime. Máquinas e imagens CI diferem; a comparação não qualifica P03, Reports ou latência de produção. `consumer-ack56.json` também declara que o verde da fonte não é transferido e exige qualificação composta. Portanto C27 pode reduzir trabalho de leitura, mas não prova a causa ou a resolução do nominal06.

A comparação C19→C27 em `serve.ts` antecipa a validação da instalação e fornece sua layer de privacidade; não altera timeout. `host-context.ts` acrescenta o route de current-choice. O novo `createSfReviewAgendaHttp` atende apenas GET/HEAD de `sf=review-agenda`; o POST de Load selection continua no dispatcher `reviews.http`. `review-services.ts` conecta a descoberta/seleção Procurement ao evidence resolver e aos ports; não constitui uma correção comprovada para o POST das três seções Dashboard.

## Limite novo da descoberta Agenda39

O preimage C27 `review-agenda-services.ts`, blob `1d161deed336cde3753c6f8dd8a7f02854833dca`, contém uma admissão GET/HEAD que converte qualquer status não ok em denied403. O browser C27 envolve a descoberta no guarded que purga em denied. Esse caminho novo não explica a falha POST nominal06 e não foi alterado por esta proposta, por pertencer à dependência Agenda39. O achado é entregue ao owner/integrador; não se declara que todo o caminho de descoberta novo atende à distinção48. As duas mesclas preservam C27 integralmente, sem invadir essa lease.

## Qualificação e próximos passos do writer

Nenhum teste foi executado por este agente. A evidência installed05 4/4 pertence a W4/C19 e não é transferida para C27. O diagnóstico07 de transporte sobre W5/C19 estava pendente na preparação deste rebase. O teste closure bloqueado permanece intacto e não é incluído por esta proposta. Os budgets, assertions e quatro jornadas Reports permanecem obrigatórios e inalterados.

O writer deve comparar todos os preimages com o alvo autorizado, compor atomicamente os 21 postimages sobre C27 juntamente com os paths próprios exatos e o fix de cookie44, e somente então executar a seleção cirúrgica hospedada aprovada. O resultado do diagnóstico07 deve definir qualquer ação adicional de transporte; não se deve inferir cura apenas pela presença de Runtime56.

Os arquivos em `merge-deltas` mostram separadamente o delta48 sobre C27 e o delta C27 preservado sobre cada postimage48 anterior. `manifest.json` registra todos os hashes, o fullpatch e as duas mesclas. A evidência MCP relevante foi lida sem writes remotos; as instruções AGENTS ancestrais já registradas no bundle21 continuam aplicáveis.
