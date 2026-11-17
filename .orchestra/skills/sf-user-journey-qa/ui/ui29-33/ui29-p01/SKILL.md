---
name: sf-user-journey-qa-ui-ui29-33-ui29-p01
description: "QA manutenção SF: executar story SF-UI29-P01 (UI29: Começar o dia com prioridades e contexto reais) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI29-P01 ou o caso específico UI29: Começar o dia com prioridades e contexto reais"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI29-P01"
---
# SF-UI29-P01 — UI29: Começar o dia com prioridades e contexto reais

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** UI29 · **Jornadas:** J08.

**Entrada UI indicada:** `/orchestra/sf-home` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** TODAY-2026-11-17 · HOT-EDI-07 · PR-32000 · R-07

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero começar o dia com prioridades e contexto reais para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: TODAY-2026-11-17 · HOT-EDI-07 · PR-32000 · R-07. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Autenticar, selecionar instalação e projeto
3. Abrir Hoje e revisar prioridades com origem, etapa e prazo
4. Abrir HOT-EDI-07 e voltar mantendo contexto
5. Confirmar separação entre atividade pessoal e visão global
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Atividades pertencem ao principal logado
- Prazos e títulos não criam autorizações novas
- Link para ação abre referência válida sem trocar owner
- A ausência de atividades é estado vazio, não erro 500
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u01. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
