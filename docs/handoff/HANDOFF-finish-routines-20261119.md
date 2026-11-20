# Handoff — finish-routines-20261119

SHA: `612f92ae0c50c39ad0c490e6cedf717c9d6a956b` (código; este documento é um commit posterior).
Data: 2026-11-19
Estado: complete

## Feito

- Base: `sf-join-four@4e3cf1f8ff0fefa4760114b663a98a998493c13e`.
- Arquivo de código alterado: `modules/sucafina/Sucafinav1/test/product/wp10/native-host/routine-services.test.ts`.
- A lista positiva exata dos seis IDs continua verificada na fábrica canônica `createRoutineCapabilities`. Essa prova enumera definições; não afirma instalação ou execução de C07/ScheduledTask. Callbacks de runtime dessa enumeração lançariam erro se invocados.
- O host sem porta de publicação agora tem negativa explícita de registro, além das respostas originais de indisponibilidade de catálogo, admissão e execução.
- O segundo cenário conserva o AuthoringStore real, a publicação real e a UI registry real. Ele prova os cinco IDs que a montagem permite e a ausência explícita de `sf_watch_prepare`.
- Todas as provas anteriores de versão de admissão, contador de starts, integridade do resultado e revogação/replacement/disposal foram preservadas. Nenhum produtor foi alterado.

## Pendente

Nenhum pendente dentro desta fatia. O gate não qualifica os demais grupos do inventário global nem um adaptador nativo C07 ou ScheduledTask.

## Decisões e justificativas

- `apps/cli/src/sucafina-product/routine-services.ts:297–303` registra descritores somente quando `publication()` existe. Watch requer também `prepareWatch` e `watchAvailable() === true`.
- O primeiro teste não fornecia publicação e exigia os seis IDs em `service.descriptors`. Essa expectativa misturava o catálogo da fábrica com a montagem instalada.
- A asserção positiva dos seis IDs foi transferida para a fábrica original em `routine-services.test.ts:47–49`; não foi apagada. A negativa de host sem porta está em `:50`; o registro real com publicação e watch ausente está em `:104–107`.
- Não foi inventado `watchAvailable: true` nem foi tratado um callback indisponível como implantação de watch.
- Asserções removidas: nenhuma; a asserção do catálogo mudou para o limite de contrato correspondente e foram acrescentadas três asserções de montagem.
- Não houve alteração de timeout, skip, HTML legado, workflow, baseline, coverage ou receipt de produção.

## Como retomar

1. Revisar o diff do único spec e este handoff.
2. Integrar a PR em `sf-join-four`.
3. Usar o SHA integrado no gate agregado coordenado pelo root. A execução estreita desta fatia já terminou e não precisa ser repetida por causa do commit documental.

## Comandos e resultados

Execução exclusivamente em GitHub Actions, sem shell local.

- Código: `612f92ae0c50c39ad0c490e6cedf717c9d6a956b`.
- Snapshot CI: `689d22e6ca71c1277170a8612784ebde62c2148e`.
- Run: [44594666179](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44594666179) — **SUCCESS**.
- Job de testes: `135809616019` — SUCCESS.
- Job de cleanup: `135810976341` — SUCCESS.
- Resultado: **3 pass, 0 fail, 43 expect()**, um arquivo, 876 ms.
- Os cenários de publicação/revogação mantêm o AuthoringStore real. O native C07 I/O já era uma fronteira de teste explícita; este resultado não o transforma em prova de instalação nativa.

Pedido change-scoped:

```json
{
  "package": "sucafina",
  "runner": "bun",
  "args": [
    "Sucafinav1/test/product/wp10/native-host/routine-services.test.ts"
  ]
}
```

A branch CI foi criada atomicamente no commit que já continha `.ci-run.json`. O arquivo não pertence à branch de trabalho.
