---
name: sf-user-journey-qa-ui-ui64-68-ui68-n01
description: "QA manutenção SF: executar story SF-UI68-N01 (UI68: contraprova — Buyer perde grant de fornecedor após gerar exp) pela UI; ator BUYER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI68-N01 ou o caso específico UI68: contraprova — Buyer perde grant de fornecedor após gerar ex"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI68-N01"
---
# SF-UI68-N01 — UI68: contraprova — Buyer perde grant de fornecedor após gerar export

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** BUYER · **Superfícies:** UI68 · **Jornadas:** J03.

**Entrada UI indicada:** `/orchestra/sf-imports/exports` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** EXPORT-PR-32000 · PO-EDI-01

**Resultado de negócio:** Como QA adversarial, quero desafiar Exports de dados/PO no contexto EXPORT-PR-32000 · PO-EDI-01 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI68-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Setup comprovável deste caso (não substituir por fixture imaginada)

1. Buyer autorizado gera export sintético e captura apenas a referência/hashes não sensíveis.
2. Administrador do ambiente de QA revoga grant em sessão realmente separada por interface autorizada; registrar revisão da policy.
3. Buyer tenta baixar export anterior; revalidar autorização no servidor e negar bytes novos, sem usar apenas ocultação de link como prova.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Buyer perde grant de fornecedor após gerar export

## Oráculos observáveis (não reescrever para passar)

- Revalidação bloqueia download do arquivo antigo e não vaza dados bancários
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Revalidação bloqueia download do arquivo antigo e não vaza dados bancários

**Fontes de teste existentes:** u23. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
