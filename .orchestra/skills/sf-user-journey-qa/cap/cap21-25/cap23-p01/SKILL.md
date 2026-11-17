---
name: sf-user-journey-qa-cap-cap21-25-cap23-p01
description: "QA manutenção SF: executar story SF-CAP23-P01 (CAP23: Criar versão hipotética sem destravar baseline publicado) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP23-P01 ou o caso específico CAP23: Criar versão hipotética sem destravar baseline publicado"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP23-P01"
---
# SF-CAP23-P01 — CAP23: Criar versão hipotética sem destravar baseline publicado

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** CAP23 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-planner/versions` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** V-2026-OFFICIAL locked; V-2026-WHATIF-A/B

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero criar versão hipotética sem destravar baseline publicado para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: V-2026-OFFICIAL locked; V-2026-WHATIF-A/B. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** No Planner → Versions (/orchestra/sf-planner/versions) identificar official/locked, ano e versionRef; usar New/Copy quando autorizado para criar WHATIF-A da official, não no Dashboard.
3. **[READ_ONLY_WITNESS]** Inspecionar A no detalhe de Versions, capturar ID, ano, nome e lock; registrar parentVersion/autoria somente se o produtor ou UI autorizada os expuser.
4. **[READ_ONLY_WITNESS]** Criar WHATIF-B por New/Copy da mesma official, não de A; conferir que os dois versionRefs são diferentes.
5. **[READ_ONLY_WITNESS]** Comparar A, B e official em Planner Versions/Compare e selecionando versionRef em Planner OPEX/CAPEX; não procurar controle de cenário no Dashboard.
6. **[UI_ACTION]** Reabrir cada versionRef na fonte Planner, comprovar original locked e hipóteses distintas, com evidência real.

## Oráculos observáveis (não reescrever para passar)

- Oficial permanece intocado e locked
- Histórico de autor/base/criação só é provado quando existir leitura autorizada; sem campo/producer observável registrar gap
- A/B possuem versionRefs distintos e não se mesclam implicitamente
- Versão inválida não é apresentada como aprovada
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u46. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
