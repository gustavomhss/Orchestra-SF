---
name: sf-user-journey-qa-e2e-e2e028-036-035
description: "QA manutenção SF: executar story SF-E2E-035 (Sessões, contexto e agentes da plataforma Orchestra) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-035 ou o caso específico Sessões, contexto e agentes da plataforma Orchestra"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-035"
---
# SF-E2E-035 — Sessões, contexto e agentes da plataforma Orchestra

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Outros atores:** OPS · **Superfícies:** UI64, UI65, UI70 · **Jornadas:** J07, J08.

**Dependência de release:** PLATFORM_CAPABILITY_DEPENDENT; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Orchestra host integra sessões, agentes, skills, ferramentas, Maestro, Relay/MCP e estado de execução nativo, quando instalado.

**Resultado de negócio:** Como CIO, com apoio de OPS, diante da situação descrita, preciso inspecionar orquestração e permissões de sessão, skill, MCP e Relay, para preservar limites entre plataforma e produto de negócio.

## Pré-condições específicas

- Orchestra host integra sessões, agentes, skills, ferramentas, Maestro, Relay/MCP e estado de execução nativo, quando instalado.

## Passos a executar na interface

1. Criar projeto/worktree isolado com duas sessões simultâneas
2. Selecionar provider/model com orçamento explícito
3. Admitir agente nativo com skill digest e permissões permitidas
4. Abrir output e verificar que host executou SessionV2/AgentV2/SkillV2 real
5. Desabilitar uma tool, testar deny e capturar provenance
6. Cancelar o run em estado admitido e conferir transição real
7. Abrir Relay/MCP somente se conexão está habilitada e testar contexto isolado
8. Inspecionar conteúdo ao trocar worktree e usuário
9. Comparar resultados com logs e event ordering

## Oráculos observáveis (não reescrever para passar)

- Agente mostra run real, não mock visual
- Nenhuma tool fora da grant consegue escrita
- Contexto de worktree não vaza entre sessões
- Cancelamento tem state coerente, sem completed fantasma
- Provider indisponível falha fechado e preserva output anterior somente identificado como histórico

## Contraprovas

- Trocar skill enquanto agente running exige digests fixos
- Relay não executa ação em outra sessão sem autorização

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
