---
name: sf-user-journey-qa-ui-ui39-43-ui41-p01
description: "QA manutenção SF: executar story SF-UI41-P01 (UI41: Acompanhar análise assíncrona sem tomá-la por decisão aprova) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI41-P01 ou o caso específico UI41: Acompanhar análise assíncrona sem tomá-la por decisão aprov"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI41-P01"
---
# SF-UI41-P01 — UI41: Acompanhar análise assíncrona sem tomá-la por decisão aprovada

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** UI41 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions/:caseRef/analyses/:analysisRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** AN-EDI-01 · análise do CASE-EDI-01

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero acompanhar análise assíncrona sem tomá-la por decisão aprovada para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: AN-EDI-01 · análise do CASE-EDI-01. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir análise assíncrona e admitir execução autorizada
3. **[UI_ACTION]** Acompanhar queued→running→completed/failed conforme retorno real
4. **[UI_ACTION]** Ler output e verifier independente
5. **[UI_ACTION]** Relacionar contribuição a CASE-EDI-01 sem aplicar
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- runRef é consistente e estado observado é honesto
- Output inválido não vira recomendação verificada
- Proveniência inclui skill/model/input versionados
- Nenhuma alteração em Procurement ocorre somente por completion
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u37. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
