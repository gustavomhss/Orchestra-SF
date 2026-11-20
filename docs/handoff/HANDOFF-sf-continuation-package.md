# Handoff — sf-continuation-package

SHA: 11a23d3cfe3c0edfaf1e92a05d21da43f0656d76 (código; este documento é versionado depois)
Base: f7dd58e32bc834f1485df20b91adbf759b4c4ad0
Estado: partial — correções publicadas; Actions e qualificação da fábrica ainda pendentes.

## Feito

- Factory usa a origem de loopback explícita `http://localhost:4120` na configuração privada, no argumento do executável extraído, em todas as requisições e cabeçalhos Origin e no recibo. O checker independente exige a mesma origem. A configuração não depende mais do default 4110.
- Preservados os asserts originais de status, sessão/identidade, console autenticado 404, comando real, caso persistido, anti-forgery, bytes do Web, extração fora do checkout, arquivo comprimido e controles de adulteração. Nenhum timeout, hash ou baseline foi alterado.
- O step UI de sf-ci emite `minimized=true` somente depois de o comando de testes retornar zero e `gate.mjs sanitize-playwright` concluir. O receipt original continua sendo exigido e continua falhando quando o baseline está pendente.
- Em falha desse mesmo step, e somente com a marca de minimização presente, o workflow retém apenas `sf-ci-evidence/<suite>/report.json` no artifact `sf-baseline-candidate-<suite>-<sha>-<attempt>`. O prefixo é distinto de `sf-evidence-*`, que o verificador consome como receipts qualificados.
- O upload normal de report + receipt em success permanece intacto. O novo artifact não contém o report bruto anterior à minimização, não publica receipt de sucesso e não muda a conclusão do job.
- Lido AGENTS.md da raiz. Não há AGENTS.md nas pastas ancestrais específicas dos quatro paths atribuídos.
- Commit de código com `[skip ci]`; somente GitHub APIs, sem shell, testes locais, PR, merge ou dispatch por este WP.

## Arquivos

- `apps/cli/test/factory-distribution-linux.test.ts` — origem/configuração explícita 4120 e uso consistente no teste real.
- `apps/cli/script/factory-receipt-check.ts` — exige origem 4120 no receipt.
- `.github/workflows/sf-ci.yml` — retém candidato UI já minimizado sem converter falha em sucesso.
- Este handoff.

## Verificação e limites

- Diff retornado pela API: exatamente os três paths de código acima; branch ahead 1 / behind 0 contra a base no commit de código.
- Nenhuma execução de Actions iniciada por este WP. Revisão de diff não é prova de execução.
- Gate estreito existente proposto ao integrador: `{"package":"script","runner":"bun","args":["../../script/sf-ci/gate.test.mjs"]}`. Resolve o pacote Script em `packages/script` e exerce os contratos de seleção do workflow, minimização de evidência e recusa de baseline/receipts inválidos.
- O gate estreito não prova o processo compilado nem um upload real do artifact GitHub. A prova completa da porta/origem permanece no workflow existente `sf-factory-package`, sobre o SHA congelado, após a integração.
- O futuro sf-ci completo deve confirmar que Reports/Decisions com testes verdes e baseline pendente produzem candidato minimizado e continuam vermelhos. Se os testes falharem antes da minimização, o artifact de candidato não deve existir.
- Sem alteração em `sf/ci/suites.json`, seleção de testes, gates, application.ts ou codec de reviews. Sem GO, deploy ou `SF_ORCHESTRA_WEB_PACKAGE_VERIFIED`.

## Baseline e pacote

- `PENDING_REAL_COMPLETE_RUN` permanece intacto. O artifact novo é insumo para revisão independente futura, não baseline aceito.
- O SHA-256 final será o `archiveSha256` dos bytes reais de `orchestra-sf-factory-linux-x64-baseline.tar.gz`, confirmado em `SF_FACTORY_PACKAGE_QUALIFIED`, `SF_FACTORY_RECEIPT_VERIFIED` e no recibo. O digest ZIP do artifact GitHub não o substitui.
- Run id: NOT_RUN. Artifact: NOT_PRODUCED. Package sha256: NOT_PRODUCED.

## Como retomar

1. Integrador revisa o diff e executa o gate estreito com snapshot `ci-run-linux-*` somente quando houver slot; máximo dois gates simultâneos.
2. Registrar run, jobs, SHA do snapshot e resultado real neste handoff. Em falha, corrigir a causa; não repetir gate idêntico sem mudança.
3. Integrar os deltas qualificados no candidato, preservando as alterações concorrentes do workflow. Executar o único sf-ci final no SHA de integração.
4. Congelar e executar a fábrica pelo mecanismo já autorizado. Confirmar que origem 4120, SHA do source/checkout, run/attempt e archiveSha256 são coerentes no receipt real.
5. Não declarar complete antes de registrar a qualificação correspondente. Não fabricar hashes, check, receipt ou aceite.
