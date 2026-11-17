---
name: sf-user-journey-qa-cap-cap11-15-cap13-p01
description: "QA manutenção SF: executar story SF-CAP13-P01 (CAP13: Abrir risco corporativo com plano de mitigação e dependênci) pela UI; ator RISK_OWNER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP13-P01 ou o caso específico CAP13: Abrir risco corporativo com plano de mitigação e dependênc"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP13-P01"
---
# SF-CAP13-P01 — CAP13: Abrir risco corporativo com plano de mitigação e dependências

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** RISK_OWNER · **Superfícies:** CAP13 · **Jornadas:** J08.

**Entrada UI indicada:** `/orchestra/sf-operations/risks` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** R-07 · EDI Logistics · likelihood 3/5 impact 4/5

**Resultado de negócio:** Como Risk Owner RISK-01, quero abrir risco corporativo com plano de mitigação e dependências para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: R-07 · EDI Logistics · likelihood 3/5 impact 4/5. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Criar risco R-07 com projeto P-004 e owner
3. Registrar mitigação e revisão com data
4. Alterar severidade conforme política registrada
5. Revisar no painel de prioridades do CIO
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Risco mantém likelihood/impact em escalas explícitas
- Painel e portfólio usam mesmo riskRef
- Histórico mostra mudança e justificativa
- Nenhuma ação financeira ocorre por simples elevação de risco
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u30. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
