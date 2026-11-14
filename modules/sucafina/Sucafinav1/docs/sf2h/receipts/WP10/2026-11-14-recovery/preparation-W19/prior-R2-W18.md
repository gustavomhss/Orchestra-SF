# Parecer independente R2 — W18

**Veredito: HOLD.** Este parecer se aplica exclusivamente ao candidato publicado `8b1cc71d8ab2484055a0d055c8487d4579476b9b`, árvore `6bace347fcd4deec2018185aff7ec152d79eaec5`, cujo pai é o W17 `2ec17b2c8204d5e953eec3186b7e236c0faaad47`. A PR29 estava aberta de `astra-wp10` para `sf2-stack` nesse SHA quando consultada independentemente por GitHub MCP.

A revisão de fonte sustenta as correções propostas para promoção BI sem operações, preflight da Review, snapshot do draft Dashboard e reconciliação C12. **O candidato ainda não possui aceite funcional:** o check hospedado terminou em falha, o conjunto A estava em execução na última observação independente e a configuração de leitores da Review usada pelo host residente difere da configuração do novo teste de reutilização.

## Independência e método

Sou R2, agente `/root/independent_r2_w16`, sem participação na autoria do produto W18. Não alterei código, branches, commits ou publicação. Não executei produto, testes, build, typecheck ou browser local. As únicas escritas foram novos artefatos desta revisão. Os pareceres W16/W17 foram preservados.

Li a fonte congelada, seus deltas e testes, as instruções/ownership do pack e os registros de intake. Consultei diretamente o commit, a PR, metadados do check e **18 blobs** por GitHub MCP. Inventariei os bytes locais e comparei os Git blob SHAs com a árvore completa declarada. A amostra parcial não foi tratada como árvore completa nem como prova de deleção. Os relatos de builders serviram para localizar material, sem substituir a análise independente.

Este é um dos três pareceres exigidos. Não equivale ao fechamento do gate dos três revisores e não aprova integração por S0, merge ou deploy.

## Bloqueio obrigatório corroborado

### R2-W18-COMPOSITION-01 — Dependência de export do consumidor Planner ausente

**Prioridade P1, aberto em W18.** O root já havia identificado o bloqueio; R2 o corroborou independentemente na fonte e no resultado hospedado.

`product/planner/evidence-reader.ts` importa `sfPlannerEvidenceRef` de `product/integration/planner-sources.ts`. O produtor composto em W18 não exporta esse símbolo. O check exato confirma `TS2305` no consumidor. A origem estrangeira do arquivo não permite considerar essa dependência satisfeita.

A correção é consumir o produtor publicado necessário na branch própria, com pin e dependências completos, e executar novamente os checks afetados no sucessor. O teste/consumidor estrangeiro deve permanecer intacto. Este parecer não atribui ao W18 uma correção preparada posteriormente.

Há outros 13 diagnósticos no mesmo check, incluindo `analysisHistory` ausente em um import de produção e incompatibilidades de fixtures estrangeiras com contratos obrigatórios. A lista integral está em `intake-audit-W18.json`. Zero diagnóstico em código próprio não torna o produto composto verde.

## Observação de evidência da Review

### R2-W18-REVIEW-HOST-OBS-01 — Configuração efetiva do host não coberta pelo caminho novo da fixture

A cadeia de código publicada é inequívoca:

| Local | Comportamento observado |
|---|---|
| `host-context.ts`, blob `834b3c967d73411771e1f5aa82b683c6427e6769` | Injeta leitores de contribuições e outcome ao compor os serviços estendidos. |
| `review-services.ts`, blob `c07d55c714b4c85ee41abb4d287ce5861500086d` | Define `localSnapshotReaders=false` quando qualquer leitor foi fornecido. |
| `review-read-integrity.ts`, blob `2a04d86546c1c5361ec523a5f7c7189b5a8d2d65` | Essa configuração escolhe `legacyRead`, sem reutilizar a prova de snapshot por invocação. |
| `review-portfolio-http.test.ts` | A fixture nova constrói o serviço sem esses leitores e testa o caminho de reutilização. |

Isso é **uma lacuna de comprovação da montagem efetiva**, não uma falha funcional inevitável demonstrada. O preflight também executa `legacyRead`; `readScopedSource` só pede commit quando a entrada muda. Portanto, ele pode materializar metadados antes do grupo C08 e permitir a leitura final. A análise estática não autoriza afirmar que toda chamada residente produzirá nested write.

Antes de creditar a correção ao host residente, é necessária prova hospedada de `review-source` positivo e das contraprovas de revogação, alteração de corpo e egress usando os leitores efetivamente injetados. Não recomendo habilitar reutilização para leitores externos sem capturar todas as suas dependências de autorização. O root assumiu essa obrigação de comprovação; uma fixture feita por builder deverá continuar sujeita à revisão independente.

## Resultados da análise de fonte

### BI: promoção sem operações e identidade real

O mutador estrangeiro preservado aloca a identidade da alternativa **antes** de chamar `simulateScenario`. A composição própria agora captura essa identidade por `createMutationId` dentro de `runPromotion`; para revisão de alternativa, mantém o ID existente e a próxima versão. Assim, a prova se refere à alternativa que o mutador efetivamente atribuirá.

`prepareNoop` está restrito ao cenário sem operações e sem assumptions e verifica a identidade da execução, o input completo, o Request, a chamada e o binding. Ele obtém a cobertura real e prepara a evidência antes do C08 com a identidade atribuída. A sequência normal de reavaliação do produtor permanece preservada. O fechamento mantém verificações de caso/preferências, intent, baseline, resultado e fontes; o fim da invocação descarta seleção e prova.

Os testes continuam exigindo HTTP200. Os novos asserts verificam cenário vazio e igualdade entre ID/versão da alternativa persistida e os campos da cobertura; o log adicional de falha não relaxa o resultado esperado. Ainda não atribuo PASS a esses testes no W18.

O achado anterior **R2-W16-BI-QUERY-01 continua resolvido na fonte publicada**: allowlist de `bi-source` e digest do bootstrap incluem `referenceDigest`. A seleção permanece vinculada às origens emitidas pelo produtor real, e as verificações finais de caso/acesso não foram removidas. Seu fechamento funcional depende da evidência hospedada exata.

### Review: preflight, isolamento e preservação

A associação de fonte com Review é reaberta após resolver os links. O preflight acontece fora da leitura C08 final; essa leitura exige que todos os corpos usados na associação, inclusive predecessor, continuem com seus digests exatos.

No caminho elegível à reutilização, a prova pertence a uma invocação aberta de AsyncLocalStorage e ao mesmo Request, chamada e binding. O fence inclui snapshots completos de todos os domínios, ator, autenticação dos principais, dia, corpo e recibo. Alterações de membership e de bytes sem incremento de versão invalidam a prova. Os resultados são clonados, e o teste novo cobre segunda invocação com o mesmo Request, Request substituto e revogação de participante.

Comentários, outcomes externos/nativos, sensitivity e evidência fora do subconjunto admitido conservam o caminho completo do produtor. Não foi introduzido cache global com TTL. Esse resultado estático deve ser lido junto à distinção de configuração do host acima.

### C12: tentativa durável, recibo canônico e egress humano

Os quatro arquivos de C12 admitidos da PR35 foram conferidos diretamente no commit `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f`, incluindo os testes publicados.

O produtor registra a tentativa antes de atravessar a fronteira do domínio. A reserva é vinculada à identidade/incarnation do caso e à mudança. Se já existe tentativa e não há recibo autoritativo, a retomada fica indeterminada e exige reconciliação; não redispara o efeito por ausência de recibo. Um recibo encontrado é vinculado à prova da Review e reaberto pelo leitor canônico.

Após o domínio, a reconciliação reabre o caso atual, preserva alterações concorrentes legítimas não relacionadas e exige a mesma mudança escolhida. A leitura final e a transação exigem corpo de recibo/prova exatos e unicidade. As cópias defensivas evitam que alias do resultado altere a prova durante callbacks.

Os wrappers próprios de Dashboard e Procurement capturam o Request, binding e intent humano completos e reautorizam a lease depois do último retorno do produtor. O teste próprio do Dashboard observa uma retomada bem-sucedida, encerra somente a lease na mesma leitura C08 final e exige egress negado; a próxima retomada deve retornar o mesmo recibo sem repetir efeito. Os testes estrangeiros cobrem resultado perdido, revogação, remoção/substituição/colisão de recibo, edições concorrentes e reinício. **São testes inspecionados, ainda sem resultado W18 creditado.**

### Dashboard e consumidores

O draft Dashboard agora usa o snapshot real do Dashboard da mesma unidade C08; exige que os bytes completos do snapshot recebido pelo callback correspondam ao domínio permitido. O teste mantém o registro positivo e compara o Planner antes/depois.

A UI HTTP continua vinculando a escolha da origem ao produtor real e reabrindo autorização antes de liberar links. O delta W18 não substitui os registries UI/native/MCP, o host residente, o pool de drivers nem a implementação de cancelamento. Sua análise anterior permanece histórica; bytes inalterados não produzem nova evidência de execução nativa. O foco de reavaliação do achado C17 anterior é de R1; não o fecho por atribuição.

## Inventário, propriedade e preservação

| Verificação estática | Resultado |
|---|---:|
| Arquivos hidratados que correspondem à árvore | 1142/1142 |
| Blobs na árvore completa | 16120 |
| Deltas declarados / observados contra W17 | 47/47 |
| Paths classificados como próprios / estrangeiros publicados | 41/6 |
| Pins efetivos correspondentes ao candidato | 401/401 |
| Blobs lidos diretamente por R2 no GitHub | 18, sem divergência |
| Deleções / violações de ownership nos próprios | 0/0 |
| Recibos WP10 anteriores preservados | 100/100 |
| Critérios com ID/texto literal preservados / tasks | 171/7 |

As cópias `prior-R2-W17.json` e `.md` são byte-exatas dos pareceres independentes originais. O mapa de critérios permanece com SHA256 `95fc2fe3cdbebffa5aefe990991fb495c7d4f6c194395c27e01b7d8e2208a8e1`.

Conferi remotamente seis inputs exatos da PR32, dois da PR34 e quatro da PR35. Os paths próprios incluem composição exata previamente publicada e overlays próprios; o número seis da tabela é a classificação do delta do manifest, não o total de inputs publicados consumidos. O `outputBlobSha` intermediário de `business-services.ts` no intake é explicitamente sucedido por `root-composition.json`, que registra o blob final `97cde4dce2858f47b57b446c9c20bad77d367591`.

Os novos arquivos PR35 de mutations/scenario/stored-scenarios examinados e excluídos permanecem registrados como inputs, sem splice no produtor. A composição BI resolve sua prova em código próprio. A verificação anterior do índice original registrou 128 foreign copies e 131 readonly inputs; o delta W18 não modifica esse índice. Não refiz o download individual de todos os blobs históricos.

**Freeze9 permanece 37/38.** O manifest e o teste estritos foram preservados. O host real tem SHA256 `6a608e24847fe730b645d5f51f86e47d83e803875162820038e0c05d18f96772`, divergindo do esperado `4c654665a12aa02a6d5a851cdbe662f6f0fabdacf21e4b600f598e499a3a1922`. Isso continua um gate declarado, sem alteração artificial do esperado.

## Evidência hospedada exata

| Evidência | SHA/run | Resultado observado |
|---|---|---|
| Check W18 | S `6d72852aa48f864338caa93204ae894ec1e978fe`; run **43591239877**; job **132436212526** | **failure** em Typecheck Sucafina: 14 diagnósticos estrangeiros |
| CLI e consumidores WP10 | Mesmo run/check | success nas etapas correspondentes |
| Atlas generation/check/typecheck e guards | Mesmo run/check | success |
| Conjunto A W18 | S `f84d2f41bb5755d350d524053c391fc8338e7bdd`; run **43591262845** | **in_progress**, sem conclusão na observação independente |
| B/C/D | Informação do root | Validados/preparados; não disparados no último status recebido |

O compare remoto entre W e o S do check contém somente `.astra-wp10-check.json`. Os metadados das etapas confirmam checkout do produto exato; `revisions.txt` identifica W, sua árvore e o guard base.

Conferi o ZIP do artifact **14112034219** e os **11 arquivos extraídos**. O SHA256 do ZIP é `08329a4279831996b48cd01911e58a5caf164185103a2acf8268d33640ec063d`. Os bytes extraídos correspondem ao ZIP e ao manifest. Isso é inspeção de evidência hospedada; não houve reexecução local.

## Condições para nova decisão

O sucessor deve fechar as dependências/diagnósticos de composição e apresentar seus próprios W, S, árvore, run IDs e terminais. A execução A pendente não pode ser presumida verde. A Review precisa da comprovação da configuração efetiva descrita acima. R1/R3 devem fechar seus respectivos achados sobre o candidato exato.

C07 nativo governado e o epic global permanecem não executados/bloqueados, conforme o plano do bundle completo. Nenhum dos resultados desta revisão autoriza fabricar esses aceites, alterar o freeze ou substituir os três revisores por autorrevisão.

O detalhamento estruturado encontra-se em `review-W18.json`, acompanhado de `source-inventory-W18.json`, `intake-audit-W18.json`, `remote-observation-W18.json` e `observed-ci-W18.json`.
