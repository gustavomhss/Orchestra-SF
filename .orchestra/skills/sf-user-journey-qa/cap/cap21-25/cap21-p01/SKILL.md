---
name: sf-user-journey-qa-cap-cap21-25-cap21-p01
description: "QA manutenção SF: executar story SF-CAP21-P01 (CAP21: Alocar custo entre entidades sem ultrapassar 100%) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP21-P01 ou o caso específico CAP21: Alocar custo entre entidades sem ultrapassar 100%"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP21-P01"
---
# SF-CAP21-P01 — CAP21: Alocar custo entre entidades sem ultrapassar 100%

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** CAP21 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-planner/allocations` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** ALLOC-EDI-01 · 60% Centro IT-EU · 40% IT-BR

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero alocar custo entre entidades sem ultrapassar 100% para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: ALLOC-EDI-01 · 60% Centro IT-EU · 40% IT-BR. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir Entities & allocations
3. **[UI_ACTION]** Criar alocação ALLOC-EDI-01 para contrato EDI
4. **[READ_ONLY_WITNESS]** Registrar splits 60/40 por entidade autorizada
5. **[READ_ONLY_WITNESS]** Conferir consolidação em Planner e BI
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Soma é exatamente 100% e reconcilia moeda/base
- Não replica o custo integral em ambas entidades
- Entidade fora do escopo não é navegável
- Revisão e sourceRef ficam disponíveis
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u09. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
