# Missão181 / D01 — handoff terminal para 162

**Origem:** `sf-ux-w01` / PR#145 / `native-fix-e1-browser181`. Ator GitHub `gustavomhss`, modelo efetivo GPT-6; sessão Astra não exposta, sem ID de sessão. **Status:** ARTIFACT_READY, NÃO integrado/qualificado, `GLOBAL_RELEASE=false`, Goal pausada.

## Evidência causal e correção
- Compiler163 real: [run43766055614/job132971280139](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766055614) em W `690a34cdd81c12d7311f3717c19679b950276161`; erro `desktop-enrollment.ts(47,73) TS2322 unknown→string`.
- `request.requestId` é `unknown` do Dock; os guards `typeof === "string"` e UUID já o validam, mas o acesso **posterior no callback assíncrono** perde o estreitamento da propriedade. Após esses guards, `const requestId = request.requestId` preserva o valor validado antes do `enrollNativeLocal()`; o reply usa `requestId` e `satisfies SfNativeEnrollmentReply`.
- Código alterado **somente** em `apps/cli/src/sucafina-product/native-ui/desktop-enrollment.ts`. Patch completo inerte: [PATCH181.patch](PATCH181.patch); máquina: [RESULT181.json](RESULT181.json).
- Branch preparada `bf031bef97d474da68888662d39bcc844a342f06` / tree `e72614417caabda8147863465db76f0e47bb87be`; ACK `a4eaee54b41dc7c6e4ba2dac4dd1d65e47c7f33e`; produto `fbff16ee8e02040a99db272ddedbe41e58467da7` / tree `4b07076dc272792232c34120f29728b38c6180e7`. Blob source `39ebdb2ecfd3d897ccd0989bdd989b82f27dbcda` → `8ea7c0c87dc02165ca29be44bc947a6813f96832` (readback remoto verificado).
- Consumidor `sf2-stack` observado em `913b6b8f143e6c3e869eee293d02f04259c7cdd1` / tree `99d4788774ce548d4cd64a96c0f2481db1fb15eb`, ainda com blob prévio `39ebdb2ecfd3d897ccd0989bdd989b82f27dbcda`; pós-consumo **pendente**, não inventado.

## Fronteiras preservadas
- Sem casts de `requestId`, sem `String(unknown)`, sem converter e-mail em identidade/papel. Kind/launchId/installationId/UUID, descriptor instalado, mount/origin/TTL e recusa de resposta após dispose continuam os mesmos.
- Nenhum arquivo main/preload/renderer/shared tocado; os sete métodos IPC, nonce, return intent, auth, authority e consentimento do servidor permanecem sob contratos D01/I00 e respectivas provas.
- Spec nova de `test/native-ui-contract/desktop-enrollment.test.ts` não criada (caminho ausente; ajuste estrito de estreitamento, sem novo comportamento). Reutilizar `apps/desktop/src/main/sucafina/broker.test.ts` e `modules/sucafina/Sucafinav1/test/operator-enroll.test.ts` existentes. W01 browser spec não estava presente no source snapshot.
- Leitura e readback GitHub **não são CI**: typecheck, testes, SDK, guards pós-patch e critérios D01-AC01/02/03/77-LOGIN = **NOT_RUN**. Browser164 [run43766970018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766970018) falhou noutras áreas (S01/S05); não é prova contra ou a favor de 181.

## Pedidos exatos
1. **162 / PR#65:** aplicar SOMENTE `PATCH181.patch` ao leaf acima, com preimage blob `39ebdb2e...` (se divergir, reconciliar); registrar o novo SHA/tree C e blob `8ea7c0c8...` + ACK de consumo. Não fazer merge bruto da PR145. Shared seam permanece 162-only.
2. **163 / PR#107 após 162:** pela lane compiler existente, `bun typecheck` no diretório `apps/cli` e verificação `apps/desktop` da closure D01; registrar resultado real de TS2322, C/tree, input hash, run/job. Executar SDK/guards somente se requeridos pela matriz canônica desse mesmo C. Não repetir W690 sem mudança causal.
3. **164 / PR#106 após 162 e prerequisites D01:** pela dispatcher única, executar apenas specs existentes `apps/desktop/src/main/sucafina/broker.test.ts` e `modules/sucafina/Sucafinav1/test/operator-enroll.test.ts`, com seleção/revisão de closure; W01 browser spec só se materializada. Salvar resultados reais e negativas de enrollment; dedup C/tree/request. Não reexecutar o S01 falho inalterado.

**Transferência:** autoria 181 terminal, fonte pronta. Sem teste/parser/build local, re-dispatch, dev merge, force, deploy, Azure, engines, restart ou nova Goal. 162 única integradora; 163 compiler/SDK/guards; 164 produto. `GLOBAL_RELEASE=false`.
