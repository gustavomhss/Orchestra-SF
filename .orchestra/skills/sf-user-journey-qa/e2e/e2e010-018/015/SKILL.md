---
name: sf-user-journey-qa-e2e-e2e010-018-015
description: "QA manutenção SF: executar story SF-E2E-015 (Login corporativo sem atalhos na identidade) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-015 ou o caso específico Login corporativo sem atalhos na identidade"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-015"
---
# SF-E2E-015 — Login corporativo sem atalhos na identidade

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** LEADER, BUYER · **Superfícies:** UI67, UI69 · **Jornadas:** J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Entra B2B resource tenant; sem gravar tokens/segredos em artefatos.

**Resultado de negócio:** Como CIO, com apoio de LEADER, BUYER, diante da situação descrita, preciso validar retorno do OIDC, sessão e proteção de origem/replay, para impedir impersonação e autorização por contexto falso.

## Pré-condições específicas

- Entra B2B resource tenant; sem gravar tokens/segredos em artefatos.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Executar login real com principal autorizado e observar endpoint no browser
2. **[READ_ONLY_WITNESS]** Conferir origem HTTPS e redirecionamento registado
3. **[CONTROLLED_FAULT]** Simular código OIDC reutilizado com autorização do QA — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
4. **[CONTROLLED_FAULT]** Testar nonce/state inválidos em ambiente controlado — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
5. **[CONTROLLED_FAULT]** Testar CSRF e origem ausente em POST de produto — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
6. **[UI_ACTION]** Alterar tid/oid de token sintético no fixture de contraprova
7. **[UI_ACTION]** Remover grupo do ator e validar nova negação
8. **[READ_ONLY_WITNESS]** Verificar cookies, logs, cache e ausência de token em HTML

## Oráculos observáveis (não reescrever para passar)

- Callback inválido falha fechada sem sessão
- tid/oid vinculados ao recurso; principal não é email/displayName
- POST exige origin/CSRF e policy atual
- 403/401 distinguidos de 200 legítimo
- Nenhum secret ou token acaba em screenshots, CI ou logs

## Contraprovas

- Cross-tenant token com assinatura válida de outro tenant deve ser negado
- local-operator não substitui Microsoft session no Azure

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
