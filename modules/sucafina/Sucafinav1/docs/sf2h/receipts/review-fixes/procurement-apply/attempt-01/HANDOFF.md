# OPS-REV-02 — entrega para revisão

**Estado:** correção implementada e prova funcional cirúrgica aprovada. Typecheck CLI e guards aprovados em W. **Typecheck Sucafina bloqueado pelo caller WP14 herdado**, portanto o check geral é `failure`.

[PR #60](https://github.com/gustavomhss/Orchestra-SF/pull/60): `procurement-apply` → `astra-operations`, base `ba8a09e371ce8d93eb917eabb102caaee5affaf4`. Entrega para revisão, sem merge.

## Comportamento entregue

| Situação | Resultado |
| --- | --- |
| Substituir PR em `po_draft` | Preparo recusa com `needs-input / requisition-stage-not-editable`. Review também recusa; não emite digest para confirmar uma substituição ignorada. |
| Substituir PR em `draft` ou `pr_rejected` | O produtor confere cada campo físico solicitado após o domínio executar, na prévia e na execução. Os dois positivos HTTP persistem exatamente 100 → 150. |
| Valor já é o solicitado | `needs-input / requisition-already-matches`, sem novo efeito, `Saved`, CAS ou recibo de sucesso. Igualdade de valores não é prova de uma operação anterior. |
| Prévia diverge da intenção | Review recusa com `prepared-intent-mismatch`; o produtor também exige a pós-condição física antes de admitir estado. |
| Replay de operação realmente aplicada | O caminho existente recupera o mesmo recibo autorizado e mantém um único efeito. |
| Fonte, digest ou autoridade inválidos | Recusa conserva o estado do domínio; a prova de fonte concorrente preserva o CAS mais novo. |

O runtime continua sendo a autoridade sobre permissões e etapas. O delta de produto modifica apenas `product/procurement/prepared.ts`, `scenario-preparation.ts` e `prepared-review.ts`. O bridge C12 existente recompõe a mutação pelo produtor reforçado. Runtime, UI `decision-apply.ts`, políticas e contratos não foram modificados; recuperação H05/I-OPS-02 continua com `operations-fixes`.

## Identidades e relação de evidência

| Papel | Commit | Tree |
| --- | --- | --- |
| W — produto, testes e notas iniciais | `897484c9a472bd43d17cabe56552f2f8fa890185` | `7ce04850ffe2dc283eae076a625bcdc5d70a4cf4` |
| S — snapshot oficial de testes | `9c45f18de1f9bd3d5647e37ef35cb3d5e2855277` | `a105a63918f72022c04cb0c948c0a79979d681ee` |
| S_check — envelope de typecheck/guards | `92fe39450c3b5f3db2ac019b8050a6dc5f883ade` | `93f5ad103abbf56b7d0273e2c31d24a6ab3f6f6f` |

S e S_check descendem diretamente de W. O primeiro acrescenta somente `.ci-run.json`; o segundo, somente `.astra-operations-check.json`. Comparações GitHub confirmaram produto, testes, configuração e fixtures idênticos em ambos. O job de checks fez checkout explícito de W.

Este handoff, TESTS.json e CHECKS.json são arquivos novos de evidência para um descendente de W. Não alteram os blobs de produto/testes nem as notas já publicadas. O SHA desse commit posterior deve ser identificado externamente na PR; nenhum resultado de W é atribuído como execução do head posterior. Não se declara guard do commit posterior nem aceite global C/D.

## CI observado

| Verificação | Run / job | Resultado observado |
| --- | --- | --- |
| Testes Bun cirúrgicos | [43626285237](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43626285237) / `132542704491` | **PASS**: 10 testes, 0 falhas, 141 expectativas, 4 arquivos, 43,32 s. |
| Cleanup do snapshot de testes | Mesmo run / `132543411849` | **PASS**. |
| Typecheck Sucafina | [43627354338](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627354338) / `132546331455` | **FAIL**: único diagnóstico TS2741 no fixture WP14, saída 2. |
| Typecheck CLI | Mesmo run/job de checks | **PASS**. |
| Guards contra `origin/dev` | Mesmo run/job de checks | **PASS**: 78 regras, 843 paths da comparação completa com dev, 0 gates, 11 avisos herdados, 0 erros. |
| Upload de evidência de checks | [Artefato 14126209098](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627354338/artifacts/14126209098) | **PASS**: 5 arquivos, 1.580 bytes; digest e metadados em CHECKS.json. |

Base dos guards: `a1d37698a7bb097c1578f827eba6a19b9917ef07`; merge-base de W com essa referência: `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`. Os 11 avisos estão em três manifests e um teste WP01, todos inalterados pela missão. Não houve ignore, aprovação de guard ou mudança de regra.

Seleção exata, relativa a `modules/sucafina`:

1. `./Sucafinav1/test/product/review-fixes/procurement-apply/refusals.test.ts`
2. `./Sucafinav1/test/product/review-fixes/procurement-apply/real-apply.test.ts`
3. `./Sucafinav1/test/product/wp04/prepared-production.test.ts`
4. `./Sucafinav1/test/product/wp04/finance-prepared-alias.test.ts`

São sete casos novos e três regressões existentes. Request normalizado, hashes, nomes/durações dos casos, W/S e jobs constam em TESTS.json. O controle Omni foi `not applicable (focused: no declaring test ran)`, com nonce `d8b6c10d15b6b0aa3c328526026e4d02`; nenhuma qualificação Omni é inferida. O run Bun não publicou artefatos; sua evidência está no log hospedado.

Foram iniciados exatamente um run de testes e um run de checks, sequenciais para esta missão, após deduplicação. Nenhum teste de produto local, epic, full suite ou workflow novo foi executado/criado.

## Limites da prova e critérios

O alvo primário é **WP04.QLT.10**, nos estados explícitos de preparo/review/Apply, versão, digest e confirmação fiel. Há suporte delimitado a **WP04.DOD.02**, **WP04.T02.SUC.02**, **WP04.INV.01/.02**, **C03/C12**, **CAMP.QLT.03**, **sf2h-integral-20261112.QLT.07** e **CAMP.CMP.02**. Não são PASS integrais desses critérios: jornadas completas de UI, análise de IA, entrada local, restart e recuperação exigem suas próprias provas.

Os positivos de `draft` e `pr_rejected` usam aplicação HTTP, autoridade, serviços e SQLite reais, com caso/escolha semeados explicitamente e cobertura de custos pendente. Exercitam valor exato, autoria, moeda, fontes, digest, CAS, recibo único, replay e revogação. Não houve execução de modelo nem medição humana.

Em `po_draft`, o save real que ignora o PR é demonstrado em clone descartável. O preparo real recusa; o review recusa entrada legada sintética persistida; o Apply HTTP com digest nunca emitido retorna `prepared-review-required`. Material Procurement, histórico, CAS e recibos permanecem intactos. Isso não demonstra emissão histórica de comando, existência/reparação de recibo antigo ou recuperação histórica. O teste de intenção mista também executa a mutação em clone, não um Apply HTTP persistido. O retry foi demonstrado na mesma composição ativa, sem restart ou resposta perdida.

## Pendência externa e consumidor

O único diagnóstico TypeScript é `test/product/wp14/source-access-atlas.test.ts(167,41): TS2741`: falta `procurementEvidenceWrites` no segundo cenário Documents WP06 → BusinessContext → Atlas C17. O arquivo tem o mesmo blob `fbe627ffde443ff7e2d3b1204bbcf67523404f41` na base e em W.

**Consumidor/owner:** `astra-compose` / owner do teste WP14. A proposta mínima já está publicada na base: [OPS-CONSUMER-02.patch](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP06/operations-20261114/OPS-CONSUMER-02.patch), blob `2ab9a6b6f18709d5bad95f58247c70ba286a00aa`.

Preimage: `fbe627ffde443ff7e2d3b1204bbcf67523404f41`. Postimage proposto: `d7d2a69837560f42438d470b83724c1a61939a73`. Os dois hunks compartilham a mesma WeakSet entre autoridade e BusinessServices. A missão referencia o patch existente e preserva o consumidor externo; não duplica nem aplica a correção. O owner deve reconciliar o head atual, preservar ambos os cenários e validar typecheck mais a seleção real do consumidor, com os controles scanner/Omni exigidos.

## Índice de recibos

| Arquivo | Blob | Papel |
| --- | --- | --- |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | `b83d0bad6a7c568aadc5ab5119e575ff1a3a0869` | Checkpoint anterior aos runs; preimages de produto e obrigações delimitadas. Preservado. |
| [EXTERNAL.md](EXTERNAL.md) | `2d219efeb9afefd9337cbfb5de58fed8a3b46081` | Dependência herdada e patch original/owner. Preservado. |
| [TESTS.json](TESTS.json) | `25ce9c739ea597dd0016bcb02055f590c89453da` | Resultado observado, requests, seleção, blobs em W e limites dos testes. |
| [CHECKS.json](CHECKS.json) | `6f6d8ea023777feeb4dc0b8f991fc2a02c6c8bbe` | Resultado próprio de typechecks/guards, artefato e pendência externa. |

Os textos iniciais que dizem “hosted validation not yet run” são checkpoints históricos, complementados pelos recibos posteriores; não foram reescritos. Fonte da missão/COMMON: `30e2215749d5295f81fdeafccb9e69ba21d0cdb8`; pack completo WP04/CI: `a3d29d011ba3607a57914701300f09117a3e2de9`; fonte normativa: `dbf9547211d9b0fade619790de7c19c0869b7c7d`. O escopo da campanha permanece 15 WPs / 74 tarefas / 17 contratos / 1.610 critérios.
