---
name: sf-user-journey-qa-ui-ui44-48-ui47-p01
description: "QA manutenção SF: executar story SF-UI47-P01 (UI47: Organizar com antecedência reunião global de TI) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI47-P01 ou o caso específico UI47: Organizar com antecedência reunião global de TI"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI47-P01"
---
# SF-UI47-P01 — UI47: Organizar com antecedência reunião global de TI

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI47 · **Jornadas:** J05.

**Entrada UI indicada:** `/orchestra/sf-reviews/agenda` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** REV-EXEC-NOV · 25 projetos + budget + risks + PR

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero organizar com antecedência reunião global de TI para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: REV-EXEC-NOV · 25 projetos + budget + risks + PR. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Criar pauta com blocos de budget, portfolio, security e procurement
3. Escolher períodos distintos e rotular cada competência
4. Preservar snapshot da pauta
5. Conferir versões/fonte/quantidade antes de apresentar
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- 25 projetos aparecem exatamente uma vez
- Competências diferentes são explícitas
- Snapshot possui reviewRef e revisão imutável
- Criar pauta não muda dados de domínio
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u25. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
