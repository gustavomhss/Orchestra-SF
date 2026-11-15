# Redesenho nativo Sucafina — plano revisto para execução paralela

**Somente planejamento.** O produto não foi implementado, testado ou liberado por esta PR. Esta revisão responde ao pedido de cold review adversarial e fatiamento agressivo, preservando o [briefing](PLANNING-BRIEF.md), a direção Sucafina primeiro e o plano canônico imutável.

## Decisão de produto

As quinze áreas Sucafina serão chapters reais da sidebar Orchestra: Hoje, Dashboard, Planner, Procurement, Portfólio, Decisões, Meu trabalho, Reuniões, Pessoas, Operações, Análises, Documentos, Importações, Memória e Rotinas. Chat e Inbox são apoio. O shell, a identidade visual, os providers, as autorizações, os domínios e a persistência continuam sendo os existentes.

A entrada respeita deep link e preferência pessoal autorizados; Hoje é o padrão quando não há preferência. A navegação conserva owner, seleção e draft conforme regras explícitas. Browser e desktop pertencem ao alvo; o transporte desktop tem uma entrega própria, sem fingir que `oc://renderer` funciona como a origem HTTP.

## O que mudou após o cold review

O plano anterior era uma proposta revisável, mas ainda deixava decisões de contrato, rotas, estados e fatiamento para os executores. A revisão identificou defeitos concretos de montagem HTTP, bootstrap, autenticação desktop, paridade de comandos e ownership. [COLD-REVIEW.md](COLD-REVIEW.md) registra evidência, correção e o limite de cada conclusão.

Esta edição acrescenta um pacote operacional com contratos fechados, rotas e ações por superfície, componentes compartilhados, ordens de trabalho com allowlists disjuntas e três dependências separadas: **para autorar, para integrar e para qualificar**. O piloto continua sendo gate de integração/rollout; não mantém autores independentes ociosos.

O número de ordens vem do [manifesto](execution/manifest.json); não é promessa de agentes simultâneos. O dispatcher existente admite todos os trabalhos prontos até a capacidade real, sem criar outro supervisor, outra fila ou outra política de CI.

## Como executar uma ordem quando houver autorização

1. Ler [EXECUTION-PROTOCOL.md](execution/EXECUTION-PROTOCOL.md) e a ficha exata em [work-orders](execution/work-orders).
2. Consumir somente os contratos, superfícies, campos e tasks pinados pela ficha. [CONTRACTS.md](execution/CONTRACTS.md), [COMPONENT-CONTRACTS.md](execution/COMPONENT-CONTRACTS.md), [component-signatures.ts](execution/component-signatures.ts) e [SURFACE-SPECS.md](execution/SURFACE-SPECS.md) são fontes únicas; não reinterpretar o conjunto de documentos como permissão de redesenho.
3. O integrador preenche fatos reais de lançamento: candidato, ator, branch, lease, capacidade e evidência de dependência. Esses campos não são decisões de produto em aberto.
4. Implementar apenas a allowlist; entregar fragmentos de registro ao integrador, sem editar arquivos compartilhados. Se um contrato estiver contraditório ou a fonte tiver mudado, registrar `BLOCKED_CONTRACT` com contraexemplo e continuar o restante independente.
5. Entregar o artefato e liberar capacidade conforme o protocolo. Integração e qualificação são estados distintos; fixture ou aparência não produzem aceite de produto.

## Ordem de leitura para revisão humana

| Objetivo | Fonte |
| --- | --- |
| Findings e fechamento | [COLD-REVIEW](COLD-REVIEW.md) |
| Organização e composição visual | [UX-DESIGN](UX-DESIGN.md), [SURFACE-SPECS](execution/SURFACE-SPECS.md), [pranchas conceituais](UX-BOARDS.pdf) |
| Fatiamento, dependências e ausência de colisões | [DELIVERY-PLAN](DELIVERY-PLAN.md), [manifesto](execution/manifest.json), [ordens](execution/work-orders) |
| Montagem, identidade e desktop | [API-AND-ISOLATION](API-AND-ISOLATION.md), [CONTRACTS](execution/CONTRACTS.md), [catálogo](execution/contract-catalog.json) |
| Tipos públicos e callbacks fechados | [Host/transporte](execution/host-signatures.ts), [componentes](execution/component-signatures.ts), [rotas](execution/route-signatures.ts) |
| Paridade de cada capacidade/ação | [SCREEN-INVENTORY](SCREEN-INVENTORY.md), [surface-manifest](execution/surface-manifest.json) |
| Migração e coexistência | [MIGRATION-AND-HANDOFFS](MIGRATION-AND-HANDOFFS.md) |
| Verificações e critérios herdados | [ACCEPTANCE](ACCEPTANCE.md), [TRACEABILITY](TRACEABILITY.md), [criteria-trace](criteria-trace.json) |

## Fonte de verdade e prevenção de divergência

O briefing e o canônico prevalecem. Para esta adaptação, contratos/rotas/ownership machine-readable e as especificações operacionais da pasta execution definem o trabalho. Os documentos superiores explicam essas decisões, não criam opções adicionais. Uma divergência entre fontes é finding bloqueante da parte afetada, nunca licença para o executor escolher a interpretação mais fácil.

As 17 pranchas originais são propostas com dados sintéticos. Sua identificação foi mantida para revisão; o adendo nelas aponta as correções normativas de entrada, BI e responsividade. Elas não são screenshots de produto nem a lista completa de controles. Cada campo, comando e estado executável vem da matriz operacional e de sua fonte pinada.

## Bases e limites

- Entrega inicialmente examinada: `2f143330a0a44d34eb764ebfb851804c504edb6d` na `sf-sidebar-plan`, PR76.
- Fontes originais: C27 `b10c424a6b318879fc30f11d03ba1cfeffda7d1a`, com reconciliação C28 `d088708276b48f896ad4e0ecd2a95cb73dc413b1`. [SOURCE-BASELINE](SOURCE-BASELINE.json) é o registro histórico dessa inspeção.
- Pin de stack observado nesta revisão: `faa30fddb7e7b61696b66fd069f51cf18c51125f`; não significa qualificação nem aceitação. Cada fonte nova mantém sua identidade nos catálogos e no relatório.
- Canônico preservado: `dbf9547211d9b0fade619790de7c19c0869b7c7d`, 15 WPs, 74 tasks e 1.610 critérios. Nenhum critério recebeu PASS por revisão documental.
- T0 e GLOBAL_RELEASE continuam os do canônico; esta frente não assume a custódia da stack, dos produtores ou do CI. A implementação continua dependente de autorização e leases explícitos.

Os bloqueios reais dos produtores e as provas finais continuam obrigatórios. A velocidade vem de trabalho disjunto, contratos estáveis e reaproveitamento válido de evidência — não de eliminar gates ou repetir testes sem mudança causal.
