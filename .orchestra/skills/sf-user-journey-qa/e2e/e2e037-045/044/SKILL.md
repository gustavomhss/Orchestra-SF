---
name: sf-user-journey-qa-e2e-e2e037-045-044
description: "QA manutenção SF: executar story SF-E2E-044 (A reunião do CIO sob carga e múltiplas consultas) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-044 ou o caso específico A reunião do CIO sob carga e múltiplas consultas"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-044"
---
# SF-E2E-044 — A reunião do CIO sob carga e múltiplas consultas

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Outros atores:** FINANCE, OPS · **Superfícies:** CAP01, CAP09, UI45, UI48, UI50 · **Jornadas:** J02, J05, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Dataset 25 projetos, notas longas, 200 usuários Graph fixture e 10 jobs; nenhum SLA inventado.

**Resultado de negócio:** Como CIO, com apoio de FINANCE, OPS, diante da situação descrita, preciso simular acesso concorrente a dados, agendas e relatórios volumosos, para manter respostas íntegras e estados honestos sob pressão.

## Pré-condições específicas

- Dataset 25 projetos, notas longas, 200 usuários Graph fixture e 10 jobs; nenhum SLA inventado.

## Passos a executar na interface

1. Congelar ambiente, hardware e profile de browser
2. Carregar 25 projetos e 10 documentos sintéticos
3. Abrir Executive, Portfolio, BI e presentation sequencialmente
4. Executar várias sessões de leitura simultânea sob contas permitidas
5. Registrar p50/p95 de carregamento e erros
6. Testar paginação Graph de 200 usuários somente no admin instalado
7. Gerar dois exports e inspecionar filas de jobs
8. Verificar que timeout mostra falha honesta e sem efeito duplicado

## Oráculos observáveis (não reescrever para passar)

- Métrica de tempo possui hardware, quantidade de registros, SHA e limites acordados pelo owner
- Nenhuma leitura faz commit ou expõe dados de outro papel
- Falha de job não trava as demais superfícies indefinidamente
- Threshold de aceite é definido antes de executar e não ajustado após resultado

## Contraprovas

- Sem definição de SLA, reportar medidas e risco, nunca PASS de performance sem limite
- Redução artificial de dados para ficar verde invalida teste

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
