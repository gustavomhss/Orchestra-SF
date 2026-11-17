---
name: sf-user-journey-qa-e2e-e2e037-045-038
description: "QA manutenção SF: executar story SF-E2E-038 (Fechamento financeiro: hipótese não edita versão oficial) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-038 ou o caso específico Fechamento financeiro: hipótese não edita versão oficial"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-038"
---
# SF-E2E-038 — Fechamento financeiro: hipótese não edita versão oficial

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Outros atores:** BUDGET_OWNER, CIO · **Superfícies:** CAP03, CAP18, CAP19, CAP22, CAP23 · **Jornadas:** J02, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Actual setembro fechado, forecast outubro aberto e versão annual locked.

**Resultado de negócio:** Como FINANCE, com apoio de BUDGET_OWNER, CIO, diante da situação descrita, preciso tentar reabrir actual fechado e editar versão locked por diferentes perfis, para preservar integridade do fechamento contábil.

## Pré-condições específicas

- Actual setembro fechado, forecast outubro aberto e versão annual locked.

## Passos a executar na interface

1. Sofie abre versão annual e confirma setembro closed
2. Budget Owner cria cenário para outubro sem editar actual
3. Inspeciona import XLSX que afeta somente outubro
4. CIO revisa impacto anual com rótulo partial/total
5. QA tenta editar setembro closed por UI e API
6. Simula entrada de zero legítimo em outubro
7. Simula cell missing e compara ao zero
8. QA verifica audit e versão official

## Oráculos observáveis (não reescrever para passar)

- Mês fechado não aceita alterações sem política explícita
- Zero legítimo não vira missing
- Partialidades mudam o estado de confiança do KPI
- Official e actual não mudam por import de cenário
- Toda abertura/fechamento exigiria comando e actor autorizado

## Contraprovas

- Impor data/FX cruzados sem conversão: indeterminado
- Tentar forçar commit por deep link stale: falha

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
