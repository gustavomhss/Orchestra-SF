# T2-F01 — separar os ports empresariais do scanner nativo sem ampliar o guard

**Estado: planejamento corrigido e integrado; rechecagem independente pendente. Produto, geração de bundles e testes de runtime: NOT_RUN.**

O contraexemplo T2-F01 é procedente. Acrescentar o scanner ao novo `business-memory-ports.js` copiaria um import de `node:child_process` para um site que não está no allowlist. A correção mantém a implementação canônica do scanner no bundle `native-memory.js`, já admitido, e torna explícita a dependência entre os dois subpaths. Não altera guard, allowlist, algoritmo, identidade, acesso empresarial ou engine.

O delta separado usa JSON Patch RFC 6902 com operações `test` antes de cada alteração. Os índices são acompanhados de IDs de entidade e precondições dos valores atuais. Deve ser aplicado ao `campaign.json` somente após conferir as precondições; alterações concorrentes de outros deltas precisam ser preservadas. O arquivo candidato não foi editado.

## 1. O que as fontes demonstram

O guard examina imports, exports-from, import dinâmico e require de módulos que criam subprocessos. Um novo site não listado falha; entradas antigas sem uso também falham. A baseline lista `scanner.ts` e `generated/native-memory.js`, mas não o novo bundle empresarial. O comando real do repositório é **`bun run check:spawn-imports`**.

A entry `native-bound.ts` é composta por reexports. Sua API de memória mantém owner e root impostos por um `AtlasBinding` imutável. Acrescentar reexports dos scanners existentes não muda essa composição: scanner recebe um registro e uma especificação de binário; não abre o store nem escolhe o owner/root da memória. A entry continuará sem exportar `createMemoryRead`, `createMemoryEmit` ou `createDurableMemory`.

Há uma aresta transitiva que impede declarar a nova entry puramente isolada apenas retirando os exports do scanner: **`memory-emit.ts` importa `NO_SCANNER_NAME` de `./scanner.js` em runtime**. A mesma fonte do scanner importa `node:child_process`. Não é suficiente confiar que o bundler eliminará o import.

Os módulos examinados de Memory e Kernel usam funções puras e interfaces; os imports de `DurableMemory`, `MemoryRead`, tipos de contratos e retrieval nessas portas são type-only. O ramo de encoding usa os hashes canônicos. A aresta da constante é, portanto, tratada expressamente, e a ausência de imports proibidos no artefato produzido é um critério obrigatório de admissão — não uma prova já executada neste trabalho.

## 2. As duas superfícies públicas

| Subpath | Exportação planejada | Consumidor |
|---|---|---|
| `@orchestra/atlas-boundary/business-memory-ports` | Factories reais `createMemoryRead`/`createMemoryEmit`, validators, fold e tipos necessários | `business-context.ts`, `atlas-memory.ts`, `atlas-store.ts` |
| `@orchestra/atlas-boundary/native-memory` | Todos os exports bound existentes, mais reexports aditivos de `detectAvailableScanner`, `runScanner`, `KNOWN_SCANNERS`, `NO_SCANNER_NAME` e tipos `ScannerBinarySpec`/`ScanVerdict` | `atlas-scanner.ts`; constante usada pelo factory empresarial |

A business entry usa exports nomeados dos arquivos concretos; não importa o barrel inteiro de adapter-io. Os tipos de store usam `export type`, sem trazer a implementação de armazenamento em disco. Nenhuma função de scanner é exportada pela business entry.

A mudança de `native-bound.ts` é limitada a:

```ts
export {
  detectAvailableScanner,
  runScanner,
  KNOWN_SCANNERS,
  NO_SCANNER_NAME,
} from "./scanner.js"
export type { ScannerBinarySpec, ScanVerdict } from "./scanner.js"
```

Os exports anteriores permanecem. `createNativeMemory`, `scanner.ts`, `memory-emit.ts` e os algoritmos de memória não são editados.

SF continua fixando o binário, path, versão e limites confiáveis no host. O modelo não envia comandos, argumentos, paths executáveis ou timeouts. O adaptador mantém os três estados reais: `clean` admite, `hit` bloqueia e `could-not-run` sinaliza indisponibilidade. Essa correção não enfraquece o scanner para facilitar o empacotamento.

## 3. A resolução exata no gerador

O descritor de build de `business-memory-ports` acrescenta uma regra de resolução com **três condições simultâneas**:

1. O artefato em geração é `business-memory-ports`.
2. O importer, resolvido para path absoluto e normalizado, é exatamente `modules/atlas/packages/adapter-io/src/memory-emit.ts`.
3. O specifier literal é exatamente `./scanner.js`.

Somente nesse caso o resolver retorna o módulo público `@orchestra/atlas-boundary/native-memory` com `external: true`. É uma ligação a uma dependência instalada e versionada do mesmo pacote. A constante é reexportada da fonte canônica; não existe literal copiado, shim, scanner substituto ou código reescrito no artefato gerado.

A regra não é um alias global de scanner. Os demais descritores e todas as outras arestas conservam a resolução canônica original. Em particular, o build de `native-memory` continua incorporando o scanner real em seu site já admitido. A nova ligação usa um import literal nomeado, verificável pelo parser, sem require computado ou import construído em runtime.

A regra precisa detectar mudança ou ausência da aresta esperada e interromper a geração. Ela não pode “achar algo parecido” e reencaminhar outro módulo. A resolução do path da business entry continua usando seu path real dentro de `boundary/src`, sem inventar um path correspondente em `packages/`.

A geração continua produzindo um JS e um d.ts por descritor, com o mesmo plugin canônico, minificação determinística e `dts-bundle-generator`. Os quatro artefatos afetados são:

- `business-memory-ports.js` e `business-memory-ports.d.ts`;
- `native-memory.js` e `native-memory.d.ts`.

Nenhum arquivo gerado recebe edição manual ou pós-processamento textual para esconder imports.

## 4. Admissão estática e evidência

O próprio build, seguido do teste já previsto `business-memory-ports.test.ts`, verifica o artefato com AST. O plano usa o parser TypeScript e a mesma função `hits(file, source)` que o guard de spawn importa de `@orchestra/script/spawn-imports`. As duas dependências de desenvolvimento são declaradas diretamente no package da boundary: `typescript: catalog:` e `@orchestra/script: workspace:*`. A atualização do lock fica com o writer existente S0/T01; não cria uma décima exceção de arquivo Atlas.

O resultado precisa provar:

- Nenhum import, export-from, require ou import dinâmico de módulo de spawn no bundle empresarial.
- Nenhum import computado, construção dinâmica de dependência, eval ou `Function` usado para esconder esse caminho.
- A constante de `memory-emit` vem do import literal do subpath nativo.
- Nenhum corpo de função de scanner nem export de scanner em runtime no bundle empresarial.
- Todos os exports bound anteriores permanecem na native entry; somente os exports aditivos declarados são acrescentados.
- A native entry não exporta factories de memória sem binding.

Além dessa admissão, o handoff exige geração, `check:generated`, typecheck e **o guard real da raiz na árvore candidata após geração**. O gate `CHECK-SPAWNS` registra SHA do candidato, comando, status, digests do guard/allowlist, quatro digests gerados e saída da execução.

O guard e o allowlist permanecem byte a byte inalterados por essa implementação. A correção não se apoia em esconder um processo: o consumidor chama a implementação canônica já existente por um subpath público explícito, mantendo o site de subprocesso já autorizado.

As contraprovas incluem reexportar o scanner na business entry, remover a regra external exata, usar import computado, copiar a constante, alterar a allowlist para obter verde e exportar um factory bruto pela native entry. Cada uma impede aceite. Esses testes permanecem **NOT_RUN** até a implementação.

## 5. Ownership e handoff

Os nove caminhos Atlas são exclusivamente de **WP10.T07 / S0-A**:

| Situação | Path |
|---|---|
| Existente | `modules/atlas/boundary/package.json` |
| Existente | `modules/atlas/boundary/script/build.ts` |
| Novo | `modules/atlas/boundary/src/business-memory-entry.ts` |
| Novo, gerado | `modules/atlas/boundary/src/generated/business-memory-ports.js` |
| Novo, gerado | `modules/atlas/boundary/src/generated/business-memory-ports.d.ts` |
| Novo | `modules/atlas/boundary/test/business-memory-ports.test.ts` |
| Existente, reexports apenas | `modules/atlas/packages/adapter-io/src/native-bound.ts` |
| Existente, regenerado | `modules/atlas/boundary/src/generated/native-memory.js` |
| Existente, regenerado | `modules/atlas/boundary/src/generated/native-memory.d.ts` |

O delta atualiza os dois inventários canônicos de ownership, as exceções exatas, a alocação técnica e a fronteira do actor. Corrige também as omissões de `product/host-binding/atlas-scanner.ts` e `product/host-binding/capabilities.ts` na reserva de S0-A.

O handoff **ATLAS-PACKAGE/T20** passa a entregar os dois subpaths resolvidos, quatro artefatos gerados e receipts de AST/guard. A janela existente não é ampliada e o trabalho continua dentro da tranche de empacotamento. Se a prova não estiver disponível, o handoff fica HOLD; um catálogo ou import em stub não o substitui.

AM05 conserva todas as provas de scanner, persistência, concorrência, revogação e reinício. Recebe, adicionalmente, as provas da origem e do empacotamento desses componentes. C17 e as cinco famílias de axiomas de WP10.T07/WP10 recebem critérios explícitos; os grants de operações permanecem intactos.

## 6. Validação realizada nesta correção

Somente a estrutura do delta foi executada: precondições JSON Patch, nove paths únicos, ownership S0-A, cinco famílias, unicidade dos checks/axiomas e ausência de scanner nos exports da business entry. As fontes foram lidas pelo GitHub MCP na baseline `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.

Não foram gerados bundles nem executados testes de produto. Não se afirma que o candidato futuro já passou no guard. A validação desse fato fica explicitamente exigida no mesmo SHA que for entregue para implementação.

## Fontes primárias

As referências completas e seus fatos estão em `source_evidence` do delta. A base técnica central é:

- [Guard de spawn](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/check-spawn-imports.ts) e [allowlist existente](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/spawn-allowlist.json).
- [Entry bound](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/native-bound.ts), [composição nativa](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/native-memory.ts) e [scanner canônico](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/scanner.ts).
- [Factory de escrita e aresta da constante](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-emit.ts) e [factory de leitura](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-read.ts).
- [Gerador canônico](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/script/build.ts), [exports e scripts da boundary](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/package.json) e [comando real na raiz](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/package.json).
