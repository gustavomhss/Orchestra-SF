# Missão 46 — patch compartilhado para a sessão 42

Base observada: `36521bb47f1d10de8d8bb5d376fdb5d5fa7bc8e1` (`sf2-stack`). O patch requer os três arquivos de produção da missão 46 na mesma composição. As seis mudanças compartilhadas estão apenas neste artefato; nenhum arquivo compartilhado foi editado no branch e nenhuma operação remota foi feita por este helper.

Estado: **NOT_APPLIED / NOT_TYPECHECKED / NOT_TESTED**. Revisão estática independente concluída por `cohort_contract_ci`. Ela não constitui evidência de execução, sucesso de UI ou aprovação de integração. O integrador 42 deve reconciliar os blobs antes de aplicar e qualificar em GitHub Actions cirúrgico.

## Composição entregue

- `local/entry.ts`: instala o fence da missão imediatamente sobre o SQLite real e antes de `createSfSourcePersistence`, preservando capacidades de blobs e a proibição de escrita aninhada. O mesmo store chega ao host, aos produtores e aos assets. A identidade e o lease vêm do runtime real.
- `product/contracts/host-context.ts`: transporta a capacidade privada opcional; hosts sem a capacidade não expõem o fluxo.
- `host-context.ts`: cria o serviço com a autoridade real, o business canônico e o registro privado de writers; monta o adaptador HTTP existente no mesmo processo.
- `current-choice-services.ts`: compõe Planner, emissor de fontes, persistência de cálculo, result-store, classificação e registro canônico de cobertura, continuidade de Atlas e as fábricas owned. Reabre caso, referências, classificação, resultado e recibo antes de publicar. O fence cobre as três superfícies e a classificação privada, que não faz parte de `sfRunSourceFence`.
- `current-choice-http.ts`: adiciona descoberta autorizada e dois POSTs independentes, preparação e promoção. Reutiliza `planner.preview` e `decisions.promote-alternative`; não acrescenta grants, políticas ou capabilities nativas. A UI mostra subtotal conhecido, total qualificado ou indisponível, cobertura, condições e restrições; promoção requer uma segunda ação humana explícita. Retry de promoção 5xx conserva exatamente payload e Idempotency-Key.
- `decision-controls.ts`: permite classificar cobertura da referência vigente somente após continuidade histórica comprovada e nova resolução fresca. Deduplica referências que convergem para a mesma versão vigente. A escolha histórica não é regravada.

## Invariantes e correções da revisão

O serviço usa o `operationIdentity` real sem prefixo adicional. Prefixos de recibos são internos às fábricas owned. A leitura de replay usa `preview.read(request, context, receipt)`, sem bypass do registro de cobertura que exige a versão original do caso. A classificação retida `not-applicable` só é aceita por `supportsCoverageClassification`; nenhum novo produtor de aplicabilidade é criado.

O snapshot da cobertura é estabelecido em `coverageEvidence.entries`, após as emissões de fontes necessárias, antes do observer owned e da primeira leitura do registro de cobertura. Os observers são síncronos e não registram novos observers ao executar. A comparação entre caso bruto e projeção autorizada exclui somente `preparedChanges` e `receipts`, campos transformados pelo case-port e não emitidos nesta UI; o snapshot bruto completo é então fixado para o fence final. O escopo do serviço envolve `fence.run`, de modo que permanece vivo durante a última verificação do fence.

## Dependências que continuam explícitas

1. Aplicação/reconciliação dos seis caminhos compartilhados pertence à sessão 42 e aos seus owners. O patch não deve ser editado concorrente em `sf2-stack` pela missão 46.
2. Qualificação do serviço/HTTP/UI composto, incluindo a instalação real e o workflow humano, continua pendente. Checks do source-only não validam esse patch não aplicado.
3. Continuidade histórica exige captura e autorização reais de Atlas/C12. Ausência de captura ou fonte revogada produz indisponibilidade.
4. Nova classificação de cobertura exige a ação humana já existente. O host observado não emite novas provas de não aplicabilidade; classificações canônicas retidas com prova continuam aceitas.
5. Uma preparação consiste em etapas privadas duráveis independentes de produtores/resultado/cobertura. Falha posterior não inventa rollback de etapas previamente autorizadas. A promoção final do caso é uma transação canônica atômica; o histórico permanece intacto.

Os blobs de origem, blobs propostos e SHA-256 do patch estão em `manifest.json`. Todas as leituras remotas que fundamentaram este artefato usaram GitHub MCP. Nenhum teste, typecheck ou suíte foi executado localmente.
