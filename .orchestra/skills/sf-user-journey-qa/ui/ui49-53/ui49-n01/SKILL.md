---
name: sf-user-journey-qa-ui-ui49-53-ui49-n01
description: "QA manutenção SF: executar story SF-UI49-N01 (UI49: contraprova — Comparar R1 USD setembro com R2 EUR outubro se) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI49-N01 ou o caso específico UI49: contraprova — Comparar R1 USD setembro com R2 EUR outubro s"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI49-N01"
---
# SF-UI49-N01 — UI49: contraprova — Comparar R1 USD setembro com R2 EUR outubro sem FX declarada

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI49 · **Jornadas:** J05.

**Entrada UI indicada:** `/orchestra/sf-reviews/compare` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** REV-EXEC-NOV/R1 vs R2 · CAPEX P-009 → 91827

**Resultado de negócio:** Como QA adversarial, quero desafiar Comparar revisões no contexto REV-EXEC-NOV/R1 vs R2 · CAPEX P-009 → 91827 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI49-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Comparar R1 USD setembro com R2 EUR outubro sem FX declarada

## Oráculos observáveis (não reescrever para passar)

- Comparação financeira é classificada incompatível ou explicitamente convertida conforme contrato
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Comparação financeira é classificada incompatível ou explicitamente convertida conforme contrato

**Fontes de teste existentes:** u32. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
