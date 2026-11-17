---
name: sf-user-journey-qa-groups-imports
description: "Grupo de manutenção SF imports: Importações e documentos. Mudanças em upload/preview/Apply, evidências e exportações."
internal: true
when: "Quando o QA solicitar grupo imports ou mudança em Importações e documentos"
not-when: "Outro domínio ou uma única story; abra o grupo correto ou folha individual"
---
# Importações e documentos

**Uso:** QA/manutenção interna. **Não iniciar ao carregar a skill:** esta folha define a seleção; só executar stories quando houver ordem explícita de execução do grupo.

**Quando selecionar:** Mudanças em upload/preview/Apply, evidências e exportações.

**Tamanho:** 20 stories; nenhum roteiro foi executado por esta lista.

## Ordem sugerida (skill individual por story)

1. **SF-UI55-P01** · `sf-user-journey-qa-ui-ui54-58-ui55-p01` · UI55: Carregar workbook de TI com prévia segura e auditável (P0)
2. **SF-UI55-N01** · `sf-user-journey-qa-ui-ui54-58-ui55-n01` · UI55: contraprova — Enviar arquivo com macro, extensão falsa ou MIME incorreto (P0)
3. **SF-UI56-P01** · `sf-user-journey-qa-ui-ui54-58-ui56-p01` · UI56: Decidir o impacto de um import antes de aplicar (P0)
4. **SF-UI56-N01** · `sf-user-journey-qa-ui-ui54-58-ui56-n01` · UI56: contraprova — Modificar linha fonte após preview e confirmar versão stale (P0)
5. **SF-UI57-P01** · `sf-user-journey-qa-ui-ui54-58-ui57-p01` · UI57: Comprovar que uma importação aplicou uma só vez (P0)
6. **SF-UI57-N01** · `sf-user-journey-qa-ui-ui54-58-ui57-n01` · UI57: contraprova — Repetir Apply com mesmo attempt ID e payload alterado (P0)
7. **SF-UI58-P01** · `sf-user-journey-qa-ui-ui54-58-ui58-p01` · UI58: Registrar documento com fonte e classificação adequadas (P0)
8. **SF-UI58-N01** · `sf-user-journey-qa-ui-ui54-58-ui58-n01` · UI58: contraprova — Enviar documento de outro tenant ou formato não aceito (P0)
9. **SF-UI59-P01** · `sf-user-journey-qa-ui-ui59-63-ui59-p01` · UI59: Validar trechos extraídos antes de usá-los como evidência (P0)
10. **SF-UI59-N01** · `sf-user-journey-qa-ui-ui59-63-ui59-n01` · UI59: contraprova — Extração atribui prazo de 60 dias por leitura errada do documento (P0)
11. **SF-UI60-P01** · `sf-user-journey-qa-ui-ui59-63-ui60-p01` · UI60: Usar somente evidências confirmadas em cenário (P0)
12. **SF-UI60-N01** · `sf-user-journey-qa-ui-ui59-63-ui60-n01` · UI60: contraprova — Usar trecho pending como razão para aprovação (P0)
13. **SF-UI68-P01** · `sf-user-journey-qa-ui-ui64-68-ui68-p01` · UI68: Exportar informação de compras preservando autorização e efeito comprovado (P0)
14. **SF-UI68-N01** · `sf-user-journey-qa-ui-ui64-68-ui68-n01` · UI68: contraprova — Buyer perde grant de fornecedor após gerar export (P0)
15. **SF-E2E-005** · `sf-user-journey-qa-e2e-e2e001-009-005` · A importação foi aplicada, mas a confirmação não chegou (P0)
16. **SF-E2E-006** · `sf-user-journey-qa-e2e-e2e001-009-006` · O documento diz 6 dias; a extração sugere 60 (P0)
17. **SF-E2E-023** · `sf-user-journey-qa-e2e-e2e019-027-023` · Planilha adversarial não pode contaminar o orçamento (P0)
18. **SF-E2E-033** · `sf-user-journey-qa-e2e-e2e028-036-033` · O servidor reiniciou, o recibo continua sendo o mesmo (P0)
19. **SF-E2E-039** · `sf-user-journey-qa-e2e-e2e037-045-039` · 403, 422 e 503 têm significados diferentes (P0)
20. **SF-E2E-043** · `sf-user-journey-qa-e2e-e2e037-045-043` · A rede caiu no momento do Apply (P0)

## Protocolo deste grupo

1. Carregue `sf-user-journey-qa` (protocolo compartilhado) e identifique a versão instalada, os atores e a fixture isolada. Navegue via as skills CAP/UI/E2E existentes (não copie seus passos). O instrumento `skill` aceita o **nome exato** da folha; alternativamente percorra o índice `Next level` quando for mais conveniente.
2. **Execute só as stories deste grupo**, na ordem acima, uma tentativa por story. Antes de cada uma, comprovar precondições e isolamento; se uma story depende de uma transação anterior, use estado autorizado e documentado, nunca mutação oculta.
3. Em falha P0, interromper o grupo e reportar o restante `NOT_RUN`/`BLOCKED`, a menos que o QA tenha autorizado diagnóstico mais amplo. Para recurso condicional não promovido, marcar `BLOCKED_CAPABILITY` e seguir apenas casos independentes.
4. Registre status e evidência por story, nunca um PASS único para o grupo. O grupo só é `PASS` se todas as stories exigidas foram verificadas na mesma campanha/ambiente/versão, com evidências; não deduzir de testes estáticos.

**Sem execução implícita de outros grupos, sem novo runner, sem bypass de UX.**
