# T8 — auth / owner / same-origin frontier (rascunho de contrato)

**Estado:** contrato proposto + testes/honey negativos, **sem implementação de produção**. Base inspecionada: `close-final-candidate` @ `d624e44db8e2f8f15825566277ced51cfac8b0c7` (2026-11-17). Não declarar a fronteira fechada por estes testes.

## Fronteiras obrigatórias

1. **Entrada local já resolvida por #320.** O helper em `operator-identity.ts` consome código de uso único, emite 303 para `/` e um cookie opaco `HttpOnly; SameSite=Lax; Path=/sucafina` (8 h). **Não modificar** o redirect nem ampliar `Path`. O navegador **não envia** esse cookie em `GET /`; estar no shell, receber HTML, ver `/api/health` saudável ou possuir dados persistidos **não prova** autenticação Sucafina.
2. **Admissão explícita a partir do shell.** Para reconhecer uma sessão local a partir de `/`, o shell deve fazer uma operação **same-origin** real **sob `/sucafina/*`**, com credenciais do navegador restritas ao path, para a autoridade da instalação selecionada (ex.: F01 `GET /sucafina/api/ui/context` com o binding descoberto). O backend recebe o **Request original**, revalida sessão/roles/grants e responde com o contexto do owner corrente. O browser só recebe projeções tipadas; nunca recebe nem reconstitui cookie/token. Se descoberta, binding ou autenticação não forem comprovados, **nenhum owner é publicado**. `checkServerHealth` pode validar o servidor Orchestra, **não** substituir admissão humana.
3. **Fence de persistência.** `apps/web/src/entry.tsx` lê `orchestra.settings.dat:defaultServerUrl`; `packages/app-shell/src/context/server.tsx` hidrata `Persist.global("server", ["server.v3"])`, e `resolveServerList` ainda enumera entradas antigas. Esses dados são somente **candidatos de UI**, nunca owner. Antes de descobrir, selecionar, restaurar draft, executar F01/F02 ou tocar API privada, o fluxo web exige: origin do servidor selecionado **idêntico** a `window.location.origin`; instalação descoberta no **server atual** por fonte autorizada; tuple `installationId/projectId/hostId` igual ao binding corrente; stamp `principalRef/policyVersion/accessRevision` válido; epoch/generation inalterado após cada await. Origin diferente, outra instalação, stale server ou mudança de epoch => invalidar contexto/transport/drafts e negar a seleção, **sem** fallback automático. Remover conexão da lista genérica não é, isoladamente, a prova do fence.
4. **Ownership exclusivamente do factory.** A composição só aceita a instalação que o owner escolheu explicitamente via `loadSfInstallation` (factory local, caminho/origin validados) e identidade atual fornecida pelo host produtor. Query, localStorage, route params, cabeçalhos `Host`, `Origin`, `X-Forwarded-*`, parâmetros `installationId` e `projectId` **não são claims de ownership**. Identificadores enviados pelo cliente são apenas expectativas a comparar com `currentBinding()`; falha na comparação ou troca da instância durante a leitura => fail-closed. Nenhum grant inferido de descriptor, health ou sessão Orchestra genérica.
5. **Revogação e validade.** Expiração de 8 h, logout POST com Origin exato, revogação durável *antes* da remoção da sessão, rechecagem após leitura concorrente. Depois de logout/revogação/owner change, resposta não pode aproveitar contexto, operação ou draft em cache; requisições em voo não podem republicá-los. Sem refresh implícito, cookie ampliado, CORS amplo, cabeçalho de identidade sintetizado ou bypass por erro de transporte.

## HTTP observado / exigido

| Condição | Resultado |
| --- | --- |
| Sem sessão, cookie ausente em `/`, sessão expirada ou revogada em recurso protegido | **401** / `unauthenticated` (nunca 200 por health/redirect) |
| Sessão presente mas operação/projeto sem permissão; mutação com Origin errado/cross-site | **403** / `denied` (não mascarar como 401) |
| Host/produtor/reader indispensável indisponível | **503** / `unavailable` (nunca principal/ready fabricado) |
| Binding ou contrato inconsistente durante F01 | **409** `contract-mismatch` na implementação atual de F01; cliente invalida owner e não restaura estado |
| Redirect local já existente | **303 → /**, com cookie **Path=/sucafina** inalterado |

As classes de erro acima não são equivalentes. A implementação atual do `createSfContextHandler` mapeia `unauthenticated/denied/unavailable` para 401/403/503 e `contract-mismatch` para 409; o gate só pode sinalizar `ok` após autoridade real. Para `/`, sem uma chamada explícita autorizada sob o mount, o resultado é **não autenticado / sem owner**, não uma nova forma de login.

## Evidência de testes adicionada (não certifica o end-to-end)

- `modules/sucafina/Sucafinav1/test/t8-auth-frontier.test.ts`: cookie restrito + 303, sem sessão em raiz, isolamento por origin, 401 para anônimo/expirado/revogado, 403 para mutação com Origin falso, logout sem bypass, 503 quando F01 não tem host, troca de binding durante admissão, rejeição do loader de factory com caminho/origin inválidos. Usa authenticator/store reais para sessão; teste de F01 com host ausente **não** simula um grant positivo.
- `packages/app-shell/src/context/server.test.ts` (**asserções T8 nos casos existentes**, sem novo arquivo/caso no inventário de CI-APP-SRC): **honey de exposição**, prova que `resolveServerList` ainda enumera uma conexão estrangeira persistida. **Não** prova que essa conexão virou owner, nem afirma que o resolvedor genérico de multi-servidores deva eliminá-la.

## Pendências que esta fatia NÃO comprova

**P0 — execução de produção necessária, fora do escopo T8:** fence de seleção web após hidratação (`defaultServerUrl` + `server.v3`) e re-admissão original do owner a partir de `/` com cookie de path restrito, sem fabricar headers nem aceitar stale origin. Testar em browser instalado, cookie real enviado pelo navegador somente a `/sucafina/*`, binding/epoch e cancelamento entre awaits.

**P0 — prova integrada de factory e 401/403/503 no mesmo host:** montar factory autorizado, servidor Orchestra e F01 reais, negar outro installationId/hostId e testar 401/403/503 após logout/expiry/revocation ao vivo (e nenhum draft/contexto publicado). Testes de store, roteador e honey não são prova de autoria do factory, de CORS seguro nem de montagem autenticada do shell. Não alterar produção nesta PR; abrir fatia própria para ambos os P0s.

**Execução:** apenas CI via GitHub Actions; nenhum `bun test` local nesta tarefa. Não baixar gates nem transformar teste negativo em aceite.
