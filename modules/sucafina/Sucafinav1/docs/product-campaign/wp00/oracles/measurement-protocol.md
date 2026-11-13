# WP00.T03 — protocolo proposto de medição

Estado: fixtures propostas; nenhuma medição executada. Todos os datasets são sintéticos e não representam volume conhecido da Sucafina.

## Carga e repetição

- Gerar/preparar 1.000 linhas financeiras, 200 pedidos e 100 projetos conforme `test/product/wp00/fixtures/corpus-v2.json`; a prova `test/product/wp00/corpus-consumer.test.ts` gera os conjuntos de volume deterministicamente em memória. Registrar digest dos dados gerados e ambiente candidato usado quando a medição for executada.
- Executar pelo menos 30 repetições por fluxo comparável: abrir/filtrar Dashboard, comparar cenário Planner, ranquear Procurement, pesquisar/preparar relatório e prévia/reimportação exata.
- Registrar cada repetição individualmente. Separar tempo até a resposta visual utilizável de conclusão da tarefa e correção do resultado. Não misturar essas medidas em uma média única.
- Fixar e registrar runtime, sistema, dispositivo, browser, commit candidato, viewport, zoom, estado de cache e forma de carga. Se um campo não puder ser observado, registrar como ausente.
- Usar viewports de 320, 768 e 1440 px e zoom de 200%; anotar overflow, controles inacessíveis, perda de conteúdo e necessidade de resumo explícito.
- Reportar observações brutas, mediana e p95 por fluxo/configuração, juntamente com falhas e cancelamentos; não declarar limiar de desempenho porque o plano não fornece um.

## Baseline

O baseline de comparação deve ser medido no mesmo ambiente e com o mesmo corpus antes de comparar com o candidato. Não existe resultado temporal observado nesta proposta. Não converter uma medida de laboratório em afirmação sobre dados reais ou produção.
