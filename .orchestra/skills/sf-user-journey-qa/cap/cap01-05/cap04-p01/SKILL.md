---
name: sf-user-journey-qa-cap-cap01-05-cap04-p01
description: "QA manutenção SF: executar story SF-CAP04-P01 (CAP04: Corrigir uma linha OPEX com rastreio de versão) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP04-P01 ou o caso específico CAP04: Corrigir uma linha OPEX com rastreio de versão"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP04-P01"
---
# SF-CAP04-P01 — CAP04: Corrigir uma linha OPEX com rastreio de versão

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** CAP04 · **Jornadas:** J01, J05.

**Entrada UI indicada:** `/orchestra/sf-dashboard/opex` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** OPEX-LIC-01 · USD 72000 → 84000 · centro de custo IT-OPS

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero corrigir uma linha OPEX com rastreio de versão para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: OPEX-LIC-01 · USD 72000 → 84000 · centro de custo IT-OPS. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[READ_ONLY_WITNESS]** Ler Dashboard → OPEX por ano como projeção independente; no Planner → Versions localizar/copiar baseline autorizado para WHATIF-A e registrar versionRef real, sem seletor WHATIF no Dashboard.
3. **[READ_ONLY_WITNESS]** Abrir Planner → OPEX (/orchestra/sf-planner/opex), escolher WHATIF-A no seletor pelo versionRef, editar OPEX-LIC-01 e registrar justificativa apenas se o campo existir na UI real.
4. **[UI_ACTION]** Salvar no Planner com revisão observada; voltar à lista e reler a linha no mesmo versionRef, nunca tratar edição do Dashboard como escrita na hipótese.
5. **[READ_ONLY_WITNESS]** Comparar official e A por seleção de versão no Planner (ano e meses); Dashboard OPEX serve apenas como leitura de ano, não comparação de hipóteses.
6. **[READ_ONLY_WITNESS]** Reabrir Planner OPEX com versionRef e Dashboard OPEX com ano separadamente; capturar sourceVersion, owner e recibo.

## Oráculos observáveis (não reescrever para passar)

- No Planner para versionRef de WHATIF-A, outlook 590000→602000 USD e delta +12000 quando a fixture existir
- Justificativa e ator persistem somente se o editor real possuir justificativa; se ausente, reportar gap, não PASS
- Actual Jan–Set permanece 400000 e official intacta na fonte de versões
- Após retornar, revalidar filtro, competência e versionRef, registrando perda de estado se ocorrer
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u39, u40. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
