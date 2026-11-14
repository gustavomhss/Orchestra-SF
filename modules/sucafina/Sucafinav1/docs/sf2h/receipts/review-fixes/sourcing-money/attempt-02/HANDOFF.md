# OPS-REV-01 — sourcing-money closure

**Status: PARTIAL — PR revisável com pendências externas explícitas.**

[PR #57](https://github.com/gustavomhss/Orchestra-SF/pull/57): `sourcing-money → astra-operations`. Sem merge. Ator S2-A, lease epoch 1. A correção C02/C06 e as contraprovas passaram; o package typecheck não está verde, e o valor bruto legado permanece divergente fora da fronteira de escrita. Este recibo não encerra aceite global de WP04 ou da campanha.

## Fontes e integridade

- Base e target observados antes do fechamento: `ba8a09e371ce8d93eb917eabb102caaee5affaf4`.
- Planejamento normativo: `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
- COMMON e finding sourcing-money: `30e2215749d5295f81fdeafccb9e69ba21d0cdb8`.
- AGENTS, pack WP04 completo e CI: `a3d29d011ba3607a57914701300f09117a3e2de9`; também reconciliados os validadores/workflows do head real.
- Head observado antes deste commit documental = produto W abaixo. Atualização da branch por lease `expected_sha=W`, sem force. Nenhuma mudança posterior de terceiros foi substituída.
- O commit que contém este recibo só acrescenta `RESULT.json` e `HANDOFF.md` ao W. Seu SHA e comparação W→entrega constam na PR depois da criação. Não se atribui um novo green ao commit documental; produto, testes, configuração e fixtures permanecem idênticos ao W verificado.
- Nenhum teste de produto local, epic/full suite, merge, alteração de workflow ou escrita em arquivo de outra sessão.

## Delta de produto

Único produto alterado: `product/procurement/monetary.ts`, quatro adições e duas remoções.

A escolha da base monetária considera a etapa efetiva (`sourcing`, `src_pending`, `src_rejected`) antes da existência de linhas da PO futura. Para a conversão existente, a leitura de sourcing recebe uma visão temporária sem a PO; isso também impede que a prioridade interna de `requestValue` selecione a proposta futura.

Não há mutação do registro persistido, aprovação, FX submetido, política financeira, alçadas ou scoring. `confirmation-fields.ts` continua usando o helper compartilhado e não foi modificado.

Testes novos: `test/product/review-fixes/sourcing-money/fixture.ts` e `sourcing-stage.test.ts`. A fixture cria o pedido, submete/aprova PR, salva propostas válidas e executa `select_quote → submit_sourcing` pelos comandos reais; não injeta a PO futura nem o snapshot pendente. C02, C06, comparação e renderer usam o mesmo registro/version/source refs.

## Prova discriminante

| Cenário | Ação real e observado |
| --- | --- |
| Sourcing pendente com PO futura | EUR100 × FX1.08 = USD108; `select_quote` já criou PO com FX/aprovação nulos; depois de `submit_sourcing` e Settings FX2, C02/C06/comparação/fila montada/bloco monetário/detalhe/resumo/aprovações mantêm108 e FX submetido1.08. |
| PO efetivamente submetida | Aprovar sourcing → `po_draft` → `submit_po` com FX2 gera decisão200USD/2; FX corrente3 depois disso mantém200 na PO, enquanto comparação histórica de sourcing mantém108. |
| FX ausente | Após seleção real, remover EURFX produz `null`/ausência na conversão e comparação; UI mostra indisponibilidade, e `submit_sourcing` retorna422 sem alterar persistência nem inventar zero. |
| Moeda base alterada | USD→GBP mantém proveniência submetida108USD/1.08; conversão corrente fica indisponível, sem108GBP; C06 altera fingerprint. |
| Sourcing rejeitado | O comando real de rejeição limpa o snapshot pelo produtor existente; a PO futura/FX corrente não substitui essa ausência. |

A alteração de FX corrente não muda o registro persistido, ranking, pesos nem fingerprints de scope/source/dependency C06. Revogação de acesso retorna `access-unavailable`. O teste observa o contrato C06; não cria um registro persistido de confirmação colaborativa nem prova ausência de recobrança em todo consumidor.

## CI executado e seleção

| Prova | W / snapshot S | Resultado real |
| --- | --- | --- |
| [Funcional inicial 43625920456](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625920456), job132541573935 | W `aa5d8c0ee49777ea82bc707df8c976d311728292`; S `532a73aa2d7b8e7f5e57e0156b0de67f7ac1fb1c` | 58 pass,0 fail,377 assertions; seis arquivos explícitos. |
| [Checks iniciais 43626182880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43626182880), job132542383185 | Mesmo W inicial; S `96688ded4096accb327aa87db36fbc24d4a2cef8` | Package falhou por uma assertion desta missão e pelo erro herdado WP14. CLI e guards passaram. Recibo preservado em attempt-01. |
| [Funcional final 43626658534](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43626658534), job132543906292 | W `a3b7fb9b45d7852a3000e01098336a1aca9526c3`; S `fb440a03e4d712e0d6f40f021997b31a80943a3d` | 5 pass,0 fail,133 assertions; somente os cinco testes afetados, após corrigir a tipagem da assertion. |
| [Checks finais 43626850572](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43626850572), job132544574863 | W final acima; S `b47a2787636a4b9584a703b0dd562f392d00e596` | Package failure somente TS2741 herdado; CLI success; guards success:78 regras,845 paths,0 gate,11 warn,0 errors. |

Seleção funcional inicial: o arquivo novo `sourcing-stage.test.ts` mais `wp04/money.test.ts`, `finance-material.test.ts`, `projection.test.ts`, `comparison-review.test.ts` e `confirmation.test.ts`.

Os outros53 testes não foram repetidos: seus arquivos, produto, fixture, configuração e fontes permaneceram idênticos. São58 testes distintos cobertos e5 revalidados; não63 testes distintos nem um único run58 no W final.

Ambos os snapshots funcionais acrescentam apenas `.ci-run.json`; os de checks acrescentam apenas `.astra-operations-check.json` e fazem checkout explícito do W. Os comparativos GitHub confirmam um commit à frente e nenhum outro delta. A seleção é normalizada, explícita e validada pelo workflow existente. Houve no máximo um run em voo e nenhuma repetição equivalente.

Omni: `not applicable` nos dois runs funcionais, com os nonces correspondentes; nenhum teste selecionado declara spawn. Não se reivindica prova de Omni. O workflow Bun não exige artefato separado; os logs reais foram lidos.

### SHAs finais e artefato

- W: `a3b7fb9b45d7852a3000e01098336a1aca9526c3`; tree `24ef58c1bb91df3b5763d402411b8f5cb73c2812`.
- S funcional: `fb440a03e4d712e0d6f40f021997b31a80943a3d`; tree `69eca18b58b29baf602bfba071cc3319111c1761`; request blob `3847c4a66c5998d3de3677940908995f0281c284`.
- S checks: `b47a2787636a4b9584a703b0dd562f392d00e596`; tree `3bf81e32753c828a6d0c61a6948ab94ccddfc468`.
- Base de guards dev: `a1d37698a7bb097c1578f827eba6a19b9917ef07`.
- Artefato [astra-operations-check-1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43626850572/artifacts/14127005950): ID14127005950,1580 bytes, digest `sha256:2e1458568a99dcb0b3aa3477cbde497e7ca8a81a6118a0ec08a9e1d29491b9cb`, expira2026-11-28T18:31:14Z. Upload/manifest conferidos; conteúdo de compilador/guards lido no log decodificado do job, sem download separado do ZIP.

## Critérios

| Critério | Resultado no recorte |
| --- | --- |
| WP04.T03.CHK.03 | PASS discriminante: snapshot108 estável após FX2; sem FX, ausência e422, nunca zero. |
| WP04.T03.DOD.02; CAMP.INV.03 | PASS nos campos/blocos exercitados: moeda original/base/submetida, FX, estado e indisponibilidade explícitos; base alterada não relabela108USD. |
| WP04.T03.SUC.02; WP04.T04.QLT.02; CAMP.INV.01 | PARTIAL: paridade em C02/C06, fila montada, bloco monetário, detalhe/resumo e comparação; divergência do valor legado abaixo impede aceite integral. |
| WP04.INV.02; T03.INV.01/02 | PASS no cenário: persistência, snapshots, ranking/pesos e políticas preservados; ausência não vira fallback. |
| WP04.T04.CHK.02 | PASS no trecho real sourcing→aprovação→PO submetida com snapshot próprio; não é aceite integral de transições WP04. |
| C02/C06 | PASS para projeção/observação e fingerprints/revogação exercitados; confirmação persistida e consumidores posteriores não executados. |
| WP04.CMP.02; WP04.T03.CMP.01; CAMP.QLT.04/20 | Evidência complementar do recorte e dos53 testes existentes; não reaceitação integral dos critérios ou de todos os consumidores. |

Revisão independente sem autoria por `/root/pack_review`: pack completo, diff da PR e logs finais conferidos; recomendação PARTIAL revisável. As revisões `money_review` e `ci_contract` também avaliaram implementação/fixture e contrato de CI antes do fechamento.

## Pendências e próximo responsável

### 1. Consumidor monetário legado — WP04/runtime

O log real registra `rawLegacyValue=200` no mesmo registro em que C02/C06/comparação=108. `runtime/procurement.ts` ainda expõe `request.value` pelo helper sem recorte de etapa. O fallback da tabela sem fila C02 e o texto separado de diferença da PO ficam fora dos arquivos de produto autorizados.

Preimage `6cd5783d5b4f6f9c9ed3e15547d59f79ccb5ef72`; proposta [legacy-value-owner.patch](legacy-value-owner.patch). O owner deve reconciliar o consumidor e validar seus usos com CI afetado. Patch não aplicado e não testado por esta missão; a divergência impede declarar SUC.02/QLT.02 globais resolvidos.

### 2. Typecheck herdado — WP14/composição

Erro remanescente real: `test/product/wp14/source-access-atlas.test.ts(167,41): TS2741`, falta `procurementEvidenceWrites` na chamada de `createSfBusinessServices`.

Blobs do teste `fbe627ffde443ff7e2d3b1204bbcf67523404f41` e do callee `9aee116a091c684ba467f81316d2fb915b3f8758` idênticos na base inicial e no W; não houve execução de CI de baseline. A assertion desta missão foi corrigida e não aparece no check final.

Proposta [wp14-typecheck-owner.patch](wp14-typecheck-owner.patch), não aplicada/testada. O owner deve incorporar/reconciliar o campo no teste autorizado e executar o typecheck e a seleção afetada. Repetir o run atual sem mudança não agregaria evidência.

As11 advertências de guards são de arquivos herdados fora do delta desta PR. Não há gate ou erro de guards. Detalhes/preimages e validações propostas em [OWNER_FOLLOWUPS.md](OWNER_FOLLOWUPS.md); evidência estruturada e requests completos em [RESULT.json](RESULT.json). Nenhum aceite integral WP04/AM02/GLOBAL_RELEASE, merge ou deploy é declarado.
