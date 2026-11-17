---
name: sf-user-journey-qa-ui-ui29-33-ui30-n01
description: "QA manutenção SF: executar story SF-UI30-N01 (UI30: contraprova — Trocar conta/tenant enquanto Meu trabalho está) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI30-N01 ou o caso específico UI30: contraprova — Trocar conta/tenant enquanto Meu trabalho est"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI30-N01"
---
# SF-UI30-N01 — UI30: contraprova — Trocar conta/tenant enquanto Meu trabalho está aberto

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** UI30 · **Jornadas:** J01, J06.

**Entrada UI indicada:** `/orchestra/sf-work` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** WORK-Caio · HOT-EDI-07 · TASK-023 · OPEX-LIC-01

**Resultado de negócio:** Como QA adversarial, quero desafiar Meu trabalho no contexto WORK-Caio · HOT-EDI-07 · TASK-023 · OPEX-LIC-01 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI30-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Passos a executar na interface

1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Trocar conta/tenant enquanto Meu trabalho está aberto
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

## Oráculos observáveis (não reescrever para passar)

- Lista e cache da identidade anterior são invalidados imediatamente
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Lista e cache da identidade anterior são invalidados imediatamente

**Fontes de teste existentes:** u41. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
