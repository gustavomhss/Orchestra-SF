# Membresia Teams na instalação Microsoft

A preparação corporativa usa o arquivo privado escolhido pelo proprietário. Para habilitar a leitura da membresia direta, defina `"teams": "direct"` nesse arquivo antes de preparar a instalação. O login confidencial solicita o escopo delegado `Team.ReadBasic.All` quando a leitura está habilitada.

A configuração fixa as origens do listener, do proxy e da aplicação pública HTTPS, além do tenant e do cliente Entra. Mantenha `client-secret.txt` e as chaves no diretório privado da instalação, separado do workspace. As sessões corporativas usam cookies seguros e credenciais criptografadas por instalação.

Em modo `"teams": "direct"`, defina `enabledTeamIds` no descritor privado com os IDs de objeto dos Teams autorizados para esta instalação. Por exemplo, `"enabledTeamIds": ["44444444-4444-4444-8444-444444444444"]`. A configuração é carregada na inicialização. Uma lista vazia ou ausente bloqueia o acesso por Team.

A entrada da instalação e o dashboard exigem membresia direta e atual em um Team habilitado e ativo. A instalação seleciona automaticamente quando há uma única opção. Quando há várias, o navegador oferece links para os Teams elegíveis. Clientes HTTP recebem as opções em JSON com HTTP 409 e podem visitar a rota do Team ou enviar o `profile` escolhido no cabeçalho `X-SF-Team-Profile` com `contractRevision: "sf-team-profile/1"` e `kind: "team"`. A instalação consulta o Graph novamente antes de aceitar a escolha. A ausência de acesso resulta em HTTP 403. Uma consulta indisponível ou incompleta resulta em HTTP 503.

## Montagem no host

Aponte `SUCAFINA_MICROSOFT_CONFIG` para o arquivo privado da instalação e passe o caminho absoluto de `local/microsoft-entry.ts` a `serve --installation`. Configure no descritor a origem do listener em `127.0.0.1` ou `[::1]` e o `ingressOrigin` correspondente ao Host que o proxy envia. A origem pública continua HTTPS.

No diretório do descritor, com acesso exclusivo ao usuário do serviço, crie `host-data`, `host-config`, `host-cache`, `host-state` e `host-tmp` com modo `0700`, e o arquivo `host-credential.key` com modo `0600`. Aponte `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME` e `XDG_STATE_HOME` para esses diretórios correspondentes. Defina `TMPDIR` para `host-tmp`, `ORCHESTRA_DB` para `host-data/orchestra.db`, `ORCHESTRA_CONFIG_DIR` para `host-config`, `ORCHESTRA_CREDENTIAL_KEY_FILE` para `host-credential.key` e `ORCHESTRA_INHERIT_CREDENTIALS=0`. Use caminhos absolutos.

Crie `ingress-secret.txt` no diretório privado da instalação, com modo `0600` e 32 bytes aleatórios codificados em 64 caracteres hexadecimais minúsculos. Configure o proxy para substituir qualquer `X-SF-Ingress-Proof` recebido do cliente pelo valor privado. O host exige uma conexão loopback e confere esse valor antes de encaminhar a requisição. O cabeçalho é removido antes de chegar à instalação.

O listener corporativo é dedicado ao mount da instalação, com login e logout. Encaminhe apenas esse caminho e seus descendentes no proxy. Aplique limites de taxa por cliente e de concorrência a `/auth/login` e `/auth/callback` antes do encaminhamento ao listener. Use os caminhos do mount ou do dashboard ao iniciar o fluxo de login. A leitura de membresia fica disponível ao código do servidor.

## Fluxos por Team

Dashboard, Planner e Procurement usam as rotas `<mount>/teams/<teamObjectId>/<aplicação>`. Os links e formulários mantêm o Team na URL, inclusive quando dois Teams estão abertos em abas diferentes. Cada Team tem seu próprio banco, anexos, versões e auditoria. Registros preexistentes seguem onde foram criados até a migração explícita.

A membresia dá acesso à avaliação dos papéis da aplicação. Configure os papéis no descritor privado em `groups.dashboard`, `groups.planner` e `groups.procurement`, em formato `group:<ID de objeto Entra>`. A instalação resolve esses grupos para a conta autenticada. Para selecionar outras pessoas, habilite `"teamDirectory": "members"` no descritor, junto de `"teams": "direct"`. O aplicativo Entra precisa do consentimento para a permissão delegada `TeamMember.Read.All`. Entre novamente após conceder o consentimento. O seletor carrega os membros do Team escolhido no tenant de recursos. Cada pessoa é identificada pelo ID de objeto do Entra. Sem essa opção, o diretório continua limitado à pessoa autenticada. Se a lista habilitada estiver indisponível ou incompleta, o fluxo retorna HTTP 503. Gravações conferem uma nova lista antes de confirmar a alteração. A habilitação de restauração e tarefas programadas por Team tem validação própria.
