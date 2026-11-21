# Membresia Teams na instalação Microsoft

A preparação corporativa usa o arquivo privado escolhido pelo proprietário. Para habilitar a leitura da membresia direta, defina `"teams": "direct"` nesse arquivo antes de preparar a instalação. O login confidencial solicita o escopo delegado `Team.ReadBasic.All` quando a leitura está habilitada.

A configuração fixa as origens do listener, do proxy e da aplicação pública HTTPS, além do tenant e do cliente Entra. Mantenha `client-secret.txt` e as chaves no diretório privado da instalação, separado do workspace. As sessões corporativas usam cookies seguros e credenciais criptografadas por instalação.

A composição disponibiliza o leitor de membresia apenas ao servidor. A política de acesso ao produto e a homologação do tenant têm etapas próprias.

## Montagem no host

Aponte `SUCAFINA_MICROSOFT_CONFIG` para o arquivo privado da instalação e passe o caminho absoluto de `local/microsoft-entry.ts` a `serve --installation`. Configure no descritor a origem do listener em `127.0.0.1` ou `[::1]` e o `ingressOrigin` correspondente ao Host que o proxy envia. A origem pública continua HTTPS.

No diretório do descritor, com acesso exclusivo ao usuário do serviço, crie `host-data`, `host-config`, `host-cache`, `host-state` e `host-tmp` com modo `0700`, e o arquivo `host-credential.key` com modo `0600`. Aponte `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME` e `XDG_STATE_HOME` para esses diretórios correspondentes. Defina `TMPDIR` para `host-tmp`, `ORCHESTRA_DB` para `host-data/orchestra.db`, `ORCHESTRA_CONFIG_DIR` para `host-config`, `ORCHESTRA_CREDENTIAL_KEY_FILE` para `host-credential.key` e `ORCHESTRA_INHERIT_CREDENTIALS=0`. Use caminhos absolutos.

Crie `ingress-secret.txt` no diretório privado da instalação, com modo `0600` e 32 bytes aleatórios codificados em 64 caracteres hexadecimais minúsculos. Configure o proxy para substituir qualquer `X-SF-Ingress-Proof` recebido do cliente pelo valor privado. O host exige uma conexão loopback e confere esse valor antes de encaminhar a requisição. O cabeçalho é removido antes de chegar à instalação.

O listener corporativo é dedicado ao mount da instalação, com login e logout. Encaminhe apenas esse caminho e seus descendentes no proxy. Aplique limites de taxa por cliente e de concorrência a `/auth/login` e `/auth/callback` antes do encaminhamento ao listener. Use os caminhos do mount ou do dashboard ao iniciar o fluxo de login. A leitura de membresia fica disponível ao código do servidor. A autorização de negócio por Team entra em um recorte posterior.
