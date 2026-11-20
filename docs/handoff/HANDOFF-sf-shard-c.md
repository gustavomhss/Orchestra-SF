# Handoff — sf-shard-c

SHA: 9643737ac1b2a0c475af283dddc72db70d81a81c (último commit de código; a publicação deste handoff é um commit documental posterior)
Data: 2026-11-20T01:16:02.004Z
Estado: partial

## Feito

- Branch isolada `sf-shard-c` criada na base exata `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (`sf-join-four`).
- Operação exclusivamente pelo GitHub MCP; testes somente em GitHub Actions. Sem shell.
- Enumerações integrais da base: **shard 7 = 518 pass / 12 fail**, 530 testes em 103 arquivos, 1.631,02 s; **shard 8 = 618 pass / 2 fail**, 620 testes em 115 arquivos, 1.004,17 s.
- Todas as falhas 7/8 classificadas abaixo. Quatro commits causais, todos em `modules/sucafina/Sucafinav1/test/**`: pin de produtor, recuperação Atlas, admissão revogada e identidade persistida AM02.
- Um gate por correção concreta: três verdes; o gate AM02 ultrapassou as expectativas corrigidas e revelou outro ponto, classificado como unbound. Não há alegação de shard integral verde após os fixes.
- Primeira leitura agregada dos oito shards a partir dos handoffs A/B e dos próprios runs. Actions prevalece quando o checkpoint de outra branch está desatualizado.
- Revisão independente confirmou partição, proveniência do pin, escopo dos diffs e contratos dos três testes alterados.

## Enumeração e gates

Paths de teste relativos a `modules/sucafina/Sucafinav1/`. Contagens integrais permanecem as medidas na base; não são recalculadas a partir dos gates focados.

| Shard / gate | Run id | Snapshot executado | Pass / fail | Falhas (file:line) | SHA do fix |
| --- | --- | --- | --- | --- | --- |
| 7 — enumeração | [44645952434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645952434) | `0cc9380fdc452c2da328a787e207396c4040c5e1` | **518 / 12** | Todas as 12 no mapa C7 abaixo | `36c7989...`, `ccde747...`, `9643737...`, com resultados separados |
| 8 — enumeração | [44645956665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645956665) | `13f88387091b7db295a73aca0d20fb3859a56ae7` | **618 / 2** | `test/product/canonical-read-cost/diagnostic-cost.test.ts:13:26`; `test/product/wp05/planner-origins.test.ts:83:77` | `328960a...` para o pin; browser unbound |
| C8.1 — pin + namespace | [44649157618](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44649157618) | `96211198e61056d3ee17d1710d74ea4b0f16bcad` | **2 / 0** | Nenhuma; 40 asserções | [328960a664ed64c4db46e69bf30f24f9efb04c51](https://github.com/gustavomhss/Orchestra-SF/commit/328960a664ed64c4db46e69bf30f24f9efb04c51) |
| C7.7 — Atlas recovery | [44650347644](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44650347644) | `0007a30900ff798c893cdf6d74362b688572fb48` | **1 / 0** | Nenhuma; 37 asserções | [36c7989ecf8b836af893de22a293092e4cbd09ba](https://github.com/gustavomhss/Orchestra-SF/commit/36c7989ecf8b836af893de22a293092e4cbd09ba) |
| C7.9 — revogação / observação | [44650428648](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44650428648) | `011e889380002daf99536c75c829062a6e270389` | **2 / 0** | Nenhuma; 27 asserções | [ccde74734b19f78aab0aa64ac0f301e5a4d379c0](https://github.com/gustavomhss/Orchestra-SF/commit/ccde74734b19f78aab0aa64ac0f301e5a4d379c0) |
| C7.10 — AM02 reopen | [44650813269](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44650813269) | `e805ecb442655cde05efc584b3f0937658754df6` | **0 / 1** | Ponto novo: `test/product/integrated-proofs/am02/performance-public-c16-reopen.test.ts:175:43`; 146 asserções | [9643737ac1b2a0c475af283dddc72db70d81a81c](https://github.com/gustavomhss/Orchestra-SF/commit/9643737ac1b2a0c475af283dddc72db70d81a81c), sem qualificação integral |

## Shard 7 — mapa completo por causa

Paths relativos a `modules/sucafina/Sucafinav1/`; as linhas iniciais referem-se ao snapshot de enumeração `0cc9380f...`.

| Causa | Falhas (file:line) | Resultado / disposição |
| --- | --- | --- |
| C7.1 — preparação e validade de autoridade | `test/product/wp12/native-execution-scenarios-review.test.ts:39:72` | **unbound** — `analysis-authority-changed` depois de cerca de 300,10 s de preparação |
| C7.2 — período e campos da fixture | `test/product/wp12/native-execution-dependencies.test.ts:60:21` | **unbound** — fontes de projeto corrente pedidas em 2027 e campo array não escalar; marco futuro sem status autorizado |
| C7.3 — escopo de resposta Planner | `test/product/wp12/native-execution-questions.test.ts:340:73` | **unbound / shared** — leitura não produz observação de resposta vinculada; composição sem `resolveAnswerScope` para Planner |
| C7.4 — custo da composição BI09 | `test/product/bi-cost-waterfall/rendering.test.ts:20:11`; `:112:7` | **2 falhas unbound**, uma causa — deadline de 105 s durante `BI09.dispatch`, antes do browser |
| C7.5 — console descomissionado | `test/product/wp02/import-report-consumer.test.ts:100:25`; `test/product/wp02/dashboard-browser.test.ts:74:66` | **2 falhas unbound**, uma causa — HTML antigo retorna 404; controles esperados não são montados |
| C7.6 — observação consumível e cache Atlas | `test/product/wp10/analysis-composition/historical-memory.test.ts:292:100` | **unbound / shared** — `analysis-source-unavailable`; diagnóstico estático aponta reuso de observação já consumida |
| C7.7 — recuperação exige fontes atuais | `test/product/wp10/atlas-business/atlas-recovery.test.ts:137:32` | **corrigida**, `36c7989ecf8b836af893de22a293092e4cbd09ba`; gate 44650347644 **1/0** |
| C7.8 — typecheck, guard e timeout | `test/product/work-split/work-reuse/static-gates.test.ts:12` (budget em `:28`) | **unbound** — 21 erros TS de fixture; 2 gates protegidos; timeout externo de 120 s |
| C7.9 — admissão já removida | `test/product/diagnostics/calculation/source-observation.test.ts:86:29` | **corrigida**, `ccde74734b19f78aab0aa64ac0f301e5a4d379c0`; gate 44650428648 **2/0** |
| C7.10 — fonte persistida versus autoridade nova | `test/product/integrated-proofs/am02/performance-public-c16-reopen.test.ts:160:42` | Expectativa corrigida em `9643737ac1b2a0c475af283dddc72db70d81a81c`; gate ultrapassa esse ponto, mas **0/1** numa asserção posterior |

**Ponto novo revelado pelo gate AM02:** `test/product/integrated-proofs/am02/performance-public-c16-reopen.test.ts:175:43` no snapshot `e805ecb442655cde05efc584b3f0937658754df6` (linha 174 na base). O snapshot completo é comparado com o estado anterior à criação de três novas execuções nativas. A preparação persiste três `nativeRuns`, seis operações create/attach e os respectivos registros C08 de idempotência; o diff mostra revisão 7 → 13. **Unbound — oracle de persistência mistura escritas autorizadas do setup com operações de leitura.** O gate fez 146 asserções e terminou 0 pass / 1 fail em 5,41 s. Não foi excluído o namespace nem substituído o baseline por um snapshot tardio. Próximo passo: provar exatamente os efeitos autorizados da preparação e, separadamente, a igualdade integral antes/depois das leituras. Isso não é qualificação AM02, inferência de agente ou GO.

### C7.1 — preparação / autoridade

O log vai de 00:35:49.585Z a 00:40:49.687Z, aproximadamente 300,10 s. `apps/cli/src/sucafina-product/analysis-http.ts:59–60` aguarda `runtime.inputs.prepare` e reautoriza o mesmo contexto; `product/integration/ui-authority.ts:45` aplica validade de cinco minutos, e `human-authority.ts:44–45` exige a autoridade atual. Há evidência forte de expiração durante a preparação, sem localização do custo interno. Não ampliar lease, manipular relógio ou fabricar aprovação. A investigação do produtor exige fatia `shared:` se houver alteração fora de test/**.

### C7.2 — seleção de período / campos

A fixture usa projetos correntes observados em 2026 como fontes de 2027 (`native-execution-dependencies.test.ts:53–56`). `product/dashboard/scope.ts:15` recusa esses snapshots fora do período observado; `product/dashboard/sources.ts:124–126` não transforma o array `milestones` em campo escalar. A projeção `milestoneDates` de 2027 perde `status` em `dashboard/scope.ts:30`, enquanto `apps/cli/src/sucafina-product/analysis-dependency-readers.ts:79–84` exige data, nome e estado confirmados. Uma troca isolada do ano ou dos campos não resolve a fixture. Retomar com projeto e marco coerentes com a observação, horizonte financeiro explícito e controles de homônimo, identidade, data e FTE preservados.

### C7.3 — integração da resposta Planner

O teste emite fonte Planner em `test/product/wp12/native-question-preparation.ts:50–59`, cria suporte/thread e lê resposta em `native-execution-questions.test.ts:281–289`. `product/collaboration/dispatch.ts:49–50` consulta `answerReuse.read`; `answer-reuse.ts:120–121` exige escopo válido mesmo antes de confirmar a resposta. `collaboration/host.ts:257–263` só tem fallback Dashboard quando `resolveAnswerScope` está ausente. A composição em `apps/cli/src/sucafina-product/business-services.ts:202–219` não fornece esse resolvedor, embora o observador de confirmação suporte Planner em `:192–198`. Diagnóstico estático forte; o erro observado omite o motivo interno. Retomar no produtor compartilhado mantendo manifest, fonte, dependências e fences de confirmação. Não trocar a fonte para Dashboard para obter verde.

### C7.4 — BI09, antes do browser

Nos dois casos, o timeout nasce em `test/product/wp10/integration/composition-test-deadline.ts:5:29`. No primeiro, `comparison.persist` leva 42.519 ms; `BI09.dispatch` inicia em 51.507 ms e retorna abortado em 105.032 ms. No segundo, comparação leva 41.373 ms; dispatch inicia em 48.600 ms e retorna abortado em 105.002 ms. Nenhum `browser.bundle` ou `browser.launch` foi alcançado. A fixture já usa horizonte de um mês e produtores reais; `apps/cli/src/sucafina-product/bi-services.ts:162–168` já usa `callScope.run`. Não há suboperação culpada comprovada; instrumentar a composição em fatia própria antes de corrigir, sem ampliar o prazo ou reduzir provas.

### C7.5 — consumidores do console morto

`runtime/application.ts:58–61` define o 404 `legacy console decommissioned — use /`; `:94–95` o aplica aos GETs HTML antigos. O teste de importação pede `page=IT+Risks` e exige 200; o teste de browser pede `page=OPEX+Detail&year=2026` e espera o formulário `save-entry`/botão Edit. O browser conecta e encerra normalmente neste caso. A falha não prova defeito dos produtores JSON/DOCX, pois esses passos não foram alcançados. Retomar migrando os consumidores para o host nativo com importação, conflito, rascunho, confirmação, foco e navegação preservados; não recriar o console nem editar o runtime proibido.

### C7.6 — cache / observação Atlas

`product/decision-memory/case-recall.ts:66` classifica e `:79` repete a classificação para confirmar o resultado. `product/host-binding/atlas-memory.ts:28–35` consome a marca privada de observação; `cloneSfAtlasRecallResult:41–45` só mantém a associação enquanto ela existe. `apps/cli/src/sucafina-product/memory-case-read-scope.ts:314–319` reutiliza o valor cacheado na segunda classificação. O log é consistente: uma leitura canônica Atlas concluída, `memory.prepare` em cerca de 12,952 s e `aborted:false`; o resultado observado é `analysis-source-unavailable`. Classificação estática forte, sem fix validado. Retomar renovando a observação canônica após consumo, mantendo o bloqueio de observações fabricadas/reutilizadas.

### C7.7, C7.9 e C7.10 — correções restritas a testes

- **Atlas:** o estado sem evidência passou a ser controle negativo explícito; restaurar o resolver real permite verificar o mesmo recibo durável com scanner offline. Nenhuma asserção anterior foi retirada. Gate 1/0, 37 asserções, 19,47 s; controle Omni real passou com 2 spawns e zero delegações.
- **Observação Planner:** a quarta revalidação da chamada anterior remove a admissão em `ui-authority.ts:32`; `requestFor:70–72` retorna undefined e `planner-sources.ts:45–46` recusa antes do próximo callback. O fix prova essa ausência, exige o motivo exato da negação e zero transações/autenticações/revalidações/leitura preparada, mantendo ABA, egress, abort e estado durável. Gate 2/0, 27 asserções, 529 ms.
- **AM02:** `source-lifecycle.ts:57–65` preserva incarnation/versão para fonte, escopo e digest intactos. `native-capabilities-fixture.ts:296–302` reabre o mesmo banco e troca host/geração, sem alterar a fonte. As referências devem continuar iguais; a autoridade se renova por novas sessões e recibos. As asserções de bindings antigos negados e novas sessões passaram no gate; a igualdade global posterior ainda falha conforme registrado acima.

### C7.8 — gate estático, evidência integral

O teste excedeu 120 s. O log contém, inclusive após o timeout do teste, os resultados dos comandos reais:

- `WORK_REUSE_TYPECHECK 2`: **21 diagnósticos** em `test/product/operations-installed-finish/private-admission.check.ts`. Raiz de API desatualizada: chamada sem await e parâmetros `principalRef/readOnly` em `:66–72`; a factory atual em `packages/app-shell/e2e/sucafina/operations-support/installation.ts:29–42` é assíncrona e exige `operators`/`isAuthenticated`; `:150–156` devolve contribuições/discovery/services/application, sem o antigo dispose. Corrigir só await não migra o lifecycle e os comandos legados.
- Diagnósticos: TS2353 `:67:47`; TS2339 `:72:44, :80:41, :121:39, :145:30, :147:12, :159:11, :161:80, :162:54, :175:12, :180:12, :180:131, :184:12, :185:54, :196:11, :199:49`; TS7006 `:159:55, :159:65, :180:58, :196:57, :196:67`.
- `WORK_REUSE_GUARD_BASE 0`: fetch de `origin/dev` concluído.
- `WORK_REUSE_GUARDS 1`: **78 regras, 6.183 paths alterados, 2 gate, 194 warn, 0 errors**. Gates em `godfile-waivers.json` e `script/spawn-allowlist.json`, protegidos e já diferentes de `origin/dev` na base de integração. Esses arquivos não foram alterados pela sessão C.
- Não foi fabricado `GUARDRAIL_APPROVED`, acrescentada label nem alterada regra protegida. O resultado “0 errors” não significa guard verde: há dois gates sem aprovação observada.


## Shard 8 — mapa por causa

### C8.1 — identidade do produtor desatualizada: corrigida e validada

- Falha: `test/product/canonical-read-cost/diagnostic-cost.test.ts:13:26`.
- Pin anterior de `product/host-binding/state-provider.ts`: `ba10043704bbb1a25eb0f4a8edddcdca814ec7610157bc7c4d9d88d2970467f5`.
- Bytes atuais na base: `bf0a5639bd41f903c67a89096b733269fbcd9eaf25392dde8c062fdcc13434c1`.
- Proveniência: [c00b150b48f576a79a7c8b33f15c4fb55d72dfd1](https://github.com/gustavomhss/Orchestra-SF/commit/c00b150b48f576a79a7c8b33f15c4fb55d72dfd1), cujo pai é `2682f82da2650314e3437ab48b5c65e52c5b3fe4`, acrescentou `preferences`/`receipts` à união de tipos e à admissão de `selectSfNamespaceHealth`, nas linhas 39–40. Recomputação SHA256 dos arquivos obtidos do GitHub confirmou ambos os hashes. Aplicar somente essas duas alterações ao arquivo do pai reproduz integralmente os bytes atuais.
- Fix restrito a `modules/sucafina/Sucafinav1/test/product/canonical-read-cost/diagnostic-expected.ts`: um pin e seu comentário de proveniência. Os demais pins, teste, probe, recibo histórico e revisão histórica permanecem intactos.
- Gate executou `diagnostic-cost.test.ts` e `native-ui-contract/namespace-health.test.ts`. Os controles de autoridade original, autoridade incorreta, revogação e ausência de conteúdo privado passaram.
- O diagnóstico mede trabalho real; ele não contém asserção de teto numérico de custo. Esse verde confirma a execução com a identidade correta e controles existentes, sem demonstrar melhoria de desempenho nem qualificar P03.

### C8.2 — clique no chooser e cleanup pendente: unbound

- Falha primária: `test/product/wp05/planner-origins.test.ts:83:77`, origem B do BI03. O locator encontrou o botão correto, visível, habilitado e estável; o clique travou em “scrolling into view if needed” e excedeu 10 s.
- Falha secundária de encerramento: `test/product/wp05/browser.ts:61` aguarda `fixture.dispose()`/`browser.close()` sem deadline depois de cancelar o timer. O log não registra fechamento/desconexão desse browser antes do timeout externo de 180 s.
- Linha do tempo do run atual: BI02 concluiu entre 00:37:33.498Z e 00:37:35.719Z; BI03 começou às 00:37:36.131Z; origem A passou por mouse, foco, teclado e tabela; origem B começou às 00:37:36.935Z; o erro de clique foi registrado às 00:37:46.976Z; timeout externo às 00:40:33.426Z.
- Contraprova histórica: [run 44590270877](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44590270877), job 135794077900, snapshot `f85c4ca344ee0a064d6f9a422f6d55d4c4b8dba2`, fix [b32a7a1fc9f9280aa54ca1708fe8764ef48c5ae6](https://github.com/gustavomhss/Orchestra-SF/commit/b32a7a1fc9f9280aa54ca1708fe8764ef48c5ae6) / PR #376: **1 pass / 0 fail**, 178 asserções, 23,37 s.
- Blobs idênticos entre esse snapshot e a base atual: `product/analytics/view.ts`, `product/analytics/source-navigation.ts`, `test/product/wp05/browser.ts`, `test/product/wp05/planner-origins.test.ts` e `test/product/wp03/planner-fixture.ts`.
- Runner image observada: verde histórico `ubuntu-24.04 / 20261116.376.1`; shard atual `ubuntu-24.04 / 20261111.370.1`. A diferença não estabelece causa. O verde histórico não é transferido ao shard atual.
- Nenhuma troca de mouse por teclado, clique forçado/JavaScript, ampliação de timeout ou alteração de foco foi realizada. Corrigir só o cleanup não demonstraria solução para o clique. Sem fix causal concreto, não foi gasto rerun idêntico.

## Pendente

- **C7.1–C7.6 e C7.8:** resolver as nove falhas originais restantes nos produtores/fixtures indicados no mapa, preservando controles. Código fora de test/** exige PR `shared:` separado.
- **AM02, ponto novo:** `test/product/integrated-proofs/am02/performance-public-c16-reopen.test.ts:175:43` no snapshot e805ecb... — construir oracle que prove as seis escritas reais do setup e a imutabilidade integral das leituras; não excluir `__sfProductV1` nem trocar baseline sem essa prova. Revogação final ainda não exercitada.
- **C8.2:** `test/product/wp05/planner-origins.test.ts:83:77` / `test/product/wp05/browser.ts:61` — localizar a causa inicial do scroll/transport e tratar cleanup sem esconder a exceção primária.
- **A/B:** completar3/6 e classificar a interrupção de 1/5. Pedido de resultados às sessões A/B: atualizar seus handoffs com resumos finais, falhas file:line, SHAs e gates por causa; incorporar o resultado na próxima leitura agregada. Nenhum rerun idêntico está autorizado por este handoff.
- **Guards:** migração da fixture Operations obsoleta e aprovação real dos dois paths protegidos são pendências separadas. “0 errors” com 2 gates não é aprovação.
- **CI-SF canônico:** não executado por instrução do usuário. Estes runs diagnósticos não produzem receipt canônico, coverage/união ou GO.

## Decisões e justificativas

- **Asserções removidas: nenhuma.** Houve atualização de expectativas demonstradamente incompatíveis com os contratos atuais e inclusão de controles mais específicos; não houve skip, exclusão de teste ou ampliação de timeout. A asserção global de snapshot AM02 foi preservada e continua vermelha.
- **Controles não produzidos por esta sessão:** recibo canônico/união de `sf-ci`, admissão estática canônica de imports e qualificação final de release. O harness WP05 não tem deadline de cleanup em `test/product/wp05/browser.ts:61`; isso não prova a causa inicial do clique. A revogação final AM02 não foi alcançada depois da falha de snapshot.
- O request literal não é admitido na base: `.github/workflows/test-ci.yml:30–37` rejeita prefixos fora de `ci-run-linux-*` (linha36); `script/test-ci-request.ts:96–98` exige `args` e valida env contra whitelist em `:12–15, :133–141`; as três variáveis `SF_*` não são permitidas. `script/test-ci-package.ts:35` não resolve `modules/sucafina`; os requests executados usam o alias suportado `sucafina`.
- Requests literais preservados sem execução (`[skip ci]`): [ci-run-sfc-7](https://github.com/gustavomhss/Orchestra-SF/blob/da35a4b6854a29e43daebfa1b2b2a6aa8774ca6d/.ci-run.json) @ `da35a4b6854a29e43daebfa1b2b2a6aa8774ca6d` e [ci-run-sfc-8](https://github.com/gustavomhss/Orchestra-SF/blob/fe76b8d9683ce868683ca8b6bb2f2cee2f88112b/.ci-run.json) @ `fe76b8d9683ce868683ca8b6bb2f2cee2f88112b`.
- Snapshots admitidos: `package: sucafina`, `directory: modules/sucafina`, `runner: bun`, `args: ["--timeout", "30000", ...arquivos exatos]`, `env: { ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "1" }`. Nenhum workflow, guard, validator ou manifest foi alterado.
- Partição reconstruída a partir da árvore Git completa da base e de `script/sf-ci/gate.mjs:98–112`/`sf/ci/suites.json`: 924 arquivos, menos 40 harness-owned e 1 release-only já excluídos, **883 selecionados**. Distribuição **113/107/99/118/119/109/103/115**. Regex, ordenação e SHA256 módulo8 do seletor foram preservados e revistos independentemente.
- Checksums das listas, não de execução: shard 7 `206d8fd9d791f9abd4b8e32b8eb66cc802f04944456f87ae5f998331016ea6b4`; shard 8 `921e07bec2f62adb05f4a35b55fcf1b645a6b40a15b0c80e24caea6ec1c7a8ae`.
- Omni `declared` passou nas enumerações: shard 7 **357 spawns / 0 delegações**, shard 8 **117 / 0**; Atlas focado **2 / 0**. Pin, observação e AM02 focados não executaram teste declarador; o próprio log informa que esses runs não provam Omni.
- Economia C: **seis execuções** (duas enumerações + quatro gates causais), **no máximo duas ativas**, zero reruns idênticos, zero execução de `sf-ci`. O gate AM02 expôs um ponto novo; não foi repetido. Nenhum ponto foi repetido após duas falhas idênticas.
- Diffs em `sf-shard-c`: quatro arquivos sob test/** e este handoff. Nenhum código de produção/infraestrutura alterado; portanto nenhum PR `shared:` foi aberto. As causas compartilhadas estão classificadas para uma fatia separada, sem patch especulativo.
- Sem alteração de `runtime/application.ts`, sem recriar console legado, sem uso de `:4110`, sem push em `close-final-candidate`, `sf-red-clusters`, `go-live-close` ou `sf-frontend-bundle`.
- Nenhum baseline, coverage, digest de execução, receipt histórico ou GO foi fabricado. O único pin alterado identifica bytes reais de produtor com proveniência e gate novo; sua evidência detalhada está em C8.1.

## Tabela agregada — primeira leitura dos oito shards

Leitura encerrada em **2026-11-20T01:16:02.004Z**. A/B foram consultados pelos handoffs e por seus runs/jobs/logs; seus checkpoints ainda não refletiam as conclusões recentes. Contagens abaixo são exclusivamente resumos finais Bun quando existem. **N/D não é zero.** Gates focados de C não são somados à enumeração integral.

| Shard | Branch | Run | Pass | Fail | Causas observadas | Unbound / pendência |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | sf-shard-a | [44646013868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646013868) | **N/D** | **N/D** | Console/porta legados; auth local; deadlines; recuperação UI; Portfolio; contratos HTTP; memória histórica | **Cancelado sem resumo**; 21 falhas parciais; 102/113 arquivos iniciados |
| 2 | sf-shard-a | [44646018333](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646018333) | **504** | **10** | Deadlines; Chromium; SQLiteIOERR; contrato de recusa; drilldown; positivos de memória |10 falhas classificadas preliminarmente, sem fix A validado nesta leitura; também 1 skip e 1 error |
| 3 | sf-shard-a | [44651344557](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651344557) | **N/D** | **N/D** | Ainda não enumeradas |**Em execução**, iniciado 01:08:21Z |
| 4 | sf-shard-b | [44645900692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692) | **497** | **14** | Handoff/idempotência; integridade de verificador; C12 receipts; totais/cobertura; auth/UI; guard; AM01 |14 falhas classificadas preliminarmente, sem fix B validado nesta leitura |
| 5 | sf-shard-b | [44645913808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808) | **N/D** | **N/D** | Custo/sensibilidade; Atlas; BI; coverage/freeze; auth/UI; transporte; threshold |**Cancelado sem resumo**; 20 falhas parciais; enumeração incompleta |
| 6 | sf-shard-b | [44651628624](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651628624) | **N/D** | **N/D** | Ainda não enumeradas |**Em execução**, iniciado 01:10:33Z |
| 7 | sf-shard-c | [44645952434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645952434) | **518** | **12** | Mapa C7 completo; Atlas e revogação validados; AM02 chega a ponto novo |**10 testes ainda sem gate verde**:9 falhas originais não corrigidas + AM02 no ponto posterior; todas classificadas |
| 8 | sf-shard-c | [44645956665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645956665) | **618** | **2** | Pin corrigido e validado; clique/cleanup de browser |**1 causa unbound**, browser; pin validado em gate 2/0 |

A coluna unbound descreve o tratamento das falhas, não uma contagem recalculada de uma execução integral após fixes. No shard 2, o error não tratado pertence ao lançamento tardio de Chromium; não é um 11º teste falho. As contagens parciais de 1/5 não substituem seus totais ausentes. Não existe resultado completo dos oito shards nem união verde.

| Shard | Snapshot da enumeração |
| --- | --- |
| 1 | `a4bbf6b042526a0ee3f544243cfa67158236f871` |
| 2 | `dcb0c68d7e866b4df2153eadd26fda2eab45b266` |
| 3 | `bce2f0ed56f7073254b4316853eca2ed0c0f5fcb` |
| 4 | `dd45d888617943df40e02815d58b59f88d8a18f7` |
| 5 | `f0bccdc48b42a9d000f3bda6565fa3d88286c845` |
| 6 | `204a74491764dcde4da22ebe558efc318e04a777` |
| 7 | `0cc9380fdc452c2da328a787e207396c4040c5e1` |
| 8 | `13f88387091b7db295a73aca0d20fb3859a56ae7` |

Handoffs A/B lidos no fechamento: [A](https://github.com/gustavomhss/Orchestra-SF/blob/sf-shard-a/docs/handoff/HANDOFF-sf-shard-a.md), blob `f03918419c9ac60ac3359cfb9c0409b9ac679511`; [B](https://github.com/gustavomhss/Orchestra-SF/blob/sf-shard-b/docs/handoff/HANDOFF-sf-shard-b.md), blob `2960b4e13181840f25aa2f683fbe37b8bc5774c7`. Ambos ainda descreviam as primeiras enumerações como em andamento; por isso foram confrontados com Actions. Runs antigos de preflight com ENOENT ou `TEST_PACKAGE_NOT_FOUND:modules/sucafina` não fornecem contagem de testes e não integram a tabela.

## Falhas A/B — evidência da primeira leitura

Os mapas abaixo registram o comportamento observado, com classificações preliminares. Não atribuem correção de causa raiz às sessões A/B. Linhas de declaração são identificadas quando um timeout não fornece stack da instrução bloqueada.

### Shard 1 — enumeração A interrompida

[Run 44646013868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646013868), snapshot `a4bbf6b042526a0ee3f544243cfa67158236f871`, job 135988658580: **cancelled, N/D pass /N/D fail finais**. O log interrompido mostra 557 eventos pass,21 fail e0 skip, com102 dos113 arquivos iniciados; não há resumo Bun nem erro não tratado entre testes observado. Esses eventos não são o resultado final do shard. Último arquivo ativo: `test/product/wp10/analysis-composition/alternative-selection.test.ts`. O log diz “The operation was canceled”, e a API encerrou o run às01:13:00Z. Não foi inferida autoria de cancelamento. Classificações abaixo são preliminares; paths relativos a `modules/sucafina/Sucafinav1/test/`.

| Falha (file:line) | Causa observada / unbound |
| --- | --- |
| `runtime-http.test.ts:169:55` | Add risk não encontrado em30s; seletor/fluxo legado |
| `business-browser.test.ts:22:26` | ERR_CONNECTION_REFUSED em localhost:4110 Settings; dependência legada de porta fixa |
| `business-browser.test.ts:210:16` | ERR_CONNECTION_REFUSED em localhost:4110 Suppliers |
| `parity-polling-browser.test.ts:10:16` | ERR_CONNECTION_REFUSED em localhost:4110 Settings |
| `product/installed-bi-closure/temporal-contract.test.ts:12:7` | Deadline165000 ms; BI10/BI09; custo interno unbound |
| `product/installed-bi-closure/temporal-contract.test.ts:61:151` | Deadline165000 ms; persistência Portfolio retorna abortada |
| `product/wp02/host-workbench.test.ts:147:16` | Falha HTTP em /sucafina/auth/local; status exato não impresso |
| `product/wp02/host-workbench.test.ts:280:16` | Falha HTTP em /sucafina/auth/local |
| `product/wp02/host-workbench.test.ts:468:16` | Falha HTTP em /sucafina/auth/local |
| `product/wp13/source-scenario.test.ts:32 (declaração)` | Timeout180000 ms; await interno não localizado |
| `product/c12-receipt-recovery/recovery-ui.test.ts:72:17` | Retry same application não visível em30s |
| `product/c12-receipt-recovery/recovery-ui.test.ts:197:57` | [data-recover-change]:enabled não visível em30s |
| `product/wp12/native-execution-portfolio.test.ts:14; product/wp12/native-portfolio-preparation.ts:150:26` | Total esperado null, recebido 240000; portfolio |
| `product/wp12/native-execution-portfolio.test.ts:134; product/wp12/native-portfolio-preparation.ts:150:26` | Total esperado null, recebido 240000; sensitivity |
| `product/wp01/workbench-analysis.test.ts:144:27` | Prepare HTTP200 esperado, recebido 400 |
| `product/wp01/workbench-analysis.test.ts:380:27` | Após alteração de acesso: HTTP403 esperado, recebido 200; preservar negativo |
| `product/wp10/integration/public-state.test.ts:49:28` | GET Dashboard legado esperado 200, recebido 404 |
| `product/wp10/integration/bi-fallback-lifecycle.test.ts:49:16` | Falha HTTP em /sucafina/auth/local |
| `product/wp10/integration/analysis-stale-calculation.test.ts:303:28` | scoped.state esperado unavailable, recebido historical |
| `product/wp10/integration/analysis-stale-calculation.test.ts:346:10` | Preflight esperado denied/analysis-stale-access-unavailable, recebido ok com sourceFence |
| `product/wp10/integration/analysis-stale-calculation.test.ts:410:23` | Flag de injeção fired esperada true, recebida false |

### Shard 2 — enumeração A

[Run 44646018333](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646018333), snapshot `dcb0c68d7e866b4df2153eadd26fda2eab45b266`, job 135988673159: **504 pass / 10 fail**, mais **1 skip e 1 error**, 515 testes em 107 arquivos, 2.278,24 s. O skip existente é `test/local-backups.test.ts` (root estrangeiro exige privilégios de fixture). O erro não tratado é o timeout tardio de Chromium; não constitui um décimo primeiro teste falho. Classificação preliminar pela evidência do log, sem fix A validado nesta leitura.

Paths desta tabela relativos a `modules/sucafina/Sucafinav1/test/product/`, salvo `runtime/local-store.ts`, relativo a `modules/sucafina/Sucafinav1/`.

| Falha (file:line) | Causa observada / unbound |
| --- | --- |
| `mixed-source-contracts/recorded-fallback.test.ts:11:7` | Deadline cooperativo165s; custo interno unbound |
| `wp08/thread-period-continuity.test.ts:17` | Hot Topic day excede30s; declaração parametrizada, await interno não localizado |
| `wp05/sensitivity-integration.test.ts:9; wp05/browser.ts:9:34` | Timeout180s; Chromium launch falha em fixture-setup, erro não tratado tardio; stack também teste:43:9 |
| `operations-fixes/document-search.test.ts:5; runtime/local-store.ts:55:16` | SQLITE_IOERR na abertura SQLite; storage/fixture/auth |
| `wp12/native-execution-collaboration-recall.test.ts:143` | Timeout120s, duração reportada286,487s; ponto interno unbound |
| `wp12/native-execution-executive.test.ts:213:31` | Esperava unavailable/analysis-source-unavailable; recebeu denied/case-selection-unavailable |
| `wp10/integration/bi-call-scope.test.ts:402:56` | BI retornou sem drilldown de registro Planner |
| `wp10/memory-integrity/revocation-tail.test.ts:87:22` | Positivo producer.prepare indisponível; possível família observação Atlas, não comprovada neste teste |
| `wp10/memory-integrity/revocation-tail.test.ts:104:29` | Positivo verifier.verify indisponível antes da revogação |
| `wp10/memory-integrity/revocation-tail.test.ts:124:29` | Positivo verifier.verify indisponível antes da aceitação/revogação |

### Shard 4 — enumeração B completa

[Run 44645900692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692), snapshot `dd45d888617943df40e02815d58b59f88d8a18f7`, job 135988262742, attempt 1: **497 pass /14 fail**,511 testes/118 arquivos,2.480,75s. O estado transitório queued foi o cleanup, não um rerun. Classificação preliminar sem fix B validado nesta leitura. Paths relativos a `modules/sucafina/Sucafinav1/test/product/`; o produtor `product/integration/product-authority.ts` é relativo à raiz Sucafinav1.

| Falha (file:line) | Causa observada / unbound |
| --- | --- |
| `wp13/handoff-persistence.test.ts:95:29` | Preparação: esperado ok, recebido stale; validade de escolha |
| `wp13/coverage-sensitivity-integration.test.ts:115:109` | Verificador aceitou objeto alterado após validação final: esperado false, recebido true; integridade de egress |
| `wp13/handoff-domain-integration.test.ts:392:39 (chamador :65:93)` | Canonical Procurement preparation unavailable |
| `wp13/handoff-c08-predispatch.test.ts:242:200` | Retomada: esperado ok, recebido conflict; idempotência |
| `wp13/handoff-canonical-integration.test.ts:176:200` | Retomada: esperado ok, recebido conflict; idempotência |
| `proof234/am04-c12-return.test.ts:78:18; c12-receipt-recovery/consumer.ts:81:43` | Authoritative receipt namespace unavailable |
| `wp12/native-execution-reevaluation.test.ts; wp12/native-portfolio-preparation.ts:150:26` | Total esperado null, recebido 240000; contrato de total/cobertura |
| `wp12/native-execution-purchase.test.ts (pending); wp12/native-procurement-preparation.ts:193:43` | Total esperado null, recebido 240000; contrato de total/cobertura |
| `wp12/native-execution-purchase.test.ts (complete); wp12/native-procurement-preparation.ts:193:43` | Total esperado null, recebido 240000; contrato de total/cobertura |
| `wp07/browser-ui.test.ts:45:41 (captura :500:21)` | Erro HTTP em /sucafina/auth/local; entrada legada |
| `ui-split/ui-source/draft-replay.test.ts:32:27` | Replay esperado 200, recebido 403; autorização |
| `ui-split/ui-work/guards.test.ts:23:18` | Guards exit 1, base0; arquivos protegidos |
| `integrated-proofs/am01/portfolio-recall-proof.test.ts:19 (declaração; budget :148)` | Timeout240000 ms sem stack do await interno |
| `integrated-proofs/am01/recall-five-profiles.test.ts:31:25; product/integration/product-authority.ts:77:15` | SF_PRODUCT_AUTHORITY_CONFIG_INVALID; configuração de autoridade |

### Shard 5 — enumeração B interrompida

[Run 44645913808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808), snapshot `f0bccdc48b42a9d000f3bda6565fa3d88286c845`, job 135988306632, attempt 1: **cancelled, N/D pass /N/D fail**. Não existe resumo Bun final. Foram observadas **20 falhas parciais**, listadas abaixo; esse número não substitui o total do shard. Job iniciou 00:26:45Z, Run tests cancelou 01:11:58Z, run encerrou 01:12:15Z. Intervalo compatível com timeout-minutes45 de `.github/workflows/test-ci.yml:25`, mas log só informa “The operation was canceled”; não há autoria de cancelamento exposta. Última fase: `planner-calculation.overlapping-revocation`, iniciando recall real do Atlas. Paths relativos a `modules/sucafina/Sucafinav1/test/product/`.

| Falha (file:line) | Causa observada / unbound |
| --- | --- |
| `installed-bi-closure/sensitivity-history.test.ts:19:11 (omitted)` | Deadline cooperativo165000 ms; custo de sensibilidade |
| `installed-bi-closure/sensitivity-history.test.ts:19:11 (confirmed)` | Deadline cooperativo165000 ms; custo de sensibilidade |
| `installed-bi-closure/sensitivity-history.test.ts:66:6` | Deadline165000 ms; histórico de escolha após treinamento |
| `similarity217/installed.test.ts:53:29 (AC01/02)` | ok→unavailable; recall/similaridade Atlas |
| `similarity217/installed.test.ts:99:29 (AC05)` | ok→unavailable; fonte histórica |
| `similarity217/installed.test.ts:137:28 (AC06/07)` | ok→unavailable; autoridade de atores |
| `wp12/native-execution-bi.test.ts:85:149 (sf_finance)` | Predicado true→false; evidência de BI |
| `wp12/native-execution-bi.test.ts:85:149 (sf_maestro)` | Predicado true→false; evidência de BI |
| `wp11/source-promotion-coverage.test.ts:182:67` | Igualdade da prova de cobertura diverge |
| `wp01/planner-monthly.test.ts:44:17` | Erro HTTP em /sucafina/auth/local; entrada legada |
| `wp00/contract-freeze.test.ts:19:72` | Digest de contrato versus freeze diverge; requer proveniência, sem re-pin especulativo |
| `wp10/integration/portfolio-promotion.test.ts:227:68 (fixture :43:14)` | Deadline cooperativo285000 ms; cobertura/autoridade |
| `wp10/integration/review-portfolio-http.test.ts:271:38` | Recusa esperada denied, recebida unavailable |
| `wp10/integration/review-portfolio-http.test.ts; wp10/integration/review-access-browser-fixture.ts:29:45` | WP10_REVIEW_BROWSER_TRANSPORT_DEADLINE10000 ms |
| `wp10/integration/bi-lifecycle.test.ts:202:33 (shell/refresh/sign-out)` | Erro HTTP de enrollment /sucafina/auth/local |
| `wp10/integration/bi-lifecycle.test.ts:202:33 (chamador :249:34)` | Erro HTTP de enrollment; resultado retido/revogação |
| `wp10/integration/bi-lifecycle.test.ts:202:33 (chamador :286:11)` | Erro HTTP de enrollment; limpar seleção |
| `wp10/integration/bi-lifecycle.test.ts:202:33 (chamador :315:29)` | Erro HTTP de enrollment; retorno da fonte |
| `wp10/integration/portfolio-exact-threshold.test.ts:43:19 (helper :213:41)` | denied/criterion-result-access-unavailable |
| `wp10/integration/planner-calculation.test.ts:615:58` | Recall Atlas esperado comprimento1, recebido 0 |

## Como retomar

1. Partir de `sf-shard-c`, último código `9643737ac1b2a0c475af283dddc72db70d81a81c`, e ler este handoff no HEAD atual. Os quatro commits de código estão vinculados aos respectivos gates na primeira tabela.
2. Obter pelo GitHub MCP os resultados de 3/6 quando concluírem; reconsultar A/B antes de declarar qualquer agregado final. Para1/5, tratar a interrupção e a causa concreta antes de nova execução; não apresentar eventos parciais como totais.
3. Para C, escolher uma causa unbound do mapa. A prioridade de AM02 é o oracle de persistência com efeitos autorizados exatos; memória/escopo Planner/desempenho pertencem a fatias compartilhadas quando exigirem produtor fora de test/**.
4. Preservar os positivos e negativos existentes. Consumidores legados precisam ser migrados ao host nativo, nunca reanimados em `runtime/application.ts` ou em porta fixa.
5. Um commit por causa e um gate após fix concreto; máximo dois gates ativos. Se o mesmo ponto falhar duas vezes, parar a causa e registrar unbound. Nenhum gate idêntico sem mudança.

## Comandos e resultados

- `bun typecheck` (app-shell): **não rodado**; sem alteração no app-shell.
- `bun typecheck` (modules/sucafina), invocado pelo teste estático em Actions: **exit 2**, 21 diagnósticos TS em fixture de Operations, detalhados em C7.8.
- `bun run check:guards --base origin/dev`, invocado pelo mesmo teste: **exit 1**, 78 regras,6.183 paths,2 gate,194 warn,0 errors; aprovação de paths protegidos não observada.
- `bun run test:ci ...`: **não executado em shell**. Os snapshots GitHub acionaram `test-ci`: enumeração7 **518/12**; enumeração8 **618/2**; pin **2/0**; Atlas **1/0**; observação **2/0**; AM02 **0/1** em ponto novo.
- `sf-ci`: **não rodado**.

Não há declaração de release, inferência de agente, AM02 qualificado, cobertura completa dos oito shards ou GO.
