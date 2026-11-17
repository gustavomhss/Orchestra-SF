---
name: sf-user-journey-qa-ui-ui64-68-ui67-n01
description: "QA manutenção SF: executar story SF-UI67-N01 (UI67: contraprova — OIDC assinado de tenant errado, CSRF inválido,) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI67-N01 ou o caso específico UI67: contraprova — OIDC assinado de tenant errado, CSRF inválido"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI67-N01"
---
# SF-UI67-N01 — UI67: contraprova — OIDC assinado de tenant errado, CSRF inválido, nonce ou code replay

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI67 · **Jornadas:** J08.

**Entrada UI indicada:** `/orchestra/sf-home/context` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** OIDC resource tenant · project SF-LAB · owner CIO

**Resultado de negócio:** Como QA adversarial, quero desafiar Login/contexto/acesso no contexto OIDC resource tenant · project SF-LAB · owner CIO para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI67-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Setup comprovável deste caso (não substituir por fixture imaginada)

1. Usar tenant e identidades de QA distintos; congelar o SHA C e capturar estado sem sessão protegida.
2. Nonce/CSRF/code replay ou JWT de tenant errado só podem ser produzidos pelo harness de identidade/OIDC aprovado em ambiente isolado; o Dock não gera tokens.
3. Conferir negação no host, nenhuma sessão válida e ausência de dados/owner de outro tenant; bloquear se o harness autorizado não estiver presente.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[CONTROLLED_FAULT]** OIDC assinado de tenant errado, CSRF inválido, nonce ou code replay — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT

## Oráculos observáveis (não reescrever para passar)

- Autenticação falha fechada, sem sessão válida nem troca de owner
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Autenticação falha fechada, sem sessão válida nem troca de owner

**Fontes de teste existentes:** u01-host231, shell-guard237. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
