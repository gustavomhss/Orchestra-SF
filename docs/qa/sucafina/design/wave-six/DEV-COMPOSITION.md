# Composição do sexto lote com `dev`

## Fontes e preservação

A implementação começou em `a5eee3584da531d087a419b8f3ef29d3881117c7`. O [PR #710](https://github.com/gustavomhss/Orchestra-SF/pull/710) entrou em `dev` por `65349c1c723a8c626135d5b8032b929f5c635193`.

A composição `760ddd364a4ea2bbf3e0be0ec00d7d4545d1f400` tem dois pais: `7749f7dd16f063b1d6f603887dc038b77c3a1496` e `65349c1c723a8c626135d5b8032b929f5c635193`. Dos 265 paths daquele avanço, 239 eram exclusivos do upstream, quatro arquivos Core compartilhados já tinham blobs idênticos e 22 arquivos exigiram resolução ou confirmação de superset.

A API Git confirmou que o diff do pai upstream para essa composição não altera nenhum dos 239 paths exclusivos. Os quatro arquivos Core iguais não constituem alteração deste PR contra o `dev` composto. O [registro estruturado](DEV-COMPOSITION.json) conserva as listas completas.

O [PR #714](https://github.com/gustavomhss/Orchestra-SF/pull/714) acrescentou três documentos de go-live. Foram incorporados pelos blobs exatos em `c51de8614a756b673f1944084978d1117e731022`, com `27f04c1cc723e42d5010b8f672a640b4792787ff` como segundo pai. Produto, workflows e parâmetros de produção não mudaram nessa incorporação.

## Resoluções em comum

| Arquivo | Frente revisora |
| --- | --- |
| `packages/app-shell/e2e/sucafina/design-support/installation.ts` | Contexto e fixture |
| `packages/app-shell/e2e/sucafina/design-support/native-host.ts` | Contexto e fixture |
| `packages/app-shell/e2e/sucafina/operations-support/documents.ts` | Registros |
| `packages/app-shell/e2e/sucafina/operations-support/imports.ts` | Registros |
| `packages/app-shell/e2e/sucafina/operations.spec.ts` | Registros |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-context.ts` | Contexto e fixture |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-u23.ts` | Registros |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-u24.ts` | Registros |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-u28.ts` | Memória e contexto |
| `packages/app-shell/src/orchestra/chapters/sucafina/context/context.css` | Memória e contexto |
| `packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx` | Memória e contexto |
| `packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx` | Registros |
| `packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx` | Registros |
| `packages/app-shell/src/orchestra/chapters/sucafina/local-administration/administration.css` | Memória e contexto |
| `packages/app-shell/src/orchestra/chapters/sucafina/local-administration/index.tsx` | Memória e contexto |
| `packages/app-shell/src/orchestra/chapters/sucafina/local-administration/summary-settings.tsx` | Memória e contexto |
| `packages/app-shell/src/orchestra/chapters/sucafina/memory/index.tsx` | Memória e contexto |
| `packages/app-shell/src/orchestra/chapters/sucafina/memory/similar-cases.tsx` | Memória e contexto |
| `packages/app-shell/src/orchestra/chapters/sucafina/routines/catalog/index.tsx` | Rotinas |
| `packages/app-shell/src/orchestra/chapters/sucafina/routines/residents/index.tsx` | Rotinas |
| `packages/app-shell/src/orchestra/chapters/sucafina/routines/runs/index.tsx` | Rotinas |
| `packages/app-shell/src/orchestra/chapters/sucafina/routines/schedules/index.tsx` | Rotinas |

- Contexto e fixture preservam workspace privado, diagnóstico de descoberta, notas de fonte e o passthrough restrito do scanner já usado na lane original. As mensagens de contexto preservam a confirmação de descarte de Teams e acrescentam a indisponibilidade específica deste lote.
- Registros preservam o desenho e as divulgações de UI55/UI56, callbacks de captura e asserts originais. O módulo visual de workflows só carrega no opt-in original, evitando hooks de outra suíte. O modo opcional de 420s não é ativado por estas jornadas.
- Memória e administração preservam os ajustes do upstream e o layout local de 1160px, sem reaplicar a restrição global de 760px. O campo de pergunta mantém o foco nativo.
- Rotinas preservam os imports das regras comuns antes dos estilos locais e os DTOs fechados. A revisão posterior retira a prontidão indevida do catálogo e mantém a origem privada e a época de configuração originais.

Nenhuma branch de outra frente recebeu escrita. A frente UI42–UI56 do [PR #613](https://github.com/gustavomhss/Orchestra-SF/pull/613) permanece independente.

## Paridade de fonte e snapshots

Checkpoint anterior a #715: `cb924bd6cda9bb1fd2ac304618d3a8760b80d94e`. Os SHAs históricos abaixo foram consultados na API Git; a composição posterior aparece em seguida:

| Parte | SHA |
| --- | --- |
| CLI fonte | `00d7f39405ffaf63925f80af355af5267f82d89a` |
| CLI testes nativos | `04ba93588dedf41adfd8444b051e6cd13976f183` |
| App-shell fonte | `a528dc314d367bbfa6ac414c90c683567fd81d66` |
| Core | `2fa2ba3b0cb0346c2b934ca0cdf3081db86fc176` |
| Schemas | `65ad5f67d9a5f35054f77e78bd475f8c584167ae` |
| Cliente final | `0326f30a3a2c6d1437c75508f0ad6ce540f1fd5c` |
| Registro de rotas original | `6e1e711e2ff3a95e460026053cb91772693da572` |

O snapshot Native69 tem os mesmos subtrees de fonte e testes CLI. A redução das leituras comuns de memória entrou antes dessa execução. App-shell, Core e schemas também são idênticos entre o candidato e a fonte de Rotinas R18.

| Lane | Fonte | Snapshot | Acréscimos ao pai |
| --- | --- | --- | --- |
| Técnica Gate16 | `cb924bd6cda9bb1fd2ac304618d3a8760b80d94e` | `a42eb2adf1e8447c865feba3ea3d30227d9266ac` | `.ci-run.json` e wrapper descartável |
| Rotinas R18 | `fd46215487c40f2fb50cd0b4057333cbece307ec` | `15e29d2f1aa89ee0e289585b8b1957c79db3c1d7` | Somente `.ci-run.json` |
| Registros R14 | `3311ce94e3d1c7e9de0a09a6d6c60868c440489c` | `0076fde9ce0349949ff7214fc72bed892c9fb4c6` | Somente `.ci-run.json` |
| Memória R11 | `cb924bd6cda9bb1fd2ac304618d3a8760b80d94e` | `257717aa632d7f029ec27b4d3cb8b9a603bad0a6` | Somente `.ci-run.json` |

Paridade não antecipa aprovação de execução. A [validação](VALIDATION.md) contém os resultados efetivos, inclusive tentativas que falharam.

### Mudança isolada do cliente

Depois das fontes de Registros/Rotinas, o cliente recebeu duas linhas que preservam o input ausente somente após o schema original admiti-lo. Portanto a árvore completa do cliente não é byte-idêntica a essas lanes.

Registros usa os codecs dedicados de Files e um DTO definido de contexto. Rotinas usa DTOs definidos de contexto, residentes e casos, com respostas JSON. Esses ramos, os schemas, o transporte e o registro de rotas não mudaram. A nova ramificação do catálogo é exercitada em Memória R11; a validação do cliente no Gate16 passou seis novos testes e seis testes existentes de Files.

O observador E2E encaminha cada pedido original uma vez, sem retry/redirect, conserva o corpo original do APIResponse e entrega a resposta integral ao navegador. A mudança evita a perda do corpo no cache transitório do Chromium. Os prazos de 40s por leitura e 10s de DOM permanecem, com registro e limpeza aguardados.

## Checagem técnica

[Gate16 — 45117046888](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45117046888), job `137502149296`, passou nove checks: tipos app-shell, guards, paridade das paletas, tipos E2E, tipos Core, regressões de filesystem/processo, tipos CLI, tipos cliente e regressões dos codecs.

Os guards originais usam exatamente `dev 27f04c1cc723e42d5010b8f672a640b4792787ff`: 78 regras, 71 paths, zero erros e zero exceções aprovadas. Os dez avisos referem-se a declarações de prazo; nenhum prazo foi aumentado para contornar falha. As sete paletas mantêm seus bytes. As regressões existentes passaram 11 testes, com um skip preexistente. Os codecs passaram 12 testes e 243 asserts.

[Native69 — 45112013210](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45112013210), job `137486273104`, passou 69 testes e 887 asserts. O contador `readOperations:4` significa quatro IDs declarados disponíveis; não significa quatro históricos exercitados. O GET original de residentes e negativas originais foram exercitados. Catálogo, Schedule, C07 e saída C08 não recebem uma afirmação positiva por esse contador.

## Integração posterior de dev — PR #715

O merge `722b703b060e5cc578fa8d23568b3f9c56d72077` tem os pais `6c7d51e3288ca40141fd6042e24e70d42aff547c` e `5b48dab52621037168ad4e3a6243c79a4fe5ad6e`. Os 24 arquivos do avanço foram reconciliados: 23 blobs foram copiados exatamente do upstream e uma regra de espaçamento de Administração local foi incorporada junto dos estilos deste lote. A verificação da composição `d463d6f84f840d8e7bae69f77b9007c96031e744` contra o novo `dev` confirma os 23 arquivos sem diferença.

O único cruzamento de produto é `local-administration/administration.css`: a regra original organiza os filhos diretos de `.sf-u28-summaries > .sf-state-panel > .sf-state-content` com grid, espaçamento local e largura mínima zero. O restante do estilo, os controles e a semântica `hidden` foram preservados. A conferência focal UI69 usa o corpo e os oráculos originais, selecionados por arquivo em um snapshot descartável; o resultado efetivo consta da matriz final.

As mudanças em `SfRecordDetail`, `SfTable` e seletores de outros capítulos não são dependências das folhas deste lote, conforme revisão de imports, seletores e estilos compartilhados. Não houve alteração de backend, cliente, schemas, registro de rotas, transporte, frame, estados, tokens ou paleta nesse avanço. A árvore agregada de app-shell mudou pelo upstream; não é apresentada como byte-idêntica à execução R18. A evidência anterior é reaproveitada somente nos caminhos cuja dependência permaneceu intacta.

Na conferência após #715 e antes de #716, dos 239 arquivos originalmente exclusivos de #710, 238 continuavam sem diferença. O guia nativo recebeu uma inserção final de 7.218 caracteres antes da seção Planner; a comparação confirma que seus 11.731 caracteres originais permanecem intactos e na mesma ordem. Isso é uma atualização documental intencional posterior, separada da preservação byte a byte comprovada no merge de #710.

## Integração posterior de dev — PR #716

O merge `8b8a9eb153374031d88315195b4af2b1a25eae19`, árvore `80d9d21f2779c1888efa09e927c408a9aed03763`, tem os pais `00543f1afdfb50b72fb287c183ded32968db2ba0` e `b71ecbcc644ee3363ccd1ce0e149c08c80e6130e`. A comparação dos 137 paths próprios com os 22 paths desse avanço encontrou zero sobreposição. Todos os 22 blobs foram copiados exatamente do upstream. Dos 23 blobs exclusivos de #715, 21 permanecem idênticos; `chapter-providers.spec.ts` e `orchestra/DESIGN.md` avançam legitimamente para os blobs de #716. A regra combinada de Administração local permanece uma única vez.

O avanço modifica Settings, o diálogo de providers, o tratamento de cancelamento de uma leitura de providers substituída, apresentações de Decisions e o espaço reservado à seta dos selects do Planner. As cinco paletas geradas mudam apenas o foco dos radios de permissão de Settings. Não muda produtores SF, grants, schemas, rotas, cliente, Core ou CLI. A composição executa novamente os checks afetados de tipos app-shell, guards contra o novo dev, geração/paridade de paletas e tipos E2E; o resultado primário está na matriz central.

A revisão de dependências não encontrou mudanças nos quatro ramos de Rotinas exercitados em R18. Os novos seletores não aparecem nessas folhas. Registros conserva suas folhas, dicionários, spec, `operations-support/` e os seis helpers compartilhados exatos a R15. A precondição CAP23 recebe somente padding lógico de 32px para a seta nativa; markup, opções, handlers, produtores, payloads e CAS não mudam. A leitura de providers preserva as falhas comuns e trata somente o cancelamento real da consulta substituída. Essas são conclusões de revisão de fonte; não são novas execuções das jornadas.

## Candidato final e fronteiras de paridade

Candidato de código: `8b8a9eb153374031d88315195b4af2b1a25eae19`. Os SHAs foram consultados na API Git após a composição #716:

| Parte | SHA |
| --- | --- |
| App-shell fonte | `80a1992c0c89e68550e2a88273554f358506298f` |
| App-shell E2E | `d0f1211921434c7dbe24994ec6739e566298a09e` |
| Sucafina nativa | `6e3bb88d38e9246d7acb368e2a55af51622c2b9f` |
| CLI fonte | `00d7f39405ffaf63925f80af355af5267f82d89a` |
| CLI testes | `04ba93588dedf41adfd8444b051e6cd13976f183` |
| Core | `2fa2ba3b0cb0346c2b934ca0cdf3081db86fc176` |
| Schemas | `65ad5f67d9a5f35054f77e78bd475f8c584167ae` |
| Cliente fonte | `6d4a0891c055c4944c43b3cf66483944c4c691ae` |
| Cliente testes | `c42361fb7ecec4a09cdf4bf3277643e7d9ad9e96` |
| Registro de rotas | `6e1e711e2ff3a95e460026053cb91772693da572` |

CLI fonte/testes continuam exatos ao Native69. Core, schema e os ramos do cliente continuam qualificados pelo Gate17. Não se afirma igualdade da árvore agregada do app-shell entre jornadas de datas diferentes: a revisão identifica as folhas e dependências preservadas, e cada imagem conserva seu próprio source.

Depois de #715, UI61 recebeu cancelamento local de materialidade, bloqueio de clique duplicado, fences de identidade e três pares de copy. UI62 recebeu uma mensagem específica somente após a recusa original fechada `similarity-source-unavailable`, preservando pergunta e candidatos e limpando o aviso ao mudar critérios. A resposta de sucesso, DTOs e autorizações permanecem intactos. As 114 expectativas do spec positivo de Memória continuam preservadas; seu resultado positivo não é qualificado por um teste de recusa.

## Execuções finais e preservação dos oráculos

| Lane | Fonte de código | Snapshot |
| --- | --- | --- |
| Gate17 completo | `d62c4b500695d248240a48944461a0d2262a589f` | `f76d89f2b6b4791034da108c5a6f80840da2e11e` |
| Gate18, observação POST | `6a9f4e9768019ceb3a7924523885a9c3ebc51fb7` | `9e4a5a13f80b25f260eb2f0e61447de016966dd5` |
| Gate19, UI62 final | `c59e406da0585a5b78f04e0689ba73ef48a3e9fe` | `ffd074c142b144ed1555bdde0bcbd06865893455` |
| Gate20, composição #716 | `8b8a9eb153374031d88315195b4af2b1a25eae19` | `f8091e294ba66a5fa3c190eb8a422aafe583b88f` |
| Registros R15 | `d5f620aeee7a9db0e83d195ffada03c703f3a59d` | `f312587515353b15f59c5c362678d3090e167677` |
| UI69 após #715 | `722b703b060e5cc578fa8d23568b3f9c56d72077` | `4d1aa02cca18a6116933c9a23acf50767fba6271` |
| UI61 cancelamento R15 | `d62c4b500695d248240a48944461a0d2262a589f` | `b0931669e80589776a6ce8a1e63b8957a5e2d280` |
| UI62 recusa R17 | `c59e406da0585a5b78f04e0689ba73ef48a3e9fe` | `1fd0a8010947a0e86be5dc2d83e1dda8abe2884e` |

Gate17 passou nove checks, incluindo 12 testes de codecs/243 asserts, 11 regressões existentes/37 asserts e um skip preexistente. Gate18 passou os dois checks afetados após o observador POST. Gate19 passou os três checks afetados após os dois arquivos de produto UI62 e seu spec negativo: tipos app-shell, guards e tipos E2E. Os resultados e contadores de todos os gates constam de [technical.json](technical.json); a [matriz final](VALIDATION.md) registra Gate20 com quatro checks aprovados contra o dev de #716 e R17 com a jornada EN/pt-BR aprovada. Gate20 manteve as sete saídas geradas sem diferença; 78 regras examinaram 140 paths, com zero erros/exceções e 15 avisos de declaração de prazo.

Registros R15 passou as quatro jornadas, incluindo as precondições CAP23/CAP27 que usam os componentes S01 alterados por #715. Administração local passou sua jornada original depois de #715. O wrapper desse focal só seleciona por arquivo o corpo original byte-idêntico; a tentativa anterior com `--grep` foi recusada pelo validador antes de qualquer teste e não é uma falha funcional da tela.

As duas jornadas UI61 de cancelamento passaram com um GET nativo por consulta, `net::ERR_ABORTED`, condições preservadas e zero reenvio automático. Elas não qualificam resultado positivo de materialidade/sinais, parada remota, rollback nem chegada tardia de corpo. O R16 qualificou a observação da recusa original 503; o positivo continuou falhando em seu requisito 200 e na expectativa de console. O spec negativo R17 passou em EN/pt-BR, é separado, preserva o original e verifica explicitamente a resposta fechada, a retenção dos critérios e a ausência de falso vazio. Houve um POST e um erro de console503 da URL exata por locale, sem erro inesperado ou erro de página.

Snapshots de CI conservam apenas o pedido original e, quando necessário, wrappers descartáveis. Nenhum `.ci-run.json`, wrapper técnico, permissão nova, alteração de workflow/Azure ou allowlist entra no produto. Os arquivos de teste permanentes preservam os prazos originais e não criam respostas de sucesso.

## Revisão e integração

A revisão compartilhada cobriu admissões independentes, revogação, identidade depois da limpeza, origem privada, época de configuração, cópia EN/pt-BR e conservação dos corpos originais. As revisões visuais e seus enquadramentos estão na [galeria](evidence/README.md).

A autorização da sessão abrange o merge em `dev`. O [PR #713](https://github.com/gustavomhss/Orchestra-SF/pull/713) é a autoridade sobre o estado efetivo e o SHA do merge. Documentação e evidências posteriores ao candidato de código não são apresentadas como novas alterações de runtime.
