---
name: sf-user-journey-qa-cap-cap16-20-cap18-n01
description: "QA manutenção SF: executar story SF-CAP18-N01 (CAP18: contraprova — Dois usuários alteram mesma linha e período e) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP18-N01 ou o caso específico CAP18: contraprova — Dois usuários alteram mesma linha e período "
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP18-N01"
---
# SF-CAP18-N01 — CAP18: contraprova — Dois usuários alteram mesma linha e período em A

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** CAP18 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-planner/opex` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** OPEX-LIC-01 · 72000 baseline / 84000 A / 78000 B USD

**Resultado de negócio:** Como QA adversarial, quero desafiar Planner: OPEX no contexto OPEX-LIC-01 · 72000 baseline / 84000 A / 78000 B USD para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP18-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Passos a executar na interface

1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Dois usuários alteram mesma linha e período em A
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

## Oráculos observáveis (não reescrever para passar)

- Segundo save stale não sobrescreve o primeiro
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Segundo save stale não sobrescreve o primeiro

**Fontes de teste existentes:** u07, u48. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
