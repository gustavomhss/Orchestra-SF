# AZ-02 — Entra/OIDC, origens, sessão e binding: auditoria A8 W0/W1

**Data:** 2026-11-16 · **Agente/branch:** A8 / `sfa-identity` · **Alvo:** Web + Linux x86_64 na Azure VM.  
**Resultado:** `W0_INVENTORY=COMPLETE`, `W1_STATIC_REVIEW=COMPLETE`, `AZ-02=BLOCKED_BY_OWNER`, `AZURE_RELEASE_QUALIFIED=BLOCKED`. **Nenhuma prova real de tenant, sessão ou VM foi executada; nenhuma mudança de segurança foi declarada validada.**  
**Limite do lease:** somente `sf/azure/{identity,security}/**` e os caminhos A8 nomeados em `sf/ci/GPT-PLAN-10.md:44,269-289` **no snapshot de planejamento** `gpt-plan-001@97944f7733e19860704d81badb67b3cf32976b42`. Nenhum código de produtor A3, UI A4, F04 A9, workflow A6/A10 ou guard protegido foi alterado. Os documentos de dispatch/plano/CI de planejamento **não existem em `close-final-candidate@1cb77b8deb`** (404 confirmado); esta branch não os altera.

## 1. Fonte e estado do PR (verificar novamente ao integrar)

- Base atual de trabalho: `close-final-candidate@1cb77b8deb144e01a655c36987922338b1474003`. O branch A8 foi reconstruído sobre essa base com force-with-lease **apenas em `sfa-identity`** para eliminar alterações herdadas de outros leases; comparar PR #245 por diff, não assumir que o antigo head era limpo.
- **Fontes normativas lidas no snapshot de planejamento** (`sf-ci-lean`/`gpt-plan-001`, **não no branch-base do PR**): `sf/release-target.json:19-33` declara ativação `BLOCKED`, e `sf/ci/PENDING-WORK.md:95-102` exige AZ-02 com positivos/negativos reais e mesmo C. Ambos retornaram **404 em `close-final-candidate`** nesta revisão; A6/A10 precisam integrá-los pelo próprio lease antes de qualquer decisão sobre release. A8 não os copia para fabricar a base do pipeline.
- **Impedimento de CI full no PR isolado:** `.github/workflows/sf-ci.yml` **não existe** em `close-final-candidate@1cb77b8deb` (GitHub contents respondeu 404 na consulta A8). Ele estava presente no head herdado antes da higienização; a execução do run 43964891981 nesse head **não qualifica este PR isolado**. O A8 **não pode** adicionar/alterar o workflow (lease exclusivo A6). A6/owner devem integrar o workflow canônico na base e produzir novo run para este PR; enquanto isso, `sf/verify=NOT_RUN_ON_ISOLATED_HEAD`. Este bloqueio de pipeline não autoriza incorporar arquivos de A6 no PR de identidade.
- Testes Microsoft existentes no repositório são **fixtures locais**; esta auditoria **inspecionou código e nomes de casos, não os executou**. Não é prova do login de um usuário Entra no tenant do cliente.

## 2. Evidência de código EXISTENTE — não reconstruir OAuth nem inventar issuer

| Superfície lida | Invariante efetivamente expressa pelo código | Limite da evidência |
|---|---|---|
| `modules/sucafina/Sucafinav1/runtime/microsoft-installation.ts:9-38` | Perfil Microsoft escolhido pelo proprietário antes da instalação; listener/ingress/public origins fixos; `Forwarded` e `X-Forwarded-*` removidos; o request reescrito não adquire direitos pelo header recebido. | Sem URL, proxy, ingress e tenant reais não há verificação operacional. Fonte pertence a A3 (read-only). |
| `.../runtime/microsoft-configuration.ts:21-64,67-99` | Configuração privada exclusiva, HTTPS público e IDs fixos de tenant/client, 0700/0600, chaves independentes, pin de tenant e credencial fora do workspace; sem fallback local. | Arquivo real, filesystem/owner e configuração do cliente **não acessíveis**. |
| `.../runtime/entra-client.ts:73-79,98-146,189-217` | Discovery com issuer exato, code+PKCE S256, ID token RS256 com issuer/audience/nonce/tid/oid e identidade Graph concordante; grupo resolvido por ID, não nome/e-mail. | Fixtures assinadas não substituem consulta Microsoft real, consentimentos, roles e revogação. |
| `.../runtime/local-identity.ts:27-36,39-123,131-223` | `createMicrosoftIdentity` HTTPS/confidential, cookies opacos `Secure; HttpOnly; SameSite=Lax`, estado/nonce/PKCE privado, callback único, anti-replay e revogação persistente com checagens depois de awaits. | Em ambiente distribuído/proxy deve-se provar Domain/Path, expiração, logout, refresh e race de revogação reais; não exportar cookies. |
| `.../runtime/microsoft-policy.ts:11-34` | Mapeamento explícito de role → grupo immutable ID e grants individuais por resource-tenant object ID. | Configuração real dos atores e operações permitidas ainda ausente. |
| `.../local/entry.ts:55-69,80-88,124-158,266-278` | Integração Microsoft **já existe**: entrada selecionada via configuração privada, `identity.authenticate` aplicada ao host, `authMode=microsoft`; métodos mutáveis do perfil Microsoft exigem `Origin` público exato e rejeitam `Sec-Fetch-Site: cross-site`. | Dev/prod ainda não comprovados como a mesma instalação; não confundir unidade/simulação com tenant live. |
| `apps/cli/src/sucafina-product/installation.ts:34-55,132-163,179-198` | Fence de `Host`/origin, rejeição de GET com body, request original preservado para handler, isolamento do proxy. | O stack Caddy/VM e os headers efetivos devem ser observados por A7/A8 na instalação. |
| `apps/cli/src/sucafina-product/native-ui/context.ts:31-45,67-113` | `GET {mount}/api/ui/context` **requer exatamente** `installationId`, `projectId`, `hostId` na query; contexto revalidado com producer; ausência de auth dá 401, negado 403, mismatch 409, host indisponível 503, inválido 400. | **HEAD retorna 200 sem autenticar**, por desenho (linhas 101-103): não usar HEAD ou GET sem três selectors como prova guest! |
| `apps/cli/src/sucafina-product/routine-native-origin.ts:58-124` | Request original, generation, expiração e binding project/installation, revalidação contínua antes de admission. | Não substituir Task/Permission/Relay por sessão meramente presente. |
| `packages/client/src/sucafina/transport.ts:134-168,365-378,629-647,734-772` | Web exige `window.location.origin===publicOrigin`, `credentials:same-origin`, HTTPS se `authMode=microsoft`; 401/403 apagam stamp; logout POST com confirmação. | `login()` Web retorna `SF_NATIVE_RETURN_INTENT_CONTRACT_UNAVAILABLE` (linhas 625-627); **não** forjar loginUrl, contract I00 ou retorno ao capítulo. |
| `packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx:129-178,356-390,845-884` | Descoberta Web somente com origem alinhada; sem fallback CORS/BASIC cross-origin; fluxo de botão de re-login implementado para **desktop**, não para Web. | `shellOrigin != publicOrigin` e retorno ao app-shell ainda exigem contrato/topologia aprovada. Cabeçalho Basic opcional para descoberta (linhas 143-159) requer verificação de que a implantação Entra não injeta credenciais de servidor no renderer. |
| `packages/app-shell/e2e/sucafina/native/fixture/readiness.ts:42-69,85-133,152-213` | Manifest/raízes privadas, IDs e contexto vistos no **cookie jar original**; sem identidade fabricada. | Observador aceita `microsoft` **ou** `local-operator`; para **AZ-02** aceitação exige observar explicitamente `authMode=microsoft` e callback real, não apenas `status=200`. A9 é dono do F04 live. |
| `apps/cli/src/sucafina-product/native-identity.ts:1-13` | Referências Core Location/Model para SessionStore. | Nome do arquivo **não representa** Entra/OIDC; integração correta está nos produtores Microsoft acima. |

**Cobertura de testes pré-existente (somente inventário, `NOT_RUN`):** `modules/sucafina/Sucafinav1/test/{entra-client,microsoft-entra-client,microsoft-session,microsoft-configuration,microsoft-composition,microsoft-routes,microsoft-node}.test.ts`. Há casos de PKCE/JWT/nonce, callback anti-replay, 0700/0600, roles/Graph, host/forwarded, logout concorrente, Origin inválido, troca de instalação/tenant. Não duplicar suítes do produtor A3 nem reescrever baseline para “ficar verde”. CI atual não prova que esses testes executaram no head isolado.

## 3. Achados adversariais W1 e roteamento

| ID / severidade | Achado verificável | Encaminhamento sem ultrapassar lease |
|---|---|---|
| **A8-01 — BLOCKER / owner+env** | Tenant Microsoft, app registration, grupos, credenciais privadas, atores e VM não fornecidos/exercitados; prova de login real impossível nesta rodada. | **Dono/Entra admin + A7** disponibilizam ambiente e sessões no host privado; A8 executa matriz §5 em W4. `BLOCKED_BY_OWNER` / `BLOCKED_BY_ENV`. |
| **A8-02 — MAJOR / contract source** | Backend Microsoft de fato oferece `{mount}/auth/login`, callback e logout, mas o contrato de **Web chapter return-intent** em `transport.ts` permanece explicitamente unavailable e o UI `owner-runtime` só mostra botão desktop. | **A1 roteia ao owner I00/product host (coordenação com A8)** contrato canônico e retorno seguro; A8 só implementa em path próprio após contrato/autorização. **Não** enviar app-shell href como `returnTo` pois `safeReturn` de backend é limitado às três páginas originais. `BLOCKED_BY_SOURCE` para a jornada Web no capítulo, não para a existência do OIDC backend. |
| **A8-03 — MAJOR / origin topology** | `alignedOrigin` da shell e `publicOrigin` da instalação são regras estritas. Deploy com origens distintas sem proxy autorizado deixa Web indisponível; CORS aberto seria bypass. | **Dono de arquitetura + A7** assinam topologia efetiva, TLS/Host, mesmo-origin ou front-door first-party autorizado, sem cookies/Basic enviados a outro host. A8 faz prova negativa cross-origin. `BLOCKED_BY_OWNER`. |
| **A8-04 — MAJOR / proof logic** | O comando de exemplo em `GPT-PLAN-10.md:279-282` **do snapshot de planejamento** faz `GET /api/ui/context` **sem os três selectors mandatórios** e aceita apenas 401/403; na fonte atual esse request deve ser **400 por contrato**, logo não é uma prova guest válida. | A8 substitui no §4 abaixo por URL completamente formada com três IDs públicos aprovados; **não edita GPT-PLAN-10.md** (documento normativo sem lease). A1 comunica correção ao owner do plano. |
| **A8-05 — MAJOR / evidence definition** | `readiness.ts` aceita `authMode=local-operator`; `HEAD /api/ui/context` responde 200 sem auth. Ambos podem gerar falso positivo se usados para AZ-02. | A8 exige `GET` completo e `authMode=microsoft` mais prova login/redirect/callback reais. A9 faz F04 com seus artefatos próprios; sem anexar storageState/cookies. |
| **A8-06 — REVIEW_REQUIRED / renderer creds** | Descoberta no shell pode montar `Authorization: Basic` de `ServerConnection` (`owner-runtime231.tsx:143-159`). Não há evidência de uso no tenant Microsoft nem de vazamento, mas não se deve certificar “zero credentials no renderer” apenas lendo o código. | A8 + security reviewer verificam deployment, bundles/Network/DevTools **sem publicar valores**; qualquer correção de UI fora de lease passa pelo proprietário A1. |

**Classificação:** achados de gate/prova e dependência; **nenhum** deles foi falsamente marcado “corrigido em produção”. Não autorizar merge/ativação pela ausência de mais erros em teste sintético.

## 4. Prova negativa guest válida — preparar agora, executar somente em W4

**Pré-condições:** `SF_PUBLIC_ORIGIN` HTTPS aprovado, `SF_MOUNT` canônico, `SF_INSTALLATION_ID`, `SF_PROJECT_ID`, `SF_HOST_ID` públicos obtidos da descoberta legítima, aplicação instalada em C; **não** usar cookies, headers Bearer/Basic, storageState, proxy de teste nem redirecionamento automático. Estes não são secrets, mas a equipe pode conservá-los no host privado.

```bash
set -euo pipefail
: "${SF_PUBLIC_ORIGIN:?owner/A7 must supply real HTTPS origin}"
: "${SF_MOUNT:?owner/A7 must supply real mount}"
: "${SF_INSTALLATION_ID:?real installed binding required}"
: "${SF_PROJECT_ID:?real installed binding required}"
: "${SF_HOST_ID:?real installed binding required}"
target=$(node --input-type=module -e '
  const env = process.env
  const origin = new URL(env.SF_PUBLIC_ORIGIN)
  if (origin.origin !== env.SF_PUBLIC_ORIGIN || origin.protocol !== "https:" ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(env.SF_MOUNT))
    process.exit(2)
  const url = new URL(env.SF_MOUNT + "/api/ui/context", origin)
  for (const [key, value] of [
    ["installationId", env.SF_INSTALLATION_ID],
    ["projectId", env.SF_PROJECT_ID],
    ["hostId", env.SF_HOST_ID],
  ]) url.searchParams.set(key, value)
  process.stdout.write(url.toString())
')
status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --max-time 30 --max-redirs 0 --header 'Accept: application/json' "$target")
test "$status" = 401 || test "$status" = 403
```

`400` significa selectors/contrato inválidos, **não** PASS; `409` binding errado; `503` host não pronto; `3xx` login redirect inesperado para este endpoint; `000` falha de rede; `200` sem cookie é **falha crítica**. Separadamente, no checkout Linux correto e com base fetchada: `bun run check:spawn-imports`; `git fetch origin +dev:refs/remotes/origin/dev`; `bun run check:guards --base origin/dev`. Guard não substitui tenant/VM. **Comandos não executados nesta rodada.**

## 5. Matriz W4 de aceitação REAL (todos `NOT_RUN/BLOCKED`)

| ID | Resultado exigido, por instalação C congelada | Classe de falha que veta |
|---|---|---|
| AZ02-AUTH-01 | Login Entra real: authorization-code/confidential client/PKCE S256, tenant/audience/issuer/nonce, callback aprovado, `authMode=microsoft` e principal resource-tenant válido. | Issuer sintético, sessão local, `id_token` sem assinatura ou user sem grupo. |
| AZ02-AUTH-02 | Negativas de `state`/cookie/login-expiry, code duplicado/replay, callback de outro origin, redirect não aprovado e consentimento ausente: sessão não emitida. | Replay aceito ou JWT verificado apenas por decode. |
| AZ02-HTTP-01 | `GET` contexto com 3 IDs: guest 401/403; requester/holder 200 + `principalRef`, `policyVersion`, `accessRevision`; denied 401/403. Cada ator em sessão **própria**. | 200 guest; HEAD 200 usado como prova. |
| AZ02-HTTP-02 | POST sem `Origin`, `Origin` externo, `Sec-Fetch-Site: cross-site`, Host/Forwarded injetados, cookie expirado: deny. Cookie `Secure`/`HttpOnly`/`SameSite`, não logado. | CORS permissivo, accepted cross-origin write, Basic/Bearer no renderer. |
| AZ02-BIND-01 | Seletores duplicados/ausentes, wrong server/project/installation/host e stale stamp: falha correta; GET 400 para request inválido, 409 para mismatch de contrato. | Confundir 400/409/503 com “guest denied”, ou replay do owner anterior. |
| AZ02-BIND-02 | Operação real permitida e negativa em outro namespace, role, tenant, projeto, instalação e source. Revalidar o **produtor original**, incluindo CAS 409/422 aplicável. | Só HTTP 200 de homepage ou aceitação sem produtor. |
| AZ02-REVOKE-01 | Remover grupo/grant de uma sessão já existente: efeito sobre o próximo read/write sem “esperar login novamente”; stale fence interrompe work e não repete commit de outcome unknown. | Acesso persiste após revogação ou permissão reconstruída de selector. |
| AZ02-REVOKE-02 | Logout remoto confirma 204 + revogação durável; cookie copiado não ressuscita após restart/refresh/race; sessão expirada não cria novo grant. | Testar apenas reset do frontend ou limpar localStorage. |
| AZ02-ORIGIN-01 | Shell/host/discovery resolvidos com topologia real e HTTPS; no cross-origin renderer fetch nem segredo acessível no browser. | “Consertar” CORS ou injetar credencial para habilitar Web. |
| AZ02-INTEGRITY-01 | Mesmo `candidateSha` C, tree, artefato SHA256, run/attempt e Linux x64 em A7/A8/A9. Security reviewer **não autor** assina conclusões e sanitização. | Prova CI PR, mock do Entra, ambiente errado ou run antigo. |

**Sequência:** (i) dono entrega tenant/atores/permissões e topo/contrato assinados → (ii) A7 instala o mesmo C e entrega HTTPS + digests → (iii) A8 executa positivos/negativos reais, coleta HTTP status sem cookies/secret, verifica revogação/CAS → (iv) A1 valida revisão externa → (v) A9 recebe apenas contexto real para F04 → (vi) A10 só qualifica release com prova de todos os gates. Nenhuma saída desta matriz altera `sf/release-target.json` automaticamente.

## 6. Handoff fechado por responsável, sem solicitação de secrets no chat

| Status | DRI externo | Entrega verificável que desbloqueia |
|---|---|---|
| `BLOCKED_BY_OWNER` | Dono + administrador Microsoft Entra | Tenant/client IDs, issuer, redirect URIs e app registration **públicos**, client credentials fora do repo (0700/0600), política de grupos/grants, contas reais requester/holder/denied/admin, canal privado de provisionamento, autorização formal. |
| `BLOCKED_BY_ENV` | A7 + dono Azure | Linux x64 VM com app/host realmente instalado; TLS/Host/ingress/reverse proxy; mesmo C/digest, mount e três IDs legítimos; storage/backup isolado. |
| `BLOCKED_BY_SOURCE` (somente retorno ao capítulo Web) | A1 → dono do contrato I00/Web host; A8 implementa apenas paths próprios se autorizado | Contrato de login e safe return canônico compatível com os capítulos Web, sem alterar o `safeReturn` da fonte original arbitrariamente; testes de URL/cross-owner aprovados. |
| `BLOCKED_BY_CI_INTEGRATION` | A6 + dono de integração | `sf-ci.yml` novo presente na base e seleção/receipts íntegros; PR isolado testado no head/merge SHA efetivo; **não** aproveitar run de head contaminado. |
| `NOT_RUN_SECURITY_REVIEW` | A1 → revisor independente Security; A10 recebe | Parecer específico em C com evidência sanitizada, status de todas linhas §5 e recibos verificáveis; proíbe `PASS` por falta de credencial. |

**Critério de saída W1:** fontes auditadas, desvios de prova identificados e atribuídos, código e guards protegidos preservados, PR com somente arquivo A8 no diff. **Critério de saída AZ-02:** ainda não alcançado, pois requer W4 real e revisão independente. A ausência de tenant/VM nunca pode virar “N/A”, e sucesso eventual do `sf/verify` nunca certifica Entra.
