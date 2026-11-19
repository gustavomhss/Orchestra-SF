# Handoff — finish-httpbridge-20261119

SHA de código: c243bef49c4674b0b80db398f498289a9f56e4eb
Base: sf-join-four @ bd45b3135c2a0cfc0a3cc2f5bdc6ed7373caebb5
Data: 2026-11-19
Estado: partial

## Feito

- microsoft-bridge.test.ts mantém a ponte Node/Effect real, OIDC/JWKS/PKCE, sessão criptografada, cookies Secure/HttpOnly/SameSite, CSRF, proxy/cabeçalhos, limite413, logout e privacidade de spans/logs.
- As três páginas HTML descomissionadas agora são explicitamente verificadas como404 com a resposta original.
- As três provas de autenticação/rolemap/logout usam o GET original procurement?page=Requests&projection=c02. runtime/application.ts:71–75 confirma essa seleção JSON; :100–104 confirma autenticação dentro da transação de papéis. O arquivo de runtime foi apenas lido.

## Pendente

- modules/sucafina/Sucafinav1/test/product/http-body-limit-fix/microsoft-bridge.test.ts:87 — gate estreito em andamento; confirmar401 com sessão válida/rolemap ausente,403 no logout forjado e303 após logout real na fonte JSON.
- Teste não qualifica Azure, guestB2B provisionado ou UI nativa, como já declarado no teste original.

## Decisões e justificativas

- Asserções de segurança removidas: nenhuma. Todas as401/403/413/204/303 e provas de cookies/headers/logs permanecem; acrescentadas6expectativas de404/corpo das páginas encerradas.
- Os GETs HTML não chegam mais à transação de autenticação: retornar404 é comportamento exigido. O C02 original conservado permite verificar o mesmo boundary sem recriar console.
- Nenhum timeout, skip, runtime/application.ts, auth policy ou fixture de identidade foi alterado. A interação não aponta navegador a4110.

## Como retomar

1. Usar finish-httpbridge-20261119 @ c243bef49c4674b0b80db398f498289a9f56e4eb.
2. Aguardar test-ci da branchci-run-linux-httpbridge-20261119, snapshot c853c2dfc1ea88b08a70c7564f307ef9c3446a5d.
3. Registrar o resultado e integrar este único teste se aprovado.

## Comandos e resultados

- Audit44585817131 FAILURE: teste parou noGET HTML esperando401 e recebeu404. https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585817131
- test-ci solicitado: package=sucafina, runner=bun, args=[Sucafinav1/test/product/http-body-limit-fix/microsoft-bridge.test.ts]; resultado pendente.
- bun run typecheck / check:guards: não executados neste patch de teste.
- Sem verificação local/shell e sem sf-ci final.

## Correção do gate de autorização

- Código: `bf49cd6a148b5ad36f34a449be0480a24f8cc645`.
- Run [44613781714](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44613781714): **failure**, 0 passed / 1 failed / 20 expects; cleanup success. As três páginas HTML antigas retornaram 404 com o texto de descomissionamento esperado. A primeira leitura C02 retornou 503 porque esta composição de identidade Microsoft não instala o runtime nativo.
- Decisão: usar o GET original `/sucafina/procurement?download=suppliers`, confirmado em `runtime/application.ts:524–559`, como sonda de autorização. O produtor preserva o authenticate/roleMap na mesma transação e não depende do runtime de projeções nativas.
- Mantidas as duas asserções 401 para a sessão guest sem papel, o logout forjado 403, logout original 204 e o redirecionamento 303 após revogação, além de body limit, cookies, proxy, spans e ausência de segredos. Nenhuma asserção foi apagada ou relaxada. `runtime/application.ts` foi apenas lido.
- Pendente: gate estreito deste arquivo no novo SHA; estado continua **partial** até resultado terminal.
