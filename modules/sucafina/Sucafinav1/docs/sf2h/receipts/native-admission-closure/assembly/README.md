# Montagem64 — patch compartilhado para60

**Patch completo e inerte. O host compartilhado permanece byte a byte no preimage de `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85`.** Esta montagem instala o consumidor64 e o registry41; não cria a origem autenticada externa nem autoriza provider, Task ou Schedule por conta própria.

## Conteúdo e integridade

| Artefato | Git blob SHA-1 |
|---|---|
| `host-context.preimage.txt` | `b19c56fdd21fe829fd3bbbb3e377b6fbe0a5825b` |
| `host-context.postimage.txt` | `297a4050323d80648684725f9c7e9a8680aa318f` |
| `host-context.patch` | `30c639d37afc202f8f1bf7d15bd427e3bfca79ad` |

O manifesto inclui também SHA-256, tamanhos, catorze dependências e os hashes da fonte W64 `0846710321afab84e0c0a3a79653f41df8a284a0`. Os cinco hunks foram reconstruídos sobre o preimage e produziram exatamente o postimage. Essa conferência foi somente textual; não houve execução de produto, typecheck ou teste local. O arquivo real `apps/cli/src/sucafina-product/host-context.ts` não foi modificado.

## Alterações propostas

A factory pública `createSfHostRuntime(input)` continua com sua assinatura atual. A seam privada `createSfHostRuntimeWithRoutineNative` recebe agora o getter opcional:

```ts
nativeRoutineOrigin?: () => SfRoutineNativeAdmissionOrigin | undefined
```

O antigo argumento privado de owners não é reaproveitado como prova. Um produtor autorizado deve fornecer a origem opaca real definida pelo módulo64. O default chama a factory sem esse getter.

A montagem instancia `createSfRoutineNativeOwnerRegistry` com os recursos do runtime, a Request canônica retornada pela autoridade, sua revalidação e a geração de provider observada. Instancia `createSfRoutineNativeAdmission` com esse mesmo registry, a governança, a origem privada, autorização humana `routines.run` do payload exato, caso atual, leitores de fontes e publicação existentes. O adapter C07 existente passa a resolver owners exclusivamente pelo registry41.

`governance.ownerHook` aponta para admission64. O hook valida a origem e instala a lease forte antes do settlement original; a montagem não chama dispatcher, não cria Session e não responde Permission. As contribuições de governança/runtime são montadas no caminho normal e o produto recebe a dependência já suportada por `runtime.mount`.

O finalizer fecha admission64 e registry41 **antes** do primeiro await do shutdown. O fechamento posterior de runtime e governança segue o caminho original. `admission.dispose` já descarta o registry; a chamada explícita e idempotente a `registry.dispose` torna a revogação independente dessa delegação interna.

## Readiness continua delimitada

O callback de registro exige `routineAdmission.readiness() === "ready"` e conserva a checagem de disponibilidade do adapter, que depende de binding real no registry. **Sem origem no default, zero descriptors de rotina são anunciados.** `sf_watch_prepare` continua oculto.

Não há patch de `contribution.ts`: ele registra `Tool.dynamic` em escopo uma única vez, e a interface de origem atual não fornece uma subscription legítima de readiness que possa comandar um registro dinâmico completo. Mutar `business.descriptors` depois do registro não resolveria isso. Um getter que passa a retornar `ready:true` depois da inicialização também não instala ferramentas.

A origem externa e o integrador precisam fornecer readiness real antes da materialização do provider, registro/fechamento escopado via `Tools.register`, rejeição de materializações antigas após revogação e autorização de leitura/continuação distinta do witness de Task running. Esse trabalho não está representado como pronto neste patch.

## Intake e prova

A lease60 encerrou explicitamente em `faa30fddb7e7b61696b66fd069f51cf18c51125f`; as instruções abaixo destinam-se ao próximo intake autorizado nessa rota. Ver [TARGET-AUTHORITY.json](../TARGET-AUTHORITY.json). Este pacote não reativa um writer.

60 deve reconciliar o HEAD e o blob atuais do host. Se houver drift, deve transportar os cinco hunks para o host corrente, preservar as alterações posteriores e registrar novos pre/post hashes. O manifesto fixa as dependências do candidato64 lidas para produzir este patch; reconcilie seus hashes com a release explícita final antes de consumir.

Consuma seletivamente `routine-native-admission.ts`, a adição `tryBind` da governança, o delta de cancelamento de aquisição no registry41, os dois arquivos de testes64 e esta montagem. Preserve o restante dos componentes41 e da composição. Não copie a árvore da branch64.

Uma prova futura precisa cobrir a composição instalada com Request real, origem nativa/C15, provider e Task verdadeiros, revisão/aprovação/Permission quando exigidas, arm/Relay, artefato imutável, consumidor após reload e revogação/abort/expiração/fencing/idempotência. Os testes de componente do hook e a reconstrução deste patch não substituem isso. **AM02, AM06 e aceite nativo instalado permanecem não comprovados por esta montagem.**
