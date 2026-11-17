---
name: sf-user-journey-qa-ui-ui54-58-ui57-n01
description: "QA manutenção SF: executar story SF-UI57-N01 (UI57: contraprova — Repetir Apply com mesmo attempt ID e payload a) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI57-N01 ou o caso específico UI57: contraprova — Repetir Apply com mesmo attempt ID e payload "
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI57-N01"
---
# SF-UI57-N01 — UI57: contraprova — Repetir Apply com mesmo attempt ID e payload alterado

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** UI57 · **Jornadas:** J03.

**Entrada UI indicada:** `/orchestra/sf-imports/:manifestId/receipt` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** IMPORT-OPEX-SEP26 · manifest digest M1 · attempt A1

**Resultado de negócio:** Como QA adversarial, quero desafiar Aplicação/recibo de import no contexto IMPORT-OPEX-SEP26 · manifest digest M1 · attempt A1 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI57-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Setup comprovável deste caso (não substituir por fixture imaginada)

1. Preparar import válido em QA com attempt/idempotencyKey real e um Apply autorizado concluído; registrar recibo e digest.
2. Repetição com payload divergente só pode ocorrer se a UI oferece essa ação ou via harness de falha já aprovado; nunca fabricar HTTP à mão como teste de usuário.
3. Conferir recibo original e ausência de segundo efeito; se não houver meio autorizado de replay, BLOQUEAR o subcaso.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Repetir Apply com mesmo attempt ID e payload alterado

## Oráculos observáveis (não reescrever para passar)

- Rejeitar colisão de idempotency, mantendo receipt anterior e zero novo commit
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Rejeitar colisão de idempotency, mantendo receipt anterior e zero novo commit

**Fontes de teste existentes:** u23. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
