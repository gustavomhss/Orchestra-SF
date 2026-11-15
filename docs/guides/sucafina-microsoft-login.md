# Login Microsoft Entra para o MVP Sucafina no Azure

Este perfil prepara a autenticação Microsoft do Sucafina para uma origem HTTPS explícita. Ele reutiliza `runtime/entra-client.ts` e `runtime/local-identity.ts`, incluindo PKCE, verificação criptográfica do ID token, sessão privada e resolução dos papéis existentes. O perfil `local-operator` continua restrito à instalação local em loopback e nunca serve como alternativa quando a configuração Microsoft falha.

**Login Microsoft real e acesso B2B ao tenant: `NOT_RUN`.** As fixtures da missão49 são sintéticas. O provisionamento, as credenciais reais e a validação com o tenant pertencem ao responsável Azure. Os resultados de Actions, a identidade exata do código testado e os limites da composição constam nos recibos da entrega49; este guia não transforma testes sintéticos em uma autenticação real.

## Composição e ponto de ativação

O host seleciona o perfil por `SUCAFINA_MICROSOFT_CONFIG`, cujo valor é o caminho absoluto e canônico para um JSON privado no servidor. `SUCAFINA_LOCAL_CONFIG` deve estar ausente. A seleção ocorre antes de abrir o banco do host; nenhum header HTTP pode habilitar o perfil.

`prepareMicrosoftInstallation` valida o arquivo, as chaves, a credencial confidencial, o isolamento do host e o vínculo imutável da instalação. `createMicrosoftIdentity` compõe o motor de sessão existente com o tenant, o cliente e a origem HTTPS fixados. `microsoftRequest` aceita apenas o ingresso configurado e reconstrói a origem pública a partir da configuração, sem confiar em `Forwarded` ou `X-Forwarded-*`.

Os patches completos de instalação/CLI são entregues à integração47 com preimages e postimages em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/microsoft-login/`. Eles precisam ser aplicados pelo writer autorizado de `sf2-stack`, preservando o host e as rotas Sucafina já compostos. A branch49 não modifica diretamente esses arquivos compartilhados. A biblioteca de autenticação, isoladamente, não ativa uma instalação hospedada.

## Registro Microsoft e permissões necessárias

O perfil hospedado usa **aplicação Web confidencial**, authorization code, PKCE S256 e OIDC. O segredo de cliente participa somente da troca/renovação de tokens no servidor. Configure a plataforma **Web**, com redirect URI exatamente igual a:

```text
${origin}${mount}/auth/callback
```

`origin` é a origem HTTPS pública canônica, sem barra final; `mount` começa com `/` e não termina com `/`. Para o mount usual `/sucafina`, o caminho do callback é `/sucafina/auth/callback`. Não use redirect de SPA, client público, endpoint `common` ou tenant de origem do convidado para este perfil. A documentação Microsoft exige correspondência do redirect registrado e orienta usar o tenant do recurso no fluxo de convidados: [authorization code + PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).

O código pede exatamente os seguintes escopos:

| Escopo | Uso neste perfil |
| --- | --- |
| `openid` | Receber o ID token do login OIDC. |
| `profile` | Identificação imutável do objeto e apresentação do usuário. |
| `offline_access` | Renovar credenciais no servidor dentro da duração limitada da sessão. |
| `User.Read` delegado do Microsoft Graph | Ler `/me` e verificar os grupos configurados por `/me/checkMemberGroups`. |

O perfil hospedado consulta apenas a identidade autenticada e a associação dessa identidade aos IDs de grupo configurados. Sua função de diretório devolve somente o próprio usuário; não enumera `/users` nem procura grupos por nome. A Microsoft documenta `User.Read` como a permissão delegada mínima para verificar grupos do usuário conectado em [`/me/checkMemberGroups`](https://learn.microsoft.com/en-us/graph/api/directoryobject-checkmembergroups?view=graph-rest-1.0). Não é necessário conceder `Directory.Read.All`, permissões de aplicação ou privilégios administrativos de diretório para esse fluxo. As políticas de consentimento e de acesso condicional do tenant ainda precisam ser verificadas pelo responsável Azure.

O código usa os endpoints públicos `login.microsoftonline.com` e `graph.microsoft.com`. Outros ambientes de nuvem Microsoft exigiriam um trabalho explícito de compatibilidade; não são selecionados por configuração neste perfil.

## Identidade do convidado e autorização do produto

O tenant configurado é o **tenant de destino que hospeda o recurso**. A identidade validada é o par `tid` desse tenant e `oid` do objeto do convidado nele. A aplicação compara o `oid` assinado com o `id` devolvido por `/me`. O `idp` pode representar a organização de origem do convidado; ele não substitui `tid` e não concede acesso. A Microsoft descreve tanto o objeto criado para convidados em [B2B collaboration](https://learn.microsoft.com/en-us/entra/external-id/what-is-b2b) quanto a estabilidade e o escopo de `tid`/`oid` na [referência de claims](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference).

O produto preserva seus IDs de ator no formato UUID (`oid`). Isso é seguro dentro da fronteira desta instalação porque `microsoft-identity.json` fixa permanentemente `tenantId` e `clientId` antes de abrir `business-microsoft`. Reutilizar o diretório com outro tenant ou aplicativo é recusado. Cookies, slots privados e AAD da criptografia também são separados por origem, mount, tenant e cliente. Uma troca de tenant requer uma instalação e uma decisão de migração próprias; apagar o vínculo para reaproveitar dados não é um procedimento suportado.

Nome, e-mail, domínio de e-mail, UPN e condição de convidado não são identidades de autorização. Não há regra especial para André. O responsável deve usar o object ID real de seu objeto B2B **no tenant de destino**, e atribuir somente os papéis e grants aprovados.

Há duas camadas explícitas de autorização:

1. **Papéis por superfície:** `groups` associa os papéis canônicos existentes a `group:<UUID do grupo no tenant de destino>`. A associação é consultada no Graph em cada resolução de autorização. Nomes de grupo e grupos ambíguos não são aceitos no perfil hospedado. Falha de consulta, ausência de associação ou mapa vazio não gera um papel padrão.
2. **Grants individuais do host de produto:** `grants` contém entradas `SfProductGrant` cujo `principalRef` é o `oid` imutável do destinatário. `namespaces`, `operations` e `humanActions` são listas explícitas dos valores canônicos existentes. O grant não substitui o papel, o escopo de dados, a participação no objeto ou a política financeira. Não são aceitos curingas nem concessões para “todos os convidados”.

Uma identidade autenticada sem papel pode concluir o login Microsoft e obter uma sessão, mas continua sem autorização para a superfície. Sem o grant individual correspondente, as operações protegidas do host de produto permanecem indisponíveis. Os controles existentes de destinatário, participante, documento e ação humana continuam a verificar cada recurso; um grant não autoriza ler os dados privados de outro usuário.

O bootstrap inicial permanece o existente em `runtime/local-bootstrap.ts`: somente um usuário cuja associação ao grupo `admin` configurado seja comprovada pode semear um mapa **ainda ausente**. Um mapa salvo explicitamente vazio é preservado. A configuração não transforma o primeiro convidado em administrador e não sobrescreve mapas existentes. É necessário preparar um administrador real para o bootstrap, sem conceder esse papel a André por conveniência. Depois, alterações de papéis seguem a administração canônica do produto. As listas de grants são carregadas na composição; sua atualização operacional precisa do procedimento do owner do host.

## Arquivo JSON privado

O arquivo contém configuração e política; o segredo do cliente fica em arquivo separado. Não existe exemplo com IDs de tenant, aplicativo, grupo ou usuário inventados: o responsável Azure preenche os valores reais diretamente no armazenamento privado, sem enviá-los a ferramentas ou agentes.

| Chave | Contrato |
| --- | --- |
| `version` | Inteiro `1`. |
| `deployment` | String exata `azure-https`. |
| `authentication` | String exata `microsoft`. |
| `origin` | Origem pública HTTPS canônica com hostname DNS; sem caminho, query, fragmento ou porta alternativa. Não aceita IP, loopback ou nomes locais. |
| `listenerOrigin` | Origem HTTP interna canônica, exatamente igual ao `context.origin` do listener do host na inicialização. |
| `ingressOrigin` | Origem HTTP interna efetivamente recebida do proxy; a URL da requisição e seu header `Host` devem corresponder a ela. |
| `mount` | Prefixo de caminho explícito, como `/sucafina`; segmentos com letras, números, `_` ou `-`, sem barra final. |
| `tenantId` | UUID real do tenant de destino. |
| `clientId` | Application/client ID real do registro Web desse tenant. |
| `groups` | Objeto com `dashboard`, `planner` e `procurement`, todos obrigatórios. Cada superfície contém seus papéis canônicos selecionados e valores `group:<UUID real>`. Objetos vazios concedem zero papéis. |
| `grants` | Array obrigatório de `SfProductGrant`. Cada entrada exige `principalRef`, `namespaces` e `operations`; `humanActions` é opcional e assume `[]`. IDs repetidos, valores desconhecidos e listas com duplicatas são recusados. `[]` concede zero grants. |
| `workspaceDirectory` | Diretório absoluto, canônico, privado e separado para o trabalho dos agentes. Não pode ser o diretório da instalação, um ancestral dele nem um descendente dele. |
| `scanner` | `null`, ou objeto com `host: "127.0.0.1"` e `port` inteiro de `1` a `65535`. `null` não promete disponibilidade de uploads que exijam scanner. |
| `sessionSeconds` | Opcional; padrão `28800` (8 horas), mínimo `60`, máximo `28800`. É duração absoluta, não prolongada por refresh. |
| `loginSeconds` | Opcional; padrão `600` (10 minutos), mínimo `30`, máximo `600`. Limita o estado/nonce/PKCE de uma tentativa de login. |

Chaves desconhecidas, `localOperator`, segredo embutido no JSON e configurações parciais são recusados. Os valores de `groups` são limitados aos papéis de `src/identity.ts`; operações e ações dos grants são validadas contra `product/contracts/freeze-v1.json` e `product/integration/human-authority.ts`.

## Arquivos privados e isolamento do host

O diretório que contém o JSON deve pertencer ao UID do processo, ter permissões `0700` e usar seu caminho real, sem symlinks. JSON, chaves e segredo devem ser arquivos regulares privados `0600`, do mesmo UID; os novos leitores também recusam hardlinks. Ao lado do JSON, são obrigatórios:

| Arquivo | Conteúdo/uso |
| --- | --- |
| `client-secret.txt` | Segredo confidencial do registro Web, provisionado exclusivamente pelo owner no servidor. Até 4.096 caracteres ASCII imprimíveis, sem espaços; aceita um newline final. Não colocar no repositório, JSON, argumentos de CLI ou variável de ambiente. |
| `session.key` | 32 bytes binários aleatórios, para criptografia das credenciais de sessão. |
| `bank.key` | Outros 32 bytes binários aleatórios, para a fronteira bancária existente. |
| `assets.key` | Outros 32 bytes binários aleatórios, para a assinatura de assets existente. |
| `host-credential.key` | Credencial privada separada do host, no formato já usado pelo host Orchestra. |

As três chaves binárias devem ser diferentes. O carregamento não gera segredo nem corrige permissões silenciosamente. O leitor de `client-secret.txt` é retido somente no servidor e relê a credencial ao trocar/renovar tokens. A indisponibilidade do segredo fecha a operação.

Para um diretório privado representado aqui por `<instalação>`, `requireLocalIsolation` exige exatamente:

| Variável | Valor |
| --- | --- |
| `SUCAFINA_MICROSOFT_CONFIG` | Caminho absoluto do JSON privado nessa instalação. |
| `ORCHESTRA_DB` | `<instalação>/host-data/orchestra.db` |
| `ORCHESTRA_INHERIT_CREDENTIALS` | `0` |
| `ORCHESTRA_CONFIG_DIR` | `<instalação>/host-config` |
| `ORCHESTRA_CREDENTIAL_KEY_FILE` | `<instalação>/host-credential.key` |
| `TMPDIR` | `<instalação>/host-tmp` |
| `XDG_DATA_HOME` | `<instalação>/host-data` |
| `XDG_CONFIG_HOME` | `<instalação>/host-config` |
| `XDG_CACHE_HOME` | `<instalação>/host-cache` |
| `XDG_STATE_HOME` | `<instalação>/host-state` |

Esses subdiretórios também precisam ser privados. `<instalação>` é apenas notação descritiva, não um valor executável. `SUCAFINA_LOCAL_CONFIG` deve continuar ausente. O owner provisiona esses caminhos antes de ativar o host.

`business-microsoft` é o diretório privado de persistência desta composição. Tokens, refresh tokens, ID tokens e material PKCE ficam criptografados em registros de autenticação separados dos snapshots e backups de negócio. O navegador recebe somente handles aleatórios em cookies `HttpOnly; Secure; SameSite=Lax`, com prefixo `__Secure-`, escopo no mount e sem `Domain`.

Os residentes SF já têm uma fronteira de ferramentas na implementação existente: `registerSfResidentAgents` fixa o engine `orchestra`, nega ações por padrão e permite somente os IDs de skills e operações selecionados; `native-host.ts` ainda restringe cada sessão com `store.narrow` aos IDs de operação admitidos. Essas sessões não recebem ferramentas genéricas de shell ou leitura de arquivos. A composição hospedada preserva essa restrição e usa `workspaceDirectory` como localização dos residentes.

O acesso administrativo ao host e quaisquer ferramentas adicionais exigem cuidado separado: permissões `0700` não impedem leitura por uma ferramenta que execute sob o mesmo UID com acesso irrestrito ao filesystem. O owner precisa manter o diretório privado fora das raízes acessíveis a ferramentas, indexação, contexto e artefatos dos agentes, com a política de sandbox/processo apropriada. Não habilitar ferramentas irrestritas sobre a instalação privada. Credenciais, cookies, headers de autorização e URLs completas de callback não podem entrar em transcripts, logs, evidências ou capturas.

## HTTPS, ingresso e rotas

O Azure/proxy deve terminar TLS na origem pública configurada, restringir o backend à rede/ingresso autorizado e encaminhar `Host` conforme `ingressOrigin`. A porta HTTP interna não deve estar acessível diretamente a clientes. A verificação de `Host` no código é complementar a essa restrição de rede: ela não autentica um atacante que já consiga alcançar o backend e fabricar headers.

`Forwarded` e `X-Forwarded-*` são descartados. Eles não escolhem tenant, origem, cookie, papel ou perfil. O owner também deve excluir query strings, cookies e bodies das rotas de autenticação dos access logs e traces do proxy. O callback transporta um código descartável que continua sendo dado sensível, mesmo com PKCE.

| Rota pública relativa ao mount | Comportamento |
| --- | --- |
| `GET /auth/login` | Cria tentativa com estado de uso único, nonce e PKCE; redireciona ao tenant fixo. |
| `GET /auth/callback` | Exige o estado correspondente no cookie do mesmo navegador, consome a tentativa, troca o código no servidor e verifica o ID token assinado e a identidade Graph. |
| `POST /auth/logout` | Exige `Origin` público exato e recusa `Sec-Fetch-Site: cross-site`; revoga a sessão e a tentativa de login apresentadas e limpa os cookies. |

Callbacks com tenant, audience, assinatura, nonce, estado ou expiração inválidos são negados. Repetição do callback e parâmetros de código/estado ambíguos são negados. O retorno após login se limita às superfícies reais `dashboard`, `planner` e `procurement` do mount. As rotas de negócio continuam usando o autenticador e a autorização canônicos na composição compartilhada.

## Sessão, revogação e limites

Refresh não estende a duração absoluta da sessão. Rotação de login revoga o handle anterior. Logout mantém marcadores duráveis de revogação; a checagem após esperas de rede/persistência impede que refresh ou callback pendente reativem a sessão revogada. A autorização e o diretório também revalidam sessão/expiração antes de devolver identidade após uma chamada externa. Consultas de identidade permanecem somente leitura durante transações de negócio.

O formato e o namespace de sessão foram reforçados. Sessões Microsoft criadas pelo formato anterior não são migradas automaticamente; os usuários precisam fazer login novamente após a atualização. Os dados de negócio existentes não são convertidos por esse procedimento. A composição Azure usa seu diretório `business-microsoft` vinculado ao tenant, sem adotar silenciosamente dados locais.

O logout desta implementação encerra a **sessão Sucafina** e torna sua cópia de cookie inutilizável. Ele não encerra globalmente a conta Microsoft, não chama uma revogação administrativa do tenant e não promete invalidar sessões de outros aplicativos. Se o navegador ainda tiver SSO Microsoft, um novo login explícito pode autenticar novamente; o produto volta a avaliar os papéis e grants. Alterações de grupos dependem da informação atual devolvida pelo Graph e da propagação do diretório; a implementação não promete um prazo de propagação do tenant.

Uma indisponibilidade de Microsoft/Graph não é contornada com identidade anônima, operador local ou papel padrão. Não há provisionamento Azure, convite B2B, concessão de consentimento, deploy ou reinício do host nesta missão.

## Validação e próximo passo do owner

As provas sintéticas usam `jose` com assinaturas RSA reais, um transporte OIDC/JWKS/Graph controlado e a persistência privada real. Não desabilitam verificação criptográfica e não injetam um autenticador permissivo. As seleções cirúrgicas incluem os testes novos `microsoft-entra-client.test.ts`, `microsoft-session.test.ts`, `microsoft-configuration.test.ts`, os testes de composição da entrega e a compatibilidade anterior de `entra-client.test.ts` e `local-identity.test.ts`.

Resultados verificáveis de testes, package typecheck e guards devem ser lidos nos recibos49 junto com commit/tree, request, run, job e comando. Um teste de biblioteca não substitui a prova da instalação composta; um PASS sintético não substitui o tenant real. Não rodar suites locais nem disparar um epic para validar esta entrega.

Após consumir os patches da entrega49, o responsável Azure deve validar o registro Web e o redirect exato, o segredo privado, a política de TLS/ingresso/logs, o objeto B2B no tenant de destino e os grants aprovados. A validação real precisa incluir um convidado atribuído, uma identidade sem papel, remoção de papel, logout com cookie copiado e tentativa de acessar dados de outro usuário. Preserve apenas resultados sanitizados e IDs de evidência; não arquive tokens, códigos, cookies ou credenciais. Até esse procedimento produzir prova real, **Microsoft/B2B continua `NOT_RUN`**.
