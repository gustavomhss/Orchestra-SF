---
name: sf-user-journey-qa-e2e-e2e019-027-024
description: "QA manutenção SF: executar story SF-E2E-024 (Relatório demorou: a UI não pode mentir) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-024 ou o caso específico Relatório demorou: a UI não pode mentir"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-024"
---
# SF-E2E-024 — Relatório demorou: a UI não pode mentir

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** AUDITOR · **Superfícies:** UI47, UI48, UI50 · **Jornadas:** J05.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Snapshot R1 de 25 projetos com DOCX/PPTX; worker de geração atrasado intencionalmente.

**Resultado de negócio:** Como CIO, com apoio de AUDITOR, diante da situação descrita, preciso executar geração lenta e observar timeout, falha, cancelamento e recuperação, para evitar informar êxito quando o documento não existe.

## Pré-condições específicas

- Review preservado R1 de 25 projetos; operações reviews.report.prepare e files.export.review instaladas. Falha de rede controlada somente com harness aprovado; não presumir worker assíncrono.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Inspecionar review preservado R1 e registrar reviewRef, seções e digest da fonte.
2. **[UI_ACTION]** Em Reviews → Reports de R1 selecionar seções/DOCX e acionar Prepare/Download, observando preparing; não buscar status started de job.
3. **[CONTROLLED_FAULT]** Injetar falha de rede controlada entre prepare e download apenas com harness QA autorizado; sem harness BLOCKED_ENVIRONMENT. Não simular worker inexistente. — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
4. **[READ_ONLY_WITNESS]** Reabrir a mesma rota/reviewRef no owner correto e inspecionar unavailable/outcome-unknown/Retry visível, sem inventar runRef ou página de jobs.
5. **[READ_ONLY_WITNESS]** Inspecionar se arquivo DOCX foi realmente baixado; sem bytes, não declarar completed. Exige controlador autorizado de downloads. — requer file chooser/download habilitado no controlador de QA; Dock MCP sozinho não atende
6. **[UI_ACTION]** Se houver Retry visível e correlação válida, executar uma única recuperação autorizada; não inventar Cancel nem iniciar nova preparação às cegas.
7. **[UI_ACTION]** Com transporte recuperado, observar download real; para PPTX iniciar seleção/tentativa separada, não afirmar recuperação de worker async.
8. **[READ_ONLY_WITNESS]** Conferir bytes/digest e conteúdo contra R1; registrar lifecycle async de jobRef/cancel/worker como BLOCKED_CAPABILITY enquanto não implementado.

## Oráculos observáveis (não reescrever para passar)

- Preparaçao/preparing nunca é prova de arquivo concluído; sem download nenhum completed legítimo
- UI50 atual não possui runRef, terminal de job, cancel ou worker async: a parte original desse lifecycle permanece BLOCKED_CAPABILITY, não PASS implícito
- Recuperação explícita usa correlação original; resultado incerto não autoriza retry cego
- Arquivo DOCX/PPTX baixado abre externamente e confere com R1
- Revogação posterior impede novo download, não apaga bytes já entregues

## Contraprovas

- UI indica sucesso de entrega sem bytes realmente baixados: FAIL
- Nova preparação sob outcome-unknown sem correlação/reconciliação: FAIL

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
