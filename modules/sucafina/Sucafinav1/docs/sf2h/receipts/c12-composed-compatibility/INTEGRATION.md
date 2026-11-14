# Missão32 — consumo pela sessão23

## Entrega e ownership

Esta continuação usa a mesma branch `procurement-apply` e PR60. A implementação C12 foi publicada na origem em `614e5c06b380fa671c3aed57ffe1172a31665ab3`; o ajuste observacional do teste de revogação foi publicado em `6f61cc332b4ebfa4a45313cd69da9dd99d4ab4fe`. Os recibos e o handoff da missão19 permanecem intactos. A sessão23 continua como única integradora de `sf2-stack`; esta missão não moveu essa ref.

A composição observada inicialmente era `253baad3f2ff4af5beac695feae4c2f6372dc2e7`. Antes de editar, foi fixado seu filho documental publicado `402a091485e11d60dff433049c7dedd7fcead687`, tree `006339cc3a61de9bf99d2ba17069181bd5d8a02e`. O executor Finance retido é o preimage real `6ad51e47b22eca073a0a81731575c463d98673e4`; não foi substituído pelo executor antigo da origem.

Na conferência final, a publicação material C9 avançou a base para **`2c44f5d63b6f1a09bd81610be6fe3a1087f6daa0`**, tree `2dba7fd244afcd39b837b1e61406de1e43450bb5`. Esta missão concluiu uma única requalificação delimitada dessa base: **W4 `ba731ff646d8ed7a1c7fb15bf82f4e8c5a2ef81a`**, tree `c46c6dbb4d0e1bdc84da7ab21812f16e4bcc9b04`, filho direto da publicação C9. O delta contém somente dois arquivos de produto e nove arquivos próprios de testes/helpers. `closure.json` fixa SHA/path/blob, o tree completo e a referência imutável à qualificação anterior.

O código de produto é idêntico ao qualificado em W3. A fixture C12 da origem `a20f8701f8e8d8a5e75a1dc66e47de1ef8a2dfe1` conserva a identidade do callback C08 quando o hook de retenção não está armado. Não altera o provider, o case-port, o host compartilhado ou os oráculos. Os avanços materiais dessas dependências são preservados e motivam o recheck C12/OPS.

## Patches completos

| Arquivo | Conteúdo | SHA256 |
| --- | --- | --- |
| [bundle-product.patch](patches/bundle-product.patch) | Dois arquivos permitidos: executor C12 e host Procurement. | `7b28a6edce5627d7eb14b5865e414805e0cc96a5fc45b764c67165568af77bb8` |
| [bundle-tests.patch](patches/bundle-tests.patch) | Cinco arquivos anteriores de recovery, incluindo a fixture de leitura, e quatro discriminadores, somente nos namespaces C12 próprios. | `32c2af29218e696992d42a67884d4b8d7ac64f68a2868872fe26642644c816ca` |
| [manifest.json](patches/manifest.json) | Base/target, todos os preimages/postimages e verificação estática dos onze resultados. | O Git blob do próprio arquivo é fixado pelo commit documental da PR. |

Os hunks completos vieram do compare GitHub `2c44f5d…ba731ff`. Cada hunk foi reconstruído estaticamente sobre os bytes do preimage e os onze resultados foram comparados aos blobs do W. Isso verifica a integridade do patch; não é execução local de produto nem substitui Actions.

A origem e a composição têm versões deliberadamente distintas de `apply.ts`:

| Árvore | Blob |
| --- | --- |
| Origem recebida `c8a03c4` | `2776a112cd24c1cb3bd4fe2791f7b232fb68286d` |
| Origem implementada `614e5c0` | `605ad1fbd9167b8234aa614a01638724e87f36f5` |
| Bundle recebido `2c44f5d` (mesmo executor de402a091) | `6ad51e47b22eca073a0a81731575c463d98673e4` |
| Bundle corrigido W4 `ba731ff` | `65d2a0518427b1454aa665ef744bce7564ed8049` |

Consumir o patch composto e conferir seus preimages preserva `application-attempt`, reservas duráveis, clones, leitura fresca, releitura autoritativa e retenção final do Finance. Copiar o arquivo inteiro da origem descartaria diferenças que esta missão deliberadamente conservou.

O host `decision-host.ts` tem preimage `14e41977752f48fc0f204dc5e5893521a5bd1d30` e postimage `9b48c999661e4b8a10593ae7cd5d6e2ed1e2f635`. Os outros dois arquivos permitidos de produto, `decision-http.ts` e `ui/decision-apply.ts`, permanecem inalterados nesta continuação.

## Correção e oráculos

A reprodução inicial demonstrou uma falha material: depois do efeito150, uma choice editada para900 ainda recebia o vínculo do recibo original e resposta200. O patch captura o digest da escolha original e o confronta antes de conciliar. O host mantém essa ligação desde a admissão canônica, fechando a janela anterior à captura do executor.

A admissão e a reconciliação também exigem uma única choice e um único PreparedChange para os IDs selecionados. Uma duplicata divergente não pode ser escondida por `.find` nem receber dois vínculos por `.map`. Entradas corrompidas são recusadas sem apagar seus bytes e sem repetir o efeito.

A edição irrelevante do objetivo continua compatível com reconciliação fresca200. Para manter a prova canônica de recibo durável ainda não vinculado, o novo helper interrompe somente o retorno após o commit real. O primeiro resultado503, o retry comum409 e a recuperação explícita200 descrevem pontos diferentes do fluxo. A justificativa individual de cada oráculo está em [ORACLES.md](ORACLES.md). O adendo [ORACLES-EGRESS.md](ORACLES-EGRESS.md) conserva a recusa interna de retenção e exige a recusa HTTP externa por revogação no host integrado.

## Interface de execução e leitura dos resultados

Os pedidos Actions são filhos diretos de cada W e acrescentam apenas `.ci-run.json`. Nenhum W foi publicado em `sf2-stack`. As refs temporárias `ci-run-linux-…` usam o dispatcher existente; o workflow remove essas refs no cleanup.

| Rodada | W | S | Recibo |
| --- | --- | --- | --- |
| Reprodução sem correção de produto | `7fd76f647a57e9b9bc1415a4d516791e13b719b4` | `ca03f3f48e19b16acdea15e2b46976180208c139` | [reproduction-01/result.json](reproduction-01/result.json) |
| Primeiro candidato, helper sintaticamente inválido | `05b9486f7c96f3aa793f030d5157c17b7b340ac1` | `7660065a030c5e0e128c1d5947ce6c41d798d583` | [validation-01/result.json](validation-01/result.json) |
| Candidato corrigido e identidade única | `9cf37f42eefb080940c7c71e4c2b1c5539459295` | `26cb97baa6ff8be3a4f020cad9ccfccbb1a6d860` | [validation-02/result.json](validation-02/result.json), 22 pass / 1 fail |
| Revogação na retenção e saída, teste isolado | `796f7d75310eba98a847a5ad9a5d4a5cec7e3de7` | `0a316164ce059b113e966810dc0c09cf47e0f76b` | [validation-03/result.json](validation-03/result.json), 1 pass / 0 fail |
| C9, closure material nova e seletor real | `ba731ff646d8ed7a1c7fb15bf82f4e8c5a2ef81a` | `114b1c3ff83a038b515f4afcf5db0fc795d59b6d` | [validation-04/result.json](validation-04/result.json), 22 pass / 0 fail |

A conclusão de cada execução permanece a observada. As oito regressões independentes aprovadas no primeiro candidato foram selecionadas novamente depois dos novos guards de identidade. Nenhum PASS de origem ou do primeiro candidato é transferido automaticamente ao W corrigido. W2→W3 altera somente o corpo do teste de revogação já identificado: produto, fixtures, imports e os outros 22 corpos de teste permanecem idênticos. A seleção histórica de W3 usou arquivo exato e filtro exato desse teste, sem reexecutar os 22 passes. A mudança material C9 motivou posteriormente a seleção distinta de W4: 22 casos C12/OPS; o alias WP04 foi reutilizado por identidade da sua closure direta.

O teste positivo `fresh-reconciliation.test.ts` destina-se ao executor composto. A origem antiga não recebe uma alegação de PASS desse fluxo. A prova do W composto também não é automaticamente prova de um futuro commit integrado: a sessão23 deve conferir sua closure e qualificar a integração efetiva.

## Typecheck, guards e caller WP14

A origem dispõe do workflow existente `.github/workflows/astra-operations-check.yml`, blob `ec63fc5e1a355ada4f1b73cc518c225719e9b08e`. Seu envelope exige W na origem, parent direto e apenas `.astra-operations-check.json`; o modo completo executa `bun typecheck` nos pacotes Sucafina/CLI e `bun run check:guards --base origin/dev`. Os resultados desta missão são registrados separadamente dos testes compostos.

O mesmo workflow não existe no bundle fixado. Não se importou workflow nem se usou epic/full suite para contornar essa fronteira. Typecheck e guards executados na origem não se apresentam como execução no bundle.

O caller externo `test/product/wp14/source-access-atlas.test.ts` mantém na origem o preimage `fbe627ffde443ff7e2d3b1204bbcf67523404f41`, correspondente ao TS2741 histórico de `procurementEvidenceWrites`. O bundle já contém o postimage corrigido `d7d2a69837560f42438d470b83724c1a61939a73` do patch existente [OPS-CONSUMER-02.patch](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP06/operations-20261114/OPS-CONSUMER-02.patch), blob `2ab9a6b6f18709d5bad95f58247c70ba286a00aa`. Não reaplicar esse patch ao bundle. Nenhum teste fora da autoridade C12 foi editado nesta missão.

## Ação da sessão23 e limites

A sessão23 recebe os dois patches completos, a closure, a justificativa contratual e os recibos reais. Deve conferir a identidade do seu candidato atual, consumir somente os deltas autorizados e registrar o resultado no SHA efetivamente composto. Se os preimages tiverem mudado, reconciliar o delta com os owners antes de atribuir a prova a outro tree.

Esta missão preserva o escopo de campanha e T0. Não fecha globalmente IOPS02, first-save, lost-register, AM04 integral, navegação Workbench completa, execução de IA/nativa ou aceite C/D/GLOBAL_RELEASE. A prova UI usa shell GET mínimo e POSTs reais; a reabertura é de serviços/C08/SQLite no mesmo processo Bun, com nova admissão e contexto de browser, sem reiniciar Orchestra. Nenhuma aprovação PR/PO de domínio é fabricada pela escolha de gestão.

## Evidência anterior à publicação C9

O run [43643559235](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43643559235) conserva sua conclusão failure com 22 passes individuais. O run [43644467464](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43644467464) aprovou o único caso restante com a recusa interna e externa exatas, 28 assertions e os quatro outros casos filtrados. Há 23 cenários distintos comprovados (15 C12, 7 OPS-REV-02 e 1 WP04), sem alegar um run único verde de 23 testes.


## Resultado na closure C9

O run [43646007759](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43646007759), job `132603819490`, aprovou **22/22 cenários, 570 assertions, nove arquivos, 402,01s** no W4/S4 acima. O controle Omni foi **pass**, nonce `2518f58e18caab01f544b1da18395a25`, dois spawns, zero delegated. Não houve artefatos Bun; o recibo estruturado e os logs hospedados identificam os resultados reais.

São 15 casos C12 e sete OPS-REV-02 novamente executados sobre o C9 publicado. O caso WP04 de alias permanece uma evidência separada do run43643559235, reutilizada por identidade do teste e de sua closure direta. Não se alega um run verde de23 testes, aceite de desempenho C08, aceite de Routines ou aceite global. A nova prova substitui a necessidade de transportar os resultados C12/OPS da base anterior; esses recibos continuam preservados com suas conclusões originais.
