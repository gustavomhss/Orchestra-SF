# Handoff — finish-reports-20261119

SHA: be0d18d53683a59ba45a334d9504f52ebf1ea60a (código em andamento).
Data: 2026-11-19
Estado: partial

## Feito

- CAP03 renderiza os totais que o produtor já calcula para o ano solicitado. Exige correspondência com selection.year antes de exibir os totais; não soma no navegador.
- O ingresso Budget → Reports preserva year na URL.
- A descoberta real expõe os recordRefs já autorizados pelo seletor. A projeção nativa usa a seleção emitida como identidade de seção, eliminando a colisão de três seções chamadas dashboard.
- UI47 permite retirar um registro da seleção sem escrever na fonte, e preserva o título emitido pelo produtor.
- UI48 oferece preparação explícita da sucessora quando review-update confirma disponibilidade, reaproveitando o editor nativo. A preservação envia previousReviewRef.
- Reports dirige os controles nativos; mantém provas de 25→24 registros, integridade de todos os demais campos, mesma seleção física na sucessora, valor/moeda/período/referência e imutabilidade da revisão anterior.
- Ordem de seleção Projects, Budget, Hot Topics é explicitamente dirigida pela UI e compatível com as asserções já existentes de reunião. Reload observa dashboard-review, a operação real do capítulo.

## Pendente

- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:19 — executar os quatro cenários após a qualificação do ingresso real pela branch finish-ingress-20261119.
- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts — verificar o destino nativo devolvido por review-source e DOCX/PPTX originais; essas asserções permanecem ativas.
- packages/app-shell/e2e/sucafina/wp10/extended-flows.ts e review-agenda-support/first-agenda.ts — concluir os consumidores nativos restantes após o ingresso compartilhado.
- Nenhum teste desta branch foi executado ainda; commits de produto não estão qualificados nem integrados.

## Decisões e justificativas

- A retomada autorizada exige fechamento completo, com novos gates necessários, sem restaurar o console descomissionado.
- Não foram removidas asserções de negócio. A mensagem estática do console antigo na remoção foi substituída pelo estado nativo reviewing e a contagem autoritativa 24. A tabela antiga da sucessora foi substituída pela linha nativa da reunião, exigindo o mesmo ID, valor, moeda e período, além de referência de origem não vazia.
- Fonte, contagens, identidade e totais continuam pertencendo aos produtores; a UI apenas seleciona e renderiza.

## Como retomar

- Continuar nesta branch. Integrar a infraestrutura de ingresso já testada com merge de pais e árvore composta, preservando estes arquivos.
- Rodar test-ci selecionando somente e2e/sucafina/reports.spec.ts com playwright.production.config.ts, um worker e zero retries.
- Corrigir os fatos observados no gate, registrar run e SHA; integrar somente com evidência correspondente.

## Comandos e resultados

- Nenhum shell local executado; alterações pelo GitHub.
- Base de trabalho 0a3c05fbc4175f9514a12036d43ff1e5cca51d56 contém o gate de compilação/sourcing 44561871689 SUCCESS; essa evidência não cobre os novos controles desta branch.
