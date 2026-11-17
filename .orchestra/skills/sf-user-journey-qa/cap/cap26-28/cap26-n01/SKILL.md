---
name: sf-user-journey-qa-cap-cap26-28-cap26-n01
description: "QA manutenção SF: executar story SF-CAP26-N01 (CAP26: contraprova — Buyer Pedro tenta aprovar a etapa do holder G) pela UI; ator APPROVER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP26-N01 ou o caso específico CAP26: contraprova — Buyer Pedro tenta aprovar a etapa do holder "
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP26-N01"
---
# SF-CAP26-N01 — CAP26: contraprova — Buyer Pedro tenta aprovar a etapa do holder Gabriel por URL direta

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** APPROVER · **Superfícies:** CAP26 · **Jornadas:** J04.

**Entrada UI indicada:** `/orchestra/sf-procurement/approvals` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PR-32000 · Gabriel holder da etapa PR

**Resultado de negócio:** Como QA adversarial, quero desafiar Procurement: My approvals no contexto PR-32000 · Gabriel holder da etapa PR para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP26-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Passos a executar na interface

1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Buyer Pedro tenta aprovar a etapa do holder Gabriel por URL direta
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

## Oráculos observáveis (não reescrever para passar)

- 403, nenhuma mudança de estado, audit de aplicação ausente
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- 403, nenhuma mudança de estado, audit de aplicação ausente

**Fontes de teste existentes:** u13. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
