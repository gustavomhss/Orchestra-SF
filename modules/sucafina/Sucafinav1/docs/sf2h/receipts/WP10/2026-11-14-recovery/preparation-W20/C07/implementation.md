# C07 — provider instalado de publicação

## Entrega e identidade

Implementação própria sobre W19 `d357de0b1f58abc33e86e79ad3f93b8715ba0e83`, árvore `20d4e76e42a8b74daced57d64ad285f5dfef17a2`. A edição começou somente após a autorização explícita de root e o congelamento desse commit. O snapshot W19 e seus recibos permanecem imutáveis.

Quatro caminhos de produto/prova foram alterados:

1. Novo `apps/cli/src/sucafina-product/routine-installed-publication.ts`.
2. Guardas adicionais em `apps/cli/src/sucafina-product/routine-publication.ts`.
3. Instalação mínima em `apps/cli/src/sucafina-product/host-context.ts`.
4. Novo `modules/sucafina/Sucafinav1/test/product/wp10/native-host/routine-installed-publication.test.ts`.

Nenhum arquivo estrangeiro, helper C17/Review/BI, descriptor `sf_routine_*`, C07 native port, Task, aprovação, arm ou ledger foi modificado ou criado. O teste existente `routine-services.test.ts` foi preservado byte a byte.

## Composição implementada

O novo node global depende das instâncias públicas existentes de `LocationServiceMap` e `SessionStore`. Ele não registra um segundo coordenador de Session nem substitui serviços reservados. A abertura efetiva de Location/Relay/skills é lazy e deriva exclusivamente da identidade do host.

O provider confirma o projeto retornado por `Location.Service`, directory/workspace da Location e o root/arquivo de autoria de `Relay.Service`. O `AuthoringStore.open` público recebe esse root e o projeto autenticado. O callback de leitura recebe exclusivamente `get`, `version` e `documents`; funções de publicação, edição, execução e ledger não escapam. O scope público do store fecha a conexão após cada uso. A API de `open` mantém seu próprio esquema SQLite; “somente leitura” aqui descreve a capacidade exposta, não uma promessa de abrir SQLite com flags read-only que a API pública não oferece.

Cada uso cerca o await com aquisição da mesma Location, das mesmas instâncias Relay/SkillV2 e do mesmo digest de localização/root. A identity do host, o objeto do runtime e o provider corrente devem permanecer iguais. Finalização, troca de identidade ou substituição de provider tornam os objetos retidos indisponíveis. O wrapper existente também compara agora o digest de placement e a identidade do publication port, além de seu epoch.

Skills são lidas no `SkillV2.Service` da Location real. O provider exige nome correspondente, corpo não vazio, ausência de NUL, limite de dois MiB e duas observações idênticas de `SkillV2.Info`. O digest usa `RelayWorkflowBinding.digest` sobre os bytes UTF-8 efetivamente retornados pelo catálogo. A publicação materializada usa a verificação pública de `RelayWorkflowBinding.acquire/revalidate`; não há catálogo sintético ou digest fornecido pelo modelo. Alterações feitas pelo catálogo público invalidam a binding anterior.

Os controles `package-verification` e `cold-review` são imutáveis e fornecidos como `acceptance`. O código apenas os anexa à materialização via API pública. Não executa checks nem registra aprovação.

## Autorização e autoria

`RoutinePublicationHost.authorize` exige o Request real ainda retido pelo registry, o mesmo binding, instalação/projeto atuais e revalidação do host antes/depois da aquisição de Location. No contexto nativo também exige host e Location ligados ao binding. Os consumidores canônicos de `RoutinePublicationHost` mantêm sua autorização antes/depois de materializar ou listar a publicação. `PublicationPort` é uma capacidade interna sem parâmetro de Request no contrato público; ela não é entregue à UI ou a argumentos do modelo.

`authorSession` não cria ou infere sessão para UI. Em contexto nativo autorizado, usa exclusivamente `context.binding.nativeSessionId`, lê o `SessionStore` real e verifica ID, projeto, Location, perfil e ausência de archive. Reabre a sessão e compara sua identidade, mantendo Request, binding e autorização atuais. O retorno desse ID prova uma sessão real vinculada ao contexto; não prova que ela tenha autoria Archie, aprovação Task ou execução C07.

## Knowledge: recusa explícita e owner

O provider retorna `RelayWorkflowBinding.Held` com razão `SF_ROUTINE_KNOWLEDGE_PORT_UNAVAILABLE` para uma chamada ao resolver de knowledge. UI não possui authorSession por contrato, de modo que a materialização canônica de um workflow com knowledge já recusa a ausência de autor; parâmetros como `authorSessionID` não mudam isso.

O seam ainda necessário pertence ao produtor nativo de conhecimento/rotinas: `modules/maestro/coordination/src/v2/workflow/knowledge.ts`, `WorkflowKnowledgeV2.resolve`, exige a sessão Archie real, um único `atlas_context` concluído, a correspondência entre chamada e anchor e releitura da fonte viva. Esse módulo e seus colaboradores Maestro são internos. `@orchestra/core/atlas` expõe consultas e operações Atlas, mas não exporta esse resolver de `AtlasKnowledge.Anchor` com a prova completa. `@orchestra/schema/atlas-knowledge` fornece o formato, não a autorização nem a leitura autenticada.

Nenhum engine privado foi importado ou copiado. As cópias em `source/` são evidência de leitura e identificação de API/seam, com blobs revalidados. Implementar knowledge futuramente exige um port público autenticado do owner e a seleção de uma sessão de autoria legítima; conteúdo de skill, digest de JSON, ID de sessão passado pela UI ou resposta do modelo não substituem essa prova.

## Provas próprias preparadas

O novo arquivo contém cinco testes completos, cada um com budget de 120.000 ms:

| Prova | Implementações reais usadas | Recusas/asserções relevantes |
|---|---|---|
| Publicação instalada | LocationServiceMap, Relay, SkillV2, SQLite AuthoringStore, UI registry e materializador público | Bytes/digest da skill, pin de versão, dois host checks, capacidade read-only, unpublish |
| Drift e knowledge | Atualização real via `SkillV2.save`, `RelayWorkflowBinding.revalidate` | Binding antiga recusada; skill ausente; UI não adquire autoria por parâmetros; knowledge Held explícito |
| Revogação durante await | Leitura real do store e UI registry real | Revogação antes do egress nega o catálogo; troca de Location invalida resultado e provider retido |
| Projeto e disposal | Location real, provider instalado, finalização real do graph | Projeto divergente recusado antes do callback; provider anterior não revive; callback não é chamado após disposal |
| Sessão de autoria | Core SessionV2/SessionStore, SkillV2, `loadSfSkill` real e SF binding registry | ID da sessão carregada; archive/remove/finish recusados; nenhum Task ou run C07 é produzido |

No quinto teste, o lease de operação é uma boundary fixture do registry, derivada do Request esperado, da admissão exata e da sessão/mensagem de skill persistidas. Não é um turno de modelo hospedado nem uma prova GNATIVE. Os callbacks de autoridade não retornam `true` irrestritamente: reabrem SessionStore e a mensagem real, comparam a admissão completa e as identidades e rejeitam Requests ou bindings divergentes.

Os interleaves alteram somente o agendamento após leituras reais; não fornecem dados substitutos. Não foram removidas asserções ou casos anteriores, e nenhum budget existente foi aumentado.

## Verificação e próximo CI

Foi feita inspeção estática dos imports públicos, contratos, caminhos, guards, tipos usados, fixture, diffs e hashes. Não houve execução local de produto, parser de produto, testes, typecheck, build ou browser. Os cinco novos testes ainda não têm resultado hospedado. Nenhum commit, push, branch, dispatch ou mutação remota foi realizado por este builder.

Seleção mínima proposta para root: o arquivo novo inteiro e `native-host/routine-services.test.ts` inteiro. O primeiro exercita o provider efetivamente instalado; o segundo preserva a boundary anterior de ausência/retained-provider/native-record. Incluir o check hospedado de CLI + WP10 para os quatro paths. A integração do novo node em `host-context` também deve permanecer no próximo recorte de host/runtime que root já executar; não é preciso reexecutar unidades dos produtores de routines que não mudaram. Sem name-pattern e sem nova expectativa de aceite nativo.

Installed publication concluída no código não equivale a C07 completo. A ausência de `SfRoutineNativePort` publicado/composto continua separada: catálogo executável, preparo de admissão e readback factual dependem de plano e receipts nativos reais. A composição mantém esses caminhos indisponíveis e não anuncia novos descritores.
