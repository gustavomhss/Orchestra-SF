---
name: sf-user-journey-qa-cap-cap11-15-cap12-p01
description: "QA manutenção SF: executar story SF-CAP12-P01 (CAP12: Interpretar KPIs de segurança sem mascara de dados ausentes) pela UI; ator SECURITY, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP12-P01 ou o caso específico CAP12: Interpretar KPIs de segurança sem mascara de dados ausente"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP12-P01"
---
# SF-CAP12-P01 — CAP12: Interpretar KPIs de segurança sem mascara de dados ausentes

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** SECURITY · **Superfícies:** CAP12 · **Jornadas:** J08.

**Entrada UI indicada:** `/orchestra/sf-operations/security` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SEC-SEP-26 · 4 endpoints críticos sem patch / 200 · 0 breaches conhecidos

**Resultado de negócio:** Como Responsável Segurança SEC-01, quero interpretar KPIs de segurança sem mascara de dados ausentes para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: SEC-SEP-26 · 4 endpoints críticos sem patch / 200 · 0 breaches conhecidos. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir IT Security KPIs e filtrar setembro/2026
3. **[UI_ACTION]** Revisar denominador, período, fonte e tendência
4. **[UI_ACTION]** Atualizar referência do KPI autorizado
5. **[READ_ONLY_WITNESS]** Inspecionar ações e incidentes ligados
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- 4/200 = 2% de endpoints atrasados e zero breaches é zero conhecido
- Campo sem coleta permanece missing
- Incidentes têm status e dono
- Alteração do KPI não apaga evidências anteriores
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u29. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
