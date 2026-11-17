---
name: sf-user-journey-qa-cap-cap01-05-cap02-n01
description: "QA manutenção SF: executar story SF-CAP02-N01 (CAP02: contraprova — Dois tópicos de mesmo título e owners distint) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP02-N01 ou o caso específico CAP02: contraprova — Dois tópicos de mesmo título e owners distin"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP02-N01"
---
# SF-CAP02-N01 — CAP02: contraprova — Dois tópicos de mesmo título e owners distintos; encaminhar usando apenas o título

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** CAP02 · **Jornadas:** J01, J05.

**Entrada UI indicada:** `/orchestra/sf-dashboard/hot-topics` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** HOT-EDI-07 · atraso fictício 6 dias · responsável LEADER-Caio

**Resultado de negócio:** Como QA adversarial, quero desafiar Dashboard: Hot Topics & Actions no contexto HOT-EDI-07 · atraso fictício 6 dias · responsável LEADER-Caio para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP02-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Dois tópicos de mesmo título e owners distintos; encaminhar usando apenas o título

## Oráculos observáveis (não reescrever para passar)

- Aplicação exige referência opaca canônica e não associa o tópico errado
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Aplicação exige referência opaca canônica e não associa o tópico errado

**Fontes de teste existentes:** u38. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
