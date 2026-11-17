---
name: sf-user-journey-qa-e2e-e2e037-045-040
description: "QA manutenção SF: executar story SF-E2E-040 (A promoção exige produto, identidade e governança) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-040 ou o caso específico A promoção exige produto, identidade e governança"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-040"
---
# SF-E2E-040 — A promoção exige produto, identidade e governança

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** AUDITOR, OPS · **Superfícies:** CAP01, UI67, CAP24 · **Jornadas:** J08.

**Dependência de release:** RELEASE_POLICY_OWNER_APPROVAL; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Release novo exige admin supreme, identidade Entra, demo Flamengo e o tema visual apenas se aprovado pelo owner.

**Resultado de negócio:** Como CIO, com apoio de AUDITOR, OPS, diante da situação descrita, preciso cruzar release candidate, admin, white-label, dados e tenant com evidência única, para assinar um go-live com rastreabilidade de ponta a ponta.

## Pré-condições específicas

- Release novo exige admin supreme, identidade Entra, demo Flamengo e o tema visual apenas se aprovado pelo owner.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Congelar commit C, tree e pacote extraído fora checkout
2. **[UI_ACTION]** Checar 12 jobs de sf-ci no mesmo SHA e 8 recibos de release
3. **[UI_ACTION]** Validar Entra com atores permitidos e negados
4. **[UI_ACTION]** Validar 70 superfícies + novo admin fora do manifesto
5. **[UI_ACTION]** Executar stories FLA demo sobre instância realmente isolada
6. **[UI_ACTION]** Executar smoke white label condicionado a inclusão real do tema
7. **[CONTROLLED_FAULT]** Verificar backup, restore e rollback com evidência — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
8. **[UI_ACTION]** CIO assina GO/NO-GO com exceções e riscos explícitos

## Oráculos observáveis (não reescrever para passar)

- Todos P0 obrigatórios têm provas E vinculadas a SHA/ator/dado
- Admin e identidade negam os atores não supreme
- Demo não é confundida com dado de produção
- Factory package não substitui sf-ci
- Sem evidência em um gate é NO-GO, não “quase verde”

## Contraprovas

- Branch mudou SHA após CI: revalidar C inteiro
- Falta de consent Graph live significa não homologado

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
