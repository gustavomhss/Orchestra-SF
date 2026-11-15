# Missão52 — financeiro v10: resultado nominal19 e handoff

**As quatro jornadas independentes passaram. A jornada financeira permanece FAIL na pré-condição de Requests: GET HTTP503, formulário de criação ausente e nenhuma mutação financeira observada.** Aprovação formal, Apply C12 e recuperação financeira não foram alcançados. Esse resultado é do nominal19, sem instrumentação temporária, sobre o candidato isolado exato descrito abaixo.

Este documento está pronto para compor o handoff solicitado a47. **No corte desta redação a fonte52 continua ACTIVE**; o encerramento só poderá ser afirmado após a publicação CAS final pelo responsável da missão. O nome do arquivo não declara essa transição. A base observada contém o terminal105, sem sucessor nomeado. Não há declaração de integração, WP11_DONE ou GLOBAL_RELEASE.

A execução é o [run43690414521](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43690414521), tentativa1. A evidência financeira específica está em [financial-nominal19-final-evidence.json](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/financial-nominal19-final-evidence.json), SHA256 `d74e6b0af12dfd36e6af526cab9b3d659484f198362aa75a6e64a7783fd69d8a`. O [v9](sandbox:/workspace/scratch/fec39c0682b3/m52-financial-terminal-draft-v9.md), SHA256 `39823ae5adf66321be6a6451f4e816b0af6a3a0e96da0556e4ce30c0e530b23c`, permanece preservado como resultado nominal17. O [suplemento C53](sandbox:/workspace/scratch/fec39c0682b3/m52-financial-C53-static-supplement.md) conserva a auditoria estática separada.

## 1. Composição e execução exatas

| Elemento | Identidade |
|---|---|
| Base documental | `eeff9b78219b5efe1ad78e68d4490af0d7c5ed07` |
| Tree da base | `072950bafdc50b9eddc549f7a327742bc5086bf6` |
| Material integrado | C53 `180212940105e7b9ad15171b067c1c1b7841df5f`, tree `c423dd1e0828242534fd45d4183104ecc1d20edd`, mais terminal105 documental |
| Fonte52 fixada no envelope | `43a31f4c51c0897287fdc53468bd171adca4795d` |
| Tree da fonte52 | `042f7cf6d9038cbc26b17c643e15a849d62800ee` |
| W isolado | `12521803d615e6b9861b30cfae4a0ba1d1229f09` |
| Tree W | `f5cc7dfadf85792821561d558bddd186a2a4904b` |
| S executado | `b737befd41f0e0a28467e18fa15ed2eebfb64f5a` |
| Tree S | `8bf6010987716a5073a04f10fce41ed38a3fd956` |
| Run / tentativa | `43690414521` / `1` |
| Job de testes | `132739685136`, failure |
| Job de cleanup | `132740799684`, success |
| Artifact | `14152367017`, `playwright-ubuntu-24.04-1`, 377.745 bytes, 11 entradas |
| ZIP SHA256 conferido | `3b97c5b5c86904624a0465b19870962e00778192d2a64f384358b5653ddcd638` |
| Request original | Blob `3619f1fd8b14262b0c89ee9830269f2b05356aaf`, 229 bytes |
| Spec executada | `e2e/sucafina/decisions.spec.ts`, blob `b6f63bfa1b8eacb5bf37a5c5b0d508fd658d70cf` |
| Workflow / configuração | `3185885e123f9bb13c16c670e4df2fcffab38290` / `ae56b7fc9da248ee8e34d73d0eb13c8fe8e0c088` |

O [envelope despachado](sandbox:/workspace/scratch/fec39c0682b3/m52-work/nominal19-dispatched-envelope.json), SHA256 `b8d8cc1a1a17a66282f3abf64886e182e708ab34276061f210b3437fa3e5e740`, fixa 36 overlays: 10 paths próprios, 21 propostas compartilhadas e 5 arquivos unitários adicionais. As cinco identidades originais, worker1, retry0, repeat1, budget180000ms por caso e assertion/deadlineUI10000ms foram preservados. Os resultados e budgets foram confrontados também com o relatório Playwright bruto, além do extrato normalizado. O candidato não contém instrumentação de diagnóstico; os registros de perfil estão vazios.

A qualificação pertence a **C53 mais os overlays exatos de W12521803**. As propostas compartilhadas continuam propostas para seus proprietários; o resultado não demonstra que estejam integradas à stack. A missão52 realizou zero escrita no target.

**Receipt geral19 congelado e conferido:** [nominal-19-receipt.json](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/nominal19-43690414521/nominal-19-receipt.json), 228.557 bytes, SHA256 `b32930aab10658a118bab832ecc5d3bf60e173ce2417568a72023236d195480d`. As [annotations revisadas](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/nominal19-43690414521/reviewed-case-annotations.json) têm 9.894 bytes e SHA256 `ffa45d226f6fb172fa2a6c8d70e5ae30702c57d11e02c34e50466d4ba60941ad`. O binding confirma os mesmos base/source/W/S, as cinco identidades originais e o resultado4PASS/1FAIL.

## 2. Fronteira financeira observada no nominal19

A identidade preservada é:

**`CI-UI-DECISIONS — require a real Procurement proposal and approval before Apply and recover its unique receipt`**

É J2 na ordem de `e2e/sucafina/decisions.spec.ts:21` e a quinta família semântica obrigatória do pacote52.

| Observação | Resultado real |
|---|---|
| Primeiro passo | `create the real requisition through its human form` |
| Duração desse passo | 10044 ms |
| Navegação solicitada | `/sucafina/procurement?page=Requests` |
| Rede registrada | Um GET `/sucafina/procurement`, HTTP503, `application/json;charset=utf-8` |
| Texto renderizado no DOM | `{"status":"unavailable","reason":"procurement-queue-unavailable"}` |
| Assertion original | `form[data-command="create"][data-page="Requests"]`: esperado1, observado0, timeout10000ms |
| Local | `decisions-support/procurement-source.ts:7` |
| Resultado / duração do caso | FAIL / 14656 ms |
| Observações de domínio | Lista vazia |
| Requests de comando | Lista vazia |
| Corpo da jornada concluído | `false` |
| Mutações financeiras observadas | Zero |

Fontes: [runtime extraído](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/nominal19-43690414521/runtime-extracted.json), [observações](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/nominal19-43690414521/observations-line-21.json), [CLI](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/nominal19-43690414521/cli-line-21.log) e [DOM de falha](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/nominal19-43690414521/extracted/packages/app-shell/e2e/test-results/sucafina-decisions-CI-UI-D-44857--recover-its-unique-receipt-chromium/error-context.md). O registro de rede omite a query; a URL completa de Requests aparece no código do passo preservado no artefato.

O formulário faltou antes de qualquer preenchimento de Title, Estimated amount100 ou clique em Create request. Não houve criação da requisição, proposta, submissão/aprovação formal, Apply, recibo ou recuperação financeira. O log registra instalação iniciada e shutdown `disposed` em 17 ms; não há EADDRINUSE no caso. A falha503 é uma observação nova do nominal19, independente dos resultados históricos.

**Precisão sobre o corpo:** o texto JSON acima foi extraído do Page snapshot de Playwright. O ZIP tem 11 entradas e não contém trace, HAR ou corpo HTTP bruto. A observação de rede confirma separadamente HTTP503 e o tipo JSON. Não se apresenta o texto renderizado como captura dos bytes do corpo de resposta.

| Evidência | SHA256 |
|---|---|
| `runtime-extracted.json` | `25f3c2b8c75e2282d7ddbb149c34ca6ab9c60ee97f3e26759b375ae4f8c24411` |
| `observations-line-21.json` | `9efb3b61e037a3073a1b80f852c230ea970ea76cc0ac416a340e6290d1527a64` |
| `cli-line-21.log` | `5d9700fc671b5b6c8c0d5f9f47ddd022898d3d4afda79e0f31e008e4a139393a` |
| `error-context.md` | `b66c78721311dddd1d351ab8c65ece81cae65ba08c890d45ed9618f6a2b2081c` |
| `playwright-runtime.json` | `9bf726730c7dc196d2f723680869b7b89767c3131a4e6e981ac3363578b62366` |

## 3. Cinco resultados individuais preservados

O nominal19 concluiu **4PASS / 1FAIL / 0SKIP**, sem retry. O FAIL do job corresponde à jornada financeira obrigatória.

| Caso / linha | Identidade original | Resultado | Duração |
|---|---|---|---|
| J1 / 12 | `CI-UI-DECISIONS — attach evidence, compare two alternatives and preserve the human choice after a source change` | PASS | 106523 ms |
| J2 / 21 | `CI-UI-DECISIONS — require a real Procurement proposal and approval before Apply and recover its unique receipt` | FAIL | 14656 ms |
| J3 / 35 | `CI-UI-DECISIONS — create, edit and reopen the same durable case through Workbench` | PASS | 11571 ms |
| J4 / 87 | `CI-UI-DECISIONS — alternative discovery consumes a real Decisions catalog, not HTML 200` | PASS | 7488 ms |
| J5 / 135 | `CI-UI-DECISIONS — recover a lost creation response by reading the same case without resubmitting` | PASS | 7028 ms |

J1 agora concluiu sua jornada original de evidências, comparação, regra numérica, escolha e preservação após mudança da fonte. Seu PASS pertence a essa identidade e a essa composição. J3, J4 e J5 também concluíram suas jornadas originais. Esses quatro resultados não satisfazem a proposta, aprovação ou recuperação financeira de J2; nenhuma aceitação foi transferida entre identidades.

O gate cirúrgico Unit06 anterior, sobre o mesmo W, registrou **36PASS / 0FAIL / 0SKIP,154expects,1 arquivo,257ms** no [run43690045333](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43690045333). Seu [receipt](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/p15-unit06-43690045333/unit-06-receipt.json), SHA256 `40f34acf952758f81975a2ed2bd2359d0eb557cd4ed4f84ecbfc0b793066f648`, verifica a proposta P15 de digest canônico. É evidência suplementar; não concede aprovação financeira nem substitui as cinco jornadas UI.

## 4. Pré-condição Requests: contrato preservado e causalidade limitada

A base e os seis blobs financeiros abaixo são os mesmos auditados em C53. Nenhum desses paths aparece nos36 overlays do nominal19:

| Path relativo a `modules/sucafina/Sucafinav1/` | Blob |
|---|---|
| `runtime/application.ts` | `a0deff8a3b272019f472aa2f93499d1940a78370` |
| `runtime/procurement.ts` | `a4ab021f646c0fc819b3afdde18796630fb9603f` |
| `product/procurement/queue-page.ts` | `91784d3ea3358565e19b62922c8867f134af9ac4` |
| `product/procurement/scenario-preparation.ts` | `82b7d822ec5ca65ba9450cde74c5e8f39da84493` |
| `product/procurement/decision-host.ts` | `9b48c999661e4b8a10593ae7cd5d6e2ed1e2f635` |
| `product/procurement/decision-preparation.ts` | `b75e0923535f4b91b71a2f2d79eef9cefde45db4` |

O overlay de `apps/cli/src/sucafina-product/business-services.ts` continua no blob `c7f8b5e31b835632fdbe6b6c195ead5f304838f1`, sobre base `7f77d2443c220ba153cf38ee538a15a7f9a4b78d`. A função financeira `contextFor` permanece byte a byte igual à base:1774bytes, SHA256 `440656636d782b2452309b5bb026c2106eb5712547199747c4ae5f8ca0f3b8d6`. Essa prova de pre/postimages foi preservada na evidência v9 e vinculada novamente ao overlay exato de N19.

O novo produtor compartilhado P15 altera uma expressão de SHA256 em `canonical.ts`, sem alterar o serializador, as entradas de cada chamada ou a política financeira. O gate Unit06 comprova a equivalência nos controles selecionados. Não foi introduzido fallback de moeda, criação de configuração, mutação de Requests ou shortcut de aprovação.

`runtime/application.ts:68–85` entrega a resposta de `productView` antes da página normal. `product/procurement/queue-page.ts:25–57` admite a leitura, seleciona período, seleciona/resolve a coleção, lista e revalida. Várias recusas convergem para `procurement-queue-unavailable`503. A função `contextFor`, nas linhas96–113 da base, exige Request válida, período atual, autoridade revalidada e moeda persistida em `formSettings.currency`; não assumeUSD. [Requests em S19](https://github.com/gustavomhss/Orchestra-SF/blob/b737befd41f0e0a28467e18fa15ed2eebfb64f5a/modules/sucafina/Sucafinav1/product/procurement/queue-page.ts) e [contexto real em S19](https://github.com/gustavomhss/Orchestra-SF/blob/b737befd41f0e0a28467e18fa15ed2eebfb64f5a/apps/cli/src/sucafina-product/business-services.ts).

**O runtime não isola qual dessas verificações produziu o503.** Configuração/moeda é uma dependência estática identificada, sem atribuição causal exclusiva. O resultado tampouco prova ausência da identidade humana. O formulário canônico de Settings é `form[data-page="Settings"][data-command="save"]`, com CAS e papel admin; `runtime/procurement.ts:142–149/679–724/929–942` exige moeda e matriz de aprovação válida. Não há ação pública de somente moeda. Preencher USD numa configuração vazia é insuficiente: o ramo prevê422 `Invalid matrix or currencies`, sem commit. Essa análise estática, preservada no [v8](sandbox:/workspace/scratch/fec39c0682b3/m52-financial-terminal-draft-v8.md), refere-se ao mesmo blob Procurement herdado por N19. Esse POST não foi enviado pela missão52. A missão52 não deve criar matriz/holder, resetar política ou inventarUSD para destravar o teste.

O próximo passo do proprietário é tornar a pré-condição canônica observável e utilizável sob os mesmos atores e regras, com diagnóstico preciso da recusa. Não há evidência suficiente para um patch financeiro concreto que substitua configuração ou autoridade. Este handoff registra a falha real sem mascará-la com seed, mutação direta, política nova ou assertion enfraquecida.

## 5. Aprovação formal: barreira posterior estática, não alcançada

O contrato em `scenario-preparation.ts:19–49` valida a operação da escolha, fonte, ator, período, moeda e preparação do comando. Nas linhas41–45 permanece a fronteira: a aprovação canônica exige requisição pendente e aprova o valor submetido; após aprovação, a requisição deixa os estágios editáveis. Esse contrato não fornece aprovação separada de replacement ainda não escrito. A preparação retorna `needs-input / financial-approval-command-unavailable`. [Produtor preservado em S19](https://github.com/gustavomhss/Orchestra-SF/blob/b737befd41f0e0a28467e18fa15ed2eebfb64f5a/modules/sucafina/Sucafinav1/product/procurement/scenario-preparation.ts).

O oracle original52 continua exigindo criação humana de PR100/v1/draft, fontes reais Planner/Procurement, alternativas120/140, comparação/cobertura, regra numérica e escolha140 mantendo a PR100/v1/draft antes de Apply. A aprovação formal precisa cobrir o efeito exato por holder e estágio corretos; depois devem ocorrer Apply C12 e recuperação do recibo único. Editar o draft para140 e então submeter/aprovar o snapshot persistido140 é outro ciclo canônico e não satisfaz essa conservação original. Aprovar100 ou equiparar escolha humana a aprovação também não satisfaz o oracle.

**M31/MI07 permanecem OPEN por contrato; sua fronteira runtime não foi alcançada em N19.** O `consumer-ack53.json`, blob `81a26f9dd69634057ea1406626e096205ac78184`, registra os componentesC24/C25 e a proposta de admissão/aplicação53 emHOLD_INERT. O `M31-S0.json` de Mixed61, blob `a6f59190656be518311cb203d2ad1dd30e255a1f`, mantém `M31_closed:false`, `MI07_closed:false` e evidência de recusa. A fila100 mantém ambosOPEN; os deltas completos posteriores C52/C53 e o terminal105 não os encerram. [Contrato M31-S0 em C53](https://github.com/gustavomhss/Orchestra-SF/blob/180212940105e7b9ad15171b067c1c1b7841df5f/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/release-wave-71/source-outputs/mixed61/checks/M31-S0.json).

C24/C25 e Mixed61 corrigiram a composição e forma de fonte anteriormente identificadas. O antigo desencontro estrutural37 não é apresentado como defeito atual. A recuperaçãoC12 integrada também não concede aprovação financeira. Qualquer resolução do replacement deve ser definida por **S0/WP00 financeiro/C12 e pelo sucessor autorizado de Procurement**, preservando política, ator/holder, estágio, versão/incarnation, caso/escolha e digest exato do comando. Não é possível especificar legitimamente um patch semântico completo de aprovação sem a decisão desse proprietário.

## 6. Autoridade e critérios de entrega

A fonte52 está **ACTIVE neste corte de preparação**. O envelope fixa source43a31f4c; este relatório não antecipa o CAS terminal. Após publicação, o responsável deve vincular o SHA terminal e seu recibo de autoridade no pacote final. As afirmações runtime de N19 continuam vinculadas ao W/S executado, mesmo que o commit documental de entrega tenha outro SHA.

A base contém `AUTHORITY-TERMINAL-105.json`, blob `b59f98f415dd114a9b797fa3d1ef667c6293c05c`, epoch `S0-C-e15-browser105`, estado `ENDED_BY_INTEGRATOR105` e nenhum sucessor nomeado.47 permanece destinatário solicitado do handoff; não é declarado integrador ativo. [Terminal105](https://github.com/gustavomhss/Orchestra-SF/blob/eeff9b78219b5efe1ad78e68d4490af0d7c5ed07/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/after-c51-105/AUTHORITY-TERMINAL-105.json).

As quatro jornadas independentes foram concluídas. A quinta permanece explicitamente selecionada e FAIL, com **zero novos critérios financeiros aceitos**. Para sua aceitação futura são necessários: Requests utilizável pela UI sob contexto/configuração canônicos; decisão do owner sobre o contrato exato do replacement; execução da jornada original até aprovação, Apply e recuperação de recibo único. Nenhum PASS de outra jornada, unit ou diagnóstico cobre essa lacuna.

N17 permanece como prova nominal histórica; D18 permanece diagnóstico com zero aceitação transferida. Este v10 acrescenta a prova nominal19 real e conserva as assertions, identidades e budgets originais. Não houve edição de Procurement/C12, CurrentChoice, Reports, workflows ou política financeira neste subtrabalho; somente leitura de artefatos, conferência de hashes e redação local do handoff.
