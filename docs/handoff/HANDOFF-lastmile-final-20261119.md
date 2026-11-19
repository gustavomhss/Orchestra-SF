# Handoff — lastmile-final-20261119

SHA: 4372b98d8e4db09a56f8ad589fb298c8779c84bf (candidato integrado e origem do pacote; este handoff posterior é somente documentação em branch separada)
Data: 2026-11-19
Estado: partial

Base inicial confirmada: sf-join-four @ f590e80e7b4b5d6ae17ca753b40583019b50a998.
Template: docs/handoff/HANDOFF-TEMPLATE.md de sf-handoff-brief, blob 725697cdae3a42133df81a42637ff70214a78cb3; ausente na base.
Briefing lido integralmente uma vez em sf-handoff-brief. Esta entrega não declara GO.

## Feito

- WPs1–5 editados em branches disjuntas criadas a partir da base confirmada. Edição encerrada no limite aproximado por WP; o restante foi explicitado como unbound. Execução somente por GitHub Actions, sem shell ou acesso à máquina do dono.
- Integração por merges normais, sem bypass de proteção: WP1 PR351 → 6bb58f9d717ac8105387fcfe316f5c9656fbbff4; WP2 PR352 → 515262e65c8deef8078b20738be791588369730b; WP3 PR353 → b2de392f3cb0508c6f9b566ec2ab780c30ba3682; WP4 PR355 → 89a5d52a191c565a22a1b1d7e55d873a8c57d62d; WP5 PR354 → 4372b98d8e4db09a56f8ad589fb298c8779c84bf.
- Inventário por leitura do diff base→final: exatamente 10 arquivos E2E atribuídos e 5 handoffs; nenhuma mudança em application.ts, workflow, baseline/coverage, release target ou .ci-run.json. Isso é inventário, não guards PASS.
- WP1: forecast OPEX, apresentação/reabertura da revisão e resolução de fontes vinculados aos contratos nativos conferidos; remoção individual explicitamente unbound.
- WP2: navegação/criação Dashboard e identidades nativas, separação de URL de navegador e request de negação; duas correções pós-gate estão NOT-VERIFIED.
- WP3: versões CAP23 e linhas CAP18, CAS/projeção/ID reais, confirmação única; guard impede preparação ainda legada de Decisions de navegar a :4110.
- WP4: entradas Planner/BI/review/agenda nativas, revisão inicial de versão, owner exato de CAP04, payload e persistência; sectionId não implementado causa erro UNBOUND.
- WP5: entrada e criação Procurement nativas; sourcing-controller.spec.ts permaneceu inalterado por montar explicitamente o screen-shell legado.
- WP6: sfa-factory-package apontada por lease para o SHA final. Head anterior 591424661cf43baedf798b470a112d32b9b0c514 preservado em lastmile-package-backup antes do reposicionamento. Sua história tinha 53 commits fora da integração.
- PR237 confirmada open/draft:true, head52d2c24f4f8cb776889b97894131df6ada43ce98; não alterada. Nenhum push em close-final-candidate, sf-red-clusters, go-live-close ou sf-frontend-bundle.

### Identidade dos WPs

| WP | Branch | SHA de código integrado | Head integrado com handoff | Gate |
|---|---|---|---|---|
| 1 | lastmile-wp1-20261119 | 60c72befab1648133123ac5240ab134001a31194 | 450a82a72798cf8a62a1cb580b71641430411680 | 44548593492 — failure, 4 failed |
| 2 | lastmile-wp2-20261119 | d8139cfcc8a0881ca3244ab8221a241293165a71 | 37bf31b863c397df4cfc71d0e3bf8f32b078e360 | 44548107962 — failure, 2 failed; testou 2e947689575b64cea7e51f42f3140c70dd386373 |
| 3 | lastmile-wp3-20261119 | e8bfc38f806e743196deca33aea552ee024b3b9f | 63fff219447a86d09820cc13ddcbf7029db8c4b7 | 44550439407 — failure, 2 failed |
| 4 | lastmile-wp4-20261119 | 99e557e6cd6e805ee5978b95f2e47b19a80a2252 | 77906af305d53417a8b3aa660f4a2db19f1ec510 | 44550163383 — failure, 2 failed |
| 5 | lastmile-wp5-20261119 | ebf070655efcbad1d81942372f59df2681676f51 | e1fc7e8f63d09bf117dbc220d45cde46375f4641 | 44547738478 — failure, 8 failed / 2 passed |

Os cinco handoffs individuais estão no candidato integrado em docs/handoff/HANDOFF-lastmile-wpN-20261119.md. As declarações locais de "sem merge/pacote/sf-ci" descrevem o momento anterior à integração; esta seção registra o estado posterior.

### Arquivos de escopo

Todos os caminhos desta tabela partem de packages/app-shell/e2e/sucafina/.

| WP | Arquivos |
|---|---|
| 1 | reports-support/review-flow.ts |
| 2 | dashboard-installed/support.ts; dashboard-installed/records-signals-history.spec.ts; dashboard-installed/confirmation-access.spec.ts |
| 3 | bi-installed/installed-fixture.ts; bi-installed/installed-planner-ingress.spec.ts |
| 4 | wp03/planner-mounted.spec.ts; wp10/extended-flows.ts; review-agenda-support/first-agenda.ts |
| 5 | wp04/procurement.spec.ts; wp04/sourcing-controller.spec.ts inspecionado e mantido inalterado |

### Correção posterior ao congelamento

- [PR356](https://github.com/gustavomhss/Orchestra-SF/pull/356) draft, base sf-join-four; não integrada e NOT-VERIFIED.
- Código8375685071b5b2603fa0391e4c4b5ec862330d5c; head com handoff5567496a6831aeaa8bc59010e78cf9e5bc47b7ed na branch lastmile-wp1-20261119. Esses dois commits são posteriores ao head WP1 integrado na tabela acima.
- Uma linha em review-flow.ts:105 muda a serialização diagnóstica para options.removeOne ?? false. O guard e todas as asserções permanecem. Corrige por inspeção a comparação impossível apontada por TS2367; nenhum compilador/teste executou o patch.
- Candidato sf-join-four e pacote permanecem4372b98d8e4db09a56f8ad589fb298c8779c84bf, com a versão anterior. Handoff WP1 atualizado na branch do patch, não no candidato congelado.

## Pendente

Caminhos E2E abaixo partem de packages/app-shell/e2e/sucafina/. O inventário completo está em cada handoff individual.

- WP1 reports-support/review-flow.ts:21 — Reports and backup ausente no gate antes dos helpers alterados; :27,110 remoção individual; :154 sucessor; :429,430 destino nativo autorizado de fonte; :446 total anual. reports.spec.ts:49,56,86 ainda assume review-read/ordem Projects-first, enquanto UI48 usa dashboard-review/ordem salva.
- Regressão introduzida no WP1 — reports-support/review-flow.ts:105:126: TS2367 em `removeOne: options.removeOne === true`, pois o guard anterior já estreitou o valor para false|undefined. O typecheck E2E do sf-ci real apontou esse diagnóstico. Pendente corrigir a serialização do booleano (por exemplo `options.removeOne ?? false`) sem remover o guard nem as asserções. Correção de uma linha preparada na PR356 (código8375685071b5b2603fa0391e4c4b5ec862330d5c), não aplicada ao SHA congelado e não verificada; não atribuir esse erro à base.
- Erros herdados fora dos WPs — decisions-support/planner-sources.ts:21,39 duplica `name`; operations-support/imports.ts:106,182 duplica `detail`, com efeitos de tipo em :193,194,195,220. Bloqueiam a coleta de DECISIONS/OPERATIONS. Blobs iguais na basef590 e no mergeaece: 7b1441822f3e3d305e4c2a2a4eb06e47758242c8 e 46515f500616b327ad3de082cf56e4d08ccadd84, respectivamente.
- WP2 dashboard-installed/records-signals-history.spec.ts:27 — Sign out ausente; confirmation-access.spec.ts:10 — timeout existente durante primeiro passo. support.ts:117,166,173 ainda tem confirmação/disclosure mensal legados; history/conflict/risk/signals têm a lista completa no handoff. Correções 7e448802e5f89e8aed59ed77c3d2b61c00e66be5 e d8139cfcc8a0881ca3244ab8221a241293165a71 posteriores ao gate não foram executadas. A contagem por pathname/page/action não prova equivalência de origem.
- WP3 bi-installed/installed-fixture.ts:217,337 — Create first version ausente; installed-planner-ingress.spec.ts:81 — Versions ausente. installed-fixture.ts:279 monthly bulk ainda legado; :49,51,53 preparação Decisions guardada antes de :4110.
- WP4 wp03/planner-mounted.spec.ts:27 — CAP23 ausente; :29 Sign out não vinculado; :48,84,175 bulk/saved-grid; :98,127,137 gerenciamento/official. wp10/composition.spec.ts:368 falha por cookie de enrollment ausente antes de extended-flows. extended-flows.ts:17,19,24,64,68 BI/review legados; :131,133 sucessor; :10,153,155 sectionId explicitamente unbound. first-agenda.ts:22,47,92,155 picker multi-domain e preservação não vinculados; consumidor nominal não coberto pelo gate.
- WP5 wp04/procurement.spec.ts:27 — Requests ausente nos oito testes; :30 proveniência C02; :125,140,181,202,217 controles de formulário/CAS; :245,257,279,291,313 aprovação/stale/race; :328,347,366,445,460,473 recorrência/sourcing/PO/FX; :111,512,513,541,543,579,580,599,605,619 banking/redaction/settings. sourcing-controller.spec.ts:5,31,32,71,85 continua prova legada isolada.
- Binding compartilhado: wp03/installation-fixture.ts:14,53,108 e reports-support/production-installation.ts:124,134,201,229 não demonstram a associação autorizada da instalação ao shell nativo. Os logs mostram ausência de superfícies; não isolam toda a causa. Não inventar cookies, grants, CORS ou descriptors.
- Rota de retomada observada: native/journeys/reports-issuer.spec.ts:90–94 navega por target.chapterHref/shellOrigin de contexto já selecionado. native/fixture/installed-browser.ts:24,53,64,71 exige endpoint CDP privado, contextos pré-autenticados e Microsoft; não é bootstrap da fixture local. native/fixture/readiness.ts:154–177 observeNativeBinding confere discovery/instalação/contexto reais e admite Microsoft ou local-operator. A existência desse spec não é prova de run aprovado.
- WP6 — complete para a qualificação do pacote: run de push44551853461 success com receipt e upload verificados. Isso não resolve os E2E nem autoriza GO.
- WP7 — SHA exato unbound em .github/workflows/sf-ci.yml:27–37: checkout default de pull_request usa merge sintético e EXPECTED_SHA=github.sha. O run automático não testa o SHA exato de sf-join-four. SHA candidato4372b98d8e4db09a56f8ad589fb298c8779c84bf / tree723f1f1781ac951c048c91a71336b79070bfcae0; checkoutsf-ci aece7640562fe9830c54ee4e73836e830cc48e0c / treed370d005810a2d4e8d01fef79befc66eae0cfe2a. Há cinco arquivos de produto adicionais nesse merge, vindos da base close-final-candidate, não dos WPs.
- Guards finais do SHA exato também permanecem unbound. Não transferir resultado do merge sintético ao candidato.

## Decisões e justificativas

- Asserções de negócio removidas: nenhuma relatada nos WPs. Contratos DOM legados substituídos, diagnósticos retirados e todos os controles ainda não vinculados estão discriminados nos handoffs. Nenhum skip, timeout aumentado ou check vazio foi usado.
- Não reabrimos produtor nem implementamos fatos ausentes fora dos WPs. O capítulo continua dependente do produtor; controles não verificados não foram recriados.
- O runner real exige branch ci-run-linux-*, package "app" e config "e2e/playwright.production.config.ts"; o exemplo "app-shell" do briefing não é admitido pelo validador. Snapshots foram criados já com .ci-run.json, exceto o bootstrap WP5 documentado abaixo.
- Foi feita uma execução nominal por WP, sem rerun. WP5 teve um bootstrap adicional que falhou antes dos testes por configuração ausente. WP2 possui duas correções depois do único gate e não as apresentamos como testadas.
- O conector GitHub disponível não expõe workflow_dispatch. A interface GitHub abriu sem sessão autenticada; nenhum login foi solicitado/concluído, nenhum dispatch manual executado.
- O push autorizado de sfa-factory-package sincronizou a PR preexistente257 para close-final-candidate e acionou automaticamente sf-ci44551871355, além de dois runs do pacote (push e PR). Nenhuma PR nova foi aberta contra uma branch proibida e nenhuma base proibida foi modificada.
- Preservado o limite de um sf-ci: não disparar um segundo workflow para esconder/substituir a divergência de SHA. O resultado exato solicitado fica pendente, com comando de retomada explícito.
- Nenhum baseline, coverage, digest ou GO foi forjado. Exportações docx/pptx continuam Schema.Never no contrato; nenhum byte de export foi produzido por operação indevida.
- Este handoff posterior fica em branch de documentação para não mover o SHA já empacotado/executado.

## Como retomar

1. Partir de sf-join-four @ 4372b98d8e4db09a56f8ad589fb298c8779c84bf e dos cinco handoffs individuais. Conferir head antes de novas edições.
2. Qualificar e integrar o patch TS2367 da PR356 para review-flow.ts:105, preservando o bloqueio de removeOne; eliminar as redeclarações herdadas de name/detail sem mudar as asserções. Depois resolver enrollment e binding da instalação real ao shell; então os specs poderão alcançar os contratos nativos alterados. Usar discovery/contexto/identidade reais.
3. Concluir somente os bindings e fatos pendentes que tenham contrato do produtor conferido; preservar identidades, CAS, períodos, fontes, cálculos, persistência e bloqueios de autorização.
4. Reexecutar na retomada o spec estreito que alcance cada mudança; não repetir suites inteiras para procurar seletor.
5. Para o gate exato, numa nova retomada autorizada, acionar workflow420530405 por workflow_dispatch com refsf-join-four: `gh workflow run 420530405 --ref sf-join-four -R gustavomhss/Orchestra-SF`. Esse comando não foi executado nesta sessão. Conferir github.sha/checkout e não aceitar apenas head_sha da API.
6. No dispatch, os dois protected-paths herdados previstos pelo briefing são godfile-waivers.json e script/spawn-allowlist.json (script/guards/rules/protected-paths.toml:9–10). Só classificar "apenas os dois esperados" após ler os findings; failure sozinho não basta. Logs completos e receipt ficam no artifact sf-guard-bases-<SHA>-<attempt>.
7. No pacote, usar o archiveSha256 do receipt real do tar.gz, acompanhado de source/checkout/workflow SHA e run/attempt. Digest do ZIP de artifact não é digest do pacote. Não reaproveitar receipt antigo591424.
8. Não promover PR237, não fazer push nas quatro branches proibidas e não declarar GO a partir desta entrega parcial.

## Comandos e resultados

### Gates change-scoped

| WP | Run | Snapshot | Resultado | Primeiro limite |
|---|---|---|---|---|
| 1 | [44548593492](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44548593492) | 733ce5b52448c0ff02a79a43aab1e53c87aa5125 | failure, 4 failed | review-flow.ts:21 |
| 2 | [44548107962](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44548107962) | 427912fa8c89c2c2062fa5cf53809eafa238124d | failure, 2 failed | confirmation-access.spec.ts:10; records-signals-history.spec.ts:27 |
| 3 | [44550439407](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44550439407) | 9bd090206b82e2fec4c5df613f5705308e0cfda2 | failure, 2 failed | installed-fixture.ts:337; installed-planner-ingress.spec.ts:81 |
| 4 | [44550163383](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44550163383) | 40ced78d45ebca77e01835f370429263071832d9 | failure, 2 failed | planner-mounted.spec.ts:27; composition.spec.ts:368 |
| 5 | [44547738478](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44547738478) | 0492549194b84444bfa8b4ea5ac4ec83836f67a7 | failure, 8 failed / 2 passed | procurement.spec.ts:27; passes só sourcing-controller legado |

WP5 bootstrap [44547735238](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44547735238): failure em Read request, ENOENT .ci-run.json, sem testes. Nenhum desses runs demonstra sucesso dos fluxos nativos ainda não alcançados. Cleanup dos cinco snapshots nominais concluiu success.

### WP6 — pacote: complete

- Evidência primária: push [44551853461](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44551853461), attempt1, job135657398119: success. Auditoria independente e upload: success.
- SF_FACTORY_PACKAGE_QUALIFIED e SF_FACTORY_RECEIPT_VERIFIED foram lidos dos logs reais e concordam: sourceSHA=checkoutSHA=expectedSourceSHA=workflowSHA=4372b98d8e4db09a56f8ad589fb298c8779c84bf; runID44551853461; runAttempt1.
- TAR: orchestra-sf-factory-linux-x64-baseline.tar.gz; archiveSha256=`ec193665f86d85e8cf0a49383b620874591f40791589cddcdaf6dcbe188339ec`.
- manifestSha256=`ce2e4461b6fee4f8fadc61cda109664616d178667959206af72c8ea5bdb00011`; bundleSha256=`b5bcf386c5f4d27bab70b2f2ab4cfb660a1cf0c32b9bcb0e80e04f2171d55a5a`.
- [Artifact14543542729](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44551853461/artifacts/14543542729), nome sf-factory-package-44551853461-1-4372b98d8e4db09a56f8ad589fb298c8779c84bf, 91517380 bytes, expires2026-11-26T15:14:30Z. Digest do ZIP de evidência=`sha256:1972878fd7337f248f7880392129c82ee036ac0c5f87f7888d0c8dbf574e992b`; não é o digest do TAR.
- Receipt atesta extração fora do checkout, 1413 arquivos totais, 1310 arquivos web publicados e nenhum sourcemap web publicado. GET de dashboard legado autenticado permaneceu404; current-choice autenticado retornou200/ok.
- Run secundário automático PR [44551871303](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44551871303), job135657461315: success, auditoria e upload success. Source/checkout4372b98..., workflowSHAaece764...; artifact14543537787. TAR desse outro run tem digest`2118ba58c6dbefd4381322878676a4c7f31908eb19262a398a9c11c4d8f140c8`. Não intercambiar receipt/digest/artefato entre os runs; push permanece referência principal.
- Nenhum digest foi calculado localmente, inferido do ZIP ou copiado do pacote antigo.

### WP7 — sf-ci único e guards: partial / SHA exato unbound

- Run automático [44551871355](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44551871355), attempt1, eventpull_request, PR257: em acompanhamento para resultado agregado; os resultados abaixo já são terminais.
- head_sha da API4372b98d8e4db09a56f8ad589fb298c8779c84bf; checkout real aece7640562fe9830c54ee4e73836e830cc48e0c comprovado pelo job135657462853 e artifactsf-omni-linux-aece7640562fe9830c54ee4e73836e830cc48e0c. O merge tem cinco arquivos de produto adicionais; não equivale à tree do candidato.
- sf/static-and-contracts, job135657462411: failure. Geração e typecheck do produto success; typecheck E2E FAIL, 147 inputs declarados, 3776 arquivos do compilador, 10 diagnósticos, exit2. Nove diagnósticos provêm das duas redeclarações herdadas e seus efeitos; um novo é TS2367 em review-flow.ts:105. Build web skipped.
- [Artifact E2E14543802969](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44551871355/artifacts/14543802969): sf-e2e-inclusion-aece7640562fe9830c54ee4e73836e830cc48e0c-1.
- Guards/spawn no mergeaece terminaram com exit0: canonicaldev=a1d37698a7bb097c1578f827eba6a19b9917ef07; PRbase=52d2c24f4f8cb776889b97894131df6ada43ce98; spawn0, guard-dev0, guard-pr-base0. [Artifact guards14542948268](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44551871355/artifacts/14542948268). PR257 tem label guardrail-approved; log mostra GUARDRAIL_APPROVED=protected-paths. Portanto este run de PR não reproduz os dois findings esperados de workflow_dispatch sem label.
- CI-UI-OPERATIONS, job135658029464: failure na coleta, SyntaxError imports.ts:182 (detail redeclarado), seguido de No tests found; zero testes iniciados. Sem artifact de UI porque não houve arquivos produzidos.
- CI-UI-DECISIONS, job135658029387: failure na coleta, SyntaxError planner-sources.ts:39 (name redeclarado); zero testes iniciados. Sem artifact de UI pela mesma razão.
- CI-UI-REPORTS, job135658029420: failure; 4 selecionados, 2 failed / 2 did not run / 0 passed por limite existente max-failures2. RPT-01/RPT-02 falham em review-flow.ts:21, link Reports and backup ausente; timeout original10000ms. [Artifact14542677834](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44551871355/artifacts/14542677834), sf-ui-failure-CI-UI-REPORTS.
- Nenhum workflow_dispatch, rerun, segundo sf-ci ou teste local foi executado. Falha estática não é atribuída genericamente aos dois protected-paths esperados: há um erro novo concreto e erros de coleta herdados.
