---
name: sf-user-journey-qa-cap-cap21-25-cap23-n01
description: "QA manutenção SF: executar story SF-CAP23-N01 (CAP23: contraprova — Contribuidor tenta publicar versão official s) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP23-N01 ou o caso específico CAP23: contraprova — Contribuidor tenta publicar versão official "
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP23-N01"
---
# SF-CAP23-N01 — CAP23: contraprova — Contribuidor tenta publicar versão official sem autorização

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** CAP23 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-planner/versions` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** V-2026-OFFICIAL locked; V-2026-WHATIF-A/B

**Resultado de negócio:** Como QA adversarial, quero desafiar Planner: Versions no contexto V-2026-OFFICIAL locked; V-2026-WHATIF-A/B para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP23-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Em Planner Versions localizar versionRef official e os grants do contribuinte; tentar ação Official só se a UI a apresentar. Com botão negado/desabilitado, provar estado da fonte intacto sem forjar escrita por API ou afirmar produtor testado.

## Oráculos observáveis (não reescrever para passar)

- Negação explícita e nenhuma alteração no snapshot oficial
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Negação explícita e nenhuma alteração no snapshot oficial

**Fontes de teste existentes:** u46. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
