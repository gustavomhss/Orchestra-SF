# Operations75 — leitura documental das cinco jornadas

Esta ferramenta lê o ZIP ou diretório já baixado de GitHub Actions. Não executa produto, Playwright, Bun, browser, daemon, comandos do repositório ou CI. Os arquivos de entrada ficam intactos. Seu resultado é uma checagem documental, com hashes dos documentos consumidos, e não um aceite global da campanha.

## Uso pelo root

Após baixar o artifact `operations75-journeys-RUN-ATTEMPT` pelo MCP, substituir os quatro valores esperados abaixo pelas referências verificadas no GitHub. O parser aceita o ZIP diretamente, sem extraí-lo.

```bash
python /workspace/scratch/68b6bb3034b2/agent-clamd-ci/journeys-document-reader/read_journeys_artifact.py \
  /caminho/para/artifact.zip \
  --work FULL_W \
  --snapshot FULL_S \
  --run RUN_ID \
  --attempt 1 \
  --snapshot-request /caminho/para/ci-run-exato-de-S.json \
  --output /caminho/para/journeys-document-read.json
```

`--snapshot-request` é opcional, mas recomendado: use os bytes exatos de `.ci-run.json` lidos em S por MCP. Isso confere o hash dessa entrada no receipt. O parser não reconstrói a formatação do JSON remoto.

Exit0 significa `ARTIFACT_DOCUMENTS_PASS`: todas as verificações documentais implementadas passaram. Exit1 significa `ARTIFACT_DOCUMENTS_HOLD`: consulte `failures`, `journeys` e `inventory`. Dados ausentes ou ambíguos produzem HOLD. A lista mantém IDs, títulos, arquivo, linha, projeto, outcome, status de cada tentativa, retry, duração, anexos e erros. Não interpretar o código0 como substituto dos checks45 ou das outras qualificações.

## Intake antes de selecionar as jornadas

- [ ]71 publicou um candidato W em `sf2-stack` contendo a release explícita73 e os nove arquivos75 finais. C35 observado, `e87e22d163924635bf0b41785c9bc80bf780ac0a`, ainda não era esse candidato.
- [ ]Reconciliar o HEAD atual de71 e o tree de W. Preservar59/72/73/74 e o material61/65/66/68 já composto. Não transportar `runtime/procurement.ts` por75.
- [ ]Ler `C35-INTAKE.json`. Conferir em W os blobs/hashes de configuração, package scripts, lock e fontes listadas em `POLICY.json`. O arquivo contém os pins revistos de63/C35/W4; divergência exige intake do diff concreto.
- [ ]S tem exatamente um parent W. Comparação W→S contém somente `.ci-run.json`; nenhuma alteração de produto, workflow, config ou script.
- [ ]O body canônico é exatamente o abaixo, sem `operationsScanner`, e seu SHA256 é `e4201f174defe27af1f45cac85a40535e665aa851eeb6e803311b9ae72085717`.
- [ ]Envelope: campaign `sf2h-integral-20261112`, mission75, sourceBranch `sf2-stack`, productSha W, selection `journeys` e o digest acima. Branch `sf-ops75-W12jREQ12N`, com N1–99.

```json
{"package":"app","packageSelector":"packages/app","directory":"packages/app-shell","runner":"playwright","args":["e2e/sucafina/operations.spec.ts"],"env":{"ORCHESTRA_CHANNEL":"prod"},"config":"e2e/playwright.production.config.ts"}
```

## Artefatos esperados

O upload usa o ancestral comum dos caminhos do runner. Portanto, o ZIP pode começar com `Orchestra-SF/Orchestra-SF/` e `_temp/`. O parser busca por sufixos e exige uma ocorrência de cada documento obrigatório; não depende do diretório de extração.

| Documento ou diretório | Finalidade |
|---|---|
| `test-ci-evidence/request.json` | W/S/run/attempt, request normalizado, digest, argumentos CLI e hashes dos11 arquivos guardados |
| `test-ci-evidence/playwright-selection.json` | Saída JSON real do `--list`, antes de executar as jornadas |
| `test-ci-evidence/selection.json` | Receipt que confirma os cinco IDs originais, workers1/retries0/repeat1 |
| `test-ci-evidence/playwright-runtime.json` | JSON real da execução, resultados e anexos por teste |
| `packages/app-shell/e2e/playwright-report/index.html` | Relatório HTML não vazio; abrir para revisão humana quando necessário |
| `packages/app-shell/e2e/test-results/**` | Traces, screenshots, vídeo e anexos emitidos pelo Playwright |
| `_temp/sf-operations75-RUN-ATTEMPT.NONCE/evidence/` | Package/config/version/process/readiness/signatures/controls/cleanup ClamD |

`--trace retain-on-failure` não exige trace para um teste que passou. Todo trace ou anexo anunciado no JSON deve estar presente; um teste falho mantém HOLD independentemente do trace. `.last-run.json` é oculto, e upload-artifact não inclui arquivos ocultos por padrão: sua ausência não invalida um run; quando presente, o parser confere status e failedTests.

## Seleção e resultado

O parser exige os mesmos cinco IDs, nesta ordem, no list e no runtime:

1. `OP-PROC-01`
2. `OP-PROC-02`
3. `OP-PROC-03`
4. `OP-IMPORT-01`
5. `OP-DOC-01`

- [ ]Uma spec e um teste `chromium` por ID; nenhuma seleção extra, omissão ou repetição.
- [ ]List não executou tentativas. IDs internos/títulos/localizações do runtime coincidem com o list.
- [ ]Cada runtime test: `expectedStatus=passed`, `status=expected`, uma tentativa com `status=passed`, `retry=0`, `parallelIndex=0`, sem erros ou annotations skip/fixme/fail/slow.
- [ ]Stats reais: expected5, skipped0, unexpected0, flaky0; nenhum erro global.
- [ ]No Actions, o job terminou success. Steps `Validate campaign, source and exact selection`, `Prepare ephemeral real ClamD`, `Run tests`, `Stop only this job's ClamD processes` e `Upload exact selection and scanner evidence` terminaram success. O run está vinculado a S, push, repositório e branch corretos.

## Configuração e budgets

| Política | Valor | Evidência |
|---|---:|---|
| Workers |1| CLI canônica, receipt e JSON config |
| Retries |0| CLI, project e ausência de segunda tentativa |
| Repeat each |1| CLI e project |
| Test timeout |60000ms| Project e cada JSON test |
| Expect timeout |10000ms| Fonte `packages/app-shell/playwright.config.ts` em W |
| Web server principal |120000ms| Mesma fonte; production config herda o budget |
| Fixture WP04 |60000ms| Production config; somente quando selecionada |
| Job |45min| Workflow75 em W |
| Fully parallel |false| JSON config |
| Forbid only |true| JSON config, sob CI |
| Max failures |0| JSON config |
| Shard |null| JSON config |
| Bundle |production| Config metadata, request `ORCHESTRA_CHANNEL=prod` |
| Trace |retain-on-failure| Workflow/config pins; referências reais de anexos |

O reporter JSON1.59.1 **não serializa `project.expect` nem `project.use`**. O parser não inventa prova dos10000ms de expect, screenshot/video/trace a partir do status passed. Esses pontos dependem do intake dos bytes da configuração em W e do workflow já guardado. A política não fixa a revisão diária de assinaturas; uma revisão oficial mais recente é legítima.

## ClamD no mesmo job

- [ ]Package oficial1.5.4, bytes105819396 e SHA256 `28d6efc5b4423e7830c3559339552eb53870a9eac51ac4efb37d60530d329886` coincidem com lock e receipt real.
- [ ]`setup.json` READY, W/S/run/attempt/branch corretos, caminho privado em RUNNER_TEMP e duas portas loopback3310/3311.
- [ ]`service.json` e process receipts concordam em PID, executável extraído, config privada, starttime e socket inode.
- [ ]`freshclam-output.log` registra três testes de banco aprovados; main/daily/bytecode têm bytes/digests; `TestDatabases=yes`, `OfficialDatabaseOnly=yes`, `syntheticDatabase=false`.
- [ ]Config receipts têm hashes iguais aos `.conf.txt`, DatabaseDirectory e CVDCertsDirectory dentro do job, sem instalação global ou credenciais.
- [ ]Readiness PONG e versão1.5.4 em ambos; controles diretos clean/EICAR/clean-after em ambos e erro real de tamanho.
- [ ]Cleanup dos journeys termina **STOPPED para ambos**, com os mesmos PID/starttime. `ABSENT` no daemon de erro era esperado no run controls R3, que o encerrou no controle DOWN; não é o resultado previsto das jornadas, que não fazem essa parada.
- [ ]R3 continua sendo a prova separada dos controles reais malformed/outage e das admissões privadas clean/EICAR/outage. O run journeys não a substitui.

## Limites e procedência

Não há consulta de rede nem autenticação no parser. O root fornece as referências esperadas e verifica sua autoridade via GitHub MCP. Os hashes documentais ajudam a reproduzir a leitura; não autenticam sozinhos um arquivo fornecido.

Schema JSON consultado no código oficial Playwright1.59.1: `packages/playwright/src/reporters/json.ts`, blob `5823746e5028bf66ff0c02c64b61fa5a36fa6969` ([fonte](https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright/src/reporters/json.ts)). Sources do repositório estão pinados por ref/blob/SHA256 em POLICY e, para as configurações lidas, SOURCE-SNAPSHOTS.

`tools.lock.json` tem duas representações legítimas, documentadas em LOCK-PROVENANCE: o source compacto de2172bytes (Git blob `cbcea48086755f45ea92e1abb516cf0222d0ebbc`, SHA256 `e3651a4fdc1348f7653660a62c8a8963bd34ae6044b3a81be8a89beb6715d9b6`) e o receipt reserializado com indent2 de2276bytes (SHA256 `899f43dfd6dffb4e713c1e2eba2c306086eddc53de6b20aa3bfc73d2b057c929`). O guard `request.integrity` usa os bytes do source; o parser compara o valor JSON do receipt de setup com a política e registra seu hash documental separadamente. A representação do artifact não é um pin do source.

`SELF-CHECK.json` contém apenas casos sintéticos do parser. Nenhum desses resultados é evidência de produto. Checks45, critérios completos/C06, native/provider parity e GLOBAL_RELEASE permanecem gates próprios.
