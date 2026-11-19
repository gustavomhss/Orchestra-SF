# Handoff — finish-c12-native-20261119

SHA: c00b150b48f576a79a7c8b33f15c4fb55d72dfd1 (código; handoff no commit seguinte)
Data: 2026-11-19
Estado: complete

## Feito

- Recorte de 14 arquivos de código a partir de sf-join-four `2682f82da2650314e3437ab48b5c65e52c5b3fe4`. O capítulo UI39 usa os produtores originais de revisão, aplicação e recuperação; as duas jornadas rodam no shell :3000 com host real, sessão cifrada, C08 e SQLite.
- Equivalência nativa C12 completa na composição `875d100c55d4c5953356b6939bf78e2facf63c4e`: run [44629501930](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44629501930), snapshot `84d397702236b6f4aa0c85d792fbdea5f78e55b6`, job135932059289 SUCCESS, cleanup135937863740 SUCCESS, três typechecks PASS, **2 passed (2.4m)**. Artefato original14581471462.
- Primeiro journey: commit real do receipt, resposta503 perdida, edição concorrente autorizada do caso, exatamente2POST Apply com corpo/key idênticos, retry409 sem novo efeito, reload, encerramento do processo, reabertura da mesma SQLite, admissão nova e browser inicialmente vazio. Recuperação200 e repetição200 ligam o mesmo receipt; um só efeito financeiro; versão do caso após prepare 3, concorrente 4 e reconciliada 5, exatamente.
- Segundo journey: resposta200 original perdida, recuperação200 do receipt já vinculado, uma só aplicação e um só efeito financeiro. Nenhum estado privado de recuperação é persistido no browser.
- UI39 conserva a intenção original apenas em memória e no mesmo owner/generation para retry explícito; rejeições definitivas encerram a retenção. Recovery faz releitura do caso. Os guards comparam exatamente caseVersion histórico+1 com a versão atual publicada por prepare-changes.
- O novo observador decision-application-health usa as três operações C12 originais, bindings efetivamente instalados e metadados C08; nenhuma autoridade, grant de produção ou receipt é criado pelo observador.
- Factory Operations recebe grants opcionais somente no fixture, preserva os defaults existentes e expõe runtime.services original. O seed C12 reutiliza prepareC12Change original, com ator opcional e os defaults alice/bob preservados; PR-1 permanece draft, a fonte individual é emitida a partir do C02 original e a seleção de período é admitida/revalidada.

- Recorte mínimo deste PR também qualificado: [run 44632508338](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44632508338), snapshot `9f14610bfd810b51bb8da4ccc6e65728974239ec` sobre head `8d8666bad24dc397cb063f564ec809f4c3a370c4`, job 135942547521 SUCCESS e cleanup 135944615791 SUCCESS. Três typechecks PASS, **2 passed (2.1m)**, artefato original 14583211611. Os mesmos receipts únicos, estados, perdas de resposta e transições CAS foram confirmados sem os outros bindings da composição ampla. Este checkpoint altera somente documentação depois desse gate.

## Recorte e blobs qualificados

- `apps/cli/src/sucafina-product/native-ui/decision-application-health.ts`: `77ffa51a34c461e7b2f744fd52f83a6cbbbba95b`.
- `modules/sucafina/Sucafinav1/test/native-ui-contract/namespace-health.test.ts`: `d723c0618523c90da04966a6f5d292beff902987`.
- `modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/fixture.ts`: `3b414811c64afe3fc95b8bb1c4dbba7af1d24640`.
- `packages/app-shell/e2e/sucafina/decisions-native-recovery.spec.ts`: `55983850eaee7078d113ed5f6f1cca1f2a373f78`.
- `packages/app-shell/e2e/sucafina/decisions-support/c12-host.ts`: `fe0263e9e259d90fa17b0f8ed40e34c7bcc44671`.
- `packages/app-shell/e2e/sucafina/decisions-support/c12-installation.ts`: `b3c557505d5573e12e615d435def3f4e5dbc0df4`.
- `packages/app-shell/e2e/sucafina/decisions-support/c12-protocol.ts`: `aaf63df5ff104108e8bcddbebffb0069c3228721`.
- `packages/app-shell/e2e/sucafina/decisions-support/c12-recovery.ts`: `0ac1ff721508a9e87929292931494d0d8f46f29d`.
- `packages/app-shell/e2e/sucafina/operations-support/installation.ts`: `06c2562e80fde20c7b16d67a2d1ff4b785a7c6cc`.
- `packages/app-shell/src/orchestra/chapters/sucafina/decisions/changes/index.tsx`: `0e531465198c208e53eadae54f128bc664300ec9`.
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u18.ts`: `448e13a0327087ab78b71af7fb906428fdedb24e`.

Os três arquivos compartilhados foram reaplicados sobre o main atual, sem copiar o host inteiro da composição:

- `apps/cli/src/sucafina-product/host-context.ts:99/998–1007`: somente import de observeSfDecisionApplicationHealth e sua chamada, com os mesmos produtores portfolioHttp/procurementDecisionHttp, identidade, withCase, cases e persistência originais.
- `modules/sucafina/Sucafinav1/product/contracts/host-context.ts:119`: somente os três IDs decisions.decision-review, decisions.decision-apply e decisions.decision-recover na união nativeReadBinding.
- `modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts:38–39`: extensão fechada do seletor metadata-only para receipts/preferences, igual ao checkpoint qualificado [44604756705](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44604756705). O teste namespace-health original de45linhas foi preservado inteiro: autoridade atual, metadados originais, ausência de dados privados e negação após revogação. Preferences é a primitiva comum já qualificada; não há binding nem renderer UI54 neste PR.

O F02 já integrado no main permite somente o retry humano da mesma decisão retida e continua revalidando owner/body/key. `packages/client/src/sucafina/transport.ts` não é alterado neste recorte. Os recursos C12 já estão indexados em live-context; esse catálogo não é alterado. Os schemas de operação integrados anteriormente permanecem iguais.

## Pendente (file:line e motivo)

- `sf/ci/suites.json:218–221`: registrar estas duas jornadas permanentemente na CI-UI-DECISIONS preservando o specFile único canônico. Coordenação com WP7/ci_resume. `script/sf-ci/gate.mjs:192/263–268` e `.github/workflows/sf-ci.yml:441–513` exigem seleção única; não contornar esse contrato.
- `modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/recovery-ui.test.ts:72/197`: os dois Bun UI antigos permanecem intactos até a cobertura nativa entrar na suite permanente e a raiz confirmar o remapeamento. Nenhuma exclusão neste PR.
- Merge do recorte reservado à raiz após seu gate. O sf-ci final e o pacote continuam sob responsabilidade da integração.

## Decisões e justificativas / asserções

- Nenhuma asserção removida, pulada ou substituída por check vazio; nenhum timeout aumentado. Exatamente2POST/1efeito, perda503/200 real, CAS, SQLite reaberta, browser vazio, ausência de persistência privada e repetição imutável foram exercitados no run44629501930.
- UI39 exibe coverage pending do produtor. A restrição local coverageState===complete não era uma precondição do produtor C12: o prepared review original retorna planned e a aplicação original autoriza o efeito explicitamente revisado. O capítulo mantém os fatos e as restrições retornados; não transforma pending em complete nem fabrica baseline, total, digest ou autorização.
- Prepare-changes guarda caseVersion anterior em prepared-change.ts18 e publica exatamente loaded.case.version+1 em mutations.ts255. A UI confere essa transição exata; Review/Apply continuam levando caseRef.version atual, os mesmos IDs, reviewDigest e revalidações. Qualquer revisão adicional continua tornando o review stale.
- A espera após reload/freshprocess é o GET projection.case original do mesmo caseRef, observado antes da navegação; exige HTTP200 antes do mesmo assert Recover. Nenhum GET adicional e nenhum aumento de timeout.
- O harness usa a fábrica/autoridade de produção e os registros preparados pela fixture canônica. O seed não é declarado como prova de autoria pela UI; o que se qualifica é revisão, aplicação, retry e recuperação reais.

## Como retomar

1. O gate estreito deste recorte já passou no run 44632508338; não o repetir sem uma alteração causal.
2. Revisar somente os14arquivos e os três hunks compartilhados acima; confirmar que o diff preserva os demais bindings do main.
3. Coordenar o registro permanente com WP7 antes de remover/remapear os dois Bun UI antigos. A raiz faz o merge; este branch não dispara sf-ci nem pacote.
4. Em falha, ler o log/artefato original antes de editar; não repetir sem causa nova e não reabrir seed/grants se a falha for de sincronização da UI.

## Comandos e resultados

Toda execução foi por GitHub Actions, sem shell local ou acesso à máquina do dono.

- Configuração change-scoped: `{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/decisions-native-recovery.spec.ts"]}`.
- [44629501930](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44629501930): SUCCESS,2passed; snapshot84d397702236b6f4aa0c85d792fbdea5f78e55b6, composição875d100c55d4c5953356b6939bf78e2facf63c4e; prova nativa completa.
- [44626328510](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44626328510): FAILURE,1failed/1didnotrun; havia passado efeito/retry/newSQLite e faltava aguardar a projeção original antes de Recover. Auditoria [44627902959](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44627902959): SUCCESS somente extração do mesmo artefato; screenshot já mostrava Recover.
- [44604756705](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44604756705): SUCCESS do seletor de namespaces; é prova da infraestrutura de metadados, separada da prova de efeitos C12.

- [44632508338](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44632508338): SUCCESS, 2 passed; snapshot `9f14610bfd810b51bb8da4ccc6e65728974239ec`, recorte `8d8666bad24dc397cb063f564ec809f4c3a370c4`, três tipos e cleanup PASS. PR [#391](https://github.com/gustavomhss/Orchestra-SF/pull/391) pronto para revisão/merge da raiz; o registro permanente de CI continua coordenado com WP7.
