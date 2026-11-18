# M29-RUNTIME-001 — C07/Relay não composto no host instalado

- **Tipo:** BUG de composição, demonstrado por inspeção estática; execução não realizada.
- **Severidade:** P1, bloqueador do aceite integral AM02/AM06.
- **Decisão:** REQUEST_CHANGES para a composição de rotinas.
- **Candidato examinado:** `0ce090d7d1d4399d77b435debd59eb7cc903c202`.
- **Tree:** `f13eadcdf86861982ded1d05ef02e3bdd94adb2f`.
- **Revisor:** S3-R3 independente, missão29, sem autoria do produto.
- **Observação:** 2026-11-14T21:09:26Z.

## Contradição concreta

O pack S3-R3 exige oito packs/39 operações acessíveis pelo transporte privado C16 e, em AM06, a cadeia receita publicada → admissão C07 nativa → Relay → perfil/skill/operação → resultado factual → consumidor UI. A composição efetiva deste C cria os serviços de rotinas sem o campo `native` e não registra suas capacidades nos descritores usados pelo MCP/UI.

Em `apps/cli/src/sucafina-product/host-context.ts`, linhas 278–283, a publicação e os leitores de inputs são instalados, mas a chamada a `createSfRoutineServices` omite o adaptador `SfRoutineNativePort`. O comentário adjacente declara a indisponibilidade da admissão C07 e a ausência dos descritores de rotinas. Em seguida, `descriptors = business.descriptors` (linha 309) é passado a `createSfProductContribution` (linhas 728–729).

Em `routine-services.ts`, o port nativo é opcional no tipo da fábrica. Quando não fornecido, os caminhos de plano, admissão e execução retornam, respectivamente, indisponibilidade/needs-plan em vez de uma execução nativa. A contribuição instalada registra somente os descritores recebidos. A existência de implementações e de nomes no catálogo não preenche esse elo.

## Fontes fixadas

Todos os caminhos abaixo foram lidos via GitHub MCP no mesmo C:

| Caminho | Git blob | Papel |
| --- | --- | --- |
| `apps/cli/src/sucafina-product/host-context.ts` | `bdf6d4e2014cc9b2a492b6ae304948c249221e39` | Composição real, sem native e sem descritores das rotinas |
| `apps/cli/src/sucafina-product/routine-services.ts` | `8b76b7591bf3ce0312108faafcda6b244a2d5e89` | Contrato do adaptador e recusas quando ausente |
| `apps/cli/src/sucafina-product/contribution.ts` | `8d44320acedc4afec9ffc100f5f6a171cdf26993` | Registro dos descritores no bridge privado e dispatch UI |
| `modules/sucafina/Sucafinav1/product/routines/capabilities.ts` | `b8adcb574a84c213bfdec0659c7cc074a543564c` | Seis operações definidas, insuficientes sem montagem |

Operações afetadas: `sf_routine_catalog`, `sf_routine_prepare`, `sf_routine_run`, `sf_routine_status`, `sf_routine_result` e `sf_watch_prepare`.

## Efeito e limites

A recusa é conservadora: esta revisão não demonstrou vazamento, execução sem autorização ou falha observada em um runtime. O defeito é a ausência estática do caminho obrigatório na montagem instalada. Não se declara que o mecanismo Relay ou um host nativo estejam indisponíveis em todos os ambientes.

A fonte contém serviços de publicação, wrappers e verificações de resultado. Isso não comprova que o produto instalado exponha as seis operações ou conclua AM06. Um teste isolado com port injetado, catálogo de 39 nomes, recibo de outro SHA ou mera retomada SessionV2 não resolve esta composição.

## Recurso mínimo e próximo passo exato

**Owners:** S0/WP10 para composição, WP09 para contrato/consumo de rotinas, WP00/C07 para adaptador nativo e WP12 para o caminho perfil/skill.

1. O owner do produto deve fornecer um adaptador C07 real para `SfRoutineNativePort`, com plano publicado, admissão governada, execução e recibo terminal verificáveis, preservando a autenticação do owner nas fronteiras nativas.
2. Compor esse adaptador em `host-context.ts` e registrar as seis capacidades no mesmo conjunto de descritores do MCP privado/UI. Não simular o port com ledger externo, `SessionV2.resume` isolado ou referência autodeclarada pelo modelo.
3. Fixar um **novo C** com a correção. Um resultado futuro nesse novo C não reclassifica retroativamente o C examinado.
4. Sob a autoridade de S0, obter AM02 das seis operações e AM06 no host instalado: versão publicada/admissionRef/runRef/sessionID, skill receipt, toolCallId, resultado/digest, retorno UI, falha/retry/intervenção, retomada sem duplicação e Schedule com fuso, owner e revogação. Provar também a recusa de prepare/run por `routine-result`.
5. Recheck independente no mesmo C aceito e gates finais obrigatórios. A missão29 não executa esses passos.

## Limite desta publicação

Este é um recibo novo na PR51, publicado imediatamente por ser acionável. Não é correção do produto, aprovação de G7, envelope D/G8 ou GLOBAL_RELEASE. Não modifica recibos anteriores. A matriz e o handoff completos desta rodada serão publicados no mesmo namespace.
