# Missão 185 — handoff do spec U15 / CAP14
**Epoch:** `closure-e1-browser185`; **branch/PR:** `sf-ux-n22` / [#153](https://github.com/gustavomhss/Orchestra-SF/pull/153); **estado:** `ARTIFACT_READY; BLOCKED_INTEGRATION; NOT_QUALIFIED`.

## Patch já publicado
- Commit `a273a1836eb62dc5b75395c6c68e3849bf3eea3e`; tree `ea3b2aa4841bd4d91bbfe96dca1b44266c7e228f`.
- Fonte exclusiva `packages/app-shell/e2e/sucafina/native/journeys/u15.spec.ts`, blob `f849819ecc16cb8b45fe6a7657cad8f36e0764d2` -> `1d59507133649d2ca57c0c30e2507193f35181fd`.
- Seis casos originais mantidos, inclusive todas asserções: leitura/filter-empty; save/CAS e reread; negado por segundo ator; 409 stale; resposta perdida sem replay; viewport 320–1440 e foco por teclado. Os seis `test.skip` foram removidos sem downgrade de expectativa.
- Import real e exclusivo de F04 `../fixture.ts`: `nativeInstalledFixture`, `armLostResponse` e tipo `InstalledNativeHarness`. `proveWeb` faz descoberta/contexto/identidade na instalação original. Falta de manifesto privado, actor, mount ou URL deve falhar, jamais passar/skip.
- O seam de perda de resposta mantém POST original `{mount}/dashboard` e só aborta entrega; exige observação de status 200 e leitura autorizada após refresh, sem claim de receipt/commit C12.

## Dependência real (owner 187, PR120)
F04 **já está integrado** no consumidor `sf2-stack` observado em `8a81e11df2bf78a55de3166e07a53ee366aad2ab` / tree `5cee64807f55d0ec169801795712844051c47e16`: `fixture.ts` blob `d699d74f092a8211fde2611c827ed4ebd83a9274` e configuração de seleção nativa `e2b615a50c3907bbe21fd6158be47fcebf477679`. O consumidor mantém `u15.spec.ts` **anterior** blob `f849819ecc16cb8b45fe6a7657cad8f36e0764d2`, portanto ainda precisa integrar somente o novo blob `1d59507133649d2ca57c0c30e2507193f35181fd`. F04 não está na branch de autoria N22, mas a dependência já existe no candidato integrador; **não repetir a importação de F04 nem alegar que o host/identidade está provado**.

A 187 deve entregar a instalação privada autenticada `SF_NATIVE_INSTALLED_MANIFEST`, o vínculo `SF_NATIVE_CANDIDATE_SHA`, as cinco URLs `SF_NATIVE_U15_LIST_URL`, `SF_NATIVE_U15_EDIT_URL`, `SF_NATIVE_U15_DENIED_URL`, `SF_NATIVE_U15_STALE_URL`, `SF_NATIVE_U15_LOST_RESPONSE_URL`, e provisionar atores de requester/denied reais com isolation por teste. Todos devem apontar para o CAP14 da mesma shell/owner do manifesto F04, não URL/hardcoded credential/browser storage fabricado. Os casos edit/stale/lost exigem registros/versionamento e injeção de falha por produtor/seam genuíno. O manifesto F04 atual não provisiona ainda por si só todas essas jornadas.

## Critérios e gates
- U15-AC01: asserções de Dashboard/source version/CAS continuam; case link e source ref/version **não qualificados**.
- U15-AC02: leitura, filtro, actor negado, stale, unknown/no-replay mantidos; **NOT_RUN**.
- U15-AC03: widths 320/768/1024/1280/1440 e teclado mantidos; resize 200% e reflow real 400% requerem prova independente; **NOT_RUN**.
- Typecheck, guards, parsers, builds e testes **não executados** por 185. Histórico guard163 run43766055614/job132971280139/art14182790522 não é green deste material. `GLOBAL_RELEASE=false`.

## Destinatários e ação exata
1. **187 / PR120:** dar ao integrador as instâncias reais CAP14 e os inputs listados no JSON `VALIDATION-REQUEST185.json`, com vínculo de identidade de cada jornada; não usar grants, result 409, storageState ou receipts falsos.
2. **162 / PR65 (único integrador):** confirmar release/leases e SHA dos dois consumidores, compor somente o novo blob U15 no C atual; F04 fixture e seleção já estão no tree do integrador, não reimportar. O host privado/manifest/atores e os cenários CAP14 seguem sem prova; não mesclar a branch inteira nem alterar os engines.
3. **162/S0:** tratar 163/PR107 e 164/PR106 como *terminal handoffs*. Nomear autoridade sucessora ou workflow de CI **já existente** de modo explícito; criar/atender pedido de validação real de spec exata, com C/tree, runtime, manifest e result para dedup. Comentário não reinicia sessões.
4. Reconciliar falhas pelo owner e fechar apenas após RUN/ACK em candidato idêntico. Goal continua pausada; sem full suite/epic, release, deploy, merge ou force nesta missão.
