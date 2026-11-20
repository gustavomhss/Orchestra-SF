# HANDOFF — sf-package-reconciled

## SHA e estado

- Branch isolada: `sf-package-reconciled`.
- Estado: **PARTIAL — composição preparada para gate focal, ainda não qualificada**.
- SHA de código: `2f520c850b55215e670ff673092b2e18407bd258`.
- Árvore de código: `8cb14b9a3001a6143a26c88bc7a95ce20bad9d03`.
- Árvore integrada usada como base: `04cd286a3f2d34bb31bdbfc440fc37332e6d9e6e`.
- Nenhum gate, PR, merge ou dispatch executado nesta preparação. O ref do PR #395 e o ref `sf-join-four` não foram movidos.

Esta branch contém o delta do #425 para testar a composição. **Não integrar esta branch, nem mover #395 para ela, antes de o #425 obter sua qualificação success e ser integrado pelo fluxo autorizado.** A ancestralidade não concede aprovação ao #425.

## Proveniência e ordem dos parents

O commit de código possui os parents nesta ordem:

1. `12e19d53cbb286b77b56d0acbabe83bd788e4b59` — head observado do #395, preservado como primeiro parent para permitir futuro avanço por fast-forward.
2. `b180588c63e41eecd6d73d839d078755d68cad3d` — `sf-join-four` observado para a composição.
3. `b5312caba2a8825c2061dfafab926a3feed370cf` — head observado do #425.

A árvore parte da integração acima. Aplica o delta exato entre `d7fa94063e798207ed692026b557d27dfff1aef8` e o head #425, preserva os três blobs de factory do #395 e une os dois arquivos sobrepostos de CI. O commit documental subsequente acrescenta apenas este handoff.

O delta do #425 tem 46 paths: 25 já eram byte-idênticos na integração; 20 paths de CI/cache ainda não estavam integrados; o path restante é o reparo concorrente e canônico de `summary-settings.test.ts`. Esse teste usa exatamente o blob do #425, sem a alternativa superseded de `sf-summary-path`.

## Reconciliação dos dois arquivos

- `.github/workflows/sf-ci.yml`: mantém todos os bytes do #425 e acrescenta as 12 linhas do #395 para `id: ui_journey`, saída `minimized=true` após a minimização real e upload separado `sf-baseline-candidate-*`.
- `script/sf-ci/gate.test.mjs`: mantém todos os testes do #425, une os imports e acrescenta o bloco exato de retenção do #395. Os quatro cenários executam o tail real com Bash e o gate real dentro de fixtures explicitamente de teste: testes originais falhos, relatório inválido, baseline pendente e baseline válida somente da fixture.
- As fixtures continuam copiando os arquivos reais `gate.mjs`, `shard-plan.mjs` e `sf/ci/shard-costs.json`. Não há novo smoke ou implementação duplicada do contrato.
- A revisão textual confirmou que remover somente esses acréscimos reproduz byte a byte os dois arquivos originais do #425.
- Não houve alteração de `sf/ci/suites.json`, `sf/ci/shard-costs.json`, seleção, baselines reais ou critérios de recibo. Os candidatos minimizados continuam separados de `sf-evidence-*`.

## Comparação explícita contra a integração

[Comparação da integração com o código composto](https://github.com/gustavomhss/Orchestra-SF/compare/b180588c63e41eecd6d73d839d078755d68cad3d...2f520c850b55215e670ff673092b2e18407bd258).

A API retornou merge-base exatamente `b180588c63e41eecd6d73d839d078755d68cad3d` e **24 paths de código/documentação herdada alterados**. São os 20 paths de CI/cache do #425, o teste Summary e os três arquivos de factory. Todos os demais paths da integração permanecem preservados. O handoff novo acrescentará o 25º path no HEAD documental.

| Path | Delta contra integração | Blob composto |
|---|---:|---|
| `.github/actions/setup-bun/action.yml` | +32/−27 | `e13c1ceb87ca437c52041e9bbf8a52429b011a18` |
| `.github/workflows/sf-cache-warm.yml` | +129/−0 | `45874f2f82d7ec45334876dc84fea205f2f37c64` |
| `.github/workflows/sf-ci.yml` | +67/−4 | `8e1f80672dc315b71806b4ada086e213401301be` |
| `.github/workflows/sf-factory-package.yml` | +4/−2 | `494615b3050bdbc153f5f7731d8e2395f9fab8ae` |
| `.github/workflows/test-ci.yml` | +58/−8 | `75af315fb7084eb7f95542e6281cc7ae7b6167c8` |
| `apps/cli/script/factory-receipt-check.ts` | +1/−1 | `caa18b28c0a4d732c8a8339f9de153a3c1c5a027` |
| `apps/cli/test/factory-distribution-linux.test.ts` | +13/−13 | `280e68985618c3d19b70425d2ac4b888f0685b90` |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/summary-settings.test.ts` | +2/−1 | `f1cb6764a4f99b2c9b8a78ac3a0bafa3ba20c3c4` |
| `packages/core/test/setup-bun-cache-inputs.test.ts` | +193/−0 | `c418267cedf079605908e00974d0f616651400ad` |
| `packages/core/test/setup-bun-cache.test.ts` | +3/−4 | `0c3f3ab12135c9e7386f3af0b32d6dded28a19de` |
| `script/ci-cache-inputs.ts` | +179/−0 | `d527d7cce386ff84b841e74c2d5ae9702f94e6fb` |
| `script/sf-ci/cache-source.mjs` | +28/−0 | `2d443a8318b336aa9631360b68e6c43456e6bbf8` |
| `script/sf-ci/cache-source.test.mjs` | +48/−0 | `ccdbe7d81f212bc807f9e083862e280461d2a536` |
| `script/sf-ci/gate.mjs` | +16/−12 | `14a04983f3e1c4d4e756cddc63a3a74c3f5ead14` |
| `script/sf-ci/gate.test.mjs` | +310/−8 | `f90b1a99b56cedf1ff3d9368e4e1407651157f9e` |
| `script/sf-ci/shard-adoption.mjs` | +197/−0 | `3022b6bbf5b9acbafabe2b9feccb6223d795de44` |
| `script/sf-ci/shard-adoption.test.mjs` | +190/−0 | `1d230ddf50251e418f36e01f40ca3ac000be0561` |
| `script/sf-ci/shard-plan.mjs` | +71/−10 | `47b2f109d265630a348e9e0f0c4457f22b830423` |
| `script/sf-ci/shard-plan.test.mjs` | +110/−0 | `f23da39e99f02b71bef41adc56d28e128e02f06f` |
| `script/sf-ci/test_timings.py` | +207/−0 | `1ff5c8a9cb850a64ca9d6e655d10703339df2b38` |
| `script/sf-ci/timings.py` | +229/−0 | `cda49feff1354698d34618eefaefa92af48b4934` |
| `script/sf-ci/workflow-contract.mjs` | +121/−21 | `bf71ecfd10f1916e7fdd0d9ec84f39331b077cd0` |
| `sf/ci/PENDING-WORK.md` | +47/−13 | `a77ef541cc7aed70f0ccbd9874c9fc18cf9900c6` |
| `sf/ci/PERFORMANCE.md` | +90/−1 | `2e44c1ffd9ba26d3ad1671f0954f788bf763c5bb` |

## Comparação explícita contra o #425

[Comparação do #425 com o código composto](https://github.com/gustavomhss/Orchestra-SF/compare/b5312caba2a8825c2061dfafab926a3feed370cf...2f520c850b55215e670ff673092b2e18407bd258).

A API retornou merge-base exatamente `b5312caba2a8825c2061dfafab926a3feed370cf` e **36 paths diferentes**: os 31 paths abaixo preservados da integração, os três blobs factory e os dois arquivos reconciliados. Não há delta em Summary contra o #425. O HEAD documental acrescentará apenas este handoff a essa lista.

| Path preservado da integração | Blob idêntico à integração |
|---|---|
| `apps/cli/src/sucafina-product/document-services.ts` | `546c7c0621af2591d7a1bb8b7214b163b4a8be2d` |
| `apps/cli/src/sucafina-product/host-context.ts` | `3f6863be244ce79dc6538564ac0c0b6b8b58e8c1` |
| `apps/cli/src/sucafina-product/native-ui/asset-health.ts` | `a38c6bb03de1a52b0746728b42939f40ebb3d0e8` |
| `apps/cli/src/sucafina-product/native-ui/domain/projection.ts` | `91e79663c56891eafc6eefa7d3a3e248c894b9cc` |
| `apps/cli/src/sucafina-product/native-ui/import-health.ts` | `c47f7d4d43db60f58a9be5e14f11838594de5f33` |
| `docs/handoff/HANDOFF-sf-files-upload-observation.md` | `f2f44169f233d54b911bb22f45825b49e438fd34` |
| `modules/sucafina/Sucafinav1/local/entry.ts` | `645b86fb48ac84e2b9c1392020eae9c5cf29fc50` |
| `modules/sucafina/Sucafinav1/product/decisions/hot-topic-draft.ts` | `231513a5661b04ee91c9435f654391758806d0b7` |
| `modules/sucafina/Sucafinav1/product/interface/analysis-http.ts` | `d79b8e1166a2ae60d276549c8cd8cafa130e0c89` |
| `modules/sucafina/Sucafinav1/product/ui/contribution-body.ts` | `f4e21ad617197a9848a3cd7787e01f3b59df9014` |
| `modules/sucafina/Sucafinav1/runtime/assets.ts` | `381dd986d26fe0dd65f8ba77e345436c580d113b` |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/asset-health.test.ts` | `c723387384640f2466355bb10f740c0e205d69cf` |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/budget-deviation-projection.test.ts` | `2337a3b7a11e080fb956e8e241fef90a182b113c` |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/import-health.test.ts` | `d7073e6a140144591467b4d3fbd680ff2e58a596` |
| `modules/sucafina/Sucafinav1/test/product/proof234/am04-c12-return.test.ts` | `7ffec83166e205370b82a91f8ca6cbd4982ea084` |
| `modules/sucafina/Sucafinav1/test/product/routine-native-admission/adapter-boundaries.test.ts` | `44fef814bfdc2402e351fdcbae7b4c92bbba89b3` |
| `modules/sucafina/Sucafinav1/test/product/wp01/import-receipt-browser.test.ts` | `9bfa3e846573521563b7d3e3f07f8313bb1badab` |
| `modules/sucafina/Sucafinav1/test/product/wp01/workbench-analysis.test.ts` | `ac4d40d4885293321831dc1c87f53b632ebda6bc` |
| `modules/sucafina/Sucafinav1/test/product/wp04/capabilities.test.ts` | `4e37830090c9945c0b03c0e72291708398a8eb0f` |
| `modules/sucafina/Sucafinav1/test/product/wp06/documents/extraction-reuse.test.ts` | `31262c73a6b7d872d78ca561aec42176829b118c` |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/bi-access-browser-fixture.ts` | `fdda1e4b507d81b297026d4f97d546631616847d` |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/work-bridge.test.ts` | `8ca43ab1bc33a229a0fdd5ee85cbc3175090fe43` |
| `modules/sucafina/Sucafinav1/test/product/wp10/native-host/native-host-disposal.test.ts` | `f16d1af3e005979fc38ebb9a22530b65f7f1804c` |
| `modules/sucafina/Sucafinav1/test/product/wp11/source-promotion-coverage.test.ts` | `57abd89aeb9c955a019b99efa0cd1a702d43cfa6` |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-bi.test.ts` | `b7d10cb0eb67d61d9aa86ca6dbf288fb87716e0a` |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-executive.test.ts` | `4cae1207ffdd24328b4f49bf9da6d30acd81cef0` |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-verifier-negatives.test.ts` | `ed82be5bd6d5d128cea5e55c84b7364ea1257afd` |
| `modules/sucafina/Sucafinav1/test/product/wp13/handoff-c08-predispatch.test.ts` | `7d8da7b3e8a5d593161ea64cbaf0c06bc6481f7b` |
| `modules/sucafina/Sucafinav1/test/product/wp13/handoff-canonical-integration.test.ts` | `3d191e0d956927251a4cf8c25d288d2c14df3744` |
| `modules/sucafina/Sucafinav1/test/product/wp13/handoff-persistence.test.ts` | `18ff9b59cff6b8f06eacc06d4d3b6c46708dc818` |
| `packages/app-shell/e2e/sucafina/operations-support/installation.ts` | `cecf2dc87f81db48efee4cbd51256e14a19f2d5a` |

Os dois deltas próprios contra #425 são `sf-ci.yml` (+12/−0) e `gate.test.mjs` (+134/−1, incluindo união de imports). Nenhuma assertion do #425 ou do bloco de retenção do #395 foi removida ou reescrita.

## Identidade dos três blobs factory

Os blobs abaixo são exatamente os do head #395 `12e19d53cbb286b77b56d0acbabe83bd788e4b59`, inclusive modos `100644`, sem edição nesta composição:

| Path | Blob |
|---|---|
| `.github/workflows/sf-factory-package.yml` | `494615b3050bdbc153f5f7731d8e2395f9fab8ae` |
| `apps/cli/script/factory-receipt-check.ts` | `caa18b28c0a4d732c8a8339f9de153a3c1c5a027` |
| `apps/cli/test/factory-distribution-linux.test.ts` | `280e68985618c3d19b70425d2ac4b888f0685b90` |

A qualificação histórica do factory, run [44652219809](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44652219809), é evidência desses blobs sob aquela fonte. Não é um pacote final deste SHA nem qualificação integral desta nova composição. Não há motivo para repetir o mesmo gate factory sem causa nova; o pacote do SHA congelado final continua pendente.

## Gates e pendências reais

O #395 tinha gate focal [44661967640](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661967640) **success**, 58 testes/0 falhas. Esse run não executou esta composição.

O run do #425 [44667265276](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667265276) terminou **failure** no snapshot `a2d58a3ecf23a645689fb37e204af5bc177ed229`, source `a08a2b7d5eb3455da143ed6ce2bd259ae9a1dc9a`. O head `b5312caba2a8825c2061dfafab926a3feed370cf` inclui o reparo seguinte; não recebe success retroativo.

- Unbound histórico do typecheck: `modules/sucafina/Sucafinav1/test/native-ui-contract/summary-settings.test.ts:76:48` no snapshot falho. O #425 agora usa `AbsolutePath.make(...)`, mas o owner ainda precisa qualificar o typecheck genuíno.
- Os erros de guards causados pelos logs `ci-efficiency-evidence/{guard-dev,guard-focused,spawn}.log` pertencem ao driver externo. Este recorte não o altera nem falsifica sua conclusão.
- Os dois `protected-paths` herdados contra `origin/dev` continuam separados daquele problema.
- Typecheck permanece gate do owner #425; não será repetido pelo gate focal desta união.

Request proposto ao integrador, ainda não publicado em `ci-run-*` nem executado:

```json
{
  "package": "script",
  "runner": "bun",
  "args": [
    "../../script/sf-ci/gate.test.mjs",
    "../../script/sf-ci/shard-plan.test.mjs",
    "../../script/sf-ci/shard-adoption.test.mjs",
    "../../script/sf-ci/cache-source.test.mjs"
  ]
}
```

O runner é `bun`, conforme o request anteriormente qualificado do #395; `node` no workflow existente é reservado a `*.node-smoke.mjs`. Esses quatro arquivos qualificam a união real de workflow, retenção/minimização, cache e shards. Não executam typecheck nem as jornadas completas de produto.

## Como retomar

1. Revisar os SHAs, os dois deltas reconciliados e a identidade dos três blobs factory.
2. O integrador pode criar um único snapshot sem `[skip ci]` para o request de quatro arquivos, respeitando os dois slots globais. Os commits de preparação usam `[skip ci]`.
3. Aguardar a qualificação e o merge autorizados do #425. Esta composição não pode servir de integração indireta enquanto esse gate estiver aberto.
4. Revalidar a árvore contra o head integrado então vigente antes de mover #395, usando CAS e preservando quaisquer merges posteriores. Não repetir gate idêntico sem mudança de código.
5. Registrar resultados reais e decidir a integração. Não há conclusão COMPLETE, sf-ci final, guards finais, pacote final, hash de pacote ou GO nesta branch. O único sf-ci completo continua reservado ao fim de todos os merges.

A composição não congela release nem move `sfa-factory-package`.
