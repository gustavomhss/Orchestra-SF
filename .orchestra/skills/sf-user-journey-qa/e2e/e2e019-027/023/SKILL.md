---
name: sf-user-journey-qa-e2e-e2e019-027-023
description: "QA manutenção SF: executar story SF-E2E-023 (Planilha adversarial não pode contaminar o orçamento) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-023 ou o caso específico Planilha adversarial não pode contaminar o orçamento"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-023"
---
# SF-E2E-023 — Planilha adversarial não pode contaminar o orçamento

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Outros atores:** AUDITOR · **Superfícies:** UI55, UI56, UI57 · **Jornadas:** J03.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Import XLSX MIME correto, arquivo XLSX com conteúdo CSV disfarçado e planilha com coluna Finance inválida.

**Resultado de negócio:** Como FINANCE, com apoio de AUDITOR, diante da situação descrita, preciso rejeitar arquivo malformado, duplicado e parcialmente válido sem commit parcial, para proteger dados financeiros e trilha de importação.

## Pré-condições específicas

- Import XLSX MIME correto, arquivo XLSX com conteúdo CSV disfarçado e planilha com coluna Finance inválida.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Preparar baseline sem nenhum novo lançamento
2. **[READ_ONLY_WITNESS]** Enviar XLSX legítimo e capturar manifest preview — requer file chooser/download habilitado no controlador de QA; Dock MCP sozinho não atende
3. **[UI_ACTION]** Cancelar sem Apply e comprovar banco imutável
4. **[UI_ACTION]** Enviar arquivo `.xlsx` com bytes inválidos — requer file chooser/download habilitado no controlador de QA; Dock MCP sozinho não atende
5. **[UI_ACTION]** Enviar workbook com header errado e linha duplicada — requer file chooser/download habilitado no controlador de QA; Dock MCP sozinho não atende
6. **[UI_ACTION]** Repetir com row válida e row inválida, sem autorizar partial
7. **[UI_ACTION]** Gerar nova prévia após corrigir e aplicar somente quando contratualmente admitido
8. **[UI_ACTION]** Auditor compara digests/receipts e contagem efetiva

## Oráculos observáveis (não reescrever para passar)

- Admissão inválida retorna erro sem efeitos
- Cancelamento de preview não escreve
- Aplicação válida tem fonte/versão/ID de attempt
- Erros de linha não são escondidos em sucesso agregado
- Se import exige all-valid, arquivo misto é rejeitado por inteiro

## Contraprovas

- Arquivo com macros não deve ser executado
- Upload em destino de outro principal deve ser negado

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
