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

Candidato de código: `cb924bd6cda9bb1fd2ac304618d3a8760b80d94e`. Os SHAs abaixo foram consultados na API Git:

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

## Revisão e integração

A revisão compartilhada cobriu admissões independentes, revogação, identidade depois da limpeza, origem privada, época de configuração e conservação dos corpos originais. As revisões visuais e seus enquadramentos estão na [galeria](evidence/README.md).

A autorização da sessão abrange o merge em `dev`. O [PR #713](https://github.com/gustavomhss/Orchestra-SF/pull/713) é a fonte de autoridade sobre o estado efetivo e o SHA do merge. Documentação e evidências posteriores ao candidato de código não são apresentadas como novas alterações de runtime.
