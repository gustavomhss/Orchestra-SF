---
name: sf-user-journey-qa-e2e-e2e028-036-029
description: "QA manutenção SF: executar story SF-E2E-029 (Visão salva só existe quando a capacidade V2 está disponível) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-029 ou o caso específico Visão salva só existe quando a capacidade V2 está disponível"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-029"
---
# SF-E2E-029 — Visão salva só existe quando a capacidade V2 está disponível

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Outros atores:** CIO · **Superfícies:** UI30, UI32 · **Jornadas:** J01, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · VIEW-EDI-Caio; no snapshot da auditoria UI32 V2 native indisponível.

**Resultado de negócio:** Como LEADER, com apoio de CIO, diante da situação descrita, preciso salvar filtro e restaurar visão somente com produtor versionado instalado, para não oferecer falsa persistência de visão.

## Pré-condições específicas

- VIEW-EDI-Caio; no snapshot da auditoria UI32 V2 native indisponível.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Abrir Meu trabalho com filtro de Caio
2. **[UI_ACTION]** Descobrir capability do producer de Saved Views V2
3. **[UI_ACTION]** Se instalado, criar view com owner e filtros explícitos
4. **[UI_ACTION]** Reabrir em segunda sessão e validar persistência
5. **[READ_ONLY_WITNESS]** Se não instalado, capturar unavailable real
6. **[READ_ONLY_WITNESS]** Comparar recursos legados sem classificá-los como V2
7. **[UI_ACTION]** Revogar acesso e tentar reler view antiga
8. **[READ_ONLY_WITNESS]** Registrar gap por release gate em vez de marcar sucesso

## Oráculos observáveis (não reescrever para passar)

- Matriz tem estado CONDITIONAL e produto observado
- Não há claim de PASS de V2 sem produtor
- Owner controla reabertura e sharing
- View não armazena dados privados fora do escopo

## Contraprovas

- Rota existente sem codec gera unavailable
- Filtros privados não aparecem em conta diferente

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
