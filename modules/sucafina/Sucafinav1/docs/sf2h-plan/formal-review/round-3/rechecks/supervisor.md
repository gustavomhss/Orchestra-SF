# Rodada 3 — rechecagem proporcional de supervisão

**Candidato corrigido:** `9a1812f360fa245fa2fac9aacf4938ddf8f21381`  
**Candidato anterior:** `10a99bf06c5578ec02dab590a680ab18766c7ff4`  
**Veredicto:** **APPROVED_FOR_EXECUTION**  
**R3-SUP-P2-01:** **CLOSED_FIXED**  
**Achados abertos neste escopo:** P0 = 0; P1 = 0; P2 = 0.  
**Produto e Actions:** **NOT_RUN**.  
**Data:** 2026-11-13 03:17:54 UTC.

## Disposição do achado

A ambiguidade de deduplicação está corrigida no candidato exato. Em `campaign.json:/execution_workflow/topology/event_idempotency_key` e no espelho `execution-workflow.json`, a chave agora é `["execution_instance", "event_id"]`. A lista `topology.events` também coincide com `event_protocol.events`, incluindo `GLOBAL_RELEASE`.

O contraexemplo original deixa de colidir: dois FINDING com event IDs distintas na mesma instância/candidato permanecem eventos distintos. Um retry com a mesma instância/event ID é deduplicado. A mesma event ID em outra instância permanece distinta. A conferência documental usou quatro entradas e conservou os três eventos únicos esperados.

O validador contém dois controles novos. Restaurar a chave antiga em uma cópia em memória foi rejeitado por `EVENT_IDENTITY_DRIFT`; remover `GLOBAL_RELEASE` somente da topologia foi rejeitado por `EVENT_ROSTER_DRIFT`. O candidato válido passou as **458 asserções**. Nenhuma dessas verificações executa produto ou um transporte real.

**Disposição:** R3-SUP-P2-01 encerrado como **CLOSED_FIXED** em `9a1812f360fa245fa2fac9aacf4938ddf8f21381`. Não há P2 residual demonstrado.

## Efeito da expansão de contexto

Comparei diretamente os cinco campos operacionais de cada um dos 23 packs com o candidato anterior: `assignment`, `write_authority`, `allocation`, `physical_slot` e `criterion_ids`. As **115 comparações foram idênticas**.

`schedule.json`, `ownership.json`, `START.md` e os cinco prompts também permanecem byte a byte iguais. A nova regra `reference_context_rule` diz expressamente que contratos, rotas, skills e provas selecionados são dependências de leitura: não transferem task ownership, autoridade de escrita nem execução de prova. `WORKFLOW.md` recebeu a mesma explicação.

O diff estrutural de `campaign.json` em relação ao candidato anterior contém apenas três caminhos: roster de eventos, chave de eventos e path do recibo de medição histórica. Portanto, a correção de seleção não cria novos writers, tarefas, reservas, pools ou proof owners.

A ampliação dos packs foi refletida na medição: **3.688.283 bytes** nas listas conservadoras de arranque das cinco coordenadoras e **9.516.800 bytes** nos 23 packs. Conferi as somas com os tamanhos presentes, sem divergência. A medição mantém a ressalva de que bytes não são tokens, latência ou economia de implementação, e de que as leituras de código real e expansões posteriores estão fora desse total.

## Checks e proveniência

| Check | Resultado |
| --- | --- |
| Chave específica por instância/evento | PASS; igual no canônico e no espelho. |
| Roster de eventos | PASS; topologia e protocolo coincidem, incluindo GLOBAL_RELEASE. |
| Contraexemplo original | PASS documental; dois eventos distintos preservados, retry exato deduplicado, outra instância isolada. |
| Validador de execução | 458 asserções; nenhum erro no candidato. |
| Controle negativo da chave antiga | Rejeitado por EVENT_IDENTITY_DRIFT. |
| Controle negativo de GLOBAL_RELEASE ausente | Rejeitado por EVENT_ROSTER_DRIFT. |
| Autoridade e alocação | 115 comparações exatas em 23 packs; nenhuma mudança. |
| Renderer | `PYTHONDONTWRITEBYTECODE=1 python tools/render_plan.py --check`: exit 0, 100 artefatos, `drift: []`. |
| Escopo | 15 WPs, 74 tasks, 17 contratos, 1.610 critérios; todos NOT_RUN. |
| Integridade focal | 41 arquivos conferidos por Git blob SHA1 contra o mapa MCP do commit corrigido; nenhuma divergência. |

O registro `corrected-mcp.json` identifica o candidato corrigido, seu parent `10a99bf06c5578ec02dab590a680ab18766c7ff4` e um mapa com 205 blobs. Esta rechecagem usou esse registro imutável já capturado; não fez nova consulta remota.

Também li os recibos do guard do candidato commitado. Eles registram exit 0, **78 regras, 205 paths, zero gate findings e zero erros**. Existe uma advertência não bloqueante de arquivo maior que 1 MB para o canônico `campaign.json`. O recibo de fidelidade registra correspondência dos 205 blobs, dos 101 inputs de guard/configuração e do root/index remoto, com alterações somente no plano. Não reexecutei esse guard nem o tratei como prova de produto.

## Limites e capacidade

A aprovação é do plano corrigido e não admite automaticamente sua execução. O backend observado continua com **quatro slots globais**, incluindo root; `N4_preset_admitted` continua **false**. Os vinte slots desejados dependem de pools independentes e capacidades reais de lançamento, comunicação, retomada e fencing, conforme o próprio gate.

O alvo de 120 minutos permanece condicional e não medido. Não houve implementação, teste de produto, Actions, prova AM, deploy ou integração externa nesta revisão. Guards de futuros C/D e todos os resultados de produto permanecem **NOT_RUN**.

A revisão foi focal e não presume resultados dos outros escopos. Não li rechecks de outros revisores e não alterei o snapshot. O parecer inicial permanece preservado em `supervisor-initial.json`, SHA256 `268cea267667a6b572a2cfe9cdaf75ef12b522bcde83a1580d8d79748436bc29`.

## Hashes dos arquivos revisados ou conferidos

O JSON pareado registra também os Git blob SHA1 e a modalidade de leitura de cada arquivo.

| Arquivo | SHA256 |
| --- | --- |
| `campaign.json` | `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba` |
| `execution-workflow.json` | `42f5898ec687e3e26fac6c20ceda9db90b5a83f04814ee994b8158eae894c160` |
| `WORKFLOW.md` | `67304dc752489fb63b8999cc1e87b79dde2367c33b04374fea20eefbe8f5a8d9` |
| `schedule.json` | `dfe70767e81524bd6212690357c10715eb3cc04f749f732377ff56daef0cdc7d` |
| `ownership.json` | `3129c0156a21e319d71e8a4c4b38c12bbc8507226457af26752c4a049d5a1d32` |
| `START.md` | `2fe153c2360feec3e937ecdc2a8a9460032303d5c0fad2d61ae97853f6e4aa49` |
| `execution/COMMON.md` | `a518cf4b3136d5c1126d59304afedf71b5f93168314f1f2f56743dcae719c94e` |
| `execution/manifest.json` | `fb6a94a2dc868bb24b95f2924921584888a088ef4af25401daf82e154d6d8471` |
| `execution/context-measurement.json` | `a9a3f3d889a5ccf7cad5f39e7ae13a804fae96efb801207046e689cfe7d8a9ed` |
| `tools/validate_execution_plan.py` | `a1084f6971001285e9063099947484ee85646247a4da99dd10efede9b9c3cb2b` |
| `tools/render_plan.py` | `7df6394361619b374a2dcc3a91dd63585d6d4314cb3289e2e66d5d2606e37a42` |
| `tools/render_fast_context.py` | `ac9650762b0296a78198d6106b099bd4bf2cf23a9273f783077c9c2a8d4278e9` |
| `formal-review/round-3/correction-controls.json` | `d10d5383bf02ba01ae4526f0dc686a82c535a88b57b6b12ca1be3745136926b9` |
| `prompts/S0.md` | `ce8c6f744c7bb49f8c0eff654561314dadb7d63acf7bfa51b5c1ad27e77ecd83` |
| `prompts/S1.md` | `10b40776f4f7d32784b45839a1477f9085c308b86ed3b539e4029660f5c9c5e7` |
| `prompts/S2.md` | `8622c0b542455e98e3173a321f4303d0580b631d95e02d80d7a443cc3979d406` |
| `prompts/S3.md` | `9086bef04de740bb88a71432ff5b7865c66d91f93dfe21708c9c39976f44c620` |
| `prompts/S4.md` | `fe18cc92d52f8ce6d381176241bae9d540bca8392cc05b3b0f8bb44cabe18975` |
| `execution/actors/S0.json` | `c963114c688a112aad5dc0e45e9a3bad2bd7c652bc82b476b7f47fe7c2f8ff2b` |
| `execution/actors/S0-A.json` | `9eba95a91797a0c57934ee5be337dca38d278cc48296014fb9454f17cd4f2f37` |
| `execution/actors/S0-B.json` | `c8889afba65defa16bf86f2aa89241eeaa5ad252bc280f6b31b0350a4765a770` |
| `execution/actors/S0-C.json` | `73aefa0871ef12b3929249d82d52999313d91fb8c9f90beed39fa6d4af69ec36` |
| `execution/actors/S1.json` | `9c662cef3ded97a9f1c797c43114f10fd9124d1cd2e0ada54ea6d5bfb13b10b7` |
| `execution/actors/S2.json` | `1c9f58d1c0b61fa2d64a800d82c78b1d21be8e0c4365014c49d1e65d0cbe7623` |
| `execution/actors/S3.json` | `bef39aaeafcb1d165c116116c939739d41dac7c29b07194d24038e5e551b4182` |
| `execution/actors/S4.json` | `31b644457c14098f1ecb0662868d5d4f1b64d116082bef0930625ee985607e28` |
| `execution/actors/S1-A.json` | `f69157f616377a71428be6702c6fd4d960acdf1f8f617940cc3e72ae32570eaa` |
| `execution/actors/S1-B.json` | `0862acbc55773218e5be426cda7822d40a8574def8cf6e96007bbf2ca4b0bd95` |
| `execution/actors/S1-C.json` | `80cb4de030f2121a671f7d4ae37fd6f614330951772a90052347a0f8cbd272b9` |
| `execution/actors/S2-A.json` | `912d62bbffb99a70ca880c255036c31bad9ad694288f7c6c4267d05b0c49fed8` |
| `execution/actors/S2-B.json` | `351680f3146cb7d4f23fba82ebab866f948b5bf0e00b0068a5bc996d68c35e11` |
| `execution/actors/S2-C.json` | `7fff8d0e4f107407280f74fcd12ef53804d237f8bd7114f356dde249cac00a1b` |
| `execution/actors/S3-A.json` | `40c0c362d277cdf840005fef2c09135a43b082e177460b0a41e69e959ee8bb56` |
| `execution/actors/S3-B.json` | `2e988a40b09985cf258d244f0a62e0472c4ce35ff623d95843e79aab7f01601e` |
| `execution/actors/S3-C.json` | `def4eb44e04764588eb996ceaf7fb22f95e8bd9f63777afd85f44a77a38e2bd9` |
| `execution/actors/S4-A.json` | `f5ecbabbfba0a4c997341f0c6a7b8d58acdc1f056768dd078ca1fc277aed2c99` |
| `execution/actors/S4-B.json` | `fc1e51bf83fa30fd2daff082f81da3a1f81c600b4985a19b883ea2b0140e2744` |
| `execution/actors/S4-C.json` | `1594efa92a3037505f8e89d09bb5908af2205e5d2c25a2e4c48b30a50765f2ce` |
| `execution/actors/S1-R1.json` | `3b86aa8ce96f304d6f65af92fa20b185928e9c3220473eda25dd301065bc28c0` |
| `execution/actors/S2-R2.json` | `5f80b52c27f08a63b43f3933b0a3ad69e7c28cc475de609a20228b38a56bfa8f` |
| `execution/actors/S3-R3.json` | `82c746193453a4c2b0a1d245829c2caffcdc230f8116d36a73497b2e60ecda86` |

## Evidência externa lida

| Arquivo | SHA256 |
| --- | --- |
| `guards/9a1812f360fa-evidence/receipt.json` | `6c86d68a48454fdd0aed3813de0f6573ee0eeb9191264410bb4a2ebff81d0e97` |
| `guards/9a1812f360fa-evidence/fidelity.json` | `2196230f41be1991de476004a9ce45d3f29a68f5e1b97b9a093054411627df90` |

