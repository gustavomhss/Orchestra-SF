# Handoff — finish-httpbridge-20261119

SHA de código: 0b29978dfdda4249ac0126ee55786fa0e273140e
Base: sf-join-four @ bd45b3135c2a0cfc0a3cc2f5bdc6ed7373caebb5
Data: 2026-11-19
Estado: complete

## Feito

- O teste conserva a ponte Node/Effect real, OIDC/JWKS/PKCE, sessão criptografada, cookies Secure/HttpOnly/SameSite, CSRF, proxy/cabeçalhos, limite413, logout e privacidade de spans/logs.
- As três páginas HTML descomissionadas são verificadas como404, com o texto exato do produtor.
- A sonda de papel ausente usa o GET original /sucafina/planner?download=xlsx. private-fixture.ts:22 concede viewer no Dashboard e requester em Procurement, e não concede papel em Planner. As duas asserções401 continuam testando o papel ausente real.
- Depois do logout forjado403, a sessão continua válida e o papel ausente continua401. O logout original204 limpa os dois cookies; a mesma sessão revogada recebe303 para login.
- runtime/application.ts foi apenas lido para conferir os caminhos retidos e a autenticação na transação original.

## Pendente com file:line e motivo

Nenhum item pendente neste componente. O teste continua declarando em microsoft-bridge.test.ts:25 que não qualifica Azure, guestB2B provisionado nem a UI nativa.

## Decisões e asserções removidas

Nenhuma asserção removida ou enfraquecida. As antigas sondas HTML de autenticação foram transferidas para o download original no domínio sem papel configurado, mantendo401/401/303. Foram adicionadas as três provas de404.
O comentário herdado de rolemap não inicializado foi corrigido conforme a fixture real. Nenhuma alteração de grants, autenticação, produtor, limite ou timeout.

## Como retomar

Integrar o teste e este handoff em sf-join-four. Não repetir o gate deste componente; o sf-ci final verifica a integração completa.

## Comandos e resultados

- [44616327315](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44616327315): **success**,1pass/0fail/76assertions, snapshot4e4ca1ad1b3f184f4861ea31f4827721c8c8b21b. Job135885882587 success; cleanup135887508223 success.
- Request: package=sucafina, runner=bun, args=[Sucafinav1/test/product/http-body-limit-fix/microsoft-bridge.test.ts].
- Histórico44613781714: failure, C02 respondeu503 porque a fixture não instala runtime nativo. Histórico44615396341: failure, Procurement respondeu200 porque o requester era autorizado. Ambos explicados pelo código e corrigidos sem mudar o resultado esperado de autorização negada.
