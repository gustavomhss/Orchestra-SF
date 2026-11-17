---
name: sf-user-journey-qa-ui-ui34-38-ui35-n01
description: "QA manutenção SF: executar story SF-UI35-N01 (UI35: contraprova — FX do período deixa de existir antes da compar) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI35-N01 ou o caso específico UI35: contraprova — FX do período deixa de existir antes da compa"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI35-N01"
---
# SF-UI35-N01 — UI35: contraprova — FX do período deixa de existir antes da comparação

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI35 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions/:caseRef/alternatives` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** ALT-A 32400 USD · ALT-B 28000 EUR×1.08 · ALT-C 29000 USD ineligible

**Resultado de negócio:** Como QA adversarial, quero desafiar Alternativas e comparação no contexto ALT-A 32400 USD · ALT-B 28000 EUR×1.08 · ALT-C 29000 USD ineligible para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI35-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** FX do período deixa de existir antes da comparação

## Oráculos observáveis (não reescrever para passar)

- B fica incomparável e a UI não substitui por taxa atual arbitrária
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- B fica incomparável e a UI não substitui por taxa atual arbitrária

**Fontes de teste existentes:** u17. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
