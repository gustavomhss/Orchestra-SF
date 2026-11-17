---
name: sf-user-journey-qa-cap-cap16-20-cap19-n01
description: "QA manutenção SF: executar story SF-CAP19-N01 (CAP19: contraprova — Inserir segunda linha com mesmo ID e combinaç) pela UI; ator BUDGET_OWNER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP19-N01 ou o caso específico CAP19: contraprova — Inserir segunda linha com mesmo ID e combina"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP19-N01"
---
# SF-CAP19-N01 — CAP19: contraprova — Inserir segunda linha com mesmo ID e combinação de período

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** BUDGET_OWNER · **Superfícies:** CAP19 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-planner/capex` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CAPEX-SCANNER-01 · 91827 USD · 2027 · P-009

**Resultado de negócio:** Como QA adversarial, quero desafiar Planner: CAPEX no contexto CAPEX-SCANNER-01 · 91827 USD · 2027 · P-009 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP19-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Passos a executar na interface

1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Inserir segunda linha com mesmo ID e combinação de período
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

## Oráculos observáveis (não reescrever para passar)

- Detecta duplicata ou exige novo ID sem duplicar projeção
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Detecta duplicata ou exige novo ID sem duplicar projeção

**Fontes de teste existentes:** u07, u48. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
