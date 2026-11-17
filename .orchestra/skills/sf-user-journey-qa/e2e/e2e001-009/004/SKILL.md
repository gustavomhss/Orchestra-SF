---
name: sf-user-journey-qa-e2e-e2e001-009-004
description: "QA manutenção SF: executar story SF-E2E-004 (Reunião preservada enquanto o sistema continua mudando) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-004 ou o caso específico Reunião preservada enquanto o sistema continua mudando"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-004"
---
# SF-E2E-004 — Reunião preservada enquanto o sistema continua mudando

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** LEADER, AUDITOR · **Superfícies:** UI47, UI48, UI49, UI50, CAP09, UI51 · **Jornadas:** J05, J06, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · CIO prepara reunião com 25 projetos, notas extensas, períodos mistos e snapshot R1.

**Resultado de negócio:** Como CIO, com apoio de LEADER, AUDITOR, diante da situação descrita, preciso guardar a fotografia dos 25 projetos e reproduzi-la após os registros vivos mudarem, para comprovar exatamente o que foi discutido sem reescrever o passado.

## Pré-condições específicas

- CIO prepara reunião com 25 projetos, notas extensas, períodos mistos e snapshot R1.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** CIO escolhe pauta com projetos P-001...P-025 e budget/risco
2. **[UI_ACTION]** Preserva R1 e registra digest e ordem dos 25 projetos
3. **[UI_ACTION]** Caio altera fonte do projeto P-004 e uma nota longa
4. **[UI_ACTION]** CIO reabre R1 em modo apresentação sem recapturar
5. **[UI_ACTION]** Cria R2 com mudanças explicitadas
6. **[UI_ACTION]** Compara R1/R2 distinguindo campos e comentário
7. **[UI_ACTION]** Gera DOCX e PPTX da R1 e abre os arquivos
8. **[UI_ACTION]** Auditor compara o conteúdo exportado ao snapshot R1, não ao estado de hoje

## Oráculos observáveis (não reescrever para passar)

- R1 contém 25 projetos uma vez, com texto longo sem truncamento silencioso
- P-004 em R1 mantém valor e nota anteriores à mutação
- R2 registra delta, sem reescrever R1
- Arquivos DOCX/PPTX têm bytes reais, hash e autoria
- Revisão misturando competências exibe cada rótulo
- Export não libera source private após revogação

## Contraprovas

- Atualizar fonte após gerar relatório não altera R1
- Revogar leitor durante download impede extração nova de bytes

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
