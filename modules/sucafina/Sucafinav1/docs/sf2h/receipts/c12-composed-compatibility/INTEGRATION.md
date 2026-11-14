# Missão32 — consumo pela sessão23

## Entrega e ownership

Esta continuação usa a mesma branch `procurement-apply` e PR60. A implementação C12 foi publicada na origem em `614e5c06b380fa671c3aed57ffe1172a31665ab3`. Os recibos e o handoff da missão19 permanecem intactos. A sessão23 continua como única integradora de `sf2-stack`; esta missão não moveu essa ref.

A composição observada inicialmente era `253baad3f2ff4af5beac695feae4c2f6372dc2e7`. Antes de editar, foi fixado seu filho documental publicado `402a091485e11d60dff433049c7dedd7fcead687`, tree `006339cc3a61de9bf99d2ba17069181bd5d8a02e`. O executor Finance retido é o preimage real `6ad51e47b22eca073a0a81731575c463d98673e4`; não foi substituído pelo executor antigo da origem.

O W composto corrigido é `9cf37f42eefb080940c7c71e4c2b1c5539459295`, tree `28877563a208d3db3e0f96c761ce357fcc2703b0`. Ele descende do bundle fixado e contém somente dois deltas de produto e oito arquivos de testes/helpers próprios. `closure.json` fixa os caminhos e blobs, as dependências críticas e o tree completo.

## Patches completos

| Arquivo | Conteúdo | SHA256 |
| --- | --- | --- |
| [bundle-product.patch](patches/bundle-product.patch) | Dois arquivos permitidos: executor C12 e host Procurement. | `7b28a6edce5627d7eb14b5865e414805e0cc96a5fc45b764c67165568af77bb8` |
| [bundle-tests.patch](patches/bundle-tests.patch) | Quatro arquivos anteriores de recovery e quatro novos discriminadores, somente nos namespaces C12 próprios. | `b997d3c9965069ca530c96b29becbfeba701e73018240c0a9b17818c7f947099` |
| [manifest.json](patches/manifest.json) | Base/target, todos os preimages/postimages e verificação estática dos dez resultados. | O Git blob do próprio arquivo é fixado pelo commit documental da PR. |

Os hunks completos vieram do compare GitHub `402a091…9cf37f4`. Cada hunk foi reconstruído estaticamente sobre os bytes do preimage e os dez resultados foram comparados aos blobs do W. Isso verifica a integridade do patch; não é execução local de produto nem substitui Actions.

A origem e a composição têm versões deliberadamente distintas de `apply.ts`:

| Árvore | Blob |
| --- | --- |
| Origem recebida `c8a03c4` | `2776a112cd24c1cb3bd4fe2791f7b232fb68286d` |
| Origem implementada `614e5c0` | `605ad1fbd9167b8234aa614a01638724e87f36f5` |
| Bundle recebido `402a091` | `6ad51e47b22eca073a0a81731575c463d98673e4` |
| Bundle corrigido W `9cf37f4` | `65d2a0518427b1454aa665ef744bce7564ed8049` |

Consumir o patch composto e conferir seus preimages preserva `application-attempt`, reservas duráveis, clones, leitura fresca, releitura autoritativa e retenção final do Finance. Copiar o arquivo inteiro da origem descartaria diferenças que esta missão deliberadamente conservou.

O host `decision-host.ts` tem preimage `14e41977752f48fc0f204dc5e5893521a5bd1d30` e postimage `9b48c999661e4b8a10593ae7cd5d6e2ed1e2f635`. Os outros dois arquivos permitidos de produto, `decision-http.ts` e `ui/decision-apply.ts`, permanecem inalterados nesta continuação.

## Correção e oráculos

A reprodução inicial demonstrou uma falha material: depois do efeito150, uma choice editada para900 ainda recebia o vínculo do recibo original e resposta200. O patch captura o digest da escolha original e o confronta antes de conciliar. O host mantém essa ligação desde a admissão canônica, fechando a janela anterior à captura do executor.

A admissão e a reconciliação também exigem uma única choice e um único PreparedChange para os IDs selecionados. Uma duplicata divergente não pode ser escondida por `.find` nem receber dois vínculos por `.map`. Entradas corrompidas são recusadas sem apagar seus bytes e sem repetir o efeito.

A edição irrelevante do objetivo continua compatível com reconciliação fresca200. Para manter a prova canônica de recibo durável ainda não vinculado, o novo helper interrompe somente o retorno após o commit real. O primeiro resultado503, o retry comum409 e a recuperação explícita200 descrevem pontos diferentes do fluxo. A justificativa individual de cada oráculo está em [ORACLES.md](ORACLES.md).

## Interface de execução e leitura dos resultados

Os pedidos Actions são filhos diretos de cada W e acrescentam apenas `.ci-run.json`. Nenhum W foi publicado em `sf2-stack`. As refs temporárias `ci-run-linux-…` usam o dispatcher existente; o workflow remove essas refs no cleanup.

| Rodada | W | S | Recibo |
| --- | --- | --- | --- |
| Reprodução sem correção de produto | `7fd76f647a57e9b9bc1415a4d516791e13b719b4` | `ca03f3f48e19b16acdea15e2b46976180208c139` | [reproduction-01/result.json](reproduction-01/result.json) |
| Primeiro candidato, helper sintaticamente inválido | `05b9486f7c96f3aa793f030d5157c17b7b340ac1` | `7660065a030c5e0e128c1d5947ce6c41d798d583` | [validation-01/result.json](validation-01/result.json) |
| Candidato corrigido e identidade única | `9cf37f42eefb080940c7c71e4c2b1c5539459295` | `26cb97baa6ff8be3a4f020cad9ccfccbb1a6d860` | [validation-02/request.json](validation-02/request.json); resultado terminal em arquivo próprio |

A conclusão de cada execução permanece a observada. As oito regressões independentes aprovadas no primeiro candidato foram selecionadas novamente depois dos novos guards de identidade. Nenhum PASS de origem ou do primeiro candidato é transferido automaticamente ao W corrigido.

O teste positivo `fresh-reconciliation.test.ts` destina-se ao executor composto. A origem antiga não recebe uma alegação de PASS desse fluxo. A prova do W composto também não é automaticamente prova de um futuro commit integrado: a sessão23 deve conferir sua closure e qualificar a integração efetiva.

## Typecheck, guards e caller WP14

A origem dispõe do workflow existente `.github/workflows/astra-operations-check.yml`, blob `ec63fc5e1a355ada4f1b73cc518c225719e9b08e`. Seu envelope exige W na origem, parent direto e apenas `.astra-operations-check.json`; o modo completo executa `bun typecheck` nos pacotes Sucafina/CLI e `bun run check:guards --base origin/dev`. Os resultados desta missão são registrados separadamente dos testes compostos.

O mesmo workflow não existe no bundle fixado. Não se importou workflow nem se usou epic/full suite para contornar essa fronteira. Typecheck e guards executados na origem não se apresentam como execução no bundle.

O caller externo `test/product/wp14/source-access-atlas.test.ts` mantém na origem o preimage `fbe627ffde443ff7e2d3b1204bbcf67523404f41`, correspondente ao TS2741 histórico de `procurementEvidenceWrites`. O bundle já contém o postimage corrigido `d7d2a69837560f42438d470b83724c1a61939a73` do patch existente [OPS-CONSUMER-02.patch](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP06/operations-20261114/OPS-CONSUMER-02.patch), blob `2ab9a6b6f18709d5bad95f58247c70ba286a00aa`. Não reaplicar esse patch ao bundle. Nenhum teste fora da autoridade C12 foi editado nesta missão.

## Ação da sessão23 e limites

A sessão23 recebe os dois patches completos, a closure, a justificativa contratual e os recibos reais. Deve conferir a identidade do seu candidato atual, consumir somente os deltas autorizados e registrar o resultado no SHA efetivamente composto. Se os preimages tiverem mudado, reconciliar o delta com os owners antes de atribuir a prova a outro tree.

Esta missão preserva o escopo de campanha e T0. Não fecha globalmente IOPS02, first-save, lost-register, AM04 integral, navegação Workbench completa, execução de IA/nativa ou aceite C/D/GLOBAL_RELEASE. A prova UI usa shell GET mínimo e POSTs reais; a reabertura é de serviços/C08/SQLite no mesmo processo Bun, com nova admissão e contexto de browser, sem reiniciar Orchestra. Nenhuma aprovação PR/PO de domínio é fabricada pela escolha de gestão.
