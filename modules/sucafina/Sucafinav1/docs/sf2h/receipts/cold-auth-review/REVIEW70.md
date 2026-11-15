# Missão70 — revisão independente de autenticação

**Parecer: FIX-FIRST para o SHA `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85`, árvore `12594fd5a48f934847db717dd872d51776484296`.** Há três achados obrigatórios, todos de gravidade **P2 / média**, sustentados por sequências causais no código. As reproduções propostas **não foram executadas**. Três gates de prova/composição permanecem abertos. Ausência de prova não é aprovação.

| Identidade | Valor |
| --- | --- |
| Pacote da missão | [cold-auth-review.json](https://github.com/gustavomhss/Orchestra-SF/blob/173c3507e40579f1a1a2dfb068bda40084a678bc/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/cold-auth-review.json), blob `b4988fd5159b783cf6ff9c3e5c05fb6c81b0436c` |
| Planejamento | `dbf9547211d9b0fade619790de7c19c0869b7c7d` |
| Candidato de código revisado | `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85` / `12594fd5a48f934847db717dd872d51776484296` |
| Material C27 de origem do stack | `b10c424a6b318879fc30f11d03ba1cfeffda7d1a` / `31be8f81803b77f03e9089e09118f78218b26262` |
| Branch / lease documental | `cold-auth-review` / `cold-auth-review-browser70` |
| Consumidores | 60/S0; autoridade60 no pin original, lease encerrada antes desta publicação (ver reconciliação) |
| Revisor responsável | `/root`; modelo identificado pela sessão como GPT-6 Astra Pro; ID de provider e UUID da conversa não expostos |
| Leituras paralelas | `/root/identity_review`, `/root/http_review`, `/root/isolation_review`, todas somente leitura |

Esta entrega modifica somente documentos no diretório autorizado. Não houve autoria de produto pelos revisores nesta sessão, execução de testes, despacho de CI, typecheck, guard, build, deploy, login novo, acesso a valores de credenciais ou alteração de Azure. As leituras e a publicação remota usam GitHub MCP; atualização da branch exige CAS, sem force.

Os autores/owners de origem são identificados pela proveniência de cada seção: Microsoft49 e composição55; runtime/local-store recomposto em C27; Procurement canônico e proposta53; proposta52 separada. Essa proveniência não equivale a atestar a identidade histórica de todos os autores. Nenhum transcript ou parecer do autor é usado como prova independente. `HANDOFF70.json` identifica a entrega documental e solicita ACK de60.

**Esta é uma única revisão delimitada.** As três leituras paralelas não são as três revisões FINAL. Não se fecha `WP10.T03.DOD.01/40`, AM, oito seleções finais, C-G7/D-G8 ou aceite da campanha. Qualquer delta material exige rechecagem independente.

## Reconciliação antes da publicação

Durante a revisão, `sf2-stack` avançou para **C28**, material `d088708276b48f896ad4e0ecd2a95cb73dc413b1`, e terminal `faa30fddb7e7b61696b66fd069f51cf18c51125f`, árvore `b3b4f89ddd6a3ca5d570681f91098214b5ce935d`. O [recibo de autoridade60](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/after-c27-60/AUTHORITY.json), blob `83e9c35441aa09e8d81e35bfb8e1a711322e8bf9`, encerra explicitamente a lease e não nomeia sucessor.

A comparação remota mostra dois commits e282 caminhos alterados desde o pin; dentre os38 arquivos de cobertura direta desta revisão, `product/integration/product-authority.ts` mudou para `8d563561be19d4f50a68033d4ba4ac2bf8cb3ea0`. Isso é registro de drift, não revisão do delta. **O parecer continua exclusivamente em7e1a36e; C28 não foi aprovado nem qualificado por70.** A branch documental não foi rebased e o PR não integra produto.

60/S0 continuam destinatários do handoff. Toda referência a60 como integrador descreve a autoridade do pin original; após o terminal, correções e integração dependem de retomada ou sucessor explicitamente autorizado. Esta entrega não reativa60 nem ocupa a autoridade do stack. ACK do consumidor será solicitado, sem presumir recebimento.

## Resultado e política de evidência

| ID | Achado | Gravidade | Disposição |
| --- | --- | --- | --- |
| M70-AUTH-01 | Estado de autenticação sem retenção/capacidade limitada | P2 / média | Corrigir antes de aprovação desta fronteira |
| M70-ISO-01 | Status distingue PR oculta de ID inexistente | P2 / média | Corrigir antes de aprovação desta fronteira |
| M70-HTTP-01 | Body Node sem Content-Length perde cutoff incremental | P2 / média | Corrigir e qualificar no listener composto |

`CONFIRMED_BY_SOURCE_NOT_EXECUTED` significa que as condições, branches e efeitos estão demonstrados no código fixado; não significa que um ataque foi executado ou que uma indisponibilidade foi observada. `NOT_PROVEN` registra prova obrigatória ausente deste pacote, sem inferir sucesso nem falha real do sistema externo. Controles positivos abaixo são observações de fonte, não um PASS global. O índice estruturado está em [FINDINGS70.json](FINDINGS70.json); a cadeia de evidências, blobs e cobertura, em [EVIDENCE70.json](EVIDENCE70.json).

## Achados obrigatórios

### M70-AUTH-01 — Estado de autenticação pode crescer sem retenção/capacidade limitada

**P2 / MEDIUM; obrigatório; CONFIRMED_BY_SOURCE_NOT_EXECUTED.** Revisão: /root + /root/identity_review. Proveniência: Microsoft49; current C27 local-store integration. Full historical model/session identities are not independently established; no FINAL independence gate is claimed.

**Pré-condições.** Instalação Microsoft ativa e ingresso alcançável com Host/origem configurados. Para challenges: discovery/authorization disponível; nenhum login concluído é necessário. Para logout: prefixo público de cookie conhecido e handle de 64 hex; Origin correta não autentica um cliente HTTP.

**Evidência primária.**

- [runtime/local-identity.ts:62–78](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/local-identity.ts#L62-L78) — retire cria marcador durável e entrada no Map para qualquer handle sintaticamente aceito; só limpa expirados do Map ao executar novo retire.
- [runtime/local-identity.ts:119–142](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/local-identity.ts#L119-L142) — logout sem sessão válida chama retire; GET login cria challenge novo sem retirar o anterior.
- [runtime/local-identity.ts:94–109](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/local-identity.ts#L94-L109) — expiração impede uso da sessão, mas não elimina o payload.
- [runtime/local-store.ts:366–388](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/local-store.ts#L366-L388) — put UPSERT; get filtra expires_at; take/remove apagam exclusivamente uma chave.
- [local/entry.ts:162–173](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/local/entry.ts#L162-L173) — rotas de autenticação são atendidas antes da autenticação de negócio.
- [local/entry.ts:123–123](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/local/entry.ts#L123-L123) — agendamento de jobs habilitado pelo perfil operator; busca limitada não encontrou retenção de autenticação nesses jobs.

**Sequência causal.**

1. GET /auth/login gera state único e persiste challenge criptografado. Abandonar o callback conserva a linha depois do expires_at.
2. Uma sessão legítima que vence sem logout também deixa seu payload criptografado na tabela; o filtro de expiração recusa autenticação e não realiza exclusão.
3. POST /auth/logout com um handle nunca emitido, porém sintaticamente válido, cria revoked-session/revoked-login e entrada retiring antes de tentar remover a chave original inexistente.
4. Cada handle diferente cria uma linha adicional. Os marcadores têm validade de 8h/8h10m. As entradas do Map permanecem até um novo retire remover as expiradas; cada retire percorre suas entradas. Não existe quota demonstrada nesse caminho.
5. Busca textual integral nos 36 arquivos runtime e 12 local fixados encontrou usos da tabela apenas em local-store.ts e exclusões por chave, sem sweep por expiração.

**Impacto.** Crescimento persistente da tabela, retenção desnecessária de ciphertext de autenticação e consumo de memória/CPU/SQLite. Indisponibilidade é impacto potencial, não medido. Não demonstra plaintext de tokens. Não demonstra sessão expirada aceita. Não demonstra bypass OIDC nem CSRF de navegador. Não afirma ausência de rate limit/GC administrados fora do conjunto inspecionado.

**Reprodução proposta, não executada.**

1. Medir contagem da tabela sem imprimir payloads; iniciar N logins sem callbacks; avançar além do TTL e executar a manutenção normal.
2. Em outro caso, concluir uma sessão e deixá-la vencer sem logout; observar retenção e recusa da sessão separadamente.
3. Enviar um número pequeno e controlado de logouts com handles distintos nunca emitidos, origem correta e sem sessão legítima; observar linhas e Map.
4. Após correção, verificar expurgo limitado e ausência de novos marcadores para handles nunca emitidos; não executar carga destrutiva.

**Correção requerida.** Registrar duravelmente emissão/consumo/revogação e correlação de callback em andamento. Não persistir revogação para handle nunca emitido; preservar cancelamento de challenge já consumido por callback pendente. Implementar expurgo por lotes fora de leituras/transações de negócio e capacidade compartilhada de emissão. Reter fences até nenhum callback/sessão derivada admissível poder sobreviver; preservar criptografia e idempotência. O desenho completo e os discriminantes estão em [REMEDIATION70.md](REMEDIATION70.md#auth-01).

**Owner e rechecagem.** 60 encaminha para owner ativo de autenticação49/sucessor e runtime/local-store59; 70 não materializa produto. Após a correção, writer e lane Actions autorizada, coordenada por60/45 deve produzir evidência dos casos afetados no candidato exato; a rechecagem cabe a revisor independente designado, sem autoria da correção. Critérios: `mission70.acceptance[0] (session/storage)`, `WP10.T03.QLT.01`, `WP10.T03.QLT.40`.


### M70-ISO-01 — Status HTTP distingue requisição Procurement oculta de ID inexistente

**P2 / MEDIUM; obrigatório; CONFIRMED_BY_SOURCE_NOT_EXECUTED.** Revisão: /root + /root/isolation_review; contraleitura /root/identity_review. Proveniência: Domínio Procurement e Application canônicos integrados; proprietário exato da correção deve ser designado por60.

**Pré-condições.** Ator A autenticado, canWrite, nome próprio no diretório e somente papel requester em Procurement. Requisição de B possui createdBy diferente de A; A não tem buyer/approver/supplier admin/admin/viewer. ID candidato conhecido ou fornecido ao cenário; não se afirma enumeração prática de UUIDs. Request POST válido e mesma origem.

**Evidência primária.**

- [src/requests.ts:3–8](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/src/requests.ts#L3-L8) — requester-only vê apenas createdBy próprio.
- [src/nav.ts:129–145](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/src/nav.ts#L129-L145) — requester pode acessar a página Requests.
- [runtime/application.ts:84–128](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/application.ts#L84-L128) — autenticação/role/canWrite/diretório precedem execute, sem ACL desse ID.
- [runtime/application.ts:456–507](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/application.ts#L456-L507) — schema aceita action save, id string, versão inteira não negativa e values vazio.
- [runtime/procurement.ts:473–487](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/procurement.ts#L473-L487) — ausência 404; invisível e versão divergente 409; versão coincidente chega à negativa save 403.
- [runtime/contract.ts:100–102](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/contract.ts#L100-L102) — conflito compara versão antes da negativa de edição.
- [runtime/application.ts:347–350](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/application.ts#L347-L350) — status do domínio vira status HTTP e result.ok=false impede commit.
- [runtime/application.ts:510–521](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/application.ts#L510-L521) — safeFailure redige campos, mas conserva status.

**Sequência causal.**

1. Enviar save para ID inexistente retorna404 na linha475.
2. Enviar o mesmo comando para ID invisível existente retorna409 se a versão diverge; o payload privado é removido nessa branch.
3. Se a versão coincide, requester A não satisfaz prEdit/sourceEdit/poEdit e save retorna403 na linha487.
4. A camada HTTP preserva404/409/403. Logo a existência é distinguível sem acertar a versão; tentativas também distinguem acerto de versão.

**Impacto.** Divulgação de existência de registro fora do escopo e observação de igualdade de versão por status. Não há leitura de campos privados nem alteração demonstradas. Não demonstra obtenção do autor, conteúdo ou enumeração de IDs desconhecidos. Não demonstra commit: todos os ramos usados retornam ok:false. Não é bypass financeiro/aprovação.

**Reprodução proposta, não executada.**


Proposta de request para uma fixture isolada, com sessão válida de A e origem configurada:

```json
{"page":"Requests","action":"save","id":"<candidate-id>","version":0,"values":{}}
```

| Alvo do mesmo request | Status deduzido do código |
| --- | --- |
| ID inexistente | 404 |
| PR invisível de B com versão positiva | 409 |
| Mesma PR invisível com versão corrente enviada | 403 |

A existência se distingue mesmo sem acertar a versão. As duas respostas para registro existente não equivalem à resposta para registro ausente.


**Correção requerida.** Para ações sobre registro existente, decidir visibilidade antes de expor existência/CAS/versão. Usar a mesma resposta pública para registro inexistente e inacessível, sem stored/by/currentVersionCAS privados. Preservar CAS409 para atores autorizados, criação e regras atuais de transição/holder/alçada. O desenho completo e os discriminantes estão em [REMEDIATION70.md](REMEDIATION70.md#iso-01).

**Owner e rechecagem.** 60 encaminha ao owner canônico Procurement e coordena Application somente se necessário. Após a correção, writer/lane autorizada deve produzir evidência dos casos afetados no candidato exato; a rechecagem cabe a revisor independente designado, sem autoria da correção. Critérios: `CAMP.INV.04`, `CAMP.CMP.02`, `CAMP.CMP.03`, `C03`, `C08`, `WP10.T03.QLT.40`.


### M70-HTTP-01 — Body sem Content-Length perde o limite incremental na ponte Node → Web

**P2 / MEDIUM; obrigatório; CONFIRMED_BY_SOURCE_NOT_EXECUTED.** Revisão: /root + /root/http_review; contraleitura /root/identity_review. Proveniência: Microsoft49/55 instalação; host C27 e Effect4.0.0-beta.83. Proposta52 não integrada.

**Pré-condições.** Instalação SF e runtime Workbench disponíveis. Ingresso aceita body sem Content-Length, Host e Origin configurados, Content-Type application/json. Sem limite externo independente mais restritivo demonstrado; o ambiente implantado não foi inspecionado.

**Evidência primária.**

- [packages/server/src/body-limit.ts:25–43](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/server/src/body-limit.ts#L25-L43) — Content-Length é verificado; MaxBodySize é fornecido, sem contador próprio do middleware.
- [apps/cli/src/sucafina-product/installation.ts:38–49](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/installation.ts#L38-L49) — HttpServerRequest.toWeb recebe o request Node sanitizado.
- [packages/effect/src/unstable/http/HttpServerRequest.ts:1032–1059](https://github.com/Effect-TS/effect/blob/cd7ab658994104bd6fe8f841f1440bea32c387f5/packages/effect/src/unstable/http/HttpServerRequest.ts#L1032-L1059) — toWeb usa self.stream no caminho Node; Web Request prévia é caminho diferente.
- [packages/platform-node/src/NodeHttpIncomingMessage.ts:117–139](https://github.com/Effect-TS/effect/blob/cd7ab658994104bd6fe8f841f1440bea32c387f5/packages/platform-node/src/NodeHttpIncomingMessage.ts#L117-L139) — stream chama fromReadable sem MaxBodySize; arrayBuffer consulta esse limite.
- [packages/platform-node-shared/src/NodeStream.ts:361–393](https://github.com/Effect-TS/effect/blob/cd7ab658994104bd6fe8f841f1440bea32c387f5/packages/platform-node-shared/src/NodeStream.ts#L361-L393) — pull não conta o total; cleanup do readable existe.
- [product/interface/http.ts:90–103](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/interface/http.ts#L90-L103) — request.text precede verificação de65536 bytes e ui.admit.
- [runtime/application.ts:60–86](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/application.ts#L60-L86) — product handler é chamado antes do parser base limitado e da autenticação da página.
- [local/entry.ts:128–141](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/local/entry.ts#L128-L141) — Workbench recebe serviços do host e compõe fallback product.
- [local/entry.ts:233–239](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/local/entry.ts#L233-L239) — ausência de pessoa só redireciona GET; POST segue ao handler.
- [apps/cli/src/sucafina-product/host-context.ts:800–803](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/host-context.ts#L800-L803) — identidade de host instalado habilita runtime, não sessão Microsoft do caller.
- [apps/cli/src/sucafina-product/host-context.ts:836–852](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/host-context.ts#L836-L852) — cadeia productHttp antecede fallback; services disponíveis por identidade do host.

**Sequência causal.**

1. Sem Content-Length, a rejeição por tamanho declarado não ocorre.
2. toWeb converte self.stream em ReadableStream; o getter Node utilizado não aplica MaxBodySize.
3. Com runtime disponível, sf=workbench-command passa fences públicos de origem/Host e roteamento.
4. request.text acumula o body antes deEOF; só então verifica65536 bytes e posteriormente admite o usuário.
5. Parser limitado da aplicação base não cobre o caso, porque product já recebeu o request antes dele.

**Impacto.** Ausência de cutoff incremental permite consumo de memória proporcional ao corpo antes da autenticação/admissão. Indisponibilidade é potencial e depende da exposição; nenhum OOM foi provocado ou observado. Não demonstra leitura privada ou mutação sem autorização. Não afirma ausência de timeouts, falta absoluta de cleanup ou inexistência de proxy limit. Não é finding de duplex ausente: duplex half já existe. Não atribui comportamento executado de chunked aos testes GET.

**Reprodução proposta, não executada.**

1. Disponibilizar runtime; usar Host/Origin públicos corretos, application/json, sem cookie e sem Content-Length.
2. Transmitir mais de65536 bytes em quantidade controlada, mantendo EOF pendente por intervalo limitado.
3. Depois da correção, observar corte/413 ao ultrapassar teto, antes deEOF, com cleanup e sem chegar ao consumidor protegido. Não gerar carga destrutiva.

**Correção requerida.** Limite incremental na rota antes de text/buffer e limite efetivo na ponte Node→Web. Propagar cutoff/413 sem expor causa privada; cancelar e liberar reader preservando abort/disconnect. Reconciliar16MiB global com limites próprios, incluindo contrato25MiB; preservar uploads binários válidos. Integrar qualquer solução52 somente com release, mapa novo e fixture coerentes, seguida de prova no candidato composto. O desenho completo e os discriminantes estão em [REMEDIATION70.md](REMEDIATION70.md#http-01).

**Owner e rechecagem.** 60 coordena owner ativo do transporte Microsoft49/52 e host; sem mudança de engine por70. Após a correção, writer e Actions autorizada deve produzir evidência dos casos afetados no candidato exato; a rechecagem cabe a revisor independente designado, sem autoria da correção. Critérios: `mission70.acceptance[1] (Node/Effect body seam)`, `C08`, `WP10.T03.QLT.01`, `WP10.T03.QLT.40`.

## Controles e fronteiras examinados

A tabela registra controles efetivamente encontrados; os achados e os gates continuam prevalecendo.

| Fronteira | Observação de código | Evidência fixada e limite |
| --- | --- | --- |
| OIDC, PKCE, nonce, JWKS | State ligado ao browser e consumido uma vez; PKCE S256; ID token com RS256, issuer, audience, tid/oid/nonce e tempos verificados; Graph `me` deve corresponder ao oid | [runtime/entra-client.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/entra-client.ts#L127-L146); [runtime/local-identity.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/local-identity.ts#L145-L169). Provider real não exercitado por70. |
| Tenant, principal e papéis | Tenant/app explícitos; grupos por UUID, papéis canônicos e grants por object ID; resposta de membership não pode inventar IDs fora da consulta | [runtime/entra-client.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/entra-client.ts#L189-L217); [runtime/microsoft-policy.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/microsoft-policy.ts#L12-L34); [runtime/microsoft-configuration.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/microsoft-configuration.ts#L67-L81). Nome/email não concedem papel. |
| Segredos e cookies | Chaves privadas separadas do workspace, verificações de owner/modo/link; ciphertext AES-GCM com AAD da chave; cookies opacos host-only, Secure/HttpOnly/SameSite=Lax | [runtime/microsoft-configuration.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/microsoft-configuration.ts#L22-L43), [runtime/microsoft-configuration.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/microsoft-configuration.ts#L84-L98); [runtime/local-identity.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/local-identity.ts#L49-L104). AUTH-01 trata retenção, não quebra de criptografia. |
| Refresh/logout | Expiração absoluta não é estendida; callback/refresh/Graph rechecados contra revogação durável e sessão atual; Map coordena refresh da instância | [runtime/local-identity.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/local-identity.ts#L145-L202). Preservar esses fences ao corrigir AUTH-01; concorrência do candidato integrado permanece sem execução70. |
| Origem, proxy e CSRF | Host/origem fixos; Forwarded/X-Forwarded removidos antes de toWeb; rewrite usa origem HTTPS configurada; métodos inseguros Microsoft exigem Origin exata e recusam cross-site | [apps/cli/src/sucafina-product/installation.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/installation.ts#L29-L49); [runtime/microsoft-installation.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/microsoft-installation.ts#L29-L38); [local/entry.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/local/entry.ts#L162-L165). Host/Origin públicos não substituem isolamento de rede do proxy. |
| Privacidade HTTP | Tracing desabilitado antes de servir o listener Microsoft; logger desabilitado; erro do bridge retorna503 vazio | [apps/cli/src/commands/handlers/serve.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/commands/handlers/serve.ts#L160-L167); [apps/cli/src/sucafina-product/installation.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/installation.ts#L35-L49). [Tracer upstream](https://github.com/Effect-TS/effect/blob/cd7ab658994104bd6fe8f841f1440bea32c387f5/packages/effect/src/unstable/http/HttpMiddleware.ts#L175-L208) consulta disable antes de criar span; logs externos não inspecionados. |
| C01/C08/C16: contexto e reenvio | Principal deve coincidir entre superfícies; grants/roles/scopes/política compõem accessRevision; admission usa contexto por identidade de objeto e consumo único; replay reautoriza principal, alvo e encarnação | [product/integration/product-authority.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/integration/product-authority.ts#L87-L117); [product/integration/ui-authority.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/integration/ui-authority.ts#L26-L78); [product/host-binding/state-provider.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts#L100-L126). Não fecha todas as provas residentes/AM. |
| Fonte e isolamento Procurement/C17 | Fonte é vinculada a Request/principal/accessRevision/policyVersion; projeção deriva de `domain.view` autorizado; grant revalidado ao emitir e resolver | [product/procurement/sources.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/procurement/sources.ts#L19-L30), [product/procurement/sources.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/procurement/sources.ts#L64-L81); [product/procurement/source-projection.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/procurement/source-projection.ts#L18-L37). Não elimina o oráculo do comando ISO-01. |
| Ação humana/admissão Procurement | POST/origem e digest vinculam intenção; admission53 requer current síncrono dentro da transação canônica e consumo único | [product/integration/human-authority.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/integration/human-authority.ts#L24-L45); [product/procurement/decision-preparation.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/procurement/decision-preparation.ts#L156-L178). Ligação instalada ausente: G03. |

A contraleitura recusou duas generalizações: não há fundamento para “duplex ausente”, pois o upstream já configura `duplex: "half"`; e há cleanup do readable no upstream, embora a prova de aborto no produto esteja aberta. O problema ISO-01 é a distinção por status.

## CI existente: resultado observado e alcance exato

Foram abertos os metadados dos runs/jobs, os logs originais, a request, o workflow e as comparações remotas W→S. Cada S tem o W indicado como único pai e acrescenta apenas `.ci-run.json`. A seleção Bun tem nove arquivos, sem Playwright. Não foi disparado novo run.

| Execução | W | S / head_sha do run | Run / job de teste | Resultado nos logs |
| --- | --- | --- | --- | --- |
| 49-01 | `63eb9626a437af7df11966fbbb86cbb2d4ad287d` | `8be70804ce551a471a733a38ef0b72fbf3d53921` | [43655093802 / 132631762058](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43655093802/job/132631762058) | 159 pass; 2 fail; 1198 expect; 161 testes/9 arquivos |
| 49-02 | `43bddf0a39a815359a2139da003d6fcf1f86447e` | `61d531f6be247e26dc66836effc427ba7403fce6` | [43655680707 / 132633538531](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43655680707/job/132633538531) | 162 pass; 0 fail; 1216 expect; 162 testes/9 arquivos |

O primeiro run falha no controle de captura de tracing e ao resolver `@effect/platform-node` para o arquivo Node. O segundo registra sucesso. A falha anterior permanece no histórico; a revisão não a apaga nem apresenta o segundo resultado como execução do stack.

Ambos: evento push, tentativa1, job Ubuntu24.04; request blob `809d91cce8eac41db2c0fdee8b3c0a80596ce16f`; workflow blob `9f078f4e37b758691bcd073e5590f05d5444392a`. Os endpoints de artifacts retornaram `total_count:0`. Não existe artifact/trace/hash de archive admitido desses runs. Cleanup success não é prova isolada de remoção da branch, pois o comando tolera erro.

Há diferenças materiais verificadas: `runtime/local-store.ts` é `b753e3ffbfcdc06de373388845c686afac26dec8` no W49-02 e `666259511ad459629ef52f48aca20b231b0dff4b` no candidato revisado. A [fixture de origem](https://github.com/gustavomhss/Orchestra-SF/blob/43bddf0a39a815359a2139da003d6fcf1f86447e/modules/sucafina/Sucafinav1/test/microsoft-login/integration-fixture.ts#L11-L26) pode importar um postimage temporário; a fixture integrada importa o canônico após validar o mapa. Portanto, **162 pass não qualifica `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85`/C27**, nem Microsoft/B2B real, typecheck, guards ou gates finais.

## Microsoft49, mapa55 e proposta52

Confrontados os17 arquivos próprios de49 no W real com seus blobs no SHA revisado, mais os3 arquivos compartilhados do mapa: **20 identidades materiais**, registradas em EVIDENCE70. Dos17 próprios,16 mantêm bytes; a fixture de integração muda explicitamente. O mapa55 tem blob `302334c0e5a50c681005d6c6463132abce84d8b1`; seus três postimages correspondem aos canônicos:

| Arquivo | Blob integrado |
| --- | --- |
| `local/entry.ts` | `0591ee43590b6db4f7b574b071eaada8346ccc1f` |
| `apps/cli/src/sucafina-product/installation.ts` | `21236af83e4de879242fd298d9e15a9923f3bf41` |
| `apps/cli/src/commands/handlers/serve.ts` | `1356a4c3099d10c62e470142209ced0f8033a6e1` |

O manifest49 `89d033326a26ed4c0674a85a5e2ba86a2799d36e` e os seis pre/postimages arquivados foram abertos; seus Git blobs coincidem com os declarados. A [fixture integrada](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/test/microsoft-login/integration-fixture.ts#L12-L29) conserva checagens de origem e importa o arquivo canônico. Essa constatação é estática;70 não executou a fixture nem afirma ter recalculado todos os SHA256 de arquivos de autor.

A proposta52 foi lida pelo [blob exato `5d9fe7ec2f070dbbedc2bdbfff4c8458e1187437`](https://api.github.com/repos/gustavomhss/Orchestra-SF/git/blobs/5d9fe7ec2f070dbbedc2bdbfff4c8458e1187437), não atribuída ao arquivo canônico da branch produtora. Ela usa `sanitized.arrayBuffer` e propaga seletivamente o erro de limite. **Não está integrada e não recebe aprovação.** O mapa novo proposto `b572fbf4525e2d5015a1e8d4245c96085703e1c1` e o lookup da fixture `bc427a51fe2f0d86d791fc9010cdbad9524ea5a1` só podem entrar com release e composição coerentes, mantendo o mapa55 e archives originais byte-idênticos. Seus campos históricos de base/preimage não são o CAS atual de60.

O owner ainda deve reconciliar16MiB globais com25MiB permitidos para contrato em [runtime/application.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/application.ts#L816-L821). A proposta reforça o teto no caminho chunked, mas não decide a política de tamanho nem comprova transporte/cancelamento. O gate de POST Node permanece aberto.

## Gates obrigatórios e parecer para60/S0

### M70-G01 — Microsoft/B2B e ingresso HTTPS reais sem prova admitida

**NOT_PROVEN; obrigatório; não é por si só um defeito demonstrado.** Owner autorizado deve fornecer recibo expurgado com candidato exato, tenant/app configurados, membro/convidado B2B, consentimento, papéis e remoção real de acesso, refresh/logout/restart, HTTPS/origem/proxy privado e redaction dos logs externos. Esta missão não inicia login/Azure/credenciais.

Evidência: [test/microsoft-login/oidc-fixture.ts:19–27](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/test/microsoft-login/oidc-fixture.ts#L19-L27); [test/microsoft-login/oidc-fixture.ts:55–67](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/test/microsoft-login/oidc-fixture.ts#L55-L67); [test/microsoft-login/oidc-fixture.ts:94–108](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/test/microsoft-login/oidc-fixture.ts#L94-L108).

Responsável: 60/S0 coordenam owner Microsoft e frente de implantação já existente.

### M70-G02 — Source CI49 não qualifica C27 nem POST Node com corpo

**NOT_PROVEN; obrigatório; não é por si só um defeito demonstrado.** Após correções e integração autorizada, W/S/run/job/logs no candidato composto com POST válido/negativo, chunked, limite, binário e aborto. Reexecutar apenas discriminantes afetados no lane existente; missão70 despacha zero testes.

Evidência: [test/microsoft-node.test.ts:53–105](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/test/microsoft-node.test.ts#L53-L105); [test/microsoft-composition.test.ts:39–43](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/test/microsoft-composition.test.ts#L39-L43); [test/microsoft-composition.test.ts:91–104](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/test/microsoft-composition.test.ts#L91-L104); [test/microsoft-login/integration-fixture.ts:12–29](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/test/microsoft-login/integration-fixture.ts#L12-L29).

Responsável: 60 coordena qualificador;45 conserva compiler/check workflow.

### M70-G03 — Admission53 não está ligada à transação HTTP canônica

**HOLD_INERT_NOT_INSTALLED; obrigatório; não é por si só um defeito demonstrado.** 60/owner autorizado devem instalar hook de admissão vinculado ao Request/contexto/command exatos, dentro da transação após fresh auth, imediatamente antes de um único execute. Qualificar no produto composto. Preservar edição direta autorizada, CAS, holders e alçadas. M31/MI07 original permanece aberto; draft-save→submit→approve de valor congelado não fecha substituição ainda não gravada seguida de Apply.

Evidência: [product/procurement/decision-preparation.ts:67–70](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/procurement/decision-preparation.ts#L67-L70); [runtime/application.ts:28–43](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/application.ts#L28-L43); [runtime/application.ts:304–306](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/runtime/application.ts#L304-L306); [index.ts:12–32](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/index.ts#L12-L32); [apps/cli/src/sucafina-product/business-services.ts:651–660](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/business-services.ts#L651-L660); [test/product/procurement-approval-closure/admission.test.ts:126–144](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/test/product/procurement-approval-closure/admission.test.ts#L126-L144); [apps/cli/src/sucafina-product/procurement-scenario-services.ts:19–33](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/procurement-scenario-services.ts#L19-L33).

Responsável: 60 + owner Procurement53/Decisions designado; S0 decide aceite.


A revisão70 também **não fecha** os discriminantes C17/mistos já mantidos pela integração57: rotação legítima de escopo do original, fallback Planner gravado, tombstone/recriação de mesma ID e revogação/aborto entre observações. O [registro fixado de dependências57](https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/closure-intake-57/dependency-closure-final.json) serve como índice de obrigações herdadas; seu relato não substitui execução independente. Esta revisão não amplia a autorização para implementá-las.

### Encaminhamento concreto

Solicitar ACK documental de60/S0 sobre o parecer e as identidades entregues. A designação dos writers de AUTH-01/ISO-01/HTTP-01 depende de retomada ou sucessor explicitamente autorizado de60, preservando G01–G03 como gates. Owners corrigem somente sob autoridade vigente;45 conserva compiler/check workflow; a integração requer retomada ou sucessor autorizado de60;S0 conserva aceite. Após release do delta, a rechecagem deve citar novo SHA/tree, blobs, discriminantes executados e consequências, sem transferir o PASS antigo ou aceitar a própria correção.

Critérios de método: [WP10.T03 no actorpack S2-R2](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/execution/actors/S2-R2.json) e [axiomas CAMP/WP10](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/axiom-index.json). Foram lidos START, WORKFLOW, COMMON, actorpack completo e partes aplicáveis dos quatro anexos obrigatórios; as identidades estão em EVIDENCE70.

**Disposição terminal desta missão: revisão documental entregue; FIX-FIRST permanece; GLOBAL_RELEASE=false.** ACK do consumidor não é presumido. A branch de revisão não autoriza merge, correção de produto, ativação53, release52, alteração de alçada ou substituição das três revisões finais.
