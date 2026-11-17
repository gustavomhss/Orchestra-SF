---
name: sf-user-journey-qa-cap-cap26-28-cap26-n01
description: "QA manutenção SF: executar story SF-CAP26-N01 (CAP26: contraprova — Buyer Pedro tenta aprovar a etapa do holder G) pela UI; ator APPROVER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP26-N01 ou o caso específico CAP26: contraprova — Buyer Pedro tenta aprovar a etapa do holder "
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP26-N01"
---
# SF-CAP26-N01 — CAP26: contraprova — Buyer Pedro tenta aprovar a etapa do holder Gabriel por URL direta

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** APPROVER · **Superfícies:** CAP26 · **Jornadas:** J04.

**Entrada UI indicada:** `/orchestra/sf-procurement/approvals` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PR-32000 · Gabriel holder da etapa PR

**Resultado de negócio:** Como QA adversarial, quero desafiar Procurement: My approvals no contexto PR-32000 · Gabriel holder da etapa PR para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP26-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Setup comprovável deste caso (não substituir por fixture imaginada)

1. Criar ou localizar PR sintética em pr_pending com holderRef apontando para Gabriel e capturar o estágio e versão pela UI.
2. Autenticar Pedro em outro perfil, confirmar papel buyer e ausência de papel holder nesta etapa; abrir URL autorizada somente para seu próprio perfil.
3. Tentar aprovação no controle visível ou deep link; confirmar negação real e ausência de etapa/histórico novo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Buyer Pedro tenta aprovar a etapa do holder Gabriel por URL direta

## Oráculos observáveis (não reescrever para passar)

- 403, nenhuma mudança de estado, audit de aplicação ausente
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- 403, nenhuma mudança de estado, audit de aplicação ausente

**Fontes de teste existentes:** u13. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
