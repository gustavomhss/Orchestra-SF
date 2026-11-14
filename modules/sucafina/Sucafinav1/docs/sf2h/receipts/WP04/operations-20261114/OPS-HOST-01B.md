# OPS-HOST-01B — segundo consumidor de sourcing

Extensão de OPS-HOST-01 para o owner astra-compose. Patch proposto, não aplicado, sobre o blob `41a795e5a2c05600741e694efca19f0ab329db55` de `apps/cli/src/sucafina-product/business-services.ts`, presente tanto em W1 `de6959db82dbe48bd59e3d012ff668a86347a6cd` quanto em W2 `5e0c79ee7013ea84329ff1fab8b32ab04ebdc2c3`.

`business.procurementDossier` também chama o produtor WP09. Seu `createProcurementDecisionPreparation` fornece request/comparison/limitations, sem os fatos opcionais de sourcing. Por isso, o produtor canônico retorna `commercialSources.proposalTerms.status = unavailable` mesmo quando o host possui `sourcingEvidence` autorizado. O primeiro patch trata `dossier-services.ts` e a apresentação no workbench; este segundo caminho precisa de seu próprio vínculo.

O patch acrescenta um wrapper exclusivo do dossiê. Ele consulta a fonte real, compara versão/contexto/refs e comparação, preserva os fatos de origem e relê o mesmo wrapper na saída. A fábrica existente e os demais caminhos C12 ficam intactos. O cálculo de comparação, scoring, câmbio, alçadas e escolha humana continuam pertencendo ao domínio. O digest de material inclui todo o sourcing; apenas o campo de idade derivado do relógio segue excluído como antes.

O owner deve reconciliar esse patch com seus deltas atuais, registrar o novo blob e validar em Actions o dossiê via ambos os entrypoints, com termos/FX/weights autorizados, troca de fonte e revogação durante a montagem. Também deve demonstrar que o cadastro do fornecedor não é usado como evidência de condições negociadas. Não há PASS, GNATIVE ou aceite global atribuído a esta proposta. Metadados, hashes e critérios detalhados estão em `OPS-HOST-01B.json`.
