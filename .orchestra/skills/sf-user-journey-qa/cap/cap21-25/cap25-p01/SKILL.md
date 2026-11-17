---
name: sf-user-journey-qa-cap-cap21-25-cap25-p01
description: "QA manutenção SF: executar story SF-CAP25-P01 (CAP25: Abrir requisição para integração de cargas e acompanhar PR→) pela UI; ator REQUESTER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP25-P01 ou o caso específico CAP25: Abrir requisição para integração de cargas e acompanhar PR"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP25-P01"
---
# SF-CAP25-P01 — CAP25: Abrir requisição para integração de cargas e acompanhar PR→PO

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** REQUESTER · **Superfícies:** CAP25 · **Jornadas:** J04.

**Entrada UI indicada:** `/orchestra/sf-procurement/requests` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PR-32000 · pedido USD 32000 · CC IT-BR

**Resultado de negócio:** Como Caio, requester Procurement, quero abrir requisição para integração de cargas e acompanhar PR→PO para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: PR-32000 · pedido USD 32000 · CC IT-BR. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Criar requisição PR-32000 com item e justificativa da integração EDI
3. **[UI_ACTION]** Salvar draft, reler e submeter PR
4. **[UI_ACTION]** Entrar como Buyer e consultar sourcing somente após etapa admitida
5. **[READ_ONLY_WITNESS]** Conferir histórico e relação com contrato CON-042
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Ciclo draft→pr_pending aparece com receipt
- Requester não ganha privilégio de Buyer ou approver
- Valores/unidade e centro de custo persistem
- Novo estágio tem histórico e revisão
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u12. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
