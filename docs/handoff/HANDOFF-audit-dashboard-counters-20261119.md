# Handoff — audit-dashboard-counters-20261119

SHA: d3c6984dc6680013f8e23213972e552a18d3fb23 (base de auditoria; workflow neste commit)
Estado: partial

## Feito

Leitor estreito do artifact14569076992 de run44601709564. Extrai somente os labels e contadores já sanitizados pelo observeDashboardRequests; aceita attachments com nome de hash e corpo incorporado no relatório. Nenhum teste é reexecutado e nenhum arquivo de produto é alterado.

## Pendente

.github/workflows/sf-audit-log-inspection.yml:1 — aguardar o próprio run e observar docs/handoff/observed-dashboard-counters-20261119.md. A falha original é CAP04 Loading em confirmation-access.spec.ts:34, ainda sem causa confirmada.

## Asserções removidas

Nenhuma.

## Como retomar

Ler somente os contadores persistidos, identificar a última leitura de CAP04/contexto e levar a correção mínima ao branch finish-ingress-20261119. Não incorporar esta branch de diagnóstico à integração.

## Runs

- 44601709564: failure, origem do artifact e não resultado deste diagnóstico.
- 44603939708: success, extração anterior que localizou as telas mas não os attachments de nome hash.
- Leitura atual: pendente de Actions.
