# Handoff — finish-codecs-20261119

SHA: base 57aafbd892e5f3425f97ab53d6bb3b59345b69aa; commit de código é o pai do snapshot de verificação.
Data: 2026-11-19
Estado: partial

## Feito

- Prova estreita do codec canônico real de CAP23 e CAP18, com schemas publicados.
- Comando JSON completo mantém valores/CAS; propriedades desconhecidas, infinitos e array com undefined são recusados.
- Diagnóstico separa a admissão do schema original e a representação JSON para id:undefined. Nenhuma alteração produtora ou relaxamento do codec.

## Pendente

- packages/client/test/sucafina/native-codecs.test.ts:17 — aguardar diagnóstico do primeiro parse para decidir a correção mínima nos callers.
- packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx:247 — primeira escrita nativa ainda aguardando gate de ingresso sob finish-ingress-20261119.

## Decisões e justificativas

- A hipótese de que apenas Schema.Json rejeita undefined ainda não foi demonstrada. Não normalizar antes da validação estrita nem apagar campos desconhecidos.
- Asserções removidas: nenhuma.

## Como retomar

1. Ler SF_CODEC_OPTIONAL_DIAGNOSTIC no run.
2. Se o schema também negar id:undefined, omitir o campo opcional nos callers; não mudar bindings.ts.
3. Qualificar a escrita real no ingresso e registrar os runs.

## Comandos e resultados

- Toda verificação ocorre por GitHub Actions; gate ainda não iniciado na gravação deste documento.
