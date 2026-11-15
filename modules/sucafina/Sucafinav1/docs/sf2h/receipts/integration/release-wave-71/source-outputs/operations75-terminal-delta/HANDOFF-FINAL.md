# HANDOFF FINAL — missão75 / Operations e ClamD real

## Resultado e destino

As quatro jornadas que falharam em63 estão **fechadas no candidato C40**, com as cinco jornadas originais aprovadas em uma única execução R4. A integração75 já foi consumida por71 em C40. Este fechamento não declara a aceitação global da campanha.

- PR fonte: https://github.com/gustavomhss/Orchestra-SF/pull/78 — `operations-scanner-proof`, mantida draft.
- Integrador exclusivo:71, PR65. Compiler/checks:45, PR32. Aceitação final:S0.
- ACK75: `55c309e3b39f11a09c1796afc755535d4eb70295`, após reconciliação do terminal63 `f0682b3ca9a792dcef2166a867aa06974e242874`.
- Material75 final W4: `d50287e998b2f42f548bce3b72b75e16eff40043`; tree `07e01afadab8499b1ada9ffa939c26e9070a1a63`.
- Congelamento D3: `c1cb7e6d9d16bcbb92fb25f5f42de342b5a554ba`; tree `74908b108978b39bfc296ba18997db4f434910b0`.
- O commit que contém este handoff acrescenta apenas recibos sobre D3. Seu SHA/tree exatos são publicados no recibo CAS de entrega nas conversas de PR78/PR65.

## Integração e autoridade reconciliadas

71 consumiu os nove postimages75 em **C40 `eb58cd9e9f8125d879bff260d6d794264b9dc53a`**, tree `b325894e636ae31db80886bb9ca2add1ce4ec126`, pai C39 `a9eb6d3e70714e712c48f7286c53a27b45236d95`. O manifesto/review71 e o readback independente de39 blobs estão preservados em `integration/received71/` e `integration/C40-readback39.json`.

A unidade inteira73 de seis arquivos já havia sido consumida em C37 `bc5eb1e0cead17254a95770e437f6fda826a66fc`. O material73 é `4bf5d040649d807d5ef6c8cbabf1409d8aee849a`, terminal `4a93f6aa8b8af138774fd1e25a7183e7a84706ba`. A73 permaneceu a única writer de `runtime/procurement.ts`;75 entregou o patch numérico como proposta e não escreveu esse runtime.

Após o disparo R4, HEAD avançou para C41 `1074cf338619a70ddef1ad1f62e32618fc355fed`, tree `3f98ab38aa223eefba708e566a42450d8f1c2a93`, com Dashboard67 e consumidores, incluindo `business-services.ts`. **R4 qualifica C40; não qualifica C41 nem HEADs posteriores.** `integration/POST-C40-HEAD.json` registra a observação. Toda integração posterior deve ser preservada.

Não reaplicar os nove postimages já consumidos, nem transplantar toda a branch fonte.71 deve consumir seletivamente os novos recibos finais e registrar seu ACK, preservando os materiais59/63/66/68/69/72/73 e demais unidades do target.

## Código entregue

A unidade material continua exatamente a de W4:

| Escopo | Alteração |
|---|---|
| `src/screen-shell.ts` | Limpeza da mensagem anterior e da associação de erro acessível, incluindo `data-error-for`, antes da próxima apresentação; outras descrições e valores são preservados. |
| `.github/workflows/sf-operations-scanner.yml` | Extensão mínima para a campanha, com permissões de leitura, branch dedicada, request/W/S verificados e duas seleções exatas; reutiliza os contratos e actions existentes. |
| `script/sf2h/operations-scanner/` | Preparação efêmera, validação da request, readiness, posse de processos, controles discriminantes e documentação. |
| `operations-support/installation.ts` | Diagnóstico limitado e sem dados sensíveis para a primeira recusa de admissão privada; sem mudar o resultado real nem enfraquecer os gates. |
| `test/product/operations-installed-finish/` | Controles reais de comandos malformados, importação/upload privados, EICAR e indisponibilidade, incluindo ausência de efeitos duráveis nas recusas. |

Manifesto completo de nove paths, pre/postimages, patch integral e dependências: `integration/MANIFEST.json`, `integration/complete75.patch` e `integration/DEPENDENCY-CLOSURE.json`, publicados em D1 `a65cc2bc3b73ae421cbbe6bef8fdd8112a1475fa`.

SHA256 do patch integral: `672747464f84b869363dbc0a869f31cc051ef438e931b2d48e3c72ad0330a6e0`.

A spec original permanece no blob `bab6a804e5f082cc60eb6f27209070b552981035`. IDs, ações, assertions, recuperação e oráculos C06 foram preservados. Nenhuma mudança material foi feita após W4.

## Setup ClamD real

O job baixa o pacote oficial ClamAV1.5.4, valida105.819.396bytes e SHA256 `28d6efc5b4423e7830c3559339552eb53870a9eac51ac4efb37d60530d329886`, e o extrai sem instalação global sob `RUNNER_TEMP`. FreshClam usa as bases oficiais, certificados do pacote e `TestDatabases`; não há banco sintético.

Dois processos foreground limitados ao loopback, com porta3310 para admissão normal e3311 para controles de erro, recebem configs privadas. O setup verifica PID, startTime, executável, config e socket; depois exige PONG, versão e clean/EICAR/clean-after. O segundo daemon também comprova o erro real de limite de stream. Só então o endpoint é exportado.

Os tempos de download, atualização, readiness e cleanup são limitados. A limpeza roda em `always()`, sinaliza apenas os processos identificados como pertencentes ao job e preserva a evidência. Não houve serviço global, Azure, novos tokens ou mudanças na lane genérica45.

R1 e R2 foram falhas reais de setup, antes dos testes. W3 passou config privada nas consultas de versão; W4 definiu `CVD_CERTS_DIR` exclusivamente no processo FreshClam para seu verificador filho. As validações de assinatura não foram removidas. Históricos, causa e correção permanecem em `ci/R1-result.json`, `ci/R2-result.json` e seus logs.

## R3 — controles reais na fonte W4

Run https://github.com/gustavomhss/Orchestra-SF/actions/runs/43672349552 ; job132684956460; attempt1.

- W: `d50287e998b2f42f548bce3b72b75e16eff40043`.
- S: `209c613895a2555ba7de8befc33f1bd41b263f62`.
- **7PASS /0FAIL /0SKIP /150 expects**, em três arquivos.
- Controles: clean/EICAR/clean, size-error com daemons vivos, indisponibilidade após parada do PID próprio, comandos desconhecidos/malformados com liveness posterior, importação e upload privados limpos persistidos, EICAR recusado sem efeitos duráveis e recusa privada com daemon indisponível.
- O diagnóstico demonstra gates anteriores aprovados e primeira recusa `file-admit/file-not-accepted` nos negativos EICAR/DOWN. Isso não identifica retroativamente a causa única do403 observado em63.
- EICAR rotulado como XLSX valida scanner antes do parser; não é apresentado como workbook válido infectado.
- Recibo: `ci/R3-result.json`. Essa prova permanece de W4; R4 não reexecutou os sete controles.

## R4 — cinco jornadas originais em C40

Run https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675784039 ; job132695512980; attempt1; conclusão **SUCCESS**.

- W/C40: `eb58cd9e9f8125d879bff260d6d794264b9dc53a`.
- S: `901dc9e2a70f2e89d5a4f0d2a768205a7252413e`; tree `97cfe87165038481ffb1d5b3ad98fa673a2fafcc`.
- S tem somente C40 como pai e somente `.ci-run.json` como delta.
- Request SHA256 canônico: `e4201f174defe27af1f45cac85a40535e665aa851eeb6e803311b9ae72085717`.
- **5PASS /0FAIL /0SKIP /0FLAKY**. Workers1, retries0, repeat1; timeout60s e expect10s originais.
- Artifact14146162056:319.886bytes; SHA256 `11fd4542d0a29a1841a0a640b7100cf04a340b0948db60a13139c262898a8d21`.

| Jornada | Duração | Resultado observado |
|---|---:|---|
| OP-PROC-01 |1.990ms|J04, valores e drilldown C02 preservados.|
| OP-PROC-02 |10.968ms|Cotação mantém30.240USD e FX1,08; futuro PO usa56.000USD e FX2.|
| OP-PROC-03 |10.367ms|Recusa422 por FX ausente, mensagem acessível correta e nenhuma nova versão.|
| OP-IMPORT-01 |7.751ms|Preview real, um Apply, recuperação do mesmo recibo após perda da resposta e nenhum efeito duplicado.|
| OP-DOC-01 |23.384ms|Schema e confirmação reais, evidência exata e revogação asset403/evidence409/discovery0.|

ClamAV1.5.4 usou daily28183/main63/bytecode339; FreshClam aprovou os três testes e cada daemon carregou3.628.275 assinaturas. Readiness durou21,006s. Main PID5148/start13712 e error PID5156/start13725 terminaram **STOPPED/STOPPED** às04:16:56.841Z.

Recibo completo: `ci/R4-result.json`. O ZIP original inteiro está preservado em `ci/R4/artifact.zip`, Git blob `569d25b96becba442c8ae185a1d04c7d315ffd7b`. `ci/R4/artifact-index.json` registra os31 membros e seus hashes, incluindo o JSON runtime integral, HTML e cinco anexos inline. `logs/R4.log.txt` preserva exatamente o texto retornado pelo MCP,95.152bytes, SHA256 `4f753a43f18835ac0a68e5b2962d29b394e4d1823039ce250e280490db6b5985`.

O `--list` representa cinco testes ainda não executados; seus skipped não são skips do runtime. A etapa Omni de controles é condicionalmente omitida na seleção journeys. O setup declara `productQualification:NOT_RUN` porque qualifica o daemon; a prova de produto está no runtime separado.

## Revisão e limites

As revisões independentes `reviews/R4-journeys-C40-independent.json` e `reviews/R4-SCANNER-REVIEW.json` aprovaram o fechamento restrito a C40, sem bloqueios novos. A revisão conferiu os anexos runtime/HTML byte a byte e964 passos sem erros. O leitor documental verificou299 condições; essas verificações locais são leitura/hash de evidência, não testes adicionais de produto.

O checkpoint final conserva os251 IDs/textos normativos —111WP04 e140WP06 — e o histórico63. Os28 critérios anotados recebem witnesses parciais; nenhum critério integral é declarado fechado somente por esses testes.

Continuam obrigatórios: checks45 (typechecks dos pacotes/E2E, spawn-imports e guards); critérios completos e fluxos fora das cinco jornadas; C06 amplo e confirmação material; formatos além do TXT exercitado/OCR; corrida73 de revogação durante scan aceito; paridade nativa/provider, Omni, human timing/AM, seleções/reviews finais, C-G7/D-G8 e aceitaçãoS0.

**GLOBAL_RELEASE=false.**

## Transferência final para71

1. Registrar ACK dos resultados C40 e do commit documental final75, sem reaplicar material já consumido.
2. Preservar a evidência distinguindo source R3/W4 e original-five R4/C40. Reconciliar qualquer candidato posterior antes de lhe atribuir resultados.
3. Assumir a custódia/manutenção da extensão CI restrita à campanha, conforme a transferência terminal já prevista em C40. A autoridade71 de integração não se converte em executor de testes; novas execuções dependem do executor autorizado e da filaS0.45 mantém sua lane genérica.
4. Consumir `checks/REQUEST-45-C40.json` como atualização do pedido existente em PR32, sem duplicar lane nem atribuir PASS de compilação a partir do browser.
5. Manter o checkpoint251 e os gaps remanescentes no gate de aceitação final.

A lease `operations-finish-browser75` termina com a publicação atômica destes recibos. Não há execução75 em andamento, processo remoto próprio restante ou trabalho de produto em background prometido. Qualquer nova escrita material exige autoridade nova e explícita.
