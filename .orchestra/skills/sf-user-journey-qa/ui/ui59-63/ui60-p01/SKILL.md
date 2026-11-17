---
name: sf-user-journey-qa-ui-ui59-63-ui60-p01
description: "QA manutenção SF: executar story SF-UI60-P01 (UI60: Usar somente evidências confirmadas em cenário) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI60-P01 ou o caso específico UI60: Usar somente evidências confirmadas em cenário"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI60-P01"
---
# SF-UI60-P01 — UI60: Usar somente evidências confirmadas em cenário

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI60 · **Jornadas:** J05.

**Entrada UI indicada:** `/orchestra/sf-documents/:documentRef/scenario` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** DOC-EDI-01 confirmado ↔ SCN-PORT-01

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero usar somente evidências confirmadas em cenário para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: DOC-EDI-01 confirmado ↔ SCN-PORT-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir documento para cenário
3. **[UI_ACTION]** Selecionar somente evidência confirmada
4. **[UI_ACTION]** Relacionar evidência a premissa do cenário
5. **[READ_ONLY_WITNESS]** Inspecionar rastreabilidade e rever cenário
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Cenário aponta para docRef/segmentRef, não texto sem origem
- Não muda documento original
- Revogação impede seguir referência privada
- Sem confirmação humana, contribuição permanece inativa
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u24. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
