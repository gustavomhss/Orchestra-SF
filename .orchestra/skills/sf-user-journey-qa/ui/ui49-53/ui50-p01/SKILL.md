---
name: sf-user-journey-qa-ui-ui49-53-ui50-p01
description: "QA manutenção SF: executar story SF-UI50-P01 (UI50: Entregar slides e documento que reproduzem revisão auditada) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI50-P01 ou o caso específico UI50: Entregar slides e documento que reproduzem revisão auditada"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI50-P01"
---
# SF-UI50-P01 — UI50: Entregar slides e documento que reproduzem revisão auditada

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI50 · **Jornadas:** J05.

**Entrada UI indicada:** `/orchestra/sf-reviews/reports/:reviewRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** REV-EXEC-NOV/R1 · report DOCX/PPTX

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero entregar slides e documento que reproduzem revisão auditada para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: REV-EXEC-NOV/R1 · report DOCX/PPTX. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir Reviews → Reports para reviewRef real R1 (/orchestra/sf-reviews/reports/:reviewRef); escolher seções e formato DOCX, acionar Prepare/Download; repetir PPTX como tentativa explícita separada.
3. **[UI_ACTION]** Observar preparing e download real, ou unavailable/outcome-unknown; a tela não tem jobRef, started/completed, cancel ou fila async, e prepare isolado não comprova entrega.
4. **[UI_ACTION]** Confirmar bytes DOCX/PPTX baixados no navegador, abrir externamente e calcular digest; controller de downloads autorizado é obrigatório.
5. **[READ_ONLY_WITNESS]** Conferir 25 projetos, valores e notas com R1
6. **[READ_ONLY_WITNESS]** Reabrir Reports no mesmo owner/reviewRef, registrar receipt de prepare, estado de recuperação e artefatos realmente baixados.

## Oráculos observáveis (não reescrever para passar)

- DOCX e PPTX realmente baixados existem, são legíveis e identificam R1
- Dados e ordem coincidem com snapshot, não com fonte atual
- Nova tentativa de download obedece grants atuais, sem prometer revogar bytes previamente baixados
- Preparação/preparing não equivale a completed; unavailable/outcome-unknown exige recuperação explícita, sem download fantasma
- Evidência liga reviewRef, seções, formato, owner, receipt de prepare, bytes/digest e resultado do navegador

**Fontes de teste existentes:** u33. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
