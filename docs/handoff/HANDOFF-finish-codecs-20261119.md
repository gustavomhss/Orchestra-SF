# Handoff — finish-codecs-20261119

SHA: 5e01992d1972156b20acae55c61297bc7beb3415 (código testado).
Data: 2026-11-19
Estado: complete

## Feito

- Prova estreita do codec canônico real de CAP23 e CAP18, com schemas publicados.
- Comando JSON completo mantém valores/CAS; propriedades desconhecidas, infinitos e array com undefined são recusados.
- Diagnóstico separa a admissão do schema original e a representação JSON para id:undefined. Nenhuma alteração produtora ou relaxamento do codec.

## Pendente

- Nenhuma pendência neste teste do codec. A qualificação da escrita real pertence à branch de ingresso.
- packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx:247 — primeira escrita nativa ainda aguardando gate de ingresso sob finish-ingress-20261119.

## Decisões e justificativas

- O run demonstrou sourceAccepted:false, wire:invalid, sourceOwnUndefined:false: Schema.optionalKey já rejeita id:undefined no primeiro parse. A hipótese de falha apenas em Schema.Json foi descartada. bindings.ts permanece intacto; a correção mínima é omitir id quando ausente nos callers.
- Asserções removidas: nenhuma.

## Como retomar

1. Conservar o codec estrito e suas provas negativas.
2. finish-ingress-20261119 omite os campos opcionais ausentes nos três callers confirmados.
3. Qualificar a escrita real no ingresso e registrar os runs; este gate unitário não a substitui.

## Comandos e resultados

- [44578426680](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44578426680): SUCCESS, 3 pass / 0 fail / 8 expect. Snapshot95e8a749c816bcb7d8433ffbc10c5782823e86af, código5e01992d1972156b20acae55c61297bc7beb3415. Test135752155677 e cleanup135753511559 success.
- Nenhum shell local, timeout ampliado ou asserção removida.
