# W26 — leitura auxiliar de Memory

**Não identifiquei defeito concreto novo nas fronteiras examinadas dos dois pacotes Memory.** Esta conclusão registra uma leitura estática de builder. **FINAL=false; não é revisão independente nem PASS funcional.**

## Escopo e pins

Base publicada W25: `3d59829e5d9e438cbb443428a9479d7f63b5bf31`; árvore `ee95a2e3d0f02efabe6a4442fcf59479265a9f61`. O inventário `publication/W26-own-staging-v1.json`, SHA256 `600de984e921e51536219a119c4b14868038a2e3a0ba5f56046598b8327ad9e1`, contém quatro overlays, nove arquivos próprios e dois arquivos novos. Conferi os hashes dos nove candidatos contra seus pacotes isolados e os quatro hashes de selo.

| Overlay | SHA256 do selo | Alcance desta leitura |
|---|---|---|
| `agents/root/W26-memory-case-records` | `5a7ff9bd1cea92f7639ab1c8ef0df6f4f4df58995b7d4c964cc945e41d590bd6` | Composição Memory: leitura semântica auxiliar. |
| `agents/ci/W26-memory-record-scope` | `bd14446d34a97f3a1e8b93dd272a7943fe74f70efc1de6877d4f46cd3a17d594` | Helper, wrapper e testes: leitura semântica auxiliar. |
| `agents/c17/W26-installed-publication-lifecycle` | `464716ba0180b7391fa7b701621bec85291e60060e62ced764143a427f36112a` | Autoria própria, com audit separado; não revisão independente. |
| `agents/root/W26-exact-threshold-composition` | `a89f977502a3fafb64beeedd46b566857ca6b9742e4bdcd939e35708efb73267` | Somente inventário e hashes; sem parecer semântico sobre threshold. |

Os pins completos por arquivo, incluindo blobs base/candidato e SHA256, estão no [registro JSON](W26-memory-auxiliary-review.json). Nenhum selo ou pacote existente foi regravado.

## Fronteiras conferidas

1. **Recusa antes do trabalho.** `unsupported` permite o caminho comum somente antes de `work()`. Depois da execução canônica, falha de witness, alteração, exceção ou writer aninhado fecha a observação como `changed`, sem devolver resultado e sem retry.
2. **Ator atual e história.** `materialized()` permanece byte exato à base W25. A qualificação usa a chave do ator atual, seus roles, canWrite, role-map, campos, período e moeda. Ela não troca a versão/incarnation histórica do ref: original, captura e continuidade continuam sendo provados pelos produtores reais.
3. **Todas as referências.** A coleta recursiva de Memory usa `digestSfValue(ref)`, preservando diferentes versões e seletores de campo do mesmo `refId`. O mapa por `refId` restante só testa o pertencimento dos seletores de cenário. O generic fixa o array completo e qualifica cada elemento.
4. **Wrapper de evidência.** `observed(undefined)` preserva o fallthrough canônico. `changed`/`unavailable` não vira `unsupported`. O fallback da API de um ref ocorre fora do root, após recusa anterior à execução.
5. **Composição Memory.** O request do caso é clonado antes do preflight. Os witnesses externos e os probes de mutação ficam fora da transação agrupada. O leitor real de casos mantém os dois passes BCS e as duas chamadas a `verifyScenarioOperations`. As duas observações Atlas recebem scopes lexicais separados.
6. **Autoridade e estado.** Permanecem C08 real, estado completo, três snapshots/source fences, identidade/método/URL/todos os headers da Request, binding/lease, identidade e expiração da seleção, identidade do leitor, principal/contexto atual, dia UTC, diretório e bank key. O retorno é um clone do resultado canônico; esse helper não cria cache de resultados.

Essas observações se referem aos bytes pinados nos dois pacotes Memory. A leitura também conferiu os consumidores atuais `case-port.ts` e `scenario-operation-access.ts` para a manutenção dos passes canônicos; não executou seus imports.

## Limites e próximo passo

- Nenhum teste, typecheck, build, import executável ou browser local foi executado. Não houve dispatch de CI ou mutação remota nesta leitura.
- Não há conclusão de desempenho medido, PASS funcional, aceite nativo ou aceite do epic global. Resultados W25 não se transferem ao candidato.
- Os três novos casos do helper e o arquivo inteiro de Memory ainda precisam de CI hospedado no SHA publicado, com os budgets e assertions preservados.
- O overlay de threshold está pinado para completar o inventário dos quatro overlays; não foi abrangido pelo parecer semântico de Memory.
- O overlay C07 foi produzido por este builder. Seu audit de ciclo de vida é separado e não conta como revisão independente.
- Os três revisores independentes permanecem necessários sobre o SHA concreto a integrar. Este registro não é FINAL.

A raiz pode anexar este parecer auxiliar ao recibo de preparo W26. Todos os pacotes selados, fontes de produto e recibos existentes permanecem inalterados por este registro.
