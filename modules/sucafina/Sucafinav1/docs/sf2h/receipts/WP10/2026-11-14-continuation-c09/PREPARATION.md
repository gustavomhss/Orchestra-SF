# WP10 — continuação reconciliada de W27

Esta entrega continua `astra-wp10` / PR29 a partir de `ab8fb4f29d078d179742a77679ef85e5c549b114`, sem reiniciar o WP. O pack integral, 171 critérios, sete tasks e 80 obrigações permanecem vigentes. O corpo anterior da PR e os terminais A27/X27/CHECK27/R27 foram arquivados nesta pasta. Nenhum teste de produto foi executado localmente.

## Composição corrigida e provas dirigidas

FIN-IND-002 descreve corretamente uma composição anterior com produtor `{host,cases}`, mas o produtor instalado em W27 exige `{host,state,authorizeCase,authorizeEvidence}`. O caller atual fornece exatamente esse contrato. Não se acrescenta uma propriedade obsoleta nem se troca o reader por fixture permissiva. O novo teste usa C09/SQLite/authority/BCS/Atlas/scanner reais: caso/evento válido, avanço do caso, captura e replay, revogação com lease já admitido, nova admissão/reabertura, fonte materialmente alterada e substituição física. O ledger usa narrativa sintética explícita; não representa uma jornada financeira completa.

FIN-IND-001, FIN-IND-003 e CR-C11-001 permanecem implementados. `reconciliation.json` identifica origens e provas. A seleção C28 inclui o negativo existente de prefixo de campanha porque a migração do provider e o guard de seleção mudaram desde sua prova W1. A prova A21 de observation permanece vinculada aos seus blobs idênticos; não é repetida. FIN-IND-004 já é byte-idêntico à entrega WP12 indicada: apenas se acrescenta prova DOM própria de clique implícito/Enter com o browser e shell reais e backend de UI declarado como fixture.

O diagnóstico cálculo PR59 foi consultado e adotado pelo owner em dois arquivos próprios, com preimages exatos de W27. O kernel de observação/materialização foi extraído sem remover fences; preparação recebe clone isolado, cada leitura é nova, as duas observações e revalidações externas continuam. O teste estrutural compara fallback real e capacidade nova, contagens 4→2, estado estável, ABA, revogação e abort. Essa contagem não é prova de desempenho integral. X só pode ser repetido depois desse gate e dos três arquivos de fontes passarem, com os budgets anteriores intactos.

## Reconciliação de evidência anterior

| Corte | Terminal real | Limite |
| --- | --- | --- |
| CHECK27 | FAIL; zero próprios / 13 estrangeiros | WP04=3, WP06=4, WP08=5, WP09=1. Demais checks específicos/guards passaram. |
| X27 | FAIL; 0 pass / 1 fail, 3 expects, 285,57s | Abort no binding/primeira verificação; releitura/retry/revogação não alcançados. Spans são inclusivos, não somáveis como walltime. |
| A27 | FAIL; 59 pass / 1 fail, 1.447 expects, 60 testes / 8 arquivos | Assertion do stale consumer sobre registro corrompido; não timeout. Cauda de revogação não alcançada. |
| R27 | FAIL; 34 pass / 13 fail, 839 expects, 47 testes / 10 arquivos | Sete setups BI divergem na ordem da evidência, quatro choices retornam403, um contador auth recebe0; Review focus excede transporte10s. Probes posteriores não recebem crédito. |

R27 terminou com cleanup success. Isso encerra aquele run, mas não prova término da sessão anterior. A continuação utiliza lease esperado do head para evitar disputa. Novos testes usam somente o protocolo GitHub Actions existente, após deduplicação e com W/S separados.

## Pendências preservadas

Memory PR55 e a nova falha de integridade A27; cauda X; ancestry/WP11 B26; H05 WP04; Freeze10; cohort CurrentChoice retido; BI/Review R27; os cortes browser/CLI/D/P/Q ainda não executados; 13 diagnósticos estrangeiros; condições nativas/residentes/watch/Task/Relay/anchors e qualificação AM/GNATIVE; observação estática estrangeira C17 de headers; três revisões FINAL independentes no candidato terminal. O novo teste DOM não fecha execução nativa ou AM05. Nenhum parecer focal aqui substitui FINAL.

O inventário anterior e o corpo integral da PR estão preservados; esta nota não redefine os critérios nem cria outro planejamento. Resultados novos pertencem a recibos posteriores, sem reescrever esta preparação NOT_RUN. S0 revisa e integra; sem merge ou GLOBAL_RELEASE.
