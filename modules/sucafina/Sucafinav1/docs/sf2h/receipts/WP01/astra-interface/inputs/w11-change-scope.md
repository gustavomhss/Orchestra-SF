# W11 — contexto de reunião na apresentação de Meu trabalho

Pai W10: `0c3d98dd1263a305ce294c78ad5939cdda110a78`, tree `5c236ef687871149e9150630a16c4ce0ac70c2a7`.

## Mudança própria

A apresentação de My work passa a consumir os metadados opcionais `reviewContexts` e `reviewContext` já publicados em Collaboration. Mostra referência, versão e encaminhamento/seção preservados; valida as duas formas fechadas e escapa os textos. Não mostra digest. Uma forma ausente preserva a apresentação anterior; forma inválida produz aviso neutro sem payload parcial.

A chamada está no ramo HTTP de apresentação existente, depois da revalidação de acesso. Nenhuma rota, contrato, autoridade, host ou producer estrangeiro é reescrito. A resolução de Open work continua no producer existente. O guia de comportamento visível foi atualizado.

O novo arquivo contém oito contraprovas da fronteira de rendering: compatibilidade antiga, formas publicadas, distinção de seção/encaminhamento, rejeição de metadados inválidos, escaping, ausência de gatilhos, imutabilidade/ordem e erro de accessor sem vazamento. São provas de componente, não simulações ou substituições de C05/C06/C08.

## Dependências explícitas

O manifesto my-work-review-context-w11.json fixa os produtores de PR33 `2784daafbb0d3b58b6019822288a07fa38e5c5b0`. O finding adjacente descreve o wiring pendente no Compose `35b9fd4f532abeb1058f00281d4ad8885ca9966f`.

Criar conversa a partir de uma seção exige PreservedReview e basis C17 reais, selector emitido pelo servidor e destinatário autorizado. A confirmação de resposta com reviewContext ainda é negada pelo próprio produtor naquele pin por falta de escopo. Esta apresentação não fecha essas jornadas, a seleção inicial arbitrária de trabalho, o histórico WholeReview nem o readback C12.

## Validação cirúrgica

Seleção nova: somente `./Sucafinav1/test/product/wp01/work-review-context-render.test.ts`. Não há uso de browser nesse arquivo; não lançar Chromium para essa prova de rendering. O validador oficial do repositório normaliza request/package/env. Omni deve qualificar a seleção conforme as declarações reais, sem confundir not applicable com prova de spawn.

Rodar bun typecheck nos packages Sucafina e CLI e guards conforme o workflow próprio. Protocol/Server HttpApi não mudou. Nenhum produto/check local.

O complemento13 permanece no W10 imutável; a nova seleção só será disparada após seu término, sem produto em paralelo ou rerun equivalente. W10/6 terminou33PASS/1FAIL: conversas/vistas/host C12 aprovados; reabertura após reload permanece falha de composição, preservada no novo recibo e finding. As novas mudanças recebem prova somente no SHA W11.
