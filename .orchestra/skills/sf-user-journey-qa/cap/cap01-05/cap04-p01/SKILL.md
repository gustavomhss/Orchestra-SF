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
2. **[UI_ACTION]** Abrir OPEX Detail na hipótese V-2026-WHATIF-A
3. **[UI_ACTION]** Criar/editar linha OPEX-LIC-01 com justificativa “renovação SaaS”
4. **[UI_ACTION]** Salvar com revisão observada e voltar à lista
5. **[READ_ONLY_WITNESS]** Reabrir e comparar impacto anual e mensal
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Nova hipótese aumenta outlook 590000→602000 USD, delta +12000
- Justificativa e ator persistem na trilha
- Actual Jan–Set permanece 400000 e versão official intacta
- Lista mantém filtro/competência após retorno
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u39, u40. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
