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
2. **[UI_ACTION]** Abrir Versions e criar WHATIF-A a partir de baseline conhecido
3. **[READ_ONLY_WITNESS]** Inspecionar parentVersion, lock e competência
4. **[UI_ACTION]** Criar versão B independente
5. **[READ_ONLY_WITNESS]** Comparar A, B e official
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Oficial permanece intocado e locked
- Histórico registra autor, base e criação
- A/B não se mesclam implicitamente
- Versão inválida não é apresentada como aprovada
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u46. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
