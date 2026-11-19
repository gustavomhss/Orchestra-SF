---
name: sf-user-journey-qa-cap-cap01-05-cap05-p01
description: "QA manutenção SF: executar story SF-CAP05-P01 (CAP05: Avaliar CAPEX de infraestrutura com approval de mudança exp) pela UI; ator BUDGET_OWNER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP05-P01 ou o caso específico CAP05: Avaliar CAPEX de infraestrutura com approval de mudança ex"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP05-P01"
---
# SF-CAP05-P01 — CAP05: Avaliar CAPEX de infraestrutura com approval de mudança explícito

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** BUDGET_OWNER · **Superfícies:** CAP05 · **Jornadas:** J01, J05.

**Entrada UI indicada:** `/orchestra/sf-dashboard/capex` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CAPEX-SCANNER-01 · USD 91827 · 2027 · Projeto P-009

**Resultado de negócio:** Como Budget Owner sintético BO-01, quero avaliar CAPEX de infraestrutura com approval de mudança explícito para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: CAPEX-SCANNER-01 · USD 91827 · 2027 · Projeto P-009. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[READ_ONLY_WITNESS]** Inspecionar Dashboard → CAPEX (/orchestra/sf-dashboard/capex) por ano e projeto P-009; seguir para Planner → Versions e registrar versionRef real da hipótese editável.
3. **[READ_ONLY_WITNESS]** Abrir Planner → CAPEX (/orchestra/sf-planner/capex), selecionar o mesmo versionRef e registrar CAPEX-SCANNER-01 de 91827 USD para 2027 apenas pelos campos existentes; não inventar approval ou janela.
4. **[READ_ONLY_WITNESS]** Inspecionar detalhe e vínculo com Portfolio somente quando controle real estiver visível e autorizado; sem approval, janela ou vínculo, registrar BLOCKED_CAPABILITY.
5. **[READ_ONLY_WITNESS]** Comparar totais por versionRef em Planner CAPEX, contra official; voltar ao Dashboard por ano sem atribuir a ele WHATIF/official.
6. **[UI_ACTION]** Reabrir Planner e Dashboard em navegações separadas; preservar versionRef, período, status locked e evidência.

## Oráculos observáveis (não reescrever para passar)

- Moeda e calendário CAPEX devem estar observáveis; approval/janela ausentes são gap explícito, não controles pressupostos
- Relação P-009 deve ser comprovada por vínculo autorizado; se a UI não o expõe, essa etapa fica BLOCKED_CAPABILITY
- Nenhuma inclusão em official/locked sem governança da versão no Planner
- Registros preservam histórico e owner
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u39, u40. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
