# Quinta rodada — quinze áreas nativas da Sucafina

Status: **IN_PROGRESS_NOT_VERIFIED**. O usuário pediu o próximo bloco de quinze áreas. A branch isolada `sf-design-next` parte de `dev d3ccea42b5f8409c8d6c68e4909f7b868b50322c`.

## Escopo fechado

Esta rodada cobre **UI42–UI56**, quinze áreas e **22 padrões de rota existentes**. As 41 áreas aprovadas e mescladas nas rodadas anteriores permanecem preservadas. Após a entrega deste bloco, restarão 14 áreas; esse saldo futuro não é contado como implementação concluída.

| Frente | Áreas | Branch |
| --- | --- | --- |
| Cenários, sensibilidade e BI | UI42–UI46 | `sf-next-analytics` |
| Revisões, relatórios e propostas de hot topics | UI47–UI50, UI54 | `sf-next-reviews` |
| Relações, conversas, confirmações e importações | UI51–UI53, UI55–UI56 | `sf-next-collab` |

[Escopo por área e rota](wave-five/scope.json).

## Direção visual

Reutilizar o sistema nativo e o acabamento aprovado: eixo de 1160px, gutters 32/24/16px, controles de 44px, tipografia e materiais existentes. Cada área tem composição própria de leitura, edição e revisão; estados e valores continuam pertencendo ao produtor original. Os catálogos ingleses existentes são preservados; qualquer nova mensagem recebe português explícito.

Os arquivos compartilhados de Importações também servem UI57 e UI68, fora deste bloco. O marcador de apresentação desta rodada deve ser aplicado somente a UI55 e UI56.

## Qualificação e aceite

As jornadas e verificações serão executadas exclusivamente no test-ci existente em GitHub Actions. As capturas virão da aplicação nativa instalada com dados isolados de teste emitidos pelos produtores originais. As evidências devem registrar produto, snapshot, execução, área e estado. Fonte indisponível não representa uma gravação ou resultado bem-sucedido.

Não há aprovação visual ou autorização de merge específica desta rodada neste checkpoint. A entrega será apresentada ao usuário com capturas reais e resultados verificáveis.
