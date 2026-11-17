---
name: sf-user-journey-qa-e2e-e2e019-027-025
description: "QA manutenção SF: executar story SF-E2E-025 (25 projetos, notas longas e apresentação acessível) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-025 ou o caso específico 25 projetos, notas longas e apresentação acessível"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-025"
---
# SF-E2E-025 — 25 projetos, notas longas e apresentação acessível

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** AUDITOR · **Superfícies:** UI47, UI48, UI49, UI50 · **Jornadas:** J05, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Pauta R1 com 25 projetos, 6 seções, notas multilinha e valores null/zero.

**Resultado de negócio:** Como CIO, com apoio de AUDITOR, diante da situação descrita, preciso capturar, navegar e exportar relatório volumoso em múltiplas larguras, para levar uma reunião executiva completa sem perda ou duplicação de conteúdo.

## Pré-condições específicas

- Pauta R1 com 25 projetos, 6 seções, notas multilinha e valores null/zero.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Criar 25 projetos ordenados e abrir pauta
2. **[UI_ACTION]** Selecionar seis seções com competências distintas
3. **[READ_ONLY_WITNESS]** Capturar R1 e comparar 25 projetos na apresentação
4. **[UI_ACTION]** Rodar zoom 200 e 400% em browser e teclado
5. **[UI_ACTION]** Abrir em viewport 320, 768 e 1440 px
6. **[READ_ONLY_WITNESS]** Exportar DOCX/PPTX e inspecionar texto longo
7. **[UI_ACTION]** Executar comparação R1/R2 depois de alterar uma nota
8. **[UI_ACTION]** Rever autorização com auditor externo

## Oráculos observáveis (não reescrever para passar)

- Sem perder projeto por paginação ou trunca silenciosa
- Tabulação e foco permanecem acessíveis
- Notação null/zero distinta na comparação
- Presentation e Office refletem R1, não fonte atual
- Se viewport necessitar scroll horizontal de tabela, container é controlado sem overflow da página

## Contraprovas

- Carregar projeto com emoji/acento e 3 mil caracteres de nota: texto escapa e não injeta HTML
- Acesso revogado impede abrir apresentação antiga

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
