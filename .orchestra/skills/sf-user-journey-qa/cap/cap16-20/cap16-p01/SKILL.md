---
name: sf-user-journey-qa-cap-cap16-20-cap16-p01
description: "QA manutenção SF: executar story SF-CAP16-P01 (CAP16: Medir contrato de desempenho de TI e subitens) pela UI; ator OPS, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP16-P01 ou o caso específico CAP16: Medir contrato de desempenho de TI e subitens"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP16-P01"
---
# SF-CAP16-P01 — CAP16: Medir contrato de desempenho de TI e subitens

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** OPS · **Superfícies:** CAP16 · **Jornadas:** J08.

**Entrada UI indicada:** `/orchestra/sf-operations/performance` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PERF-01 · disponibilidade 99.7 vs SLA 99.9 · 3 subitens

**Resultado de negócio:** Como Operador de TI OPS-01, quero medir contrato de desempenho de TI e subitens para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: PERF-01 · disponibilidade 99.7 vs SLA 99.9 · 3 subitens. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir IT Performance Contract
3. **[UI_ACTION]** Criar item PERF-01 com owner e meta
4. **[READ_ONLY_WITNESS]** Adicionar três subitens e registrar evidência mensal
5. **[UI_ACTION]** Revisar atraso e eventual correção
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Meta/real são rastreáveis por período
- Subitens reconciliam com o item pai
- Mudança não forja aprovação de performance
- A lista mostra status e data da última evidência
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u31. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
