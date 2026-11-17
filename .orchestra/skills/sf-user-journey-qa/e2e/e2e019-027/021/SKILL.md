---
name: sf-user-journey-qa-e2e-e2e019-027-021
description: "QA manutenção SF: executar story SF-E2E-021 (Dois administradores alteram a mesma política) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-021 ou o caso específico Dois administradores alteram a mesma política"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-021"
---
# SF-E2E-021 — Dois administradores alteram a mesma política

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** HR · **Superfícies:** UI67 · **Jornadas:** J08.

**Dependência de release:** PR270_NOT_PROMOTED; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Daniel e André alteram roleMap de mesmo grupo em duas abas com revisão V7.

**Resultado de negócio:** Como CIO, com apoio de HR, diante da situação descrita, preciso submeter edições concorrentes do mapa de papéis e conferir CAS, auditoria e rollback, para não sobrescrever política de segurança silenciosamente.

## Pré-condições específicas

- Daniel e André alteram roleMap de mesmo grupo em duas abas com revisão V7.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Daniel e André abrem admin na versão V7
2. **[UI_ACTION]** Daniel configura group→role Buyer e salva, vira V8
3. **[UI_ACTION]** André tenta salvar snapshot V7 após editar Finance
4. **[UI_ACTION]** QA captura 409 e corpo do erro
5. **[UI_ACTION]** André recarrega V8 e refaz alteração válida
6. **[READ_ONLY_WITNESS]** Comparar auditoria from/to de ambas ações
7. **[CONTROLLED_FAULT]** Reiniciar store sob QA e reler versões — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
8. **[UI_ACTION]** Validar que nenhum change parcial ficou aplicado

## Oráculos observáveis (não reescrever para passar)

- V7 stale recebe 409 e não escreve
- Auditoria contém apenas ações realmente admitidas
- Estado persiste após restart
- CAS por binding/perfil segue contrato e escopo
- Releitura de usuários obtém grants atuais em cada operação

## Contraprovas

- Modificar policy fora do POST autorizado falha
- POST simultâneo não perde update do outro admin

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
