# HANDOFF — sf-package-reconciled

## SHA e estado atual

- Estado: **COMPLETE para o delta de cinco paths do #395**. Esta é uma candidata isolada e qualificada nesse escopo; não é aceitação global, pacote final ou GO.
- Branch candidata: `sf-package-candidate`.
- Fonte integrada preservada: `18d343f7eb8a3afaca94bb0789ae62bfc886c9c3` (`sf-join-four` observado).
- Árvore dessa integração: `e990b72a28b88200df73542e1179da9ea65bd1ce`.
- SHA de código da candidata: `d5f49003d323360c6274584ab02a937fb89c6f72`.
- Árvore de código: `7d3399fcbef6ffc09e5c740a52f7ca26ff5b1500`.
- Primeiro parent: união qualificada `8bd50288e72123cff4823ea52004dca024f73a89`, que contém o head original #395 na sua ancestralidade.
- Segundo parent: integração `18d343f7eb8a3afaca94bb0789ae62bfc886c9c3`.
- Head original #395 observado: `12e19d53cbb286b77b56d0acbabe83bd788e4b59`; não foi movido nesta preparação.
- Um commit documental posterior acrescenta este handoff atualizado. Ambos os commits usam `[skip ci]`.

A árvore foi construída sobre a integração atual, aplicando somente os cinco blobs abaixo e restaurando o handoff original do pacote. Nenhum gate adicional, PR, merge, dispatch ou movimento de `sfa-factory-package` foi executado por esta preparação.

## Delta exato e identidade

| Path qualificado | Blob aplicado sem modificação |
|---|---|
| `.github/workflows/sf-ci.yml` | `8e1f80672dc315b71806b4ada086e213401301be` |
| `script/sf-ci/gate.test.mjs` | `f90b1a99b56cedf1ff3d9368e4e1407651157f9e` |
| `.github/workflows/sf-factory-package.yml` | `494615b3050bdbc153f5f7731d8e2395f9fab8ae` |
| `apps/cli/script/factory-receipt-check.ts` | `caa18b28c0a4d732c8a8339f9de153a3c1c5a027` |
| `apps/cli/test/factory-distribution-linux.test.ts` | `280e68985618c3d19b70425d2ac4b888f0685b90` |

Os dois blobs de CI são os da união `8bd50288e72123cff4823ea52004dca024f73a89`; os três factory são também exatamente os do #395. Seus modos continuam `100644`.

Na integração, os preimages de CI eram `2f42e22ec44236f66224acbd04fa0b196d3f089b` (`sf-ci.yml`) e `a4d01afc6267b1fcdf498706bd06445e24a2cbae` (`gate.test.mjs`), exatamente os do #425 já integrado. O delta mantém todos os contratos do #425 e acrescenta os pontos de retenção e testes do #395. Não há outra reconciliação de código.

Os dois paths documentais da candidata são:

1. `docs/handoff/HANDOFF-sf-continuation-package.md`: restaurado integralmente do #395, blob `27abd659e000f6d9300e1a773276575b84d975f1`, pois estava ausente na integração. Seus receipts e afirmações são históricos, vinculados aos SHAs ali identificados.
2. `docs/handoff/HANDOFF-sf-package-reconciled.md`: este registro, atualizado a partir do blob `76bbbb404544ff430e5596659e164d47bd94cdfe` da união 8bd.

O diff final contra `18d343f7eb8a3afaca94bb0789ae62bfc886c9c3` deve conter **somente os cinco paths qualificados e esses dois documentos**. Nenhum request de CI ou teste auxiliar de auditoria do snapshot é transportado.

## Qualificação real da união

Run [44670544483](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670544483), attempt **1**, evento `push`, branch `ci-run-linux-sfc-package-reconciled`:

- Resultado global: **success**.
- Snapshot: `07ed37e09e8eb7468a20b08fea64829cecaa455c`.
- Parent direto e único do snapshot: `8bd50288e72123cff4823ea52004dca024f73a89`.
- Test job `136070172103`: **success**.
- Cleanup job `136070935106`: **success**.
- Resultado observado no log: **143 pass / 0 fail, cinco arquivos, 623 ms**.

O snapshot acrescenta somente `.ci-run.json` e `script/sf-ci/wp00-source-hash.test.mjs`. Não modifica os cinco blobs qualificados. O request executou:

```json
{
  "package": "script",
  "runner": "bun",
  "args": [
    "../../script/sf-ci/gate.test.mjs",
    "../../script/sf-ci/shard-plan.test.mjs",
    "../../script/sf-ci/shard-adoption.test.mjs",
    "../../script/sf-ci/cache-source.test.mjs",
    "../../script/sf-ci/wp00-source-hash.test.mjs"
  ]
}
```

Os testes de retenção executam o tail real do workflow com Bash e o gate real. Preservam os quatro cenários: testes originais falhos, relatório inválido, baseline pendente e baseline válida apenas da fixture unitária. A condição real só publica `report.json` minimizado depois de testes originais com exit zero e minimização bem-sucedida; um receipt recusado mantém a falha. Não publica receipt aprovado nem inclui logs/corpos brutos no candidato.

O quinto teste é somente uma auditoria de bytes do produtor. O log real registrou:

- Path: `apps/cli/src/sucafina-product/host-context.ts`.
- Blob: `3f6863be244ce79dc6538564ac0c0b6b8b58e8c1`.
- Bytes: **95024**.
- SHA-256: `51641a232525128ea4338034ff095a828204a5411dc7dd3334283c00fe6e57bd`.
- Escopo declarado: `source-bytes-only`.

Esse hash é de fonte. Não é baseline de campanha, digest de execução ou hash do pacote final.

## Ausência de drift no escopo qualificado

Os cinco preimages, os manifests e as dependências abaixo foram conferidos por GitHub. Entre a união qualificada e a integração atual, estes dez arquivos usados pelo gate permanecem byte-idênticos:

| Dependência/teste | Blob preservado |
|---|---|
| `script/sf-ci/gate.mjs` | `14a04983f3e1c4d4e756cddc63a3a74c3f5ead14` |
| `script/sf-ci/workflow-contract.mjs` | `bf71ecfd10f1916e7fdd0d9ec84f39331b077cd0` |
| `script/sf-ci/shard-plan.mjs` | `47b2f109d265630a348e9e0f0c4457f22b830423` |
| `script/sf-ci/shard-plan.test.mjs` | `f23da39e99f02b71bef41adc56d28e128e02f06f` |
| `script/sf-ci/shard-adoption.mjs` | `3022b6bbf5b9acbafabe2b9feccb6223d795de44` |
| `script/sf-ci/shard-adoption.test.mjs` | `1d230ddf50251e418f36e01f40ca3ac000be0561` |
| `script/sf-ci/cache-source.mjs` | `2d443a8318b336aa9631360b68e6c43456e6bbf8` |
| `script/sf-ci/cache-source.test.mjs` | `ccdbe7d81f212bc807f9e083862e280461d2a536` |
| `sf/ci/shard-costs.json` | `508a62d91c00758e18cffa06db5459a138acb4cd` |
| `.github/workflows/test-ci.yml` | `75af315fb7084eb7f95542e6281cc7ae7b6167c8` |

`sf/ci/suites.json` permanece no blob `57937b0e9df670fb7ccf10a18de5f5a83dec734d`; `CI-UI-REPORTS`, `CI-UI-DECISIONS` e `CI-SF` continuam `PENDING_REAL_COMPLETE_RUN`.

O freeze integrado permanece no blob `7a8132250131b9d30aaca5a330720bd3e0fa97fa`, revisão **12**, com os mesmos **38 artifacts** e o mesmo `consumerAcceptance`. Esta candidata não altera freeze, pins, drafts, baselines, cobertura, seleção ou limites de teste. O gate de 143 testes não substitui a qualificação separada do freeze nem é apresentado como ela.

Por identidade dos cinco blobs e das dependências do gate, esta reconciliação não exige repetição do mesmo gate. Não foi criada uma segunda execução para o mesmo código.

## Histórico e condição anterior do #425

A preparação anterior em `8bd50288e72123cff4823ea52004dca024f73a89` partia de `b180588c63e41eecd6d73d839d078755d68cad3d` e estava PARTIAL, aguardando o gate da união e a integração do #425. Seu registro completo continua disponível [naquele SHA](https://github.com/gustavomhss/Orchestra-SF/blob/8bd50288e72123cff4823ea52004dca024f73a89/docs/handoff/HANDOFF-sf-package-reconciled.md).

O #425 já foi mergeado externamente em `c74724c3e82f9a3fd3bdf2cd5492d966069caed8`, com head `b5312caba2a8825c2061dfafab926a3feed370cf`, antes desta candidata. A integração usada aqui já contém esse merge. Assim, a orientação anterior de não integrar o #425 por esta composição é superada pelo estado efetivamente existente: **esta candidata preserva a integração existente e não introduz o #425 indiretamente**. Isso não declara success retroativo nem autoriza retroativamente aquele merge.

A distinção permanece explícita:

- Run owner [44668900773](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668900773): **failure global**, apesar de 294 testes aprovados e typechecks reais de Core/Sucafina aprovados. Falhou em `.github/workflows/ci-efficiency-proof.yml:194`, preparando worktree com objeto LFS ausente.
- Suplemento [44669419937](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669419937): **failure global** em `.github/workflows/ci-efficiency-guards.yml:35`, por dependência ausente no check de spawn. A comparação real de guards confirmou somente os dois protected-paths herdados, zero novos e nenhuma aprovação aplicada.
- Run da união [44670544483](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670544483): **success real**, com o escopo e fonte próprios descritos acima.

O avanço da integração de `124d5b5c7fbc4a7a57edc0fe1420d38496402a48` para `18d343f7eb8a3afaca94bb0789ae62bfc886c9c3` é o merge **#450**, head `ffd192c0c0743382d3729740022fa28ed690758b`, às **2026-11-20 04:05:00Z**. Altera somente `sf/ci/PENDING-WORK.md` e `sf/ci/PERFORMANCE.md`; ambos são preservados integralmente nesta candidata. Nenhum código de CI, teste ou freeze mudou nesse avanço.

## Factory: prova histórica e pacote final pendente

Os três blobs factory foram qualificados originalmente no run [44652219809](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44652219809), attempt **1**, source/checkout `98e56b260a2b36030f6edd9711d77b1cebc907be`. Permanecem idênticos nesta candidata, incluindo porta **4120**, runtime extraído real e os controles originais de autenticação, 404, tamper e execução fora do checkout. Nenhum novo gate factory foi repetido.

Receipt **exclusivamente histórico**:

- Artifact `14591363180`: `sf-factory-package-44652219809-1-98e56b260a2b36030f6edd9711d77b1cebc907be`.
- Archive SHA-256 histórico: **`2f25f518095ddf3ade0e4aca36f9c6ba63796655613d9eefa44fcb1fb329af44`**.
- O ZIP do artifact GitHub é outro objeto, com digest histórico `788e491f8daa17925fbf4e4e063191b43a4ada88fe3fae38030dd07f59d716df`.

**Esse archiveSha256 não é o hash desta candidata nem do pacote final da Parte C.** O pacote final ainda deverá ser construído no SHA congelado pelo workflow `sf-factory-package`; seu run, artifact e archiveSha256 novos permanecem pendentes. Não há GO, deploy ou declaração de pacote final verificado.

## Estado dos demais gates e da integração

- Ordem de merges executados por esta preparação: **nenhum**.
- #395: ref original preservado; o integrador decide o avanço e o merge depois da revisão desta candidata.
- Guards finais `bun run check:guards --base origin/dev`: **pendentes no SHA final**; resultados focados não os substituem. Os dois protected-paths herdados não foram aprovados artificialmente.
- `sf-ci` completo: **não executado por esta etapa**; permanece reservado à única corrida final após os merges.
- Artifact/baseline da corrida completa: **pendentes**; nenhum manifest de suites ou hash de baseline foi editado.
- Jornadas de produto e shards fora do delta de cinco paths: suas conclusões permanecem vinculadas aos runs próprios. O COMPLETE deste documento não as promove a green.
- Pacote final/sha256: **pendentes**, conforme a seção anterior.

## Como retomar

1. Revisar o diff contra `18d343f7eb8a3afaca94bb0789ae62bfc886c9c3`: somente os cinco blobs qualificados e os dois handoffs. Confirmar a árvore e a identidade das dependências.
2. Conferir se `sf-join-four` ainda aponta para a fonte pinada. Se houver avanço posterior, preservar esses merges antes de qualquer atualização do #395; não sobrescrever paths concorrentes.
3. O integrador pode avançar `sf-continuation-package` por fast-forward/CAS a partir do head esperado `12e19d53cbb286b77b56d0acbabe83bd788e4b59`, pois ele é ancestral do primeiro parent desta candidata. Nenhum ref desse PR foi movido por este trabalho.
4. Registrar o merge e sua ordem real após a revisão. Não repetir o gate idêntico destes blobs.
5. Finalizar os demais merges autorizados, executar guards reais e o único sf-ci final, registrar cada conclusão e os artifacts autênticos. Só então congelar o SHA para o pacote final e registrar seu archiveSha256 novo.
