> **Validação final pelo integrador:** produto `dae18b4f43f0daecf46264e876810025684a919d`; Bun 257 pass, Playwright 10 pass, zero falhas/skips/retries, geração oficial e typecheck aprovados. Recibos e escopo em [ci-evidence.json](ci-evidence.json). O texto histórico abaixo conserva a atribuição e o estado da revisão em sua data; estes resultados hospedados não são atribuídos a execução pelo revisor. Permanecem 10 limites nativos e 4 observações humanas.

> **Adaptação de links para publicação pelo integrador:** fonte original SHA-256 `e87bb63e7abb380819fb89dae11a28a2065b1af3ef8914f2e42eb361deaad02f`. Apenas destinos de links locais foram adaptados: código histórico aponta para W6, pareceres incluídos usam links relativos e os demais artefatos de trabalho são identificados como não publicados. O texto da avaliação e sua atribuição histórica permanecem preservados. O inventário completo está em [publication-link-normalization.json](publication-link-normalization.json).

# WP04 — revisão estática do gerador de recibos finais

**Conclusão: RFGEN-01 fechado estaticamente; nenhum outro achado concreto aberto no escopo revisto. O gerador não foi executado por este revisor. Esta conclusão não promove critérios nem declara CI/browser aprovados.**

Data: 2026-11-14. Revisor: `/root/wp04_final_review`, independente do autor de `build-delivery-receipts.py`. Escopo autorizado: gerador de documentação e entrada pendente; sem alteração de produto/testes, execução de builder, suíte, typecheck ou navegador.

## Fontes congeladas

| Arquivo | SHA256 |
| --- | --- |
| review/build-delivery-receipts.py (`review/build-delivery-receipts.py`; referência de trabalho histórica, não publicada neste recibo) | `8dd2363dbc133a650d3e91e6463cfad208560cd137a19118b932a6e7b2c2366d` |
| review/final-evidence-input.pending.json (`review/final-evidence-input.pending.json`; referência de trabalho histórica, não publicada neste recibo) | `b48987c48d6bf24df18327ad9cfac6ff606f459ba2f3a57897900df2dc548153` |
| review/final-acceptance-candidate.json (`review/final-acceptance-candidate.json`; referência de trabalho histórica, não publicada neste recibo) | `0bdd398b687f4749e76f6c29cbabad182e1be86ccd7ddd686c4be115858641c4` |

O hash do candidato registra apenas o JSON lido como contexto do gerador. A revisão não refez a avaliação semântica dos 111 critérios ou de cada teste mapeado. A coleta remota dos metadados permanece atribuída ao integrador.

## RFGEN-01 — relatório/anexo sem ligação ao ZIP declarado

**Estado final: corrigido por `/root/wp04_finance` e fechado por leitura estática.**

Na versão inicial, `artifact_record` comparava o digest anunciado com um `verified_sha256` fornecido e sua ocorrência no log, mas `report_path`, `selection_path` e arquivos de anexos eram lidos independentemente. Assim, uma troca acidental de diretório podia combinar um relatório verde de outra rodada, com os mesmos nomes de testes, e os metadados/equality do run final. O gerador qualificaria os critérios e rotularia os anexos com o artifact ID final sem provar que esses bytes pertenciam a ele.

O fechamento revisado exige:

1. `archive_path` para browser e checks; cálculo do SHA256 dos bytes reais do ZIP e igualdade com o digest anunciado/verificado.
2. Nome, ID e URL canônica de run/artifact no mesmo bloco de upload do log que contém o digest.
3. Igualdade byte a byte entre os arquivos lidos e os membros canônicos `test-ci-evidence/playwright-runtime.json` e `playwright-selection.json`. O `request.json` do próprio ZIP precisa identificar o snapshot e a seleção exatos.
4. Para anexos, body inline que já pertence ao report verificado ou path correspondente a um único membro do ZIP. O fallback para `observations.attachments[].local_path` foi removido; ausência de bytes arquivados recusa a qualificação. Quando body e path coexistem, os bytes precisam ser iguais.
5. Ligação dos quatro membros checks — `revisions.txt`, `output-schemas.ts`, `typecheck.log`, `guards.log` — aos bytes do mesmo ZIP. As revisões vinculam produto, tree e base de guards; o schema oficial corresponde aos bytes de produto.
6. SHA realmente checkoutado nos três logs: snapshot Bun, snapshot browser e produto nos checks. Isso impede etiquetar um log antigo apenas mudando os metadados locais.
7. Reconstrução determinística das árvores Git de produto e snapshot a partir dos root entries e do único envelope `.ci-run.json`, conferindo os tree SHAs declarados.

Nenhum desses controles foi exercitado pelo revisor. A conclusão é sobre o fluxo de código no hash congelado, não um recibo de execução positiva ou de teste de falha do builder.

## Gates de promoção conferidos

| Fronteira | Comportamento lido |
| --- | --- |
| Entrada final | Exige arquivo real e `conclusion=success` para Bun/browser/checks antes da geração publicável. O template pendente não satisfaz essas condições. |
| Critérios | Confere os 111 IDs/textos canônicos, unicidade e a distribuição do candidato. Preserva exatamente 10 `BLOCKED_NATIVE` e 4 `NOT_RUN_HUMAN`; somente os 97 `CONDITIONAL` podem virar `PASS_SCOPED`. A qualificação global continua falsa. |
| Nomes de testes | Cada teste mapeado precisa de ID estável, nome literal declarado ativamente e uma observação única no arquivo exato selecionado. Skip/todo/only, duplicidade ou ausência impedem promoção. |
| Bun | Reprocessa o log e o compara ao resultado estruturado, seleção, contagens, assertions e summary. Exige todos os resultados pass e zero fail/skip/todo/error; rejeita duplicação e retry. |
| Playwright | Compara a seleção listada com os casos efetivamente executados, arquivos/projetos e resumo. Exige expected pass, resultado único, retry 0, ausência de erro/skip/fixme/expected-failure e estatísticas sem flaky. |
| Produto e fontes | Metadados W/S, request digest, árvores e checkout precisam coincidir. Paths alterados precisam corresponder ao blob publicado. A condição financeira global exige os testes finais e os bytes finais dos paths afetados. |
| Checks | Gerador oficial e typecheck precisam estar aprovados; log não pode conter diagnósticos TS. Contagens de guards conferem com o log e preservam warnings/atribuição à base. |
| Nativo/humano | Testes sintéticos, UI, mocks e controller não promovem os 14 critérios reservados. As observações browser precisam manter `humanTimingMeasured=false`. |

Os testes e fontes são ligações de evidência no escopo declarado; o gerador não prova por si só que um caso satisfaz semanticamente todas as partes de um critério. Essa avaliação continua pertencendo ao candidato e à revisão humana dos recibos.

## Publicação, privacidade e hashes

O fluxo de geração emite resultados normalizados: path, título, status, duração, retry, hash/tamanho/nome do anexo e referência ao artefato. Não copia `stdout`, o relatório Playwright bruto, o corpo dos anexos, cookies ou URLs temporárias de download para os recibos. A leitura do ZIP e dos anexos serve à verificação/hash. A varredura dos documentos antes da escrita rejeita padrões de URL com credencial/assinatura e payload JSON de cookies; ela reforça a seleção explícita de campos, sem constituir um detector universal de segredos.

O manifest documental exclui o próprio hash; `documentation_commit` permanece sem um SHA inventado. Os hashes de documentos referenciados são calculados depois de seus bytes existirem em memória. O integrador precisa vincular separadamente o commit D de documentação e a igualdade fora do prefix de recibos. Não foi identificado ciclo de auto-hash no fluxo lido.

Os arquivos históricos W2 permanecem fora do destino de geração e são comparados antes/depois. A geração prepara os arquivos em memória e só escreve após os gates de evidência. A publicação remota não é feita pelo script e permanece com o root.

## Entrada pendente e estado da execução

`review/final-evidence-input.pending.json` continua um template parcial: browser `PENDING`, sem a coleção final de job/log/report/selection/observations/revisão visual e sem os `archive_path` agora obrigatórios. Essa condição é coerente com a recusa esperada; o template não deve ser apenas renomeado como evidência final.

Durante a revisão chegou o log da rodada browser 43533038529 com **4 failed / 6 passed**. O código revisto recusa essa rodada pelos gates de conclusão/spec/resultados. W7 Bun/checks verdes não eliminam essa falha e não autorizam a promoção dos recibos. Um novo produto/snapshot exige revalidar as evidências correspondentes; os registros finais devem apontar aos SHAs e artefatos efetivamente executados.

**Fechamento:** sem impedimento estático adicional no gerador congelado. Executá-lo continua condicionado à entrada final real, à passagem das verificações acima e à coleta final do navegador. Nenhum recibo foi gerado ou publicado por este revisor.
