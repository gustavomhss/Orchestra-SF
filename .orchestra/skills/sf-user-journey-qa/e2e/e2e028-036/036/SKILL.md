---
name: sf-user-journey-qa-e2e-e2e028-036-036
description: "QA manutenção SF: executar story SF-E2E-036 (A URL não pode conceder acesso ao registro) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-036 ou o caso específico A URL não pode conceder acesso ao registro"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-036"
---
# SF-E2E-036 — A URL não pode conceder acesso ao registro

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** AUDITOR · **Superfícies:** CAP24, UI31, UI40, UI57 · **Jornadas:** J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Matriz de 165 routes com 21 padrões sintaticamente sobrepostos e refs r_base64url canônicos.

**Resultado de negócio:** Como CIO, com apoio de AUDITOR, diante da situação descrita, preciso testar referências opacas, padrões de rotas e manipulação de IDs, para impedir acesso por guessing ou colisões de roteamento.

## Pré-condições específicas

- Matriz de 165 routes com 21 padrões sintaticamente sobrepostos e refs r_base64url canônicos.

## Passos a executar na interface

1. Selecionar rota estática /new e rota dinâmica /:ref do mesmo capítulo
2. Abrir URL com ref canônica e autorizada
3. Abrir URL com `r_` truncado ou base64url não canônico
4. Abrir URL com ref válida de outro owner
5. Testar encoding de barra e dot segments
6. Testar parameter pollution e percent encoding inválido
7. Repetir sem sessão e com revogação no meio
8. Conferir router static precedence e resposta de host

## Oráculos observáveis (não reescrever para passar)

- Static routes resolvem antes de dynamic sem ambiguidade
- Ref válida continua exigindo autenticação/autorização
- Ref inválida não aciona recurso ou leaked path
- No redirect unsafe para domínio externo
- Erros não mostram nomes de fontes privadas

## Contraprovas

- Ref de outro tenant nunca é aceito por coincidence de ID
- Rota 404 e rota 403 não podem vazar conteúdo no corpo

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
