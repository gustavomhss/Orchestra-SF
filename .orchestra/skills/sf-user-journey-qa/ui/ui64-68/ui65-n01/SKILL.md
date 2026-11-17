---
name: sf-user-journey-qa-ui-ui64-68-ui65-n01
description: "QA manutenção SF: executar story SF-UI65-N01 (UI65: contraprova — Provider responde output incompleto e run acab) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI65-N01 ou o caso específico UI65: contraprova — Provider responde output incompleto e run aca"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI65-N01"
---
# SF-UI65-N01 — UI65: contraprova — Provider responde output incompleto e run acaba failed

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI65 · **Jornadas:** J07.

**Entrada UI indicada:** `/orchestra/sf-routines/runs/:runRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** RUN-EDI-RISK-01 · recipe ROUTINE-EDI-RISK-v1

**Resultado de negócio:** Como QA adversarial, quero desafiar Execução/resultado de rotina no contexto RUN-EDI-RISK-01 · recipe ROUTINE-EDI-RISK-v1 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI65-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Passos a executar na interface

1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Provider responde output incompleto e run acaba failed
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

## Oráculos observáveis (não reescrever para passar)

- UI apresenta erro honesto sem elevar recomendação a approved
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- UI apresenta erro honesto sem elevar recomendação a approved

**Fontes de teste existentes:** u27. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
