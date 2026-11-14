# WP10 — candidato W14

Continuação de W13 `f075e9824b7d8aed50b7f42c597528ef198177db`, sem alteração dos critérios ou dos recibos anteriores.

## Correções próprias dos três pareceres W13

- R1-W13-TYPECHECK-01: os tipos de produção e fixtures mantêm as unions e usam os decoders/identidades canônicos. A fixture Verifier é estrutural, sem execução ou proveniência nativa alegada. Nenhuma assertion anterior foi removida para obter resultado verde.
- R2-W13-REVIEW-REFRESH-01, R2-W13-BI-FALLBACK-REFRESH-02 e R2-W13-BI-NOTIFICATIONS-03: raízes Review/BI preservam o DOM durante a atualização genérica; o shell mantém navegação, notificações e logout. O fallback BI adapta seu formulário publicado aos eventos reais de atualização e revogação. Testes usam os bundles reais, HTTP autenticado e Chromium hospedado.
- R3-W13-ALT-FENCE-01: o relógio e a autoridade finais da prova Alternative permanecem dentro da leitura C08 real. Duas contraprovas enfileiram escritores independentes de caso e Planner durante esse await.
- R3-W13-SOURCE-EGRESS-02: a resposta de links BI relê sua seleção protegida; Review relê os corpos corrente e predecessor em um único scope C08 depois da resolução do destino. Quatro contraprovas mantêm a sessão e o acesso ao registro, revogando somente a associação protegida ou alterando o corpo preservado.

## Contratos e producers publicados

- PR32: composição C17 verifica a cadeia de cálculos com o replay Planner canônico, persiste e reabre o request real, verifica ancestors e detecta ciclos. O host WP10 liga os verificadores do result store e preserva o replay de persistência e o scope de recall Atlas existentes.
- PR32: dossier-services e workbench publicados exibem propostas, comparação, rejeições, próximos passos e lacunas do producer. A composição business.procurementDossier também exige sourcingEvidence coerente e relê o mesmo material.
- PR35: 37 blobs publicados, inclusive contratos/conversões de cálculo, métricas e seus consumidores/testes. PR34: cinco blobs publicados para C12, dashboard e testes. Arquivos divergentes de owners, workflows alheios e patches propostos não entram como código.
- Freeze 8: 17 documentos publicados recuperados; os 38 hashes do contrato conferem antes da publicação. Freeze 9 pertence ao delta opcional de joint Alternative admission que não foi incorporado.

## Provas e limites

O check W13 `43580267717` passou em Atlas, spawn e guards; os três checks TypeScript falharam. O artefato `14108415696` registra os diagnósticos; W14 precisa de seu próprio check. Os pareceres W13 não aprovam automaticamente este candidato. Nenhum teste, typecheck, build ou browser de produto foi executado localmente.

O mapa final deve preservar os 171 textos literais, registrar as observações hospedadas e separar os bloqueios por owner. C07, AM01–AM06, 39 operações, oito outputs, inferência nativa e aceitação global/epic não são declarados aprovados. A integração em sf2-stack permanece responsabilidade de S0; nenhuma branch alheia, dev ou deploy é modificada.
