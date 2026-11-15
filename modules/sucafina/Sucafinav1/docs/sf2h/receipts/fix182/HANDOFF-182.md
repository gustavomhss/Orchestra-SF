# Missão 182 — F03: cobertura tipada, privacidade de gráfico e import BI

**Entrega:** ARTIFACT_READY; apenas autoria na branch `sf-ux-w04` / PR #129. **NÃO integrado, NÃO qualificado, NÃO lançado.** Epoch `native-fix-e1-browser182`. Modelo efetivo GPT-6, ator GitHub `gustavomhss`, sessionID não exposto (não é válida a alegação de runtime Astra). Goal pausada, `GLOBAL_RELEASE=false`.

## Evidência real e correção causal

- Actions browser164 run [43766970018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766970018), job `132974180913`, material W `6d42d675`/tree `e797d2dd`. F03 aninhado: **7 PASS, 2 FAIL**; externo de quatro arquivos: **5 PASS, 3 FAIL** (contagens não se somam). Erro 1: `<Show when={props.coverage && !privacy() && !loading()}>` entregava boolean `true` a `SfCoverageView`, resultando em `props.message.key` indefinida. Erro 2: `questionKey` do gráfico privado ainda rendia `Partial coverage` em denied.
- `shared/states/index.tsx`: o `<Show>` agora recebe `props.coverage` efetivo somente fora de privacidade/loading; não fabrica zero nem transforma estado em `ready`.
- `shared/frame/index.tsx`: o cabeçalho inteiro (título, pergunta, contexto, inclusive vínculo `aria-labelledby`) só existe quando não há `denied/session-expired`. Corpo de SVG/tabela continua governado por `SfStatePanel`; estado privado revela apenas o aviso. `revoked` é mapeado pelo owner F01 para `denied` e a purga do cache original pertence ao produtor/owner, NÃO a F03.
- O mesmo teste DOM existente continua montado com `withBrowserPlatform` real de 140, sem `globalThis` e sem mock de autoridade; intensifica asserções com SVG real e `<title>PRIVATE_CHART</title>`, ausência de contexto, tabela, header e cobertura para `denied` e `session-expired`. Mantém checks prévios para loading / filtered-empty / partial / outcome-unknown, zero conhecido, unavailable, seleção e pt-BR.
- Compiler163 run [43766055614](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766055614), job `132971280139`, também documentou `SfUnit` não exportado pelo barrel F03 embora já declarado em `frame/types.ts` e importado no BI real. F03 agora reexporta **apenas o tipo já declarado**. Não há schema/guard/oráculo novos, nem teste espelhado de import.

## Fonte — HEAD/tree e blobs exatos

- HEAD preparado `cd2257b601be744ad27faa502c8057a49e241a01`, tree `6090aee7c361019602f4f8f3b1e9dc7c260f49a3`; ACK real no commit `a9c997c328b312e36d1562fcd0a9f1594f660960`, tree `c8eb6eaf6d0f2b27883271cbedaa8180ab05f3a9`.
- Commit browser fix `3081705b36b55ab37f1288ae94d9d9bb77c3c04b`, tree `1d777bcd9d00552392329a4d3c46b55455fd740b`; tipo re-export commit `2304f06ce4a1269034ba7db94211c639878b3d1a`, material final tree `bc8e570705e64c5ce6ff31151f74cbcf4351f273`.

| Arquivo | Preblob fonte | Postblob fonte |
| --- | --- | --- |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/index.tsx` | `efd0e794526297be54f648315f8d6ad01e29198e` | `5ac932898531625f64037dd0da9c1d2b5d894b1c` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/states/index.tsx` | `7084c442f96e3b7d0f91b66027118df6eb003ebc` | `15433e5b73a4234e7dfb6df3bdb327c88fb83e7d` |
| `packages/app-shell/test-browser/sucafina-native/page-frame.test.ts` | `aa17ece934eb35f54602b6de99bcc39da39d1fed` | `92024c7caa2f5e10d243c6feff71abb4b2a1b7f0` |

Patch íntegro: [`SOURCE-FIX182.patch`](./SOURCE-FIX182.patch), blob `9ed61920fe76cd51972f71c9c4f228a64da20f63` (originais exatamente do fence, três paths). Sem alteração em CSS, COPY-01 ou tipos originais; `SfUnit` já existia como tipo estrito.

## Entrega inerte e consumo exclusivo pela 162

- Integradora `162`, branch `sf2-stack` PR #65: HEAD observado `913b6b8f143e6c3e869eee293d02f04259c7cdd1`, tree `99d4788774ce548d4cd64a96c0f2481db1fb15eb`. **Nenhuma escrita feita nesse branch**. A publicação aqui não altera o W integrado nem qualifica o software.
- Consumidor frame antes `06165f1ac7c6b9918a712570caa6a076559f2ec7`; depois **proposto** `26656f573f877496925993e2c702df7aa926251a` preservando o re-export `SfSource` que a 162 acrescentou. `states` `7084c442...` → `15433e5...`; teste `aa17ece...` → `92024c7...`. Árvore proposta em git objeto solto `82c14e013244c2466885f22f97f9529bc3012a72`: não está em branch e **não é integração**.
- Patch [`CONSUMER-162-INERT.patch`](./CONSUMER-162-INERT.patch), blob `e8f019a6cf5ca9e6ec66bd3922c15aede2db8d1f`, contém hunks completos contra preimagens do consumidor, sem substituir o frame inteiro por blob de origem ou apagar `SfSource`. Integrador deve reconfirmar HEAD, cada preblob, atualizar CAS, compor novo W/tree e publicar ACK de consumo. Se mudou desde a observação, reconciliar hunk a hunk e não sobrepor trabalho paralelo.
- Shared seam, registry, host e i18n global continuam exclusivos da integradora. 171/A12, 172/F01, AM165–170 e demais produtores permanecem intocados.

## Pedidos exatos após integração pela 162

- **163, PR #107**: no **novo W integrado**, registrar SHA/tree e executar via executor hospedado existente `bun typecheck` em `packages/app-shell` e `bun run check:guards --base origin/dev`, preservando falhas reais e guard 66 GATE/141 WARN anteriores. Sem reexecutar entrada inalterada; F03 isolado não altera HttpApi nem demanda nova geração SDK, salvo delta público independente no W.
- **164, PR #106**: reconciliar requests/runs existentes e disparar **uma única** seleção `./test-browser/sucafina-native/page-frame.test.ts`, cwd `packages/app-shell`, runner `bun`, args exatos `--timeout 120000 ./test-browser/sucafina-native/page-frame.test.ts`, env `{}`, Ubuntu 24.04, pelo dispatcher **existente** `.github/workflows/test-ci.yml` (blob `3185885e123f9bb13c16c670e4df2fcffab38290`), após novo W materializado. Não inventar CLI ou outro workflow. Os demais S01/S05 são outras autorias; não contam como F03. Registrar novo W/S/request/blob/job/expects e resultado, ou manter NOT_RUN.

**Validação após este patch: NOT_RUN.** Nenhum teste, typecheck, parser, build ou validador local executado. Falhas de Schema/Client/CLI/guards anteriores não viram PASS; full EPIC, oito finais, AM01–06 e revisões independentes mantidos. Terminar esta autoria não libera a goal nem `GLOBAL_RELEASE`.

Dados auditáveis: [`MANIFEST-182.json`](./MANIFEST-182.json), [`REQUESTS-182.json`](./REQUESTS-182.json), [`TERMINAL-182.json`](./TERMINAL-182.json).
