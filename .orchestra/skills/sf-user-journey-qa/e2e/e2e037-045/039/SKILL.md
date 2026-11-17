---
name: sf-user-journey-qa-e2e-e2e037-045-039
description: "QA manutenção SF: executar story SF-E2E-039 (403, 422 e 503 têm significados diferentes) pela UI; ator AUDITOR, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-039 ou o caso específico 403, 422 e 503 têm significados diferentes"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-039"
---
# SF-E2E-039 — 403, 422 e 503 têm significados diferentes

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** AUDITOR · **Outros atores:** LEADER, FINANCE · **Superfícies:** UI67, UI55, UI57, CAP25 · **Jornadas:** J03, J04, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Probe histórico mostrou 403/422/503 em jornadas autorizadas; negar a pessoa errada é esperado, negar autorizado pode ser defeito.

**Resultado de negócio:** Como AUDITOR, com apoio de LEADER, FINANCE, diante da situação descrita, preciso reproduzir falhas de autorização, validação e backend sem mascarar causas, para abrir defeito correto e impedir falso PASS.

## Pré-condições específicas

- Probe histórico mostrou 403/422/503 em jornadas autorizadas; negar a pessoa errada é esperado, negar autorizado pode ser defeito.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Congelar SHA e fixture para reprodução
2. **[UI_ACTION]** Executar mesmo endpoint de import com Finance e com Zico
3. **[READ_ONLY_WITNESS]** Capturar 200/403/422 reais e discriminar causas
4. **[UI_ACTION]** Reproduzir JSON/headers/MIME, origem, principal, resource tenant e revision
5. **[UI_ACTION]** Testar Procurement supplier/host 503 isolado
6. **[READ_ONLY_WITNESS]** Conferir cada corpo e logs sem segredos
7. **[UI_ACTION]** Corrigir pré-condição de teste somente quando era falsa
8. **[UI_ACTION]** Reexecutar e associar run IDs a cada QA case

## Oráculos observáveis (não reescrever para passar)

- 403 de Zico é prova de negação se a fonte não mudou
- 403 de Finance autorizado bloqueia jornada e deve ser investigado
- 422 significa validação, não sucesso
- 503 de producer impede homologar decisão
- Never weaken assertions, skip ou mock para obter verde

## Contraprovas

- Um teste que não rodou por early bail permanece NOT_RUN
- Artefato verde de package não significa workflow funcional verde

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
