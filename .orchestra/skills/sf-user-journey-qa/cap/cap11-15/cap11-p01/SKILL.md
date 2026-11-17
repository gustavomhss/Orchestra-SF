---
name: sf-user-journey-qa-cap-cap11-15-cap11-p01
description: "QA manutenção SF: executar story SF-CAP11-P01 (CAP11: Atualizar operação de TI com métricas e tempo coerentes) pela UI; ator OPS, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP11-P01 ou o caso específico CAP11: Atualizar operação de TI com métricas e tempo coerentes"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP11-P01"
---
# SF-CAP11-P01 — CAP11: Atualizar operação de TI com métricas e tempo coerentes

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** OPS · **Superfícies:** CAP11 · **Jornadas:** J08.

**Entrada UI indicada:** `/orchestra/sf-operations/service` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** OPS-SEP-26 · uptime 99.7% · meta 99.9% · 3 incidentes

**Resultado de negócio:** Como Operador de TI OPS-01, quero atualizar operação de TI com métricas e tempo coerentes para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: OPS-SEP-26 · uptime 99.7% · meta 99.9% · 3 incidentes. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir IT Operations setembro/2026
3. **[READ_ONLY_WITNESS]** Inspecionar SLO, incidentes e fonte de dados
4. **[UI_ACTION]** Editar mês mantendo unidade porcentagem
5. **[UI_ACTION]** Navegar para Security e retornar
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- 99.7% e 99.9% não são arredondados para o mesmo estado
- 3 incidentes e mês correto persistem
- Métrica mostra revisão e responsável
- Dashboards derivados reconstroem dados de fonte, sem escrita incidental
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u04. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
