# W13 — fechamento estático de ReviewHost e SfStateResult

## Estado e limite da revisão

Esta é uma revisão estática dos 11 locais estrangeiros únicos reportados pelo run **43590727281**, job **132434661801**, para o head **4bd1f807e449d040e3db61c4d2b1e177b205ac69**, tree **2459923b94c080688a31a1138e73ddf30c5be744**. O recibo congelado é `analysis/static-43590727281.receipt.json`: 20 diagnósticos em dois packages, 13 locais únicos, dos quais dois são OWN e estão sob correção separada de WP01. Não foram executados produto, typecheck, guards, polling ou novo dispatch nesta revisão.

Os heads reconciliados por GitHub MCP continuam:

| Owner | PR | Head publicado |
|---|---|---|
| Compose | 32 | `ed10a3806a4ffdf6ad5891e2065d93a4c91412cf` |
| Collaboration | 33 | `2784daafbb0d3b58b6019822288a07fa38e5c5b0` |
| Operations | 34 | `ba8a09e371ce8d93eb917eabb102caaee5affaf4` |

**Conclusão:** dois dos 11 locais têm reparos publicados consumíveis: `dashboard-services.ts` de Compose e `documents/capabilities.ts` de Operations. O segundo também contém melhorias de extração/busca, mas seus imports e interfaces externas permanecem compatíveis com os inputs retidos. A proposta pequena no contrato resolve a representação que causou os seis erros originais de estreitamento; depois do intake Operations, restam cinco callers do host abrangidos por ela. Os quatro callers do teste WP07 precisam de reconciliação preservando a fixture retida. Não substituir o teste atual por uma versão que introduza permissões irrestritas somente para remover TS2739.

Correção explícita do diagnóstico inicial comunicado ao root: os campos faltam no caller **local W13**; o blob Dashboard **publicado ed10 já os contém**. Não há necessidade de patch autoral desse caller. O patch exploratório Dashboard foi retirado do pacote de propostas.

## 1. ReviewHost: produção Dashboard já publicada

O `ReviewHost` consumido no W13 é `product/reviews/port.ts`, blob **62db836fd93e349f19d007e1933396420a3540ff**, publicado por Collaboration2784. Ele exige:

- `creationTarget: { ref; incarnation }`;
- `authorizeOutcomeComparison`;
- `authorizeOutcome`;
- `authorizeDecision`.

O caller W13 `apps/cli/src/sucafina-product/dashboard-services.ts`, blob **24c76c54e314c0c0579bf4beaaca8f492a7038b5**, não fornece esses campos na linha 90.

**Reparo publicado consumível:** o mesmo arquivo no head Compose ed10 é o blob **0891d178833165fff098e3c05f3a64c5f5b35043**. Seu diff em relação ao W13 adiciona exatamente o `creationTarget` já obtido de `input.authority` e os três callbacks `values.length === 0`, além de uma linha vazia final. Não muda imports, estado, seleção, persistência ou assertions. Não cria nova identidade, não instala grant e não admite um outcome ou decision não vazio. A seleção Dashboard atualmente produz projeções de agenda, e a autorização real de seções, evidências e fontes continua executada pelos callbacks existentes do host.

Fonte: [dashboard-services.ts em Compose ed10](https://github.com/gustavomhss/Orchestra-SF/blob/ed10a3806a4ffdf6ad5891e2065d93a4c91412cf/apps/cli/src/sucafina-product/dashboard-services.ts).

Snapshot exato para intake:

- `reference/w13-static-published/compose/apps/cli/src/sucafina-product/dashboard-services.ts`;
- 29.221 bytes;
- SHA256 **7a44e3ebca4ecc31bca3e4842c09f2e31fff0bb24523d869fbcc7e1125e40611**.

Este intake é solução de compatibilidade de composição. **Não fecha o finding C05 de WholeReview:** não troca a validação das fontes atuais pela prova de continuidade física, ACL atual e conteúdo histórico capturado. O 403 positivo preservado de C05 continua evidência distinta.

## 2. ReviewHost: quatro fixtures WP07 retidas

Os quatro locais são `test/product/wp07/review-port.test.ts`:40,45,56,221, blob W13 **0b10585a9ea34b26a132816a4e56670ac5de23a8**. O teste retido contém 11 títulos e 82 linhas de assertions; seu primeiro caso usa a persistência SQLite real aberta por `openLocalStore`.

Há callers atualizados publicados:

| Pin | Blob de review-port.test.ts | Resultado da inspeção |
|---|---|---|
| Compose ed10 | `77ef3a9e1a289953999abc976557257849bb9237` | Fornece os campos novos; altera a composição das fixtures e amplia a suite |
| Collaboration2784 | `b55cc4830c32df7ac19ab966105f21171d1628db` | Fornece os campos novos; amplia provas de decisão e snapshot |

Esses arquivos têm 14 testes e 141 linhas de assertions. Não se afirma remoção geral de provas: 80 das 82 linhas retidas permanecem textualmente, duas igualdades de bytes mudam o operando de `artifacts[0]` para `documentArtifact.bytes`, e existe uma nova prova explícita de restart SQLite. Contudo, o primeiro caso retido é refeito sobre `testPersistence` e existem **15 callbacks novos** de outcome/comparison/decision com `async () => true`. Esse não é o intake mínimo aceitável para corrigir os quatro erros locais sob as restrições de preservação desta sessão.

Foi preparado **somente como artefato para os owners**, sem aplicar, `analysis/w13-retained-review-fixtures.owner-only.patch`:

- Preimagem: o blob W13 **0b10585a9ea34b26a132816a4e56670ac5de23a8**, e não a suite atual do owner.
- Adiciona apenas os quatro conjuntos de campos obrigatórios.
- A fixture principal admite os novos tipos somente quando a coleção está vazia e `access.allowed` continua válido.
- As fixtures de seção negada e comparação pareada admitem somente coleções vazias; o caso de binding forjado nega os três callbacks.
- Mantém as 82 linhas de assertions, os 11 títulos e o restante da fixture SQLite integralmente.
- Não amplia autorização para decision/outcome e não pretende provar esses novos domínios.

O owner deve incorporar esse ajuste preservando também suas provas publicadas mais recentes. **Não aplicar o patch como substituição cega da suite b55cc/77ef.** O artefato demonstra a alteração mínima necessária à fixture retida; a publicação reconciliada deve ser feita por Collaboration/Compose. Nenhuma supressão de tipo ou cast novo é proposto.

Fontes: [teste em Collaboration2784](https://github.com/gustavomhss/Orchestra-SF/blob/2784daafbb0d3b58b6019822288a07fa38e5c5b0/modules/sucafina/Sucafinav1/test/product/wp07/review-port.test.ts), [contrato ReviewHost no mesmo pin](https://github.com/gustavomhss/Orchestra-SF/blob/2784daafbb0d3b58b6019822288a07fa38e5c5b0/modules/sucafina/Sucafinav1/product/reviews/port.ts).

## 3. SfStateResult: seis erros do discriminante combinado

O contrato `product/contracts/state.ts`, blob **755639b2a16265fe164ba2e6343738c1362d168c**, é idêntico em Compose ed10 e Collaboration2784. Ele representa os retornos bem-sucedidos em um só membro:

```ts
| { status: "ok" | "preview"; storageVersion: number; aggregateRevision: number; incarnation: string; value: T }
```

O W13 tem cinco callers em `apps/cli/src/sucafina-product/host-context.ts` (blob **4aca959eaba4f30aa7ee4f89eb95030afc2fa02b**) e um em `product/documents/capabilities.ts` (blob **d2eb0f7c3532a56ce547429c66f5e6dd9af8e072**). Todos já tratam `preview` em runtime; o ramo negativo devolve o objeto de estado ou lê `reason`. Com o discriminante agrupado, TypeScript continua considerando o membro que contém `value: T` em retornos que precisam ser um `PortResult` de outro payload, ou no acesso a `reason`. Os diagnósticos executados demonstram essa incompatibilidade de representação. Não foi encontrado um defeito runtime adicional nesses seis locais por esta leitura.

A proposta **owner-only**, `analysis/w13-state-discriminant.owner-only.patch`, separa o mesmo conjunto de valores em dois membros:

```ts
| { status: "ok"; storageVersion: number; aggregateRevision: number; incarnation: string; value: T }
| { status: "preview"; storageVersion: number; aggregateRevision: number; incarnation: string; value: T }
```

É uma mudança exclusivamente de declaração de tipo. Preserva todas as namespaces, mapas, campos, `sourceFence: "all"`, `checkNamespaces`, `bi-artifacts` e as demais adições do blob755639. Não modifica providers, controles de acesso, operações ou payloads runtime. A previsão estática é que ela restaure o narrowing dos seis locais; **isso ainda não é resultado de typecheck executado**.

### Reparos publicados alternativos

- Operations ba8 publica `state.ts` blob **898a1c2117ba7a011c35dbbd92b586034fe72d6f** já com os dois membros separados. Seu arquivo completo tem 5.324 bytes, contra 9.143 do755639; substituí-lo perderia adições novas de contrato. Usar o padrão de discriminante, sem fazer downgrade do arquivo.
- Compose ed10 publica `host-context.ts` blob **834b3c967d73411771e1f5aa82b683c6427e6769**, que reconstrói os resultados com `"reason" in found` e objetos `{status, reason}` nos cinco pontos correspondentes. A incompatibilidade concreta do intake completo não é seu tamanho: na linha213 o novo host fornece `procurementEvidenceWrites`, `caseSelectionWrites`, `threadHistoryWrites`, `readQuestionContribution` e `documentEvidenceList` à factory BCS retida, que não declara esses inputs; também consome `business.baselineCoverage`, `bindForecastCoverage` e `bindDecisionDomain`, que não fazem parte do retorno BCS retido. Há29 imports diretos ausentes do W13. O fechamento exige o BCS4b02413 e o case-port67203 já registrados no inventário C12 held, com a pendência real de `verifyScenarioOperations` e preservação das provas WP11. Portanto não há closure fechada preservada para consumir esse host inteiro no W14. Os caminhos e imports estão no manifesto; não substituir o host só para contornar o discriminante.
- Operations ba8 publica `documents/capabilities.ts` blob **6b655187d4444cff5b8966e868ba163191adfc42**, que separa `"reason" in loaded` de `status !== "ok"`. Seu diff também implementa reuso idempotente de extração e revalidação final das fontes de busca (46 linhas adicionadas, seis removidas). A leitura de compatibilidade confirmou imports idênticos, tipos públicos inalterados e todas as funções/campos usados já presentes nos produtores retidos: `readDocumentEvidence`, `StoredDocumentEvidence.confirmationVersion`, `SfDocumentSnapshot.confirmationVersion`, `resolveSfDocumentEvidence` e `createSfDocumentEvidenceAdapter`. O novo helper é privado ao arquivo. Esse blob é consumível exato sem puxar host, BCS ou C12 held; não é uma alteração puramente tipada e requer a seleção cirúrgica de produto correspondente sob coordenação do root/CI. Não foi importado por este agente nem recebe prova executada antecipada.

Fontes: [state em Compose ed10](https://github.com/gustavomhss/Orchestra-SF/blob/ed10a3806a4ffdf6ad5891e2065d93a4c91412cf/modules/sucafina/Sucafinav1/product/contracts/state.ts), [state em Operations ba8](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/contracts/state.ts), [host-context em Compose ed10](https://github.com/gustavomhss/Orchestra-SF/blob/ed10a3806a4ffdf6ad5891e2065d93a4c91412cf/apps/cli/src/sucafina-product/host-context.ts), [documents/capabilities em Operations ba8](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/product/documents/capabilities.ts).

## 4. Próxima ação e contraprovas

1. Root pode consumir os blobs Dashboard **0891d178** e Documents **6b655187** exatos, registrando seus pins e SHA256. A closure direta preservada está em `analysis/w13-static-published-intake.manifest.json`; nenhuma edição foreign é necessária para esses dois callers.
2. Compose/Collaboration devem publicar a separação tipada do755639 e reconciliar os quatro callers WP07 sem perder a fixture retida nem suas provas novas. Os patches são propostas de owner; os inputs canônicos locais continuam exatos.
3. Depois de publicação e intake coordenados, o CI autorizado deve executar `bun typecheck` nos packages conforme CI.md e guards. Não marcar os 11 locais como corrigidos antes dessa evidência.
4. A validação de produto afetada deve preservar o fluxo real de captura/preserve, replay, leitura histórica e revogação, e negar decision/outcome não vazio no host Dashboard sem authorizer. A suite WP07 deve manter as provas SQLite, bytes completos de export e os negativos de seções, comentários e binding. Esta proposta não substitui gates nativos nem o epic final de S0.

C05 WholeReview, C12 reload, F04 continuidade de draft e a composição WorkSignals permanecem independentes destes reparos estáticos. Nenhum deles recebe crédito de produto por este relatório.
