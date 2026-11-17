---
name: sf-user-journey-qa-e2e-e2e001-009-005
description: "QA manutenção SF: executar story SF-E2E-005 (A importação foi aplicada, mas a confirmação não chegou) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-005 ou o caso específico A importação foi aplicada, mas a confirmação não chegou"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-005"
---
# SF-E2E-005 — A importação foi aplicada, mas a confirmação não chegou

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Outros atores:** LEADER, AUDITOR · **Superfícies:** UI55, UI56, UI57, UI68, CAP18 · **Jornadas:** J03, J01.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Import planner XLSX alinhado à coluna OPEX; renovação 72000→84000; não editar o 518000 inalterado.

**Resultado de negócio:** Como FINANCE, com apoio de LEADER, AUDITOR, diante da situação descrita, preciso aplicar uma única importação de OPEX, perder a resposta e reconciliar o recibo, para evitar dupla gravação financeira após timeout.

## Pré-condições específicas

- Import planner XLSX alinhado à coluna OPEX; renovação 72000→84000; não editar o 518000 inalterado.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Sofie exporta versão de Planner com linha renewal72000 e fixed518000
2. **[UI_ACTION]** Modifica workbook somente na célula permitida para 84000 — requer file chooser/download habilitado no controlador de QA; Dock MCP sozinho não atende
3. **[UI_ACTION]** Seleciona destino real e admite arquivo com MIME XLSX correto — requer file chooser/download habilitado no controlador de QA; Dock MCP sozinho não atende
4. **[UI_ACTION]** Revisa preview, digest, before/after e zero efeitos prévios
5. **[UI_ACTION]** Confirma Apply uma vez usando attempt ID e versão fixados
6. **[CONTROLLED_FAULT]** QA intercepta apenas entrega da resposta após producer commit — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
7. **[UI_ACTION]** Sofie aciona recuperação por attempt original sem reenviar Apply
8. **[UI_ACTION]** Auditor compara tokens antes/depois e recibo original
9. **[UI_ACTION]** Testa reabrir import em sessão nova e exportar versão

## Oráculos observáveis (não reescrever para passar)

- Apenas renewal muda 72000→84000; fixed permanece 518000
- Preview não altera source nem tokens
- Exatamente uma transação, mesmo com perda da resposta
- Recibo recuparado refere mesmo manifest/attempt
- A reexportação reconcilia valores e versões
- Se arquivo não for admitido pelo produtor, o status é BLOCKED com código real e não efeito simulado

## Contraprovas

- Tentar reaplicar com mesmo attempt e payload diferente: falha sem commit
- Trocar base depois de preview: CAS impede efeito parcial

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
