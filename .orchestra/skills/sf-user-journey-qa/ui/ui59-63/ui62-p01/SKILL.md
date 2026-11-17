---
name: sf-user-journey-qa-ui-ui59-63-ui62-p01
description: "QA manutenção SF: executar story SF-UI62-P01 (UI62: Encontrar casos anteriores semelhantes sem vazar dados) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI62-P01 ou o caso específico UI62: Encontrar casos anteriores semelhantes sem vazar dados"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI62-P01"
---
# SF-UI62-P01 — UI62: Encontrar casos anteriores semelhantes sem vazar dados

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI62 · **Jornadas:** J07.

**Entrada UI indicada:** `/orchestra/sf-memory/cases` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CASE-EDI-01 ↔ CASE-EDI-OLD-02 · score de similaridade

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero encontrar casos anteriores semelhantes sem vazar dados para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: CASE-EDI-01 ↔ CASE-EDI-OLD-02 · score de similaridade. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Casos semelhantes a partir de CASE-EDI-01
3. Inspecionar score e justificativa da correspondência
4. Abrir caso autorizado e retornar
5. Comparar com resultado de u26 + teste especializado similarity217/ui62
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Similaridade não é equivalência nem decisão automática
- Scores mostram origem, versão e critérios
- Caso inacessível não revela título ou snippet privado
- Busca não reabre acesso revogado
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u26. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
