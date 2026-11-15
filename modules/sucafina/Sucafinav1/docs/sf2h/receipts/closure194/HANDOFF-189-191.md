# Missão 194 — U15/CAP14 — HANDOFF para 189 e 191

**Status: ARTIFACT_READY; BLOCKED_INTEGRATION / BLOCKED_INSTALLED_VALIDATION; GLOBAL_RELEASE=false.**
Epoch source-closure-e1-browser194. Ator: GPT-6; ID de sessão não exposto. Branch sf-ux-n22, PR #153; integradora atual 189/PR #65, dispatcher único de produto 191/PR #106, compilador 190/PR #107. Notificação em PR não significa ACK.

## Autoridade, SHA e proveniência

- Pacote imutável 194.json no commit e027e7ba4141d42075714939f8d9f686b1fec157, blob 5318293873ae6a7228d4e7c1eb1a630e2ab6e31c. Predecessor 185 no 510288e459f47d12364f43b458368a7bc465e87b, future writes revogados via S0-FENCE.
- HEAD/árvore inicialmente verificados: 97c2c456cd0edf688392faa06bd1dffe6233a890 / edce15f23a30e017f15a145d8340b24cfdf93b82; S0-FENCE.json blob ccb53748b3017372430be5b8cee4f15e730abb67 (preservado).
- Planning canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; normativo UX cbac654784714f68779ae1434d30e6ea8970c4d1. Contratos CAP14 de domain.page.CAP14 e domain.command.CAP14.save/delete permanecem Dashboard / Vendor Contracts.
- F04/187 commit 96c01020db59d9b4f8d44300638418d67ee11fea, HANDOFF blob fb48f3d79a2644f91237685eccf29a5e703ac972, ARTIFACT blob eb5b45c1417c9a75d59dc926b5b5f5eab1eb53be. APIs consumidas: nativeInstalledFixture, requireNativeJourney, observeNativeBinding, nativeDashboardCommandTarget e armLostResponse. Blobs F04 imutados: fixture cc7818e623e61e4217dfb2ada18ca3e1fa5f7e12; journeys 66e269a78af8262764228557e2eeccd29bca1a36; response-faults 71adbaaf679331a5a201aae663123ba87bc4a0b5.

## Alterações executadas, preimage/postimage

| Path | Pre blob | Post blob |
| --- | --- | --- |
| packages/app-shell/e2e/sucafina/native/journeys/u15.spec.ts | 1d59507133649d2ca57c0c30e2507193f35181fd | 01e56d1ac9cb3930f2c0486e15328e136a0a3e04 |
| modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure194/S0-FENCE.json (inalterado) | ccb53748b3017372430be5b8cee4f15e730abb67 | ccb53748b3017372430be5b8cee4f15e730abb67 |
| modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure194/VALIDATION-REQUEST-191.json (novo) | ABSENT | fcce1e38a50721283e0d8ccd6d064b36b7fd8502 |
| modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure194/ARTIFACT.json (novo) | ABSENT | 7d9b1a273abc8e67c97910511a23f003d8b4fde0 |
| modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure194/HANDOFF-189-191.md (este documento) | ABSENT | Ver blob do commit de entrega / PR #153; autorreferência de hash não é possível dentro do próprio blob |

Commits de código via GitHub MCP, expected-head CAS e force:false: 41c6e13a7aaad46dd2c2931b95a9e39fe8cfa0fa e f956939313132c307381714859792db366db19e8. Árvore de código: 8724b16c504c568143b4f636b7350f0695a486e1. Nenhum outro path alterado pela autoria; nada em sf2-stack, SDK gerado, fixture F04, engines, infraestrutura, CI workflow, dev ou Azure.

## Comportamento efetivamente escrito (seis jornadas, nenhuma removida)

1. CAP14 leitura autorizada: principal requester de contexto real F04 + admissão read, GET original e filtered-empty com filtro preservado.
2. CAP14 edição: admissão save real, registro único com ID e versão contracts:id vindos do GET, somente POST original Dashboard Vendor Contracts; resposta do produtor, idempotency-key e reread de versão/valor.
3. CAP14 denied: requireNativeJourney com actor=denied, capabilityId=CAP14, intent=denied consulta o contexto real; não exige proveWeb nem componente autorizado visível. DOM sem lista, detalhes, campos ou review e zero POST.
4. CAS stale: requester retém review no ID/versão original. Outra BrowserContext Microsoft já autenticada, principal holder ou dashboardAdmin e admitida a CAP14 save, salva no MESMO ID e avança versão real. Só então requester envia o POST obsoleto e exige 409 real, sem aviso de sucesso.
5. Lost response: armLostResponse recebe exatamente nativeDashboardCommandTarget(manifest,CAP14), incluindo page=Vendor Contracts; 1 POST ao produtor original, resposta transport perdida, alerta de resultado incerto; GET autorizado posterior prova novo valor/versão sem POST adicional.
6. Reflow/teclado: preserva 320/768/1024/1280/1440, Tab, acrescenta 200% texto e 400% em 320 CSS px, sem trocar o produto por mock.

## Dependências e limites de prova

- Este patch não instala identidade. No HEAD da branch autora, fixture.ts F04 não está presente; no sf2-stack observado em 4426445c05823ed4932b8a8e35391df024bf74f3 a fixture real já tinha blob cc7818e623e61e4217dfb2ada18ca3e1fa5f7e12 e o spec antigo 1d59507133649d2ca57c0c30e2507193f35181fd. Integrar só o novo spec por blob, reconciliando a HEAD viva e CAS.
- O host do Actions deve fornecer F01/F02 em produção, manifesto privado 0600 dentro da raiz 0700, candidate SHA C consistente, conexão serverKey aprovada, sessões Microsoft requester/holder/denied realmente distintas, sessão denied quando selecionada e holder ou dashboardAdmin com permissão CAP14 save quando stale. Contextos secundários genuínos devem permanecer acessíveis no mesmo Browser de Playwright por browser.contexts(); sem esse input, teste falha explicitamente. Não criar novos contextos autenticados, copiar cookie/storageState, forjar header/grant, nem simular resposta.
- F04 precisa fornecer SF_NATIVE_U15_LIST_URL, SF_NATIVE_U15_EDIT_URL, SF_NATIVE_U15_DENIED_URL, SF_NATIVE_U15_STALE_URL, SF_NATIVE_U15_LOST_RESPONSE_URL com origem e query iguais ao chapterHref; ao menos os casos edit/stale/lost exigem registro real unívoco, ID e versions[contracts:id] operacional. URLs não criam autorização nem conflito. Os registros de mutação devem ser isolados entre seleções.
- Persistem limitações herdadas do produto: U15-AC01 decision/case-link BLOCKED_CONTRACT se não houver source ref e versão completos; este escopo de teste não permite mudar produtor ou código compartilhado. U15-AC02/03 são assertions escritas, sem evidência de browser/desktop ou aceite do candidato.

## Validação e próximo passo executável

**Tests NOT_RUN; builds NOT_RUN; validators NOT_RUN; typecheck NOT_RUN; guards NOT_RUN; CI NOT_RUN; não existem run IDs nem PASS desta missão.** Nenhum teste local, disparo CI ou deploy foi realizado. A sessão não altera a fila nem assume que 189/191 recebeu ACK.

**Para 189:** confirmar HEAD atual de sf2-stack, consumir o blob 01e56d1ac9cb3930f2c0486e15328e136a0a3e04 somente em packages/app-shell/e2e/sucafina/native/journeys/u15.spec.ts e manter F04 original e predecessores; publicar candidate C/tree e ACK explícito de aplicação, sem merge dev. Recibo detalhado em ARTIFACT.json.

**Para 191:** após 189 publicar candidate C e instalação genuína, deduplicar seleção já existente e executar somente packages/app-shell/e2e/sucafina/native/journeys/u15.spec.ts (6 casos nominados em VALIDATION-REQUEST-191.json, blob fcce1e38a50721283e0d8ccd6d064b36b7fd8502) pelo runner Playwright production/native preexistente; publicar run/job ID, seleção realmente coletada e resultado; não inventar PASS se faltar sessão ou fixture. Compilador/typecheck/guards são autoridade 190, não 191/194.

GLOBAL_RELEASE permanece false. Documento e comentário de PR são handoff/notificação, nunca ACK nem prova instalada.
