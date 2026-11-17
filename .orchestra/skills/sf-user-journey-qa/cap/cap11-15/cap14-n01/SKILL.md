---
name: sf-user-journey-qa-cap-cap11-15-cap14-n01
description: "QA manutenção SF: executar story SF-CAP14-N01 (CAP14: contraprova — Fornecedor é desativado após contrato entrar ) pela UI; ator BUYER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP14-N01 ou o caso específico CAP14: contraprova — Fornecedor é desativado após contrato entrar"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP14-N01"
---
# SF-CAP14-N01 — CAP14: contraprova — Fornecedor é desativado após contrato entrar em revisão

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** BUYER · **Superfícies:** CAP14 · **Jornadas:** J04.

**Entrada UI indicada:** `/orchestra/sf-procurement/contracts` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CON-042 · fornecedor SUP-003 · renovação 2027-02-01

**Resultado de negócio:** Como QA adversarial, quero desafiar Dashboard: Vendor Contracts no contexto CON-042 · fornecedor SUP-003 · renovação 2027-02-01 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP14-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Fornecedor é desativado após contrato entrar em revisão

## Oráculos observáveis (não reescrever para passar)

- UI sinaliza impedimento e produtor rejeita novo compromisso inelegível
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- UI sinaliza impedimento e produtor rejeita novo compromisso inelegível

**Fontes de teste existentes:** u15. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
