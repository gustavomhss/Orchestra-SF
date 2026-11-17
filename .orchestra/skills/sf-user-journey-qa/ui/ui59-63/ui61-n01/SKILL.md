---
name: sf-user-journey-qa-ui-ui59-63-ui61-n01
description: "QA manutenção SF: executar story SF-UI61-N01 (UI61: contraprova — Limiar ausente e sinal com unidade diferente) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI61-N01 ou o caso específico UI61: contraprova — Limiar ausente e sinal com unidade diferente"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI61-N01"
---
# SF-UI61-N01 — UI61: contraprova — Limiar ausente e sinal com unidade diferente

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** UI61 · **Jornadas:** J07.

**Entrada UI indicada:** `/orchestra/sf-memory/signals` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SIG-EDI-07 · atraso de 6 dias vs limiar 3

**Resultado de negócio:** Como QA adversarial, quero desafiar Sinais/materialidade no contexto SIG-EDI-07 · atraso de 6 dias vs limiar 3 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI61-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Passos a executar na interface

1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Limiar ausente e sinal com unidade diferente
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

## Oráculos observáveis (não reescrever para passar)

- Classificação fica indeterminada, sem severidade fabricada
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Classificação fica indeterminada, sem severidade fabricada

**Fontes de teste existentes:** u26. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
