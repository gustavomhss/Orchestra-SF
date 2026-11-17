---
name: sf-user-journey-qa-ui-ui34-38-ui37-n01
description: "QA manutenção SF: executar story SF-UI37-N01 (UI37: contraprova — Enviar pergunta a homônimo Sofie de outro owne) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI37-N01 ou o caso específico UI37: contraprova — Enviar pergunta a homônimo Sofie de outro own"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI37-N01"
---
# SF-UI37-N01 — UI37: contraprova — Enviar pergunta a homônimo Sofie de outro owner

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** UI37 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions/:caseRef/questions` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** Q-EDI-FX-01 · finance owner Sofie

**Resultado de negócio:** Como QA adversarial, quero desafiar Perguntas e ciclos no contexto Q-EDI-FX-01 · finance owner Sofie para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI37-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Passos a executar na interface

1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Enviar pergunta a homônimo Sofie de outro owner
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

## Oráculos observáveis (não reescrever para passar)

- Referência do destinatário impede entrega ao principal errado
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Referência do destinatário impede entrega ao principal errado

**Fontes de teste existentes:** u17. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
