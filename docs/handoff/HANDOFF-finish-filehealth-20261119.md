# Handoff — finish-filehealth-20261119

SHA: 2439074bb503c49a80a77299ecaab84000bd0a54 (código; este documento é um checkpoint posterior)
Data: 2026-11-19
Estado: partial

## Feito

- Base explícita: dfbc0ce6c61226a17bf3042c7587944a33f6c57b, que já contém o probe Imports do integrador. Nenhum arquivo de import-health foi alterado.
- Assets: 070c10d4e40314aed67f500a4dba39466b240ca3 acrescenta native-ui/asset-health.ts e dois pontos de composição (local/entry.ts e operations-support/installation.ts). O probe observa o mesmo Application, produtor montado, persistence e serviços de assets. Revalida readContextAdmission original antes/depois, autentica dentro de duas transações read-only por surface e compara os fatos observados. Exige portas privadas de blob e chave HMAC instalada.
- Upload exige também o serviço scan original aceitar um INSTREAM vazio de saúde. runtime/local-scanner.ts:4–6 não rejeita bytes vazios; :35–49 envia o terminador original e :9/22–31 aceita somente stream: OK seguido de NUL após o stream completo. Não há asset, arquivo persistido, referência de documento nem recibo criado por esse probe. O upload efetivo continua a autenticar, verificar registro/CAS e escanear os bytes reais.
- Link/download não dependem de um scanner disponível: permanecem cercados pelo serviço original de assinatura, autenticação e armazenamento. A permissão e validade de cada asset continuam sendo verificadas por runtime/assets.ts:153–216/382–396.
- Documents: 2439074bb503c49a80a77299ecaab84000bd0a54 acrescenta native-ui/document-health.ts, um observer/import no host-context.ts e dez IDs já existentes ao tipo privado nativeReadBinding. O catálogo de 305 operações não foi reescrito.
- O probe Documents verifica o productHttp realmente montado, a mesma composição documentHttp/createSfDocumentServices, métodos e parser originais, admissão/validate/revalidate atuais e namespace C08 documents com leitura dupla de versão, revisão e incarnation. Schema e confirmação exigem as ações humanas originais. Não executa discover/admit/extract/register/confirm nem inventa documento ou evidência.

## Pendente

- apps/cli/src/sucafina-product/native-ui/asset-health.ts:15 — código ainda sem typecheck ou gate funcional; usar o contexto original e o fluxo OP-DOC-01 com ClamD real para qualificar.
- apps/cli/src/sucafina-product/native-ui/document-health.ts:16 — código ainda sem gate de namespace/autoridade e fluxo nativo de documento; disponibilidade não equivale a sucesso de parsing ou confirmação.
- packages/app-shell/e2e/sucafina/operations-support/documents.ts:103 — Operations6 bloqueou antes do upload pela indisponibilidade original files.*. Este checkpoint prepara a correção causal; não declara que o cenário passou.
- packages/app-shell/e2e/sucafina/operations-support/documents.ts:158 — a parte posterior de admissão/schema/extraction/confirmation/revogação não foi alcançada no run anterior e permanece ativa para a próxima verificação.
- packages/app-shell/e2e/sucafina/operations-support/procurement-refusal.ts:150 — correção de captura dos bytes originais de submit_pr pertence à branch Operations; pendente ao publicar este documento.
- A composição com os probes UI38 isolados de finish-choice deve aplicar somente os hunks novos no host-context e no contrato; não substituir arquivos compartilhados por uma versão antiga.

## Decisões e justificativas

- Nenhuma asserção foi removida, pulada ou enfraquecida; nenhum timeout foi elevado.
- Assets pertencem ao createApplication original, fora do productHttp. Por isso seu probe fica no ponto real de composição; ele não recebe um grant C08 novo para tornar uploads possíveis.
- Documents pertence ao productHttp original. As admissions são sf_document_extract, sf_knowledge_search, sf_evidence_get e sf-human:documents.schema/confirm, conforme product/interface/document-http.ts:30/55/74/143/156/178/188/200.
- Namespace documents é o original de byte-port.ts:85, schemas.ts:78 e do host de documentos. As operações de escrita usam o seletor de saúde com mode write; reads não são promovidos a escrita.
- O estado de files.document-confirm anuncia a confirmação de campo autorizada. Rejeição/vínculo com cenário continuam exigindo suas ações originais adicionais no handler; o probe não concede essas ações.
- O probe do scanner qualifica somente o canal de saúde com bytes vazios; nunca substitui o resultado de scan do arquivo real nem garante que um arquivo futuro será aceito.

## Como retomar

1. Compor os seis arquivos desta branch sobre a base atual, preservando import-health do integrador e as fatias posteriores de UI38/Reports.
2. Acrescentar a correção CAP26 9865ba7d31f660a4f534bedf54e12d6396ae3ca0 e a captura original de resposta da branch Operations quando pronta.
3. Rodar o gate combinado Operations com request exato: {"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/operations.spec.ts"]}. Esse filename ativa o ClamD real existente no workflow.
4. Em falha, preservar o resultado específico de contexto/admissão e os bytes originais; não liberar controles, inventar grants ou repetir comandos automaticamente.

## Comandos e resultados

- Nenhuma execução local, shell ou máquina do dono foi usada.
- Typecheck deste checkpoint: não executado.
- Guards deste checkpoint: não executados.
- test-ci deste checkpoint: não executado; integrador compõe o próximo gate nominal.
- [Operations6 44619924653](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44619924653): FAILURE, job 135898520754; três typechecks e ClamD real SUCCESS; 1 passed / 4 failed. É a evidência anterior que motivou a correção, não uma aprovação deste código.
- [Auditoria 44622222711](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44622222711): SUCCESS, somente leitura do artifact original. Contexto HTTP200/status ok anunciou todas as operações files.* indisponíveis; CAP26 respondeu400 needs-input. Documento em audit-opscontext-20261119/docs/handoff/observed-opscontext-44619924653.md.
