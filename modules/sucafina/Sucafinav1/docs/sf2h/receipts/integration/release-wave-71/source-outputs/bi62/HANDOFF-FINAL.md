# Missão62 — terminal para60 / sucessão reconciliada com71

**Source liberado para composição seletiva com HOLD. Qualificação instalada não aceita. `GLOBAL_RELEASE=false`.**

PR draft [75](https://github.com/gustavomhss/Orchestra-SF/pull/75), `installed-bi-proof` → `sf2-stack`. O material congelado é W7 `8258b1a0a426b9f4bff59dd015038cca63d1f576`, tree `811cab16598c23333f4276d115fd61940eb3d486`. O arquivo de evidências D1 é `a8b267ab600bfda7a8a747f34a80e2d65566565b`, tree `bb6fb137453d26865539e1cea77b75e7a763555e`. A identidade terminal é o commit que contém este documento, também publicada na PR75 e no comentário terminal da PR65 após readback. A lease62 termina na publicação CAS terminal; não há worker ou retomada automática.

## Entrega e limites de autoridade

São **17 paths materiais: três arquivos de produto e 14 testes/helpers novos**, com manifesto, pre/post, patch completo e dependências. `SOURCE-MANIFEST.json`, `DEPENDENCY-CLOSURE.json` e `owned-overlay/VERIFICATION.json` fixam a unidade; o patch completo tem SHA256 `0fa7024cf9fcd69717f0e25bcdf70f165c04b7ab83612e3fef9e0547b435f391`. A reconstrução estática reproduziu os17 postimages;156 imports diretos foram resolvidos, sem equivaler a compilação ou aceite transitivo.

1. `bi-services.ts` conecta BI09 e BI10 ao produtor canônico de custos, inclusive projeção de Portfolio com envelope persistido; BI11 conserva sua admissão própria.
2. `scenario.ts` admite BI10 no mesmo host canônico, preservando par C08 histórico/atual, dupla observação de fontes e revalidação de autoridade.
3. `view.ts` usa data observada no recorte visual, conserva datas desconhecidas explícitas, aplica o mesmo recorte à tabela e ao timeline, restaura seletores validados e focaliza valor com origem exata. Não rateia valores financeiros nem altera request/período canônico. O host instalado ainda depende da proposta externa para consumir/restaurar o estado visual.

Os cálculos canônicos, a distinção ausência/null/zero e os sete oráculos literais foram preservados. A validação integral desses oráculos continua pendente nos pontos discriminados na matriz. Não houve alteração do motor financeiro, políticas, shell ou migração visual nativa.

## Quatro propostas externas completas, ainda inertes

| Unidade | Efeito preparado | Limite |
|---|---|---|
| `external/browser-selection/` | Restaurar seletores de recorte após leitura nova; foco por origem exata; remover links antigos e limpar navegação após leitura falha | Host compartilhado não editado |
| `external/multi-source-timeline/` | Chooser com Enter/Space/Escape e referência exata de origem | Timeline compartilhado não editado |
| `external/legacy-bi10-test/` | Atualizar a expectativa antiga de BI10 indisponível para o produtor conectado | R1 não chegou à expectativa antiga; não explica nem corrige o deadline |
| `external/missing-coverage-fixture/` | Na fixture ausente, declarar incluídos apenas componentes conhecidos e manter raw null/pending | Não resolve a estabilidade canônica C10 nem os deadlines |

Cada diretório contém manifesto, preimage, postimage e patch íntegros.71 deve aceitar ou reter explicitamente cada proposta com o dono do limite. O bundle BI legado requer gerador canônico e `--check` por45; não foi editado à mão.

## Resultados reais de Actions

| Run | Resultado | O que demonstra e o que falta |
|---|---|---|
| [R1 ·43667093423](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43667093423) |41 PASS /10 FAIL|Oito deadlines e duas promoções503. Cross-view, Portfolio e renderer legado continuam sem fechamento.|
| [R2 ·43668401496](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43668401496) |0 PASS /1 FAIL|CLI/browser instalados reais; timeout180s no primeiro save, antes de BI.|
| [R3 ·43668513417](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43668513417) |2 PASS /7 FAIL|FX/currency e forecast/waterfall canônicos passaram.40000/ausência/zero/null, thresholds e histórico bloquearam nas operações anteriores ao BI.|
| [R4 ·43669699195](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43669699195) |0 PASS /1 FAIL|GET200; POSTs pequenos sem headers até aborto. Controle read-only com Content-Length28 também bloqueou.|
| [R5 ·43669861192](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43669861192) |4 PASS /0 FAIL, limitado|BI10 sobre o mesmo par canônico persistido e três contratos do renderer real em Chromium com payload C02 sintético não persistido. Não substitui a jornada instalada.|
| [R6 ·43670652989](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43670652989) |0 PASS /1 FAIL|W7 captura Versions/save versão0, `net::ERR_ABORTED`, `retried=false`, em16.434ms. Nenhum passo BI foi alcançado.|

Os seis attempts1 terminaram. Cada W/S/tree/run/job e requisição consta de `evidence/CI-REQUESTS-02.json`; os snapshots acrescentam somente `.ci-run.json`. Não se somam PASS de heads distintos como um resultado final verde. R6 corrige o helper que antes aguardava uma resposta impossível; não corrige o POST do produto. Budgets/assertions originais, falhas e resultados desconhecidos foram conservados.

O browser realmente abriu o CLI e percorreu a UI instalada até o bloqueio. Não há alegação de waterfall instalado aprovado. Os três testes sintéticos exercitam `view.ts` real em Chromium e estão rotulados separadamente. Artefatos R2/R4/R6 tiveram hashes conferidos e evidências visuais inspecionadas; seus fatos normalizados permanecem nos recibos.

## Consumidor e composição atual

60 encerrou em `faa30fddb7e7b61696b66fd069f51cf18c51125f`. A rota solicitada continua na PR65. ACK71 `99d404ef15e12161b9043b3ac020bbb814d710dc` torna71 a única writer atual de `sf2-stack`; não se presume reativação60. Também foram observados os ACKs74 e76. `CONTROL-RECONCILIATION-03.json` atualiza append-only o estado preparado registrado anteriormente.

O alvo observado é **C31 `7e64ed4f2e59e0baabcc8655b8067ff9eb847665`**, tree `e7cfbfa92bd3c149ed9e36141c221c996b6974ae`. Os três preimages de produto e os quatro alvos externos conferem exatamente. C31 incorporou runtime59, Operations63 e Native64 e mudou dependências compartilhadas: **não foi testado por62 e não herda os PASS da fonte**.71 deve reconferir HEAD, preimages e novos paths no intake; nenhuma branch de outro owner foi escrita por62.

**Recheck antes da publicação:** a branch avançou para **C33 `f8c316a3e96447fb2b33555396060e7977d51cfa`**, tree `4c9cc42ad6cd557febf721db14c802d1f2fb9ced`, após C32 mixed61 e C33 C12-65. Em `2026-11-15T03:23:31Z`, os sete preimages foram conferidos novamente por MCP e permanecem exatos. Os novos paths de acesso misto e decisões reforçam a necessidade de qualificação própria. C33 também não foi testado por62; este pin não presume imobilidade futura do HEAD de71.

## Bloqueios obrigatórios e ACK solicitado

- **74 via71 — HTTP instalado:** diagnosticar o primeiro estágio que não termina entre listener/corpo/admissão/persistência. O POST com Content-Length explícito impede atribuição simplista à ausência desse header. O achado de limite M70 não foi demonstrado como causa. Contrato completo: `evidence/HTTP-INGRESS-CONTRACT.json`.
- **76 via71, linhagem59 — custo canônico:** as fases de comparação/solver/ChoiceRecord atingem os budgets e leituras BI completas duram cerca de68–81s. As medidas são inclusivas. `evidence/PERFORMANCE-BOUNDARY.json` conserva as observações sem cache de autoridade nem redução das leituras obrigatórias.
- **C10 e oráculos:** estabilidade de reassessment continua separada da proposta de fixture; treinamento40000, thresholds55000/15000, ChoiceRecord no mesmo caso, positivo N/A, margem anual e história completaFX02 precisam das provas pendentes.
- **45 — compilação/geração/guards:** `COMPILER45-REQUEST-02.json` contém solicitações concretas para o candidato efetivamente composto. `NEXT-VALIDATION-REQUESTS.json` prepara as execuções cirúrgicas após mudanças materiais nos pré-requisitos, sem replay inalterado.
- **Aceite integral:**108 critérios,59 BLOCKED,49 NOT_RUN,zero PASS integral; sete oráculos preservados. `CRITERIA-DELTA-R6.json` atualiza apenas a evidência de R6. Native200%zoom, viewport/acessibilidade/p95, C17,8+3BI, AM, oito seleções finais, três reviews finais, C-G7/D-G8 permanecem abertos.

Solicita-se ACK71 com paths aceitos/retidos, disposição das quatro propostas, SHA/tree do candidato composto, encaminhamento74/76/45 e preservação dos HOLDs. `CONSUMER-RELEASE.json` libera a unidade para essa integração seletiva; `AUTHORITY-FINAL.json` encerra a lease62. **Não é declaração DONE da missão nem aceite do produto instalado.**
