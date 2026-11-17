---
name: sf-user-journey-qa-ui-ui39-43-ui39-p01
description: "QA manutenção SF: executar story SF-UI39-P01 (UI39: Aplicar somente mudança preparada com dupla checagem) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI39-P01 ou o caso específico UI39: Aplicar somente mudança preparada com dupla checagem"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI39-P01"
---
# SF-UI39-P01 — UI39: Aplicar somente mudança preparada com dupla checagem

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI39 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions/:caseRef/changes/:changeRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CHANGE-EDI-01 · CASE-EDI-01 · PR-32000

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero aplicar somente mudança preparada com dupla checagem para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: CHANGE-EDI-01 · CASE-EDI-01 · PR-32000. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir mudança preparada e ler diff before/after
3. **[UI_ACTION]** Revisar owner, escopo, revisão e efeitos no produtor
4. **[READ_ONLY_WITNESS]** Confirmar humana e registrar attempt ID
5. **[UI_ACTION]** Aplicar uma vez e abrir recibo do producer
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Sem confirmação não há commit
- Aplicação tem exatamente um recibo com versionamento
- Estado novo é relido da fonte governada
- Uma análise ou comentário não pode acionar mudança
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u18. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
