# Parecer independente final de produto e UX — W17

**CHANGES_REQUIRED. CI10 passou no W17 exato para os cinco casos selecionados de BI lifecycle e seus quatro encerramentos normais de driver.** O retorno real ao Planner e a volta ao BI agora têm prova de filtros, par A/B, moeda e foco preservados. Os critérios completos de UX, consumidores, C17, provas nativas e gates globais permanecem abertos.

Revisor: `/root/review_product_ux_final`. **`no_author_overlap: true`**. Não escrevi implementação, teste, workflow ou branch; não executei produto localmente nem disparei CI. O draft W17 e todos os pareceres anteriores permanecem preservados. Este arquivo registra o resultado terminal posterior ao corte do draft.

| Âncora | Identidade |
|---|---|
| PR | [#32](https://github.com/gustavomhss/Orchestra-SF/pull/32) |
| C revisado | `9048e0e65351a5bd80768458a79fed94a4993db7` |
| Árvore C | `f073278e9fb11ca93b129c16331460e1fb6e25c4` |
| Pai único | `34e6dd4f3588a64a3963a854ee29729f82fdd594` |
| Plano imutável | `dbf9547211d9b0fade619790de7c19c0869b7c7d` |
| campaign.json SHA256 | `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba` |
| Handoff | `a3d29d011ba3607a57914701300f09117a3e2de9` |

## Delta e revisão independente

O compare completo contém **nove paths: uma fixture e oito recibos**, sem deleções ou alteração de fonte de produto/helper estrangeiro. Reabri 48 blobs no C por GitHub MCP e conferi identidades por metadados locais. Dos 46 críticos do W16, 45 são idênticos; somente a fixture lifecycle mudou. A fonte completa do driver e seus caminhos de aquisição, cancelamento, disposal e relatório foram lidos independentemente. [Âncoras](final-9048e0e65351-anchor.json); [delta](final-9048e0e65351-delta-review.json).

| Arquivo | Blob / julgamento |
|---|---|
| BI lifecycle | `a6e4dbe4bddc18866a8fe8082fa889540ac75972`; reutiliza o driver Node existente e acrescenta trace passivo HTTP/click. |
| WP02 browser driver | `76188b9f567861b30dba3b22afce66d60a2424c8`; inalterado, sem consumo do pool novo de PR31. |
| Deadline | `3eb140557b597156baf52578d8981d332e52aef3`; inalterado. |

O host HTTP/produto continua real em Bun com SQLite, C08, C16, cookie montado e respostas reais retidas. Node possui os pipes DevTools; Bun continua cliente Playwright. As **81 linhas standalone de expect e 83 linhas contendo expect foram retidas**, assim como os cinco nomes, budgets externos de 120 s e limites cooperativo 105 s, aquisição 15 s, padrão de página 10 s e navegação 15 s. O quinto caso sem browser é byte idêntico. Não houve aumento de budget.

Há quatro declarações `expectSpawn` e quatro reports, todos depois do cleanup aguardado; falha no corpo ou no cleanup impede report. O trace limita-se a mode, method, viewId, phase, status, elapsedMs e aborted; não registra cookie, URL completa, seletor, credencial ou payload. O rótulo permitido `host-contextual-controls` identifica diagnóstico, sem certificar jornada WP02 ou instalação nativa.

## CI10 terminal: resultado e alcance

[Run 43605201442 / job 132478265438](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43605201442/job/132478265438): **SUCCESS — 5 pass, 0 fail, 114 assertions, 16,02 s, zero erros unhandled**. A seleção contém o arquivo lifecycle inteiro, sem filtro, com Omni habilitado. Identidades, jobs, log e quatro provas foram lidos independentemente por MCP. [Evidências detalhadas](final-9048e0e65351-checks-observation.json).

| Identidade | Valor |
|---|---|
| S CI10 | `dcd14c5fad0c84143d3071557c493e2c5de3e9e4` |
| Árvore S | `823a2081fbc1fab1f39e441cf0f9bd3fa34687e1` |
| Pai | Somente W17 C |
| Diff | Somente `.ci-run.json`, blob `6decd1736e1fda8ac653ff5ec7a03d3f48d47ede` |
| Request SHA256 | `b7e57c0f9591b817e4d387c73e29d1875c1fbb684dd100687dd6b1a688475d2a` |
| Log salvo por root, SHA256 | `e1523b406dbed298dea8853371390c09366e094510a3e57642f97d5083b6b2d2` |
| Omni | PASS; quatro testes declarantes, quatro spawns reais, zero delegated |
| Nonce | `7b19b299b892fc9d0777b0a87e16f2b7` |
| Cleanup da branch de snapshot | Job `132478786112`, SUCCESS; separado das provas de driver |

| Caso completo | Resultado / duração |
|---|---|
| Shell canônico; refresh manual/focus/timer; sign-out e resposta genuína retida | PASS / 4.333,16 ms |
| Poll de autoridade durante resultado retido; revogação e exclusão de render tardio | PASS / 2.357,29 ms |
| Limpar seleção enquanto opções reais autorizadas estão atrasadas | PASS / 2.468,05 ms |
| Origem real Planner → navegação → Back, com estado humano e foco | PASS / 5.783,85 ms |
| Digest seleciona somente origem Planner explícita, sem escolher A/B implicitamente | PASS / 652,69 ms |

No retorno, a comparação HTTP respondeu 200 e o DOM atualizou. O clique no marcador real abriu a origem autorizada Planner. A entrada de histórico preservou BI02, período 2026-01-01 a 2026-03-31, seleção Planner, base/candidate explícitos, USD, ready e marcador de foco. Após Back houve **nova resposta BI autorizada**, restauração dos valores e `activeElement` no mesmo `data-bi-focus`. Todas essas assertions foram executadas no C atual antes do cleanup/report.

O trace observou comparison.http em 357 ms, source.http em 133 ms e return.http em 382 ms; a comparação foi produzida/retornada pelo handler em 312 ms. Esses números descrevem esta execução de fixture. **Não são p95 nem qualificam feedback de 200 ms, 30 medições comparáveis ou regressão acima de +20%.**

### Quatro provas reais de encerramento normal

As provas aparecem imediatamente antes dos respectivos casos aprovados. Há quatro pares distintos de PID Node/Chromium: 4099/4114, 4236/4251, 4374/4389 e 4514/4529. O cliente foi Bun 1.3.14, o driver Node 24.22.2 e Chromium 157.0.8103.50. Os metadados foram validados sem executar produto localmente.

Cada prova demonstra zero contexts restantes, cliente desconectado, exits normais 0 para Node e Chromium sem signal, stdin/Unix EOF, WebSocket limpo com código 1000, bridge/listener/socket fechados, filas e frames pendentes zerados e socket/diretório removidos. Houve tráfego bidirecional real e somente um cliente aceito por driver, com limites de frame/fila e permissões de diretório/socket verificados. A prova fica disponível somente depois desse protocolo; o report vem depois do finally aguardado.

Isso qualifica os **quatro encerramentos normais executados**. O fault path histórico WP07 permanece aberto: W16 teve timeout antes da navegação, conexão ainda true e três RPCs de close pendentes; os membros físicos finais do grupo não foram enumerados. O helper WP07 não foi modificado nem exercitado pelo caminho novo. O comentário sobre reciclagem de descritores Bun explica a escolha do transporte, sem provar a causa daquele timeout. Nenhum fault path forçado foi qualificado por CI10.

## Check15 terminal: package ainda falha

[Run 43604348151 / job 132475647040](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43604348151/job/132475647040): **FAIL por 14 diagnósticos TypeScript externos, exatamente iguais ao Check14; zero novo diagnóstico próprio e zero CLI.** CLI, geração/diff e boundary Atlas, guard de subprocessos e guards passaram. O package Sucafina continua sem typecheck verde.

| Evidência | Valor |
|---|---|
| S Check15 | `771cf5896aa504620ab35a2e44cca2606b7e18c3` |
| Árvore S | `12707f474e546fe850ab798de957d2fc535007ff` |
| Pais | W17 e Check14 `8005cdc71222a6656c38e0ab90a434bb66d20949` |
| Diff contra W17 | Somente `.astra-compose-check.json`, blob `fab08401863895c347b6b64a9e6322786575129b` |
| Guards | 78 regras, 1.423 paths, 0 gate, 46 warnings, 0 erros |
| Spawn guard | 4.671 arquivos, 66 sites permitidos |
| Artifact | `14117816293`, 3.947 bytes |
| Artifact SHA256 | `c9520733218b5b12b9540594b4330b76f1d313bd6af2f3b97cbb7d5569700c33` |

Root fez o único download do ZIP. Li e conferi apenas o recibo de metadados, SHA256 `be75cee1629735451727fbc7fac806da27392ebdf11d9a0294650f8b5402620f`; não abri nem baixei o artifact.

## Seis remédios próprios e finding do owner WP05

| Finding / critério | Julgamento no W17 |
|---|---|
| **01 — retorno/contexto BI** | **Resolvido no caminho Planner source/Back executado em CI10**, incluindo estado humano e foco. Não constitui PASS de todos os critérios compostos. |
| **02 — seis destinos BI** | Um caminho Planner source/Back tem prova atual. Os seis callbacks e J01–J13 completos, inclusive outros contextos de source/evidence/question/case, permanecem abertos. |
| **03 — shell/refresh Review** | Remédio estático preservado. O body browser de W14/CI7 passou em 71,49 s, mas o run/Omni falhou. Está fora de CI10; evidência histórica não foi transferida. |
| **04 — reflow de detalhes próprios** | Containment/wrapping estáticos preservados. Faltam 320/768/1440 px, 200% zoom, teclado e dados densos/longos. |
| **05 — refresh de detalhe aberto** | A prova atual de shell/retorno não cobre detalhe aberto durante timer/focus com nova autoridade/membership e preservação de foco/scroll, nem todos os casos de mudança/late response. |
| **06 — cardinalidade e recuperação** | Três casos advantage passaram no W16/CI9; as fontes são idênticas, mas estão fora de CI10. Recuperação progressiva, feedback/p95 e medições continuam pendentes. |
| **07 — advantage reflow WP05** | **OPEN_MUST_FIX**; blob `47b271f492292956a8d8696cc32cd999e9878661` inalterado. |

No finding 07, a tabela de seis colunas continua anexada diretamente à seção Finance; o pai não contém o overflow e o shell mantém células nowrap e larguras mínimas de cabeçalhos. O remédio de detalhe próprio não abrange esse renderer estrangeiro. O owner deve preservar valores canônicos, captions/headers e callbacks enquanto corrige containment e acesso por teclado, com prova visual. [Finding encaminhado ao owner](https://github.com/gustavomhss/Orchestra-SF/pull/35#issuecomment-6876551357).

## Dependências e gates preservados

Além dos findings de UX, permanecem explícitos:

- **WP07 fault path histórico:** [thread do owner](https://github.com/gustavomhss/Orchestra-SF/pull/33#issuecomment-6878062059). O novo caminho normal aprovado não encerra sua investigação de teardown/cancelamento.
- **C17 ancestry/reopen:** o parecer independente de runtime preserva quatro casos históricos CI5 sem execução aprovada. Os dois stale cases selecionados passaram somente no W15/CI8; CI10 não seleciona C17. Esses resultados não qualificam latência, grant ou os quatro casos restantes.
- **Atlas grant em fonte retida:** o finding anterior de grant após último await em `e4e648fe` permanece hold de fonte WP14 não consumida. Não o atribuo ao Compose preservado após rollback.
- **C12/consumidores:** mantidos os cenários HTTP/browser e Dashboard withdrawal/revocation pendentes, incluindo H05 de CI6 Expected409/Received200. CI10 não os executa.
- **C07/C17 nativo:** provider governado, recipient/lease/checkAtCommit, política/memória de projeto/fontes mistas e falha/retry/revoke ainda precisam de prova apropriada; **AM01–AM06 continuam exigidos**.
- **Typecheck:** os 14 diagnósticos externos de WP04/WP06/WP08/WP09/WP13/WP14 permanecem sob seus owners.

O relatório de runtime citado é `final-34e6dd4f3588.json`, revisor `/root/review_runtime_final`, SHA256 `70850a38869caba1f48e5944827c510e6378159cff11fd5ce05b4f2e81ee26db`. Essas dependências mantêm proveniência histórica; não são apresentadas como execução nova de CI10.

O plano conserva **85 critérios WP00, 171 WP10 e 50 globais**. S0 ainda precisa das oito seleções finais: CI-SF, CI-CLI, CI-APP-SRC, CI-APP-BROWSER, CI-ATLAS-BUSINESS, CI-UI-OPERATIONS, CI-UI-DECISIONS e CI-UI-REPORTS. Exigem-se três reviews finais independentes sem findings obrigatórios. Esta revisão é independente, porém continua CHANGES_REQUIRED.

**C/G7 permanece aberto; D/G8 bloqueado.** O estado é `PROPOSED_EVIDENCE_BRANCH_NOT_D`: generation → format → prettier inclui os recibos propostos sem ignore correspondente, e o fechamento dos inputs de Turbo/build/loader/runtime não foi qualificado para D. O audit original e seus pins não são renomeados para este C. Guard C não qualifica D.

## Preservação e próxima ação

O draft continua com seu corte verdadeiro de 14:30:07 UTC, quando nenhuma run havia sido observada; a observação posterior independente registrou CI10 terminal às 14:32:34 UTC. SHA256 do draft JSON: `ab72ba0c16b1b7677bacd83cfe7f1f573bf2d09c7cf487699a992d001558c4ae`; Markdown: `69b1f505fd50ab14ed8f92f9749e8a632d81b59410a023393392da5d107de6b9`. W16 continua intacto, com JSON `3a07e286b2f1a7d3c2be10dd2f0522af4320542f578581c2869c01116cbe7624`.

Root pode consumir a prova estreita de lifecycle/retorno e cleanup normal sem duplicar CI10. Os owners devem fechar os findings e dependências restantes no candidato correspondente; S0 conserva a integração e a suite global. **Sem READY para o WP completo e sem GLOBAL_RELEASE.**
