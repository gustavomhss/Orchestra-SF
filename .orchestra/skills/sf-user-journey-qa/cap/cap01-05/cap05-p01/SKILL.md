---
name: sf-user-journey-qa-cap-cap01-05-cap05-p01
description: "QA manutenção SF: executar story SF-CAP05-P01 (CAP05: Avaliar CAPEX de infraestrutura com approval de mudança exp) pela UI; ator BUDGET_OWNER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP05-P01 ou o caso específico CAP05: Avaliar CAPEX de infraestrutura com approval de mudança ex"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP05-P01"
---
# SF-CAP05-P01 — CAP05: Avaliar CAPEX de infraestrutura com approval de mudança explícito

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** BUDGET_OWNER · **Superfícies:** CAP05 · **Jornadas:** J01, J05.

**Entrada UI indicada:** `/orchestra/sf-dashboard/capex` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CAPEX-SCANNER-01 · USD 91827 · 2027 · Projeto P-009

**Resultado de negócio:** Como Budget Owner sintético BO-01, quero avaliar CAPEX de infraestrutura com approval de mudança explícito para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: CAPEX-SCANNER-01 · USD 91827 · 2027 · Projeto P-009. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir CAPEX Projects e selecionar P-009
3. Registrar CAPEX-SCANNER-01 com 91827 USD, janela 2027 e responsável
4. Inspecionar detalhe e vínculo com portfolio
5. Voltar e verificar total apenas no cenário editável
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- CAPEX identifica moeda e calendário independentes de OPEX
- Relação P-009 é exata e visível no detalhe
- Projeto não ingressa em versão official sem governança
- Registros preservam histórico e owner
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u39, u40. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
