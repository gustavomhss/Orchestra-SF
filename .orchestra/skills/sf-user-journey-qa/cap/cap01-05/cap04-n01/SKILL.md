---
name: sf-user-journey-qa-cap-cap01-05-cap04-n01
description: "QA manutenção SF: executar story SF-CAP04-N01 (CAP04: contraprova — FINANCE-B edita mesma linha no intervalo e FI) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP04-N01 ou o caso específico CAP04: contraprova — FINANCE-B edita mesma linha no intervalo e F"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP04-N01"
---
# SF-CAP04-N01 — CAP04: contraprova — FINANCE-B edita mesma linha no intervalo e FINANCE-A salva revisão velha

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** CAP04 · **Jornadas:** J01, J05.

**Entrada UI indicada:** `/orchestra/sf-dashboard/opex` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** OPEX-LIC-01 · USD 72000 → 84000 · centro de custo IT-OPS

**Resultado de negócio:** Como QA adversarial, quero desafiar Dashboard: OPEX Detail no contexto OPEX-LIC-01 · USD 72000 → 84000 · centro de custo IT-OPS para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP04-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Setup comprovável deste caso (não substituir por fixture imaginada)

1. FINANCE-A registra o versionRef real de WHATIF-A em Planner Versions e abre OPEX-LIC-01 no mesmo ano/período em Planner OPEX, anotando sourceVersion sem salvar.
2. FINANCE-B, em navegador autenticado independente, seleciona o mesmo versionRef/período e salva nova revisão da mesma linha em Planner OPEX.
3. FINANCE-A tenta salvar formulário stale; prova CAS, valor novo preservado e rascunho local sem alterar official.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** No Planner OPEX, ambos os usuários escolhem o mesmo versionRef de WHATIF-A; FINANCE-B salva a linha e FINANCE-A tenta salvar a revisão antiga, verificando CAS. O Dashboard não seleciona cenários.

## Oráculos observáveis (não reescrever para passar)

- Conflito CAS é visível, edição local é preservada e nada é sobrescrito
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Conflito CAS é visível, edição local é preservada e nada é sobrescrito

**Fontes de teste existentes:** u39, u40. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
