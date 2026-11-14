# W17 — parecer final independente de runtime e autoridade

**Veredito do escopo completo: CHANGES_REQUIRED.** O incremento selecionado de BI está **PASS no W17/CI10 exato**. READY e GLOBAL_RELEASE não são declarados.

Revisor `/root/review_runtime_final`, sem autoria de produto ou fixtures. PR32, branch `astra-compose`, contra `sf2-stack` observado em `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`.

| Pin | Valor |
|---|---|
| C W17 | `9048e0e65351a5bd80768458a79fed94a4993db7` |
| Árvore C | `f073278e9fb11ca93b129c16331460e1fb6e25c4` |
| Pai único | W16 `34e6dd4f3588a64a3963a854ee29729f82fdd594` |
| Fixture própria publicada | `a6e4dbe4bddc18866a8fe8082fa889540ac75972` |
| Driver publicado reutilizado | `76188b9f567861b30dba3b22afce66d60a2424c8` |

## Resultado e escopo da composição

GitHub MCP autenticou commit, árvore, pai, PR32 e o delta remoto completo: **9 paths, uma fixture própria e oito recibos, sem deleções**. O arquivo publicado é byte a byte a proposta revisada independentemente; o driver foi reaberto no W17 e permanece igual. Não há alteração nova na implementação do produto, na identidade, na política financeira ou em fonte de outro proprietário.

A fixture mantém o host HTTP/produto e o cliente Playwright no Bun; o helper publicado faz Node possuir os descritores de Chromium através de AppProcess. Preservam-se as 81 linhas anteriores de `expect`, cinco nomes e budgets, quinta prova sem browser, cookie real da rota montada,403, exclusão de resultados tardios e a jornada de retorno completa. Nenhum teste foi reduzido a um resultado simulado.

A aquisição registra o close antes de observar cancelamento. O driver remove seu listener de startup ao concluir aquisição; o disposal normal usa o fechamento registrado. Os quatro reports estão depois das asserções e do cleanup aguardado. O helper ainda exige encerramento físico completo antes de permitir report. A execução agora confirma esses quatro caminhos.

## CI10 — cinco casos BI aprovados

[Run43605201442](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43605201442), job `132478265438`, **SUCCESS**.

- **S:** `dcd14c5fad0c84143d3071557c493e2c5de3e9e4`; árvore `823a2081fbc1fab1f39e441cf0f9bd3fa34687e1`.
- Pai único C W17. Único delta: `.ci-run.json`, blob `6decd1736e1fda8ac653ff5ec7a03d3f48d47ede`, SHA256 `b7e57c0f9591b817e4d387c73e29d1875c1fbb684dd100687dd6b1a688475d2a`.
- Um arquivo completo, cinco casos, sem filtro de nome e sem epic.
- **5 PASS / 0 FAIL / 114 asserções / 16,02 s; zero marcador de erro não tratado.**

| Caso | Resultado |
|---|---|
| Shell canônico, refresh manual/foco/timer e signout com sucesso retido | PASS4.333,16ms |
| Revogação real enquanto a leitura aguarda;403 e nenhum resultado tardio | PASS2.357,29ms |
| Limpeza de seleção enquanto opções autorizadas aguardam | PASS2.468,05ms |
| Navegação à fonte e Back com filtros, par de versões, moeda e foco após leitura atual | PASS5.783,85ms |
| Digests de origens explícitas do Planner real | PASS652,69ms |

A quarta prova ultrapassa o ponto que falhava em W16. `comparison.http` completa em357ms, `source.http` em133ms, navegação à fonte em99ms e leitura de retorno em382ms; o DOM e o foco esperados também são verificados. Esses tempos observados em uma execução não estabelecem p95.

**Omni PASS:** nonce `7b19b299b892fc9d0777b0a87e16f2b7`, quatro testes declarantes, quatro spawns e zero delegados. O cleanup de snapshot também passa, job `132478786112`; é evidência separada do fechamento físico dos browsers.

### Quatro recibos físicos de fechamento

O log MCP contém quatro `SF_WP02_BROWSER_DRIVER_PROOF`, um após cada cleanup e antes do PASS correspondente. Os dados correspondem integralmente ao recibo root. Todos usam o cliente Bun PID4078, drivers Node distintos e Chromiums distintos:

| Caso | PID Node | PID Chromium | Frames enviados/recebidos |
|---|---:|---:|---:|
| Shell/refresh/signout |4099|4114|71/189|
| Revogação |4236|4251|48/131|
| Seleção limpa |4374|4389|33/102|
| Fonte/Back |4514|4529|84/213|

Em cada recibo, conferi contexto zero, browser desconectado, saídas normais Node/Chromium com código0, nenhum sinal, EOF do pipe, WebSocket limpo com código1000, bridge/listener/socket fechados, nenhuma parte de frame ou escrita pendente, tráfego real dentro dos limites e remoção de socket/diretório. Os PIDs são distintos do cliente e entre os quatro pares.

O nome herdado `SF_WP02_BROWSER_DRIVER_PROOF` e a categoria `host-contextual-controls` identificam o helper reutilizado. Aqui a prova vale somente para **quatro lifecycles de fixture WP10 BI no novo transporte**. Não estabelece cobertura WP02, instalação nativa, inferência nativa ou reparo do caminho antigo WP07.

Log independente: `w17-ci10.log`, SHA256 `e1523b406dbed298dea8853371390c09366e094510a3e57642f97d5083b6b2d2`; é byte a byte o log root. A verificação estruturada independente está em `w17-ci10-proof-verification.json`, SHA256 `fbd07ea0d454a5222944578c8b28766e220ec2bda17bd05ef8163240e4967d76`.

## Check15 — baseline ainda bloqueia o pacote

[Run43604348151](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43604348151), job `132475647040`, **FAILURE**.

S `771cf5896aa504620ab35a2e44cca2606b7e18c3`, árvore `12707f474e546fe850ab798de957d2fc535007ff`, tem pais W17 e Check14 `8005cdc71222a6656c38e0ab90a434bb66d20949`. Seu único delta contra C é `.astra-compose-check.json`, blob `fab08401863895c347b6b64a9e6322786575129b`.

| Gate | Evidência exata W17 |
|---|---|
| Sucafina `bun typecheck` | **FAIL14diagnósticos**, idênticos ao Check14 em texto e ordem após remover timestamps. |
| Owners do baseline | WP04:3;WP06:4;WP08:4;WP09:1;WP13:1;WP14:1. |
| Diagnósticos novos próprios / CLI |0/0. |
| CLI | PASS. |
| Atlas generate/check/diff/typecheck | PASS; diff vazio. |
| Subprocess imports | PASS4.671arquivos,66sites permitidos. |
| Guards | PASS78regras,1.423paths contra dev,0gate,46warnings,0erros. |

Dev permanece `a1d37698a7bb097c1578f827eba6a19b9917ef07`, com merge-base `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`. É referência de guard, sem incorporação de dev ao produto.

Artifact `14117816293`:3.947bytes, SHA256 `c9520733218b5b12b9540594b4330b76f1d313bd6af2f3b97cbb7d5569700c33`. Usei a cópia única do root; não fiz download. Autentiquei metadata por MCP e conferi o ZIP, dez entradas, C/tree/dev exatos,14diagnósticos e diff Atlas vazio. Recibo independente: `w17-check15-artifact-verification.json`, SHA256 `8eae6c481a6e4d32d5a44d53fec232572f43aee95e9cb9bb6e227e9cff2e5675`.

## Continuidade, catálogos e limites de fonte

O delta completo não toca os38arquivos protegidos de freeze10 `b20cf5cecf22885dd8858f3659056a50ab88f485`. As leituras MCP do W17 confirmam business-services `b3595989d0c08159c96484d96bd40a149a9721e6`, com `withAnalysisCase`/`lifecycleOnly` preservados, e analysis-run-context `70ff3cd88d5f8ae2137c17a3750f72d94f3d969e`. Permanecem a ordem de autorização humana, snapshot C08 final, membership/case e Request/lease/binding originais. CI10 não reexecuta suas provas históricas.

Conferi os hashes dos **16 catálogos**, seus16trees de raiz e referências parentais até a árvore C; nenhum catálogo está truncado. A união contém8.821entradas, das quais8.137blobs. Catálogos obtidos originalmente em commits anteriores só são reutilizados por identidade exata de tree. Isso é inventário de metadados selecionados, não um audit completo de inputs de D. Recibo: `w17-catalog-reference-verification.json`, SHA256 `42bb15e5478ed0f99b5d3a77fc5a21f799b55baaa1f7ab33abc4478940fef9c0`.

O aviso de intake fornecido pelo root sobre substituição integral de business-services do PR29 continua em HOLD: removeria os helpers privados compostos e depende de quatro helpers ausentes. Esta rodada autentica o código preservado de W17; não aceita o head inteiro de origem nem reaudita esse conjunto. O resultado188/11 reportado na origem não é prova de W17.

## Mapa de critérios e findings ainda abertos

| Área | Estado |
|---|---|
| WP00/C08/C15 e contratos congelados | Continuidade estática preservada; aceitação completa aberta. |
| Cinco casos completos BI lifecycle | **PASS no C/S de CI10**, inclusive source/Back. |
| Quatro drivers Node e Omni | **PASS no C/S de CI10**, com prova de fechamento físico. |
| Caminho antigo direct-Bun/WP07 | Finding histórico aberto: não foi reexecutado ou reparado. |
| Quatro casos antigos C17 | Não selecionados; continuam abertos. |
| W15 lifecycle/Finance/readers e W16 advantage | Evidências históricas nos seus próprios W/S; nenhum green transferido. |
| C12 HTTP | Cinco casos WP04 e Dashboard/WP02 seguem pendentes. |
| Seis destinos BI, detail refresh e reflow | Pendentes, junto a viewport/zoom/teclado/dados densos/p95. |
| C07/provider/recipient e C17 policy/project/mixed-source | Pendentes. |
| Instalação/native/manual e AM01–AM06 | Pendentes; nenhuma prova fabricada. |
| C/G7 | Exige escopo final e três revisões independentes aceitas; root/autores não contam. |
| D/G8 | **NOT_QUALIFIED; pacote NOT_D.** Faltam qualificações de inputs de geração/format/build/Turbo. |

Permanecem85critérios WP00,171WP10,50gates globais e oito seleções finais, sem alteração do plano. Os14diagnósticos de tipo e as demais dependências impedem qualificação completa apesar do incremento BI aprovado em sua seleção.

## Independência e próxima ação

Não houve autoria de produto/fixture, teste/typecheck/guard local, CI dispatch/cancelamento/publicação, edição remota ou alteração de branch pelo revisor. Originais W14/W15/W16 e o intake W17 foram conferidos por hash e preservados. Os drafts anteriores não foram alterados.

Conservar o incremento BI como positivo estritamente ligado a W17/CI10. Owners devem fechar os diagnósticos e as pendências históricas/UX/native/AM; o pacote de evidências permanece explicitamente NOT_D. S0 mantém a autoridade de integrar sf2-stack e executar a suite global sobre o bundle final completo. **Sem READY global ou GLOBAL_RELEASE.**
