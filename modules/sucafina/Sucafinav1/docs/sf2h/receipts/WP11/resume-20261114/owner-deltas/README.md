# WP11 — propostas aos owners WP10 e WP13

**Status: `UNEXECUTED_OWNER_PROPOSAL`.** Os dois patches deste diretório são propostas concretas sobre fontes publicadas e fixadas por SHA. Nenhum arquivo de produto ou teste dos owners foi alterado no working tree de WP11 por estes patches. Eles não representam integração, aprovação de CI, prova de runtime instalado, GNATIVE ou fechamento dos critérios dependentes desses seams.

Os arquivos originais foram obtidos pelo GitHub MCP e seus conteúdos foram conferidos contra os Git blob IDs. `git apply --check` sobre cópias isoladas das fontes exatas confirmou apenas que os patches se aplicam textualmente. Nenhum teste de produto, typecheck ou suíte epic foi executado localmente. A execução hospedada do candidato WP11 também não valida alterações que existem somente dentro de arquivos `.patch`.

## Conteúdo e origem

| Proposta | Owner e pin publicado | SHA-256 do patch |
| --- | --- | --- |
| [WP10-C17-current-ancestry.patch](WP10-C17-current-ancestry.patch) | [PR #32, compose `5866bcb2ed610f80138aaabc261acac4acf709cd`](https://github.com/gustavomhss/Orchestra-SF/pull/32) | `c89a51b4c04688b354ee6e23b67bdc5c916b1787502af2dfdb0eba4e8d542dbe` |
| [WP13-history-same-version.patch](WP13-history-same-version.patch) | [PR #36, intelligence `2fb7e9c792327725384d99d656cc44b232ddc485`](https://github.com/gustavomhss/Orchestra-SF/pull/36) | `1ca074f342f5f2e7c4931d044feb9df29c875117dab43bba3ba6c7b3acaf9c94` |

[manifest.json](manifest.json) registra cada path, SHA de origem, blob original e blob proposto. Os hashes identificam esta proposta; não são commits publicados contendo sua aplicação.

| Path de origem | Blob publicado |
| --- | --- |
| `apps/cli/src/sucafina-product/business-services.ts` em compose `5866bcb2` | `34a491f859f7b57b0883a122f816803df43c74c8` |
| `apps/cli/src/sucafina-product/planner-calculation-services.ts` em compose `5866bcb2` | `6898b08eb4b018f5a83167555836ac876d288976` |
| `modules/sucafina/Sucafinav1/product/portfolio/history-provenance.ts` em intelligence `2fb7e9c` | `18c18eeaf6b0aca408d934771a3a95db4c1e7d0f` |
| `modules/sucafina/Sucafinav1/test/product/wp13/history-provenance.test.ts` em intelligence `2fb7e9c` | `2c4887d711ff636754b7aed9638b0681fe3fc334` |

## WP10 / C17: composição da proveniência de cálculos atuais

O pin compose preserva um adaptador de publicação que aceita apenas ancestrais record-only. A proposta liga os hooks canônicos já publicados pelos produtores às leituras e à persistência do runtime, sem duplicar fórmulas nem fornecer verificadores permissivos.

1. `business-services.ts` encaminha `verifyCalculationSources` do result store ao produtor de cálculo após sua construção. Até que esse produtor exista, o hook retorna `false`; no dispose, o vínculo é removido. O adaptador recebe o mesmo Planner composto usado pelo produto.
2. `planner-calculation-services.ts` encaminha `verifyRequestSources` ao verificador canônico `verifyCalculationRequestSources`. Também retorna `false` antes da inicialização. `nested.replayScenario` usa `planner.simulateScenario`, e `nested.evidence` usa o BCS real.
3. As leituras de requests, a emissão e a resolução de cálculos instalam o escopo C08 exato antes de iniciar o replay de ancestrais. O bootstrap consulta somente metadados privados do resultado/caso, verifica principal, revisão de acesso, política, participação, encarnação e versão atuais, e passa pelo `authorizeCase` e pela revalidação do host. Essa consulta não emite evidência e não substitui as verificações posteriores do produtor.
4. Persistência de cenários com assumptions, replacementRefs ou ancestrais não record deixa de saltar silenciosamente a captura do request. O caminho usa o Planner composto para replay e persistência, valida o fechamento de fontes e registra o request autenticado. As proteções existentes de captura privada, cercas de fonte e identidade operacional permanecem.
5. A resolução aceita uma projeção BCS fresh de CaseLedgerEvent com ref/currentRef/revisão de acesso exatos. Ela não exige que um evento de caso tenha o shape monetário de DomainProjection. A extração monetária continua dependendo das projeções e sourceRefs próprios do produtor; um evento de caso não inventa valores.

### Dependências publicadas

Os hooks são consumidos do incremento C17 em [PR #35, `981ad44102b2e2e67d31bfc8fb7d97208e390e5b`](https://github.com/gustavomhss/Orchestra-SF/commit/981ad44102b2e2e67d31bfc8fb7d97208e390e5b), já registrado no intake de WP11:

| API | Blob desse pin |
| --- | --- |
| `product/decisions/result-store.ts`: `verifyCalculationSources` | `338889513cfc681bdda91697a9d5bbc16bde8fd1` |
| `product/decisions/scenario-request-store.ts`: `verifyRequestSources` | `54c5155aa64b4528a75a601950b56bed8e021471` |
| `product/planner/calculation-evidence.ts`: verificadores de request/resultado e replay nested | `6d09c74ff03eef72aa564355fd7da52ae6fb503d` |

Esses paths são relativos a `modules/sucafina/Sucafinav1/`. O incremento posterior `66bbe152c145f04c16223a938589c63cedb3b716` acrescenta o cenário canônico source-only completo consumido por WP11; seu manifest separado é [finance-66bbe-intake.json](../finance-66bbe-intake.json). A semântica de source-only não autoriza mutações nem confirmação humana implícita. A proposta depende ainda do escopo C08 privado já presente em compose `5866bcb2`; aplicar somente os novos hooks sobre um runtime sem esse escopo não é equivalente.

### Limite explícito: revisão histórica nested permanece pendente

`apps/cli/src/sucafina-product/review-calculation-history.ts`, blob `012c83ed8b6382bebc0046526985f2f900f04035` em compose `5866bcb2`, continua record-only. Esse caminho rejeita fontes não record, assumptions, replacementRefs e fechamento não record. O patch não remove esses guardas.

O owner precisa ligar uma autenticação histórica própria dos requests, eventos e ancestrais antes de ampliar esse caminho. O replay histórico deve conservar os digests e referências originais, confirmar a autoridade de leitura atual e distinguir evidência historical de fresh. Reemitir cálculo antigo pelo caminho de emissão atual não constitui prova histórica e não deve ser usado como atalho. Esta proposta cobre a composição dos cálculos atuais; a revisão histórica nested e sua prova hospedada continuam abertas.

### Verificação hospedada requerida pelo owner

Após aplicar e publicar o delta na composição do owner, executar typecheck de `apps/cli` e Sucafinav1 e as seleções cirúrgicas aplicáveis ao SHA publicado, conforme seus workflows e gates. Os arquivos existentes relevantes são:

- `test/product/wp10/integration/calculation-case-scope.test.ts` (blob `37c3ebc9f88065b5c6d40f6fbce06088e414a1c7` em compose `5866bcb2`): retenção do escopo, sobreposição, caso estrangeiro e revogação.
- `test/product/wp10/integration/planner-calculation.test.ts` (blob `6bddb122a8c1d94b79b6ebd9e4d98552eeaab4c6` no mesmo pin): persistência e emissão pelo runtime composto.
- `test/product/wp10/integration/review-calculation-history.test.ts`: preservar os negativos record-only enquanto a extensão histórica permanecer pendente.
- `test/product/wp03/calculation-evidence.test.ts` e `test/product/wp11/calculation-persistence.test.ts`: provas de produtor e persistência publicadas no intake C17.

É necessária uma regressão adicional no host real que combine CaseLedgerEvent e cálculo ancestral autenticado, rejeite ancestral forjado, feche/reabra o store e rejeite revogação ou mudança de caso/fonte durante a operação. As provas componentes existentes não demonstram, sozinhas, que o wiring proposto está montado. Nenhum run ID é atribuído a este patch antes dessa publicação e execução.

## WP13: histórico quando a fonte muda sem avançar o caso

O pin intelligence exige `currentCase.version > storedCase.version` para autenticar proveniência histórica. Uma fonte do domínio pode mudar enquanto o caso permanece na mesma versão. A proposta admite igualdade: rejeita apenas `currentCase.version < storedCase.version`. Isso torna elegível a autenticação histórica; não promove evidência antiga a fresh e não permite recalcular ou aplicar mudanças sem nova autorização.

Permanecem as verificações do pin: caso/encarnação, identidade e digest do request/resultado/binding, digest da seleção, referências únicas dos candidatos, versão e digest exatos de cada alternativa, autoridade atual da evidência, revalidação do host e dupla inspeção estável. A regressão proposta usa o harness publicado, aceita histórico na mesma versão e rejeita a mesma leitura após revogação. É uma prova unitária a executar; não representa uma atualização real de fonte ou um percurso de runtime instalado.

Esse delta precisa ser composto com os guardas de WP11 em `product/decisions/portfolio-history.ts` e `product/decisions/portfolio-bindings.ts`, que também devem aceitar a mesma versão, mantendo versão futura rejeitada e identidade/proveniência exatas. O candidato WP11 já contém essa alteração própria; este diretório não a reaplica. As fontes antigas de compose usadas na revisão constam no manifest, respectivamente blobs `6834ac4460c8f98fa3b6c2db0743e0d1e39769c5` e `2a8111a810d878a4cf6133c3842c5320fb1f5b9e`.

Após composição e publicação, o owner deve executar hospedado `test/product/wp13/history-provenance.test.ts` junto de `test/product/wp11/portfolio-history-version.test.ts` e dos gates de tipos pertinentes, registrando o SHA exato. A prova integrada ainda precisa cobrir mudança real de fonte com caso N/N, acesso revogado, alternativa alterada e caso reincarnado. Sem isso, não declarar o seam integrado ou comprovado.

## Montagem do consumidor current-choice

O delta de montagem do consumidor de preview/promotion está descrito separadamente em [current-choice-mount.md](current-choice-mount.md). Os patches deste diretório não montam a rota nativa nem substituem o grant de confirmação humana. A revisão e integração dos owners e de S0 continuam necessárias; nenhuma instrução deste receipt autoriza merge em dev ou deploy.
