# Redesenho nativo da Sucafina no Orchestra

**Estado: proposta de UX e arquitetura para revisão. Somente planejamento.** Esta adaptação responde ao [briefing](PLANNING-BRIEF.md) e às duas orientações adicionais do usuário: a Sucafina é o centro do Orchestra SF; o trabalho inclui um redesenho completo da experiência, hierarquia e distribuição das telas.

## Decisão proposta

Transformar o Orchestra SF em um espaço de trabalho de negócio, com **15 destinos Sucafina na sidebar nativa**, agrupados por frequência e finalidade. Hoje abre o trabalho que exige atenção; Dashboard explica a situação do negócio; Planner, Procurement, Portfólio e Decisões dão continuidade à ação. Pessoas, Operações, Análises, Documentos, Importações, Memória e Rotinas têm lugares explícitos. Chat e Inbox são apoio; ferramentas técnicas ficam recolhidas.

Cada destino será um chapter SolidJS do Orchestra, no mesmo registro e ciclo de navegação dos módulos existentes. O desenho usa os componentes e materiais reais do repositório. A mudança de organização visual não muda o domínio que autoriza, calcula, persiste ou emite um recibo.

A proposta inclui telas de trabalho, estados adversos, composição responsiva, interações de teclado, textos, APIs, isolamento e plano de integração. As pranchas são **design proposto com dados sintéticos**, não capturas de produto implementado nem evidência de funcionamento.

## Como revisar

| Ordem | Documento | Decisão que permite revisar |
| --- | --- | --- |
| 1 | [UX-DESIGN.md](UX-DESIGN.md) e [UX-BOARDS.pdf](UX-BOARDS.pdf) | Organização, hierarquia visual, distribuição de conteúdo e jornadas |
| 2 | [SCREEN-INVENTORY.md](SCREEN-INVENTORY.md) | Destino das 28 capacidades originais e das funções previstas |
| 3 | [API-AND-ISOLATION.md](API-AND-ISOLATION.md) | Contrato de dados, Microsoft, contexto e autoridade |
| 4 | [NATIVE-ARCHITECTURE.md](NATIVE-ARCHITECTURE.md) | Reuso real do Orchestra e o que precisa ser composto |
| 5 | [MIGRATION-AND-HANDOFFS.md](MIGRATION-AND-HANDOFFS.md) | Paridade, deep links, coexistência e limites dos handoffs |
| 6 | [DELIVERY-PLAN.md](DELIVERY-PLAN.md) | Fatias, paths exclusivos, dependências, ordem e dimensionamento |
| 7 | [ACCEPTANCE.md](ACCEPTANCE.md) | Aceite funcional, visual, acessível e segurança via GitHub Actions |
| 8 | [TRACEABILITY.md](TRACEABILITY.md) e [criteria-trace.json](criteria-trace.json) | 15 WPs, 74 tasks e 1610 critérios sem alteração do canônico |
| 9 | [RESEARCH.md](RESEARCH.md) e [SOURCE-BASELINE.json](SOURCE-BASELINE.json) | Fontes primárias, decisões derivadas e pins de inspeção |

## Pranchas para a revisão visual

O [UX-BOARDS.pdf](UX-BOARDS.pdf) reúne 17 pranchas: uma para cada um dos 15 destinos de negócio, uma de continuidade em telas menores e uma de conflitos, resultado incerto e perda de acesso. Light e Dark demonstram a direção com tokens do Orchestra; os sete temas continuam obrigatórios na qualificação futura. As 17 páginas foram renderizadas e inspecionadas como documento, sem executar o produto.

## Base e autoridade

- Brief/planning branch: `sf-sidebar-plan@87d6e496a6a1e08e64ffb6d3c06890647a401459`, baseada em C26.
- Base de inspeção abrangente: **C27 `b10c424a6b318879fc30f11d03ba1cfeffda7d1a`**, em `sf2-stack` / [PR65](https://github.com/gustavomhss/Orchestra-SF/pull/65).
- Planejamento canônico imutável: [`dbf9547211d9b0fade619790de7c19c0869b7c7d`](https://github.com/gustavomhss/Orchestra-SF/tree/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan).
- T0 preservado: `2026-11-13T04:01:10Z`. **GLOBAL_RELEASE continua false.**
- Handoff terminal a57: `d6d9816bb09f7595330862616305e0791e23e61e`, com lease encerrada e somente 14 receipts sobre C27. Handoff a58: `00813b2ebacf5b0cd1c69d871c7a757ac323ebb4`, P03 FAIL/HELD. A sucessão permanece explícita; esta sessão não assume autoridade de implementação.
- Reconciliação final: **C28 `d088708276b48f896ad4e0ecd2a95cb73dc413b1`**, publicado por a60 durante a sessão, incorpora Reports48 completo sob **QUALIFICATION HOLD**. A60 já possui ACK de sucessão; esta proposta não assume essa custódia.
- A branch de planejamento recebe apenas documentos. Ela não absorve candidatos por merge, não altera `sf2-stack`, não altera o briefing nem o plano canônico.

## Recomendações para autorização posterior

Aprovar a arquitetura de informação e a direção visual; autorizar primeiro **N0–N2 e um piloto vertical de Procurement**, com navegação real, contexto Microsoft, leitura autorizada, detalhe e revisão de uma ação canônica. A validação do piloto deverá ocorrer no GitHub Actions e produzir evidência do mesmo candidato.

Depois do aceite desse contrato e do piloto, liberar as famílias de tela em paralelo conforme o DAG. O piloto calibra custo e experiência; não reduz o produto a um MVP, não fecha o epic e não dispensa nenhuma obrigação canônica.

A autorização de execução deverá manter os gates existentes: M31/MI07, P03, Reports e admissão nativa/Relay não são resolvidos por uma aprovação visual. Ausência de serviço deve ter estado de UI honesto; não recebe um substituto permissivo.

## O que esta entrega demonstra

Demonstra uma proposta concreta, um inventário rastreável e uma ordem de execução. **Não demonstra implementação, readiness nativa, aprovação de testes ou fechamento de critérios.** Nenhum teste, typecheck, guard, servidor, deploy ou operação Azure foi executado nesta sessão. Renderização das pranchas e conferência documental não são validação do produto.
