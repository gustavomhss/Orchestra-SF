---
name: sf-user-journey-qa-cap-cap26-28-cap26-p01
description: "QA manutenção SF: executar story SF-CAP26-P01 (CAP26: Deliberar em fila onde é o holder real) pela UI; ator APPROVER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP26-P01 ou o caso específico CAP26: Deliberar em fila onde é o holder real"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP26-P01"
---
# SF-CAP26-P01 — CAP26: Deliberar em fila onde é o holder real

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** APPROVER · **Superfícies:** CAP26 · **Jornadas:** J04.

**Entrada UI indicada:** `/orchestra/sf-procurement/approvals` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PR-32000 · Gabriel holder da etapa PR

**Resultado de negócio:** Como Gabriel, holder/aprovador Procurement, quero deliberar em fila onde é o holder real para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: PR-32000 · Gabriel holder da etapa PR. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Entrar como Gabriel no contexto correto
3. Abrir My approvals e localizar PR-32000 pendente
4. Analisar valores, etapa, histórico, fornecedor e orçamento
5. Aprovar com justificativa e conferir receipt/releitura
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Apenas holder atual recebe ação de aprovação
- Aprovação muda exatamente uma etapa, com audit
- Pedido some da fila pendente do mesmo holder
- Não emite PO nem aciona ERP externo automaticamente
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u13. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
