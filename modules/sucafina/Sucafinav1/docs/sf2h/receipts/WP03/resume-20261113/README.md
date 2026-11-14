# WP03 — retomada de 13/11/2026

**Estado: produtor revalidado; integração ainda pendente.** Esta entrega continua a branch `astra-wp03` e o [PR #22](https://github.com/gustavomhss/Orchestra-SF/pull/22), com base `sf2-stack`. O escopo é Sucafina/WP03. Genesis e implementação de WP05 não fazem parte desta alteração.

## Resultado e identidade

O candidato de produto desta retomada é **`5d811c04881b630608789d56349f8bed5908f509`**, árvore `998b73a29f7d680642db7a49ecc4676bdcecd5a0`. Ele descende do HEAD retomado `f1eca7591b14e6cf8fda7cfb7b7a7a77959314be`, por um commit que adiciona apenas contraprovas e outro que corrige o produto.

A seleção hospedada reteve os 28 arquivos anteriores e acrescentou dois. O resultado foi **163 pass / 0 fail, 1608 assertions, 30 arquivos**. Os 142 nomes históricos reaparecem uma vez cada; os 21 casos novos também passaram. A reprodução anterior, com esses mesmos dois arquivos de teste e sem as correções, produziu **19 fail / 2 pass**.

| Execução | Produto / snapshot | Resultado observado |
| --- | --- | --- |
| [RED — 43527686283](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43527686283) | W `0b41cf9072fac93597ebd9b36b52b58f4e307cfd`; S `ca75f98b6aa4e048fe855e3a32a515efd7452b3b` | 21 testes, 2 pass, 19 fail, 28 assertions. Falhas discriminantes esperadas, sem falha de fixture/import/timeout. |
| [GREEN — 43528213766](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528213766) | W `5d811c04881b630608789d56349f8bed5908f509`; S `aff47b70bde99a09bef5a247553728b1662d7166` | 163 pass, 0 fail, 1608 assertions, 30 arquivos, 43,48 s de testes. |
| [Checks do produto — 43528219202](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528219202) | Checkout direto de W | Guards: 78 regras, 625 paths, 0 gates, 12 warnings, 0 errors. Typecheck: failure, 132 diagnósticos externos. |

Os snapshots de teste diferem dos respectivos produtos somente pela adição de `.ci-run.json`. Os requests exatos e seus hashes estão nos JSONs deste diretório. Nenhum teste ou typecheck de produto foi executado localmente.

## Correções realizadas

1. **Identidades de preview.** Previews mensais, de Headcount e de catálogo usam IDs temporários determinísticos, sem consumir o gerador real. O helper evita colisão com registros vivos, chaves legadas e revisões de registros removidos. Os testes repetem o preview, verificam o snapshot original e exercitam apply com o ID real.
2. **Falhas de leitura do catálogo.** Falha de environment retorna indisponibilidade; falha de revalidação na entrada ou na saída retorna recusa. As exceções não escapam como um resultado de leitura utilizável.
3. **Identidades ambíguas no catálogo.** Save/delete de FX, entidade e allocation exigem exatamente um alvo. Os seis casos verificam a recusa de preview/apply e a preservação dos dois registros.
4. **Resultado de gravação mensal.** A revalidação de saída distingue commit efetivo de conflito sem commit. Somente o primeiro exige reconciliação; a recusa sem gravação permanece denied e conserva o snapshot.
5. **Observações independentes na comparação.** Cenários e critérios são copiados antes de chamar o resolver seguinte. Fontes e coverage seguem a mesma ordem. O preview conserva request, baseline e sample separados dos objetos mutáveis do callback. Mudança entre observações retorna stale; o caso estável mantém a diferença canônica de 12000 e o estado conditioned, sem inventar cobertura completa.

A superfície de autoridade, roleMap, intent digest, abort, revisão e revalidação continua presente. A revisão independente inspecionou as fixtures e a implementação, confrontou cada falha RED e reconciliou os 163 nomes/path no GREEN.

Os blobs dos dois arquivos novos de teste são os mesmos no RED e no GREEN:

- `resume-ui-host-boundaries.test.ts`: `b112602cb6e3a12ca208780092b2a65ab6a24c91`.
- `resume-engine-freshness.test.ts`: `317499b1e96ace3f56f23421e303bf5e6c47b414`.

## Alcance da prova e matriz

A [matriz atual](./criteria-matrix.json) conserva os **112 IDs e textos literais**, o estado e a prova remanescente de cada critério. O [catálogo observado](./test-proof-catalog.json) liga os resultados ao run e ao produto desta retomada. Os receipts históricos permanecem intactos.

| Estado | Critérios |
| --- | ---: |
| PRODUCER_VERIFIED | 79 |
| PENDING_UI_PROOF | 16 |
| BLOCKED_EXTERNAL | 9 |
| NATIVE_UNPROVEN | 8 |
| **Total** | **112** |

A nova prova acrescenta casos que a seleção W6 não discriminava. W6 continua sendo uma observação histórica, sem atribuição retroativa dos testes novos. O GREEN reexecuta a seleção anterior e os novos casos no candidato acima; isso não fecha consumo instalado, navegador ou runtime residente.

Os dois runs registram Omni **not applicable**, sem spawn e sem delegação. O nonce GREEN é `cea71b8ad102336ce79e22d876acea37`. Nenhuma prova de SessionV2, SkillLoadReceipt, grant/provider real, MCP vivo ou reabertura de resultado nativo foi fabricada.

## Pendências concretas e owners

| Owner | Pendência e próxima ação | Evidência / encaminhamento |
| --- | --- | --- |
| WP10 | O carregador registra a base e o wildcard que já inclui a base, impedindo o CLI instalado de servir a UI. Aplicar o delta do owner e repetir a spec instalada. | [Handoff do router](../wp10-installation-router-handoff.md). O arquivo `apps/cli/src/sucafina-product/installation.ts` conserva em W o blob `30ffcb8353cdf478808fbb8d6bc67b48b10a6109`. O run browser histórico 43520849840 falhou antes da UI. Não foi repetido sem alteração da causa. |
| WP00 / WP01 | Conectar os campos operation/entity/setting ao contrato e router; provar edição, preview/apply, conflito/retry, Overview, Versions e perfis na UI real. | [Contrato mensal](../wp00-monthly-contract.patch), [router](../wp01-monthly-route.patch), [retry](../wp01-monthly-retry.json), [Overview/Versions](../wp01-overview-versions-handoff.md). |
| WP10 / WP11 / WP13 / S0 | Executar o caminho residente com identidade, skill e grants reais, persistir e reabrir os resultados no consumidor; integrar as obrigações de comparação e apply. | [Runtime nativo](../native-runtime-handoff.md), [persistência de comparação](../wp13-comparison-persistence-handoff.md), [fonte do apply](../wp11-planner-apply-source-initialization-handoff.md). |
| Owners externos / S0 | Resolver os 132 diagnósticos do pacote sem suprimir o gate; revalidar os consumidores afetados. | [Atribuição atual](./typecheck-attribution.json) e [handoff detalhado anterior](../external-typecheck-handoff.md). |

A atribuição atual analisou todos os 132 headers, em 41 paths, aceitando prefixos relativos e completos. Não há diagnóstico em paths próprios de WP03 nem novo local/código comparado ao seed. As duas diferenças literais são mensagens TS2322 nos mesmos locais externos de WP06, com ordem diferente de propriedades. Os nove locais resolvidos são uma comparação com o seed histórico, não nove correções novas desta retomada.

Os 12 warnings também são anteriores: dez dependências em manifests não alterados, um double cast em decisions e um timeout da spec instalada WP03. Nenhum path desses warnings está entre os dez paths alterados nesta retomada; nenhum ignore, label, regra ou timeout foi modificado para obter aprovação. O bloqueio conhecido do browser é a duplicação de rota, documentada acima.

## Arquivamento e limite da entrega

Este diretório acrescenta somente receipts novos em JSON, Markdown e texto, modo 100644. O produto e seus inputs permanecem no candidato W. O índice de evidências registra os hashes dos outros arquivos sem incluir seu próprio hash. O SHA do commit que contém os receipts e o resultado do guard posterior são publicados no PR, sem editar estes arquivos para autorreferência.

O T0 original, `2026-11-13T04:01:10Z`, permanece registrado; esta retomada não reinicia o relógio nem declara a campanha concluída em duas horas. A entrega não é aceite integral do WP ou da campanha, não substitui as revisões globais e não realiza merge ou deploy.
