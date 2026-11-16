# AZ-02 — Pacote executável de contraprovas de identidade (A8)

**Estado em 2026-11-16:** `PREPARED_NOT_RUN`; `AZ-02=BLOCKED_BY_OWNER` (tenant/app/atores) e `BLOCKED_BY_ENV` (VM Azure Linux x64, HTTPS, mesmo candidato C). **Este documento e o runner não certificam login real, authZ ou go-live.** Owner A8 só publica em `sf/azure/identity/**`; PR #245 continua DRAFT. O trabalho do A7/A9/A10 e os workflows são somente leitura.

## 1 — Entrega e limites da prova

| Arquivo A8 | Uso |
| --- | --- |
| `sf/azure/identity/az02-proof.cjs` | Runner Linux x64 / Node >=20 sem dependências externas; HTTP real TLS, sem redirects, casos positivos/negativos, JSON sanitizado, exits `0=all-observed-pass`, `1=failed`, `2=blocked/invalid input`. |
| `sf/azure/identity/az02-proof.config.example.json` | Template não-secreto que deve ser copiado e preenchido em pasta privada, **nunca no repositório**. |
| Este runbook | Provisionamento Microsoft, sequência owner/VM, casos manuais adicionais, matriz de aceite, limites. |
| `AZ-02-W0-W1-handoff.md` | Levantamento das fontes e riscos estáticos anteriores; não substitui W4. |

**Proveniência do contrato:** `runtime/microsoft-configuration.ts`, `runtime/entra-client.ts`, `runtime/local-identity.ts`, `runtime/microsoft-policy.ts`, `local/entry.ts`, `apps/cli/src/sucafina-product/native-ui/context.ts`, `apps/cli/src/sucafina-product/native-ui/procurement.ts`, `runtime/procurement.ts` e `runtime/application.ts` no candidato a ser congelado. **Antes da execução, conferir novamente essas rotas e contratos no C; se mudou, revalidar e atualizar o pacote, sem aceitar teste obsoleto como PASS.** Em particular, `HEAD /api/ui/context` devolve 200 sem prova de identidade; `GET` sem três selectors devolve 400, não 401.

## 2 — Precondições que só o dono/A7 podem satisfazer

1. A10/A6 fornecem **candidato C congelado**: SHA de commit (40 hex), `git rev-parse HEAD^{tree}`, ID do run, attempt, jobs completos com `sf/verify` e digest SHA256 **do artefato efetivamente servido**. A7 atesta SO Linux x86_64, serviço, bind, topologia TLS, binário + `sha256sum`, mesmo C; qualquer diferença `BLOCKED`, não “equivalente”.
2. Dono/TI fornecem **tenantId** da Sucafina, **clientId** da App Registration Web criada em tenant autorizado, IDs imutáveis de grupos do tenant, OIDs de atores e grants explícitos por namespace/operação/human action. Aprovação formal de quatro papéis de prova (requester, holder, denied, security reviewer), planos de revogação, autorização de escrita **somente em request isolado não produtivo**. Nunca usar conta simulada ou autenticação local para certificar AZ-02.
3. A7 fornece `origin` **HTTPS FQDN real**, `mount` real (ex. `/sucafina`), `listenerOrigin` e `ingressOrigin` **HTTP fixos** da topologia aprovada (não extraídos de `X-Forwarded-*`), certificados válidos, host do proxy e bind `installationId/projectId/hostId` oriundos do produtor I00 **instalado**. O browser deve usar a MESMA origin pública que a aplicação; CORS `*`, `Access-Control-Allow-Credentials` cross-origin e injeção de Basic não são correções.
4. Fazer execução em **ambiente de validação controlado** no mesmo C e sem tocar registros reais. Para confirmar 422, escolher request de Procurement que esteja em **sourcing editable** e outro papel admitido pelo produtor; “enviei JSON inválido” não garante 422: 400/403/404 são resultados distintos.

## 3 — App Registration Microsoft Entra (procedimento EXATO do dono)

1. Entrar como administrador autorizado em **Microsoft Entra admin center** `https://entra.microsoft.com/` → **Identity → Applications → App registrations → New registration**. Nome sugerido `Orchestra SF Web – <ambiente>`. Em **Supported account types**, marcar **Accounts in this organizational directory only** (single tenant da organização recurso, não `common` nem multi-tenant).
2. Selecionar plataforma de **Redirect URI: Web** (não `Single-page application`, não Mobile/Desktop). Preencher **EXATAMENTE** `https://<PUBLIC_FQDN><SF_MOUNT>/auth/callback`. Se o mount aprovado for `/sucafina`, é `https://<PUBLIC_FQDN>/sucafina/auth/callback`. O valor deve casar **byte por byte** com `config.origin + config.mount + "/auth/callback"` do backend. O nome real do host **não está disponível**; não cadastrar URL fictícia, `localhost`, wildcard, `/signin-oidc`, ou callback de SPA. Se houver ambientes separados, cada origem/instalação é decisão explícita da TI; não usar lista genérica de redirects como bypass.
3. Após **Register**, em **Overview**, copiar `Directory (tenant) ID` e `Application (client) ID`; são identificadores públicos, não senha. Conferir `tenantId` com o resource tenant que emite `tid` e `iss=https://login.microsoftonline.com/<tenantId>/v2.0`. Para convidado B2B, usar identidade/oid do **tenant recurso**, não oid da home organization. Nenhum JWT assinado por outro tenant pode ser aceito.
4. **Authentication → Platform configurations → Web:** confirmar a única callback canônica; `Implicit grant and hybrid flows`: **NÃO marcar** `Access tokens` nem `ID tokens` (aplicação usa authorization **code** no backend confidencial com PKCE S256). Não habilitar “Allow public client flows”. Front-channel logout/SPA redirect não são requeridos pelo código.
5. **API permissions → Microsoft Graph → Delegated permissions → User.Read.** O próprio backend requisita OIDC `openid profile offline_access User.Read` (e chama `/me` e `/me/checkMemberGroups` com token delegado). Não adicionar `User.Read.All`, `GroupMember.Read.All`, `Directory.Read.All`, `Application.ReadWrite.All` ou **Application permissions** por hábito. Confirmar com administração que `User.Read` delegado cobre `/me/checkMemberGroups` nesse tenant e registrar aprovação/consentimento quando política exigir. Consentimento é ação humana, não assumida pelo script.
6. **Certificates & secrets → Client secrets → New client secret.** Escolher validade curta e rotação de acordo com a política. Copiar **Value** UMA ÚNICA VEZ, pelo canal de provisionamento secreto do dono diretamente para arquivo privado **`client-secret.txt`** da VM; **Secret ID não é Value**. Não enviar em chat, GitHub issues, Actions, browser, trace, application JSON, CI secrets ou `echo` de terminal. O backend **hoje exige client secret** (`web-confidential`), não suporta substituição transparente por certificado/Managed Identity. Planejar atualização para certificado/credencial federada, mas não inventar funcionalidade existente.
7. Em **Enterprise applications → <aplicação criada> → Users and groups**, conceder acesso e consentimento conforme política. Definir grupos de segurança para os papéis por **Object ID imutável**. A fonte `src/identity.ts` permite `dashboard:{admin,domain leader,contributor,viewer}`, `planner:{admin,finance,hr,budget owner,viewer}`, `procurement:{requester,buyer,approver,supplier admin,admin,viewer}`. A configuração tem `groups` por surface/role com valores `group:<GUID>`; **só grupos existentes com atribuição legítima**. O actor “denied” precisa autenticar para testar 403 de autorização: não atribuir grupo no surface alvo nem grant correspondente; se “Assignment required?” bloquear sign-in integralmente, usar outra identidade admitida na aplicação porém **sem papel/perm. na operação testada**. Registrar o desenho na matriz de atores sem publicar OIDs.
8. Para revogação, o dono deve aprovar remoção do grupo/grant do **requester**, preservando a sessão original, observar o **próximo request sem logout/login**, documentar horário/grant anterior/novo e efeitos de eventual propagação Microsoft/Graph. **Qualquer 200 após revogação = FAIL**, não “esperar cache limpar e declarar PASS” sobre o primeiro request.

Referências oficiais: `https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app`; `https://learn.microsoft.com/en-us/entra/identity-platform/howto-create-service-principal-portal`; `https://learn.microsoft.com/en-us/graph/api/directoryobject-checkmembergroups`; `https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow`. Os nomes de menus podem variar; os **valores e contrato** acima vêm da implementação efetivamente lida.

## 4 — Provisionamento servidor por service UID (A7 + dono; NUNCA via GitHub)

**Pasta de configuração é externa ao workspace de agents.** Executar como o UID real do serviço (ou preparar com `chown` autorizado, depois executar como tal) e ajustar caminhos escolhidos por A7. Exemplo de **layout**, não de valores reais:

```text
<PRIVATE_CONFIG_DIR>/                   0700  owner = service UID
  installation.json                    0600  sem secret embutido
  client-secret.txt                    0600  Microsoft Value, NUNCA para repository
  session.key                          0600  raw 32 bytes
  bank.key                             0600  raw 32 bytes, independente
  assets.key                           0600  raw 32 bytes, independente
  host-credential.key                  0600
  host-data/ host-config/ host-cache/ host-state/ host-tmp/ 0700
<WORKSPACE_DIR>/                       0700  externo, não ancestral/descendente do PRIVATE_CONFIG_DIR
<PRIVATE_PROOF_DIR>/                    0700  owner = operador do runner
```

Criar diretórios `install -d -m 700` com dono correto; `umask 077`; inicializar **três** arquivos distintos com `openssl rand 32 > "$PRIVATE_CONFIG_DIR/session.key"` e idem `bank.key`, `assets.key` (não usar base64: precisa de **32 bytes crus**). **Não regenerar keys da instalação existente**; quebraria a leitura de sessões/assets e identity binding. O `host-credential.key` precisa existir e ficar 0600 conforme runtime. Aprovisionar secret de modo não-econômico:
```bash
umask 077
# Execute como service UID, em sessão TTY controlada, sem xtrace e sem terminal gravado.
read -r -s -p 'Entra client secret Value: ' _sf_secret; printf '\n'
printf '%s' "$_sf_secret" > "$PRIVATE_CONFIG_DIR/client-secret.txt"
unset _sf_secret
chmod 600 "$PRIVATE_CONFIG_DIR/client-secret.txt"
test "$(wc -c < "$PRIVATE_CONFIG_DIR/session.key")" -eq 32
test "$(wc -c < "$PRIVATE_CONFIG_DIR/bank.key")" -eq 32
test "$(wc -c < "$PRIVATE_CONFIG_DIR/assets.key")" -eq 32
```

Config `installation.json` **exemplo incompleto intencionalmente** (preencher com dados **aprovados**; nunca colar em Issue/PR):
```json
{
  "version": 1,
  "deployment": "azure-https",
  "authentication": "microsoft",
  "origin": "https://<PUBLIC_FQDN>",
  "listenerOrigin": "http://<LISTENER_HOST>:<PORT>",
  "ingressOrigin": "http://<INGRESS_HOST>:<PORT>",
  "mount": "/sucafina",
  "tenantId": "<RESOURCE_TENANT_GUID>",
  "clientId": "<APP_CLIENT_GUID>",
  "groups": {
    "dashboard": {},
    "planner": {},
    "procurement": {
      "requester": "group:<IMMUTABLE_SECURITY_GROUP_GUID>",
      "approver": "group:<APPROVER_GROUP_GUID>"
    }
  },
  "grants": [
    {
      "principalRef": "<RESOURCE_TENANT_ACTOR_OID_GUID>",
      "namespaces": ["reviews"],
      "operations": [],
      "humanActions": []
    }
  ],
  "workspaceDirectory": "/ABSOLUTE/SEPARATE/WORKSPACE",
  "scanner": null,
  "sessionSeconds": 28800,
  "loginSeconds": 600
}
```
**Não inferir grants vazios ou o namespace `reviews` como autorização adequada ao fluxo de procurement**: o exemplo é restritivo, não é configuração produtiva pronta. O dono deve mapear operações/namespace/human actions **da autoridade original do produtor**, sob revisão de acesso mínimo; o `microsoftPolicy` valida names contra catálogo real. O serviço seleciona perfil Microsoft via **`SUCAFINA_MICROSOFT_CONFIG=<PRIVATE_CONFIG_DIR>/installation.json`**, e **não** `SUCAFINA_LOCAL_CONFIG`. O restante do ambiente exigido (`ORCHESTRA_DB`, `ORCHESTRA_INHERIT_CREDENTIALS=0`, `ORCHESTRA_CONFIG_DIR`, `ORCHESTRA_CREDENTIAL_KEY_FILE`, `TMPDIR`, `XDG_{DATA,CONFIG,CACHE,STATE}_HOME`) deve apontar para os subdiretórios privados sob o config-dir, conforme `requireLocalIsolation()`. Nenhum `Forwarded` fornecido pelo navegador pode redefinir a origem.

## 5 — Sequência mecânica de prova no host privado

**Nunca executar comando abaixo no runner de CI público.** Os dados de prova e cookies permanecem em host dedicado com mode 0700/0600. O script faz TLS verificado por Node, segue **zero** redirects, não exporta valores de cookies nem corpos de HTTP, e produz somente `id/expected/observed/result` por caso. A saída `PASS` é **apenas das chamadas observadas naquela fase**, não `AZ-02=PASS`.

```bash
set -euo pipefail
test "$(uname -s)" = Linux && test "$(uname -m)" = x86_64
node --version            # >=20
git rev-parse HEAD        # deve ser o mesmo C do recibo, não o PR merge ref errado
git rev-parse HEAD^{tree}
sha256sum "$SF_ARTIFACT_PATH" # digest deve casar artefato servido por A7
umask 077
E="$PRIVATE_PROOF_DIR"    # owner-controlled absolute dir, previamente 0700
install -d -m 700 "$E"
cp sf/azure/identity/az02-proof.config.example.json "$E/proof.json"
chmod 600 "$E/proof.json"
# DONO: substituir placeholders por origin, mount, tenant/client IDs, selector do host,
# C/artifact SHA256, runId/runAttempt e caminhos privados de cookies, sem exibir valores.
P="$(pwd)/sf/azure/identity/az02-proof.cjs"
node "$P" --config "$E/proof.json" --phase preflight --out "$E/preflight.json"
```

`preflight` é *safe*: não injeta sessão, só GET e POST de logout **sem cookie** (não altera identidade autorizada), e exige 303/PKCE/cookie de login sem navegar para Microsoft. Os requests de CORS/CSRF são **contraprova negativa**; qualquer 200 inesperado, redirecionamento no endpoint de contexto, 3xx para unauthorized, 503, 000, malformed ou rede indisponível falham a respectiva linha. Isso não cria conta Entra nem prova issuer/JWT.

**Atores reais**: cada um faz login interativo através de `https://<PUBLIC_FQDN><SF_MOUNT>/auth/login` em browser e perfil separados, 1) consentimento/CA e callbacks legítimos, 2) retorno seguro `/dashboard`/etc, 3) principal do resource tenant. Operador autorizado transfere **apenas** cookie opaco de sessão para arquivo privado por ator, com linha única `__Secure-sucafina_<12hex>_session=<64hex>`; cada arquivo 0600 e diretório 0700, sem `export COOKIE`, screenshot, copy em terminal gravado, email, console/PR/Actions. O browser jamais deve receber server secret/refresh token. Depois:
```bash
node "$P" --config "$E/proof.json" --phase actors --out "$E/actors.json"
```
Provar requester/holder `200` e stamps diferentes com `authMode=microsoft`, e `denied` `401/403`; validar CSRF **com sessão** e sessão preservada. Se o denied nunca conseguiu fazer login, a linha correspondente é **BLOCKED_BY_OWNER**, não falsificar sessão. O shell Web ainda tem bloqueio de `return-intent` em `packages/client/src/sucafina/transport.ts`; funcionamento do login direto não prova integração automática da UI/I00. Requer parecer independente sobre safeReturn, `shellOrigin == publicOrigin` e Network DevTools sem Bearer/Basic cross-origin ou secret no renderer.

**Produtor/CAS**: antes de executar, owner designa **um request de sandbox** já existente, visível e editável a requester, confirma que as duas operações de contraprova são **refusadas**, e autoriza `approvedForNegativeWrites=true` **somente neste ambiente**. Lembrar que a prova **exige acesso ao produtor original**; não sobrescrever `versions` por mock. Consultar `GET /api/ui/pages/CAP25?request=<ID>` para obter `value.versions["requests:<ID>"].version`. Preparar DOIS arquivos JSON **0600** na VM:
```json
{ "page":"Requests","action":"save","id":"<SANDBOX_REQUEST_ID>","version":0,"values":{} }
```
No `cas409BodyFile`, trocar `version:0` por **versão desatualizada comprovada** (diferente do registro atual). Para `validation422BodyFile`, usar **versão atual** e `values` de retenção inválida em estado de sourcing editável conforme `runtime/procurement.ts`; a forma exata e o estágio do registro devem ser **aprovados pelo produtor/A4**. Nunca supor que `values:{}` resulta 422 — pode produzir outra resposta. Ambos devem produzir `409`/ `422` **e preservar byte-a-byte a projeção+versão**. Reprovar se voltar `200`, 400, 403, 404, ou versão mudou; se não conseguir preparar estágio legítimo → `BLOCKED_BY_SOURCE/OWNER`.
```bash
# Após o dono autorizar e os dois JSON privados estarem prontos:
node "$P" --config "$E/proof.json" --phase producer --confirm-producer-writes --out "$E/producer.json"
```

**Revogação:** capturar primeiro `actors.json` de requester autenticado; administrador remove grupo/grant, documenta carimbo de tempo no registro protegido da Sucafina, **não realiza logout/login** e, sem retry “até ficar verde”, faz o próximo GET:
```bash
node "$P" --config "$E/proof.json" --phase after-revoke --out "$E/revoked.json"
```
Contexto e CAP25 devem retornar `401/403` com **cookie original**. Qualquer `200`, `503` ou stale stamp aceito é falha/bloqueio. O teste HTTP não substitui prova de *in-flight Task/Permission/Relay* antes/depois de `await`: revisor Security e A9 têm de provar cancelamento de work, source/binding fences e ausência de commit duplo em corrida autorizada.

**Logout e persistência:** após registrar revogação, operador confirma logout do requester (ainda com cookie antigo) e o replay. Este comando altera irrevogavelmente aquela sessão:
```bash
node "$P" --config "$E/proof.json" --phase logout --confirm-logout --out "$E/logout.json"
```
A7 então reinicia serviço mantendo business store e revocation state; produzir testemunho **privado** com logs reais `systemctl`, tempos de restart, SHA C e digest do binário servido. O runner exige `--restart-receipt` apontando para arquivo 0600 exatamente:
```json
{
  "schema": "sf.az02.a7-restart-witness.v1",
  "candidateSha": "<SAME_C_SHA40>",
  "artifactSha256": "<SAME_SHA256_HEX64>",
  "restartObserved": true,
  "witness": "<ID_OF_ACTUAL_A7_SERVICE_LOG_AND_EXTERNAL_REVIEW>"
}
```
O JSON é **declaração de evidência**, não prova autoautenticada; A1/Security deve validar logs originais de A7, processo, janela, backup e host. O script comprova o replay do cookie antigo negado no host reiniciado:
```bash
node "$P" --config "$E/proof.json" --phase after-restart \
  --restart-receipt "$E/a7-restart-witness.json" --out "$E/restart.json"
```

## 6 — Tabela exata de status e sinais (sem confundir categoria)

| Contraprova | Request / contrato do produtor | Resposta exigida |
| --- | --- | --- |
| Guest sem credencial | `GET /api/ui/context?installationId=I&projectId=P&hostId=H` | **401/403 JSON**, nunca 200; exige 3 IDs presentes mesmo quando guest. |
| Query sem IDs, duplicados, origin fora do allowlist | `GET /api/ui/context` sem os 3, ou `projectId` duplo, `Origin` externo / `Sec-Fetch-Site: cross-site` | **400**, não contar como guest auth. |
| Binding errado | `GET` com `installationId`, `projectId` ou `hostId` incorreto, um por vez | **409 JSON**, `status=unavailable`, `reason=contract-mismatch`; se I00 não instalado, 503=BLOCKED. |
| Requester / holder legítimos | `GET` correto com cookies **independentes** e papéis aprovados | **200 JSON** com `authMode=microsoft`, `stamp.principalRef/policyVersion/accessRevision`, `X-SF-*Revision`; não basta 200 HTML/status. |
| Denied | mesmo GET com identidade válida sem acesso à surface | **401/403**; login bloqueado pela Enterprise App não substitui negativa de autorização no servidor. |
| State sem challenge/cookie ou duplicado | `GET /auth/callback?state=...&code=...` sem challenge emitido | **403**; nunca obter sessão/cookie. |
| Login real | `GET /auth/login` e navigation Entra | **303** para issuer de tenant pinado, code+PKCE S256, callback exato, state e nonce, login cookie `Secure/HttpOnly/SameSite=Lax`. |
| CSRF de logout | `POST /auth/logout` sem `Origin`, origem externa ou cross-site, com/sem cookie | **403**, sem logout; validar que session ainda funciona depois. |
| CAS produtor (request sandbox) | `POST /procurement` com versão stale mas request visível | **409** + snapshot/version inalterados. |
| Validação produtor (request sandbox) | `POST /procurement` com versão atual e input inválido ao estágio | **422** + snapshot/version inalterados; 400=bad contract, 403=permission e 404=invisible **não** equivalem a 422. |
| Revogação | próximo GET com cookie autenticado **anterior à remoção do grupo/grant** | **401/403**, principal sem read/write; 200 ou timeout não é PASS. |
| Logout e replay | `POST /auth/logout` com `Origin` exata, depois GET com cookie anterior | **204** + limpar cookies e depois **401/403**, inclusive pós-restart A7. |

## 7 — Contraprovas MANUAIS adicionais (NÃO automatizadas, exigem ambiente e revisor)

- **Issuer/ID token/callback:** fazer login real do tenant; comprovar logs privados do backend com correlation ID sem tokens e verificar (`iss`, `aud`, `tid`, `oid`, RS256, nonce, Graph `/me` e `/me/checkMemberGroups`) contra documentação e sessão do provedor. Tentar code replay/expiração e callback state trocado **somente na VM de validação autorizada**; qualquer sucesso repassado/replay = FAIL. Não capturar URL de callback com `code` no arquivo público.
- **Authorization/source/binding:** troca de role, projet/installation/host/namespace e source com versões; denied não pode usar operações de requester nem acessar documentos ou dados do outro projeto. CAS verifica produtor original, não DTO simulado; contraprova de quarantine e mutation pertence A4/A9, não duplicar lease.
- **Cookies/origem:** inspecionar Application/Network no DevTools no browser *protegido*: cookies com `Secure, HttpOnly, SameSite=Lax, Path=<mount>`, ausência de token no `localStorage` ou renderer, CSP, `Access-Control-Allow-Origin` nunca permissivo; validar shell público e host sob mesma origem (ou front-door explicitamente aprovado). Confirmação precisa de revisor Security, sem upload de HAR com cookie/token.
- **CAS concurrent / revogação in-flight:** disparar requests assíncronos autorizados com pausa/fence no ambiente controlado, revogar role/source durante execução, esperar ausência de commit/outcome duplicado, efetivo `accessRevision` novo, sem fallback; contagem de transações duráveis e auditoria do produtor. O runner HTTP não sincroniza esse race e **não** o marca PASS.
- **Segredos persistentes:** confirmar permissões 0700/0600, owners, inexistência de secret em workspace, Git, process command-line, debug logs, arquivos de pipeline; rotação e expiração de secret em plano revisado. Testar cert/TLS e tráfego real no host; só no mesmo C.

## 8 — Recibo/parecer, sem green falso

Arquivos de saída no diretório privado: `preflight.json`, `actors.json`, `producer.json`, `revoked.json`, `logout.json`, `restart.json`. Cada um contém apenas status/casos e `candidateSha/artifactSha256/runId/runAttempt`. **Uma fase com 0 casos não passa.** Conferir `exit code` e que `counts.failed=0` em **todas** as fases efetivamente exigidas; 0 sozinho não certifica live Microsoft. Copiar para a pasta de evidência compartilhada **somente o resumo sanitizado** + hashes SHA256 dos próprios relatórios, nunca `proof.json`, cookie files, secrets, request body, screenshots de sessão, callback URLs ou logs com PII. Revisor independente confronta a forma sanitizada com os originais privados e assina (`revisor, função, C, artifact SHA, data UTC, casos, exceções`). Se algum caso carece de ator/tenant/VM/consentimento, classificar **BLOCKED_BY_OWNER/ENV/SOURCE**, nunca PASS/“N/A”.

**Separação de marcos:** CI full `sf/verify=success` no SHA C **não** valida AZ-02. `AZ-02` só pode ser aceito por **login Microsoft real + todas as negativas/positivas aplicáveis + A7 mesmo binário e revisão Security independente**. `AZURE_RELEASE_QUALIFIED` permanece bloqueado também por A7 (AZ-01/03), A9 (F04/AM01–06), A10 e autorização humana. A1 registra o conflito de contrato `SfTransport.login()=SF_NATIVE_RETURN_INTENT_CONTRACT_UNAVAILABLE` na Web; não inventar segundo OAuth ou “loginUrl”.
