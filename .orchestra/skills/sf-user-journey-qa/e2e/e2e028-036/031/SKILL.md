---
name: sf-user-journey-qa-e2e-e2e028-036-031
description: "QA manutenção SF: executar story SF-E2E-031 (Flamengo demonstra fluxo sem inventar autoridade) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-031 ou o caso específico Flamengo demonstra fluxo sem inventar autoridade"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-031"
---
# SF-E2E-031 — Flamengo demonstra fluxo sem inventar autoridade

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** LEADER, FINANCE, BUYER, APPROVER · **Superfícies:** CAP01, CAP24, CAP25, CAP26, UI47, UI55 · **Jornadas:** J01, J02, J03, J04, J05, J08.

**Dependência de release:** PR268_DRAFT_NOT_PROMOTED; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · PR #268 em DRAFT: org FLAMENGO sintética com 3 diretorias, 6 departamentos, 12 centros de custo e 10 fornecedores.

**Resultado de negócio:** Como CIO, com apoio de LEADER, FINANCE, BUYER, APPROVER, diante da situação descrita, preciso executar campanha sintética com atores reais do tenant e efeitos verificáveis, para apresentar uma demo íntegra e reproduzível.

## Pré-condições específicas

- PR #268 em DRAFT: org FLAMENGO sintética com 3 diretorias, 6 departamentos, 12 centros de custo e 10 fornecedores.

## Passos a executar na interface

1. Selecionar instalação QA isolada para FLA-DEMO-2026
2. Inspecionar dados declarativos no sf/demo/flamengo sem assumir que já foram aplicados
3. Executar seed dry-run e registrar plano de admissões
4. Autorizar `--apply` somente com contas/portas reais e snapshots backup
5. Daniel/André validam contexto admin quando feature integrada
6. Caio faz request, Pedro sourcing, Gabriel aprovação, Sofie Finance
7. Zico sem grupo tenta abrir domínio e recebe negação
8. Auditor compara contagem seeded e IDs antes/depois de segunda aplicação
9. CIO prepara review demonstrativa usando os dados realmente persistidos

## Oráculos observáveis (não reescrever para passar)

- Seed idempotente read-before-create sem INSERT direto
- Cada estado é efeito do produtor, não dados de showcase falsos
- Actor Zico recebe negação no servidor
- Não existem principalRef e sessão inventados pela fixture
- Falha de porto real é BLOCKED, não seed success
- Finance/Procurement e pauta reconciliam com fonte persistida

## Contraprovas

- Replicar seed em produção é proibido
- Release sem fixture instalada não declara demo concluída

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
