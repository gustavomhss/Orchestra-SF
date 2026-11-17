---
name: sf-user-journey-qa-ui-ui49-53-ui49-p01
description: "QA manutenção SF: executar story SF-UI49-P01 (UI49: Comparar duas revisões sem confundir mudança e ausência) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI49-P01 ou o caso específico UI49: Comparar duas revisões sem confundir mudança e ausência"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI49-P01"
---
# SF-UI49-P01 — UI49: Comparar duas revisões sem confundir mudança e ausência

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI49 · **Jornadas:** J05.

**Entrada UI indicada:** `/orchestra/sf-reviews/compare` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** REV-EXEC-NOV/R1 vs R2 · CAPEX P-009 → 91827

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero comparar duas revisões sem confundir mudança e ausência para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: REV-EXEC-NOV/R1 vs R2 · CAPEX P-009 → 91827. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Selecionar R1 e R2 com competências conhecidas
3. **[READ_ONLY_WITNESS]** Comparar projetos, números e notas
4. **[READ_ONLY_WITNESS]** Conferir diferença entre zero, null, ausência e 91827
5. **[READ_ONLY_WITNESS]** Abrir detalhe de uma mudança e verificar origem
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Deltas têm unidade e sinais corretos
- Mudança só textual é identificada separadamente
- Comparação incompatível é declarada, não somada
- Fontes e timestamps preservados
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u32. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
