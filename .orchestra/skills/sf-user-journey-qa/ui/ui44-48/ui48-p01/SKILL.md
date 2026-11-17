---
name: sf-user-journey-qa-ui-ui44-48-ui48-p01
description: "QA manutenção SF: executar story SF-UI48-P01 (UI48: Apresentar revisão histórica com fidelidade mesmo após mudan) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI48-P01 ou o caso específico UI48: Apresentar revisão histórica com fidelidade mesmo após muda"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI48-P01"
---
# SF-UI48-P01 — UI48: Apresentar revisão histórica com fidelidade mesmo após mudança de dados

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI48 · **Jornadas:** J05.

**Entrada UI indicada:** `/orchestra/sf-reviews/reviews/:reviewRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** REV-EXEC-NOV/R1 · 25 projetos · nota longa P-004

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero apresentar revisão histórica com fidelidade mesmo após mudança de dados para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: REV-EXEC-NOV/R1 · 25 projetos · nota longa P-004. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir revisão preservada R1 em modo apresentação
3. **[UI_ACTION]** Exibir 25 projetos e notas extensas
4. **[UI_ACTION]** Alterar a fonte original P-004 em sessão separada
5. **[READ_ONLY_WITNESS]** Reabrir R1 e conferir estabilidade textual e numérica
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- R1 mantém 25 projetos e valores originais sem recomputação
- Ordem e texto não mudam
- Acesso é revalidado na releitura
- Nova revisão precisa receber outro ID
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u32. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
