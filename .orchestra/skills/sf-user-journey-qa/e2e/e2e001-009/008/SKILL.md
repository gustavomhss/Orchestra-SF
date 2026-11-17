---
name: sf-user-journey-qa-e2e-e2e001-009-008
description: "QA manutenção SF: executar story SF-E2E-008 (Headcount e remuneração sob segregação real) pela UI; ator HR, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-008 ou o caso específico Headcount e remuneração sob segregação real"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-008"
---
# SF-E2E-008 — Headcount e remuneração sob segregação real

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** HR · **Outros atores:** FINANCE, CIO · **Superfícies:** CAP06, CAP07, CAP08, CAP20, CAP21, UI45 · **Jornadas:** J02, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Plano 42 FTE, 40 ativos e 2 posições vagas; 1 contrata em outubro sem alterar setembro.

**Resultado de negócio:** Como HR, com apoio de FINANCE, CIO, diante da situação descrita, preciso planejar vaga e cenário de contratação sem expor dados de pessoa ou folha a leitores indevidos, para preservar privacidade e precisão do custo de pessoal.

## Pré-condições específicas

- Plano 42 FTE, 40 ativos e 2 posições vagas; 1 contrata em outubro sem alterar setembro.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** HR inspeciona Headcount Overview setembro
2. **[UI_ACTION]** Abre organograma e confirma 40 pessoas sem ciclo
3. **[UI_ACTION]** Consulta 2 posições planejadas e custos conforme grant
4. **[UI_ACTION]** Cria hipótese de contratação de 1 FTE em outubro
5. **[UI_ACTION]** Finance revisa impacto de custo sem ver notas privadas de talento
6. **[UI_ACTION]** CIO abre BI agregado e verifica total não nominativo
7. **[UI_ACTION]** HR confirma review TAL-014 e sua classificação
8. **[UI_ACTION]** QA tenta exportar como Viewer sem grant

## Oráculos observáveis (não reescrever para passar)

- 42 planned / 40 occupied / 2 vacant em setembro
- Mudança outubro não reescreve actual setembro
- Notas TAL-014 não aparecem no BI executivo sem permissão
- Cargo do funcionário não concede role Entra
- Viewer recebe negação/redaction e nenhum dado privado em cache

## Contraprovas

- Nome homônimo ou ciclo manager A→B→A: não fundir perfis
- Vagas sem rate conhecido: custo agregado reportado incompleto

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
