# Handoff — finish-localentry-20261119

SHA: 901091e71375b6bda4f6aee70a8930a57f1f2d67 (último código; este handoff é o commit seguinte)
Data: 2026-11-19
Estado: complete

## Feito

- Migrada a prova do nome de operador gravado no enrollment em `modules/sucafina/Sucafinav1/test/local-entry.test.ts:108`.
- O teste conserva um nome explicitamente diferente de `userInfo().username`, faz enrollment real e usa o cookie emitido para salvar um risco pelo POST produtor existente. Exige HTTP 200, `ok: true`, perfil `local-operator`, uma única entrada de audit e identidade `macos:<installationId>:<uid>` com o nome original gravado.
- O GET do dashboard aposentado continua com asserção 404. As outras onze provas do arquivo permanecem intactas, incluindo isolamento de perfis, proteção de origem, persistência, logout, backups e preservação/negação de estado local existente.
- [Run 44571370644](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44571370644): success, 12 pass / 0 fail / 92 expect() calls; job 135727023622 e cleanup 135728119688 success.

## Pendente

- Nenhum item unbound nesta fatia. O teste verifica enrollment e produtor reais; a renderização dos capítulos é responsabilidade dos E2E de ingresso.

## Decisões e justificativas

- Asserções removidas: nenhuma prova de identidade ou perfil. A expectativa de HTTP 200 no HTML aposentado passou para a operação ativa do produtor; o texto `Homologação local` foi substituído pela resposta de readiness `login: local-operator`; o nome que antes era procurado em HTML é exigido no audit da operação com a identidade exata do operador.
- O arquivo passa de 78 para 81 chamadas estáticas de `expect`. Nenhum skip, timeout maior ou check vazio.
- A escrita de teste usa o mesmo contrato IT Risks/save já exercitado no arquivo, dentro de diretório privado. Não modifica nenhum produtor ou ambiente externo.
- Sem alterações a `runtime/application.ts`, workflows, suites, baselines, coverage ou receipts.

## Como retomar

1. Revisar e integrar `finish-localentry-20261119`, código `901091e71375b6bda4f6aee70a8930a57f1f2d67`, sobre `d3de8477cd26bd98ffff7a030d8328ee403f37da`.
2. Se houver alteração relevante, solicitar `test-ci` com `{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/local-entry.test.ts"]}` em branch `ci-run-linux-*` criada atomicamente no snapshot já configurado.
3. Continuar as demais causas SF em fatias independentes; este gate não é uma execução sf-ci.

## Comandos e resultados

- `bun typecheck` (app-shell): não rodado nesta fatia Bun.
- `bun run check:guards --base origin/dev`: não rodado; sem declaração de guards PASS.
- `test-ci` [44571370644](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44571370644), snapshot `624f261bbc7dca19743a402d3a0bac50d3adf9c8`, parent de código `901091e71375b6bda4f6aee70a8930a57f1f2d67`: success, 12 pass / 0 fail / 92 expect em 1.052 ms.
- Alteração posterior ao gate: apenas este handoff.
