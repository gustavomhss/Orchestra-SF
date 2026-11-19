# Handoff — ci-types-20261119
SHA: 15388053117883174329454207e60e2a878f5426
Data: 2026-11-19
Estado: partial

## Feito
Snapshot de diagnóstico das três compilações canônicas de test-ci, sem instalação de Chromium. Não substitui os gates Playwright dos WPs. Não executa sf-ci. Corrigidos os três erros observados no run 44598844856 sem cast, timeout ou mudança de política.

## Pendente
- packages/app-shell/e2e/sucafina/wp03/native-ingress.spec.ts:1 — gate instalado após compilação.
- packages/app-shell/e2e/sucafina/reports.spec.ts:1 — gate instalado após compilação.
- Resultado deste diagnóstico ainda não observado no momento do commit.

## Decisões e justificativas
Mesmos setup-bun, Node24.15 e comandos bun run typecheck / bun run typecheck:sf-e2e --pretty false do workflow test-ci. Jobs independentes permitem observar todos os tipos; nenhum teste ou asserção removido. Workflow temporário fora da integração.

## Como retomar
Consultar o run desta branch; corrigir somente erros observados. Reexecutar os specs nativos mais estreitos em ci-run-linux-* sobre o código corrigido.

## Comandos e resultados
- Run44598844856: FAILURE; CLI types PASS; app-shell types FAIL; browser não iniciou.
- Diagnóstico atual: aguardando GitHub Actions.
