---
name: sf-user-journey-qa-e2e-e2e010-018-018
description: "QA manutenção SF: executar story SF-E2E-018 (Nem o administrador pode se autoconceder privilégios) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-018 ou o caso específico Nem o administrador pode se autoconceder privilégios"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-018"
---
# SF-E2E-018 — Nem o administrador pode se autoconceder privilégios

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:**  · **Superfícies:** UI67 · **Jornadas:** J08.

**Dependência de release:** PR270_NOT_PROMOTED; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Daniel membro supreme tenta alterar seus próprios grants e role inheritance.

**Resultado de negócio:** Como CIO, diante da situação descrita, preciso testar tentativa de autoelevação, autodeleção e escopo fora da allowlist, para reduzir riscos de abuso administrativo.

## Pré-condições específicas

- Daniel membro supreme tenta alterar seus próprios grants e role inheritance.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Abrir admin como Daniel com roles vigentes
2. **[READ_ONLY_WITNESS]** Capturar snapshots das três telas e próprio principal oid
3. **[UI_ACTION]** Tentar atribuir a si mesmo novo grant de supplier-admin
4. **[UI_ACTION]** Tentar remover o próprio grant ativo
5. **[UI_ACTION]** Tentar trocar grupo→role que adicione papel herdado a Daniel
6. **[UI_ACTION]** Tentar remover papel de um grupo do qual Daniel faz parte
7. **[UI_ACTION]** Confirmar que nenhuma tentativa cria audit de sucesso
8. **[UI_ACTION]** Reabrir como segundo admin e testar alteração legítima de outra pessoa

## Oráculos observáveis (não reescrever para passar)

- Todas alterações próprias são rejeitadas conforme contrato anti-escalation/lockout
- Versão e snapshots não mudam nos casos negados
- O grupo supreme nunca pode ser editado pelo workbench
- Segundo admin pode alterar outro perfil sob CAS e policy, sem tocar Graph

## Contraprovas

- Forjar actor oid no POST não muda identidade do servidor
- Trocar nome de grupo para simular group:<uuid> diferente não contorna guard

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
