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

- Snapshot R1 de 25 projetos com DOCX/PPTX; worker de geração atrasado intencionalmente.

## Passos a executar na interface

1. Criar review R1 e registrar hash
2. Solicitar relatório e observar estado started
3. Simular worker travado por > timeout operacional
4. Reabrir job em sessão nova
5. Inspecionar se arquivo de saída realmente existe
6. Cancelar/reexecutar apenas conforme contrato e sem duplicação
7. Recuperar worker e gerar output válido
8. Conferir byte/hash final contra R1

## Oráculos observáveis (não reescrever para passar)

- Started nunca vira completed sem arquivo
- Timeout é diagnosticável com runRef e estado honesto
- Reexecução é autorizada, não retry cego
- Arquivo correto abre externamente e bate R1
- Revogação após geração impede download novo

## Contraprovas

- Relatório aponta URL sem arquivo: FAIL
- Worker cria arquivo mas audit/receipt não aponta digest: FAIL

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
