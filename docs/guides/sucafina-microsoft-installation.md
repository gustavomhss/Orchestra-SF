# Membresia Teams na instalação Microsoft

A preparação corporativa usa o arquivo privado escolhido pelo proprietário. Para habilitar a leitura da membresia direta, defina `"teams": "direct"` nesse arquivo antes de preparar a instalação. O login confidencial solicita o escopo delegado `Team.ReadBasic.All` quando a leitura está habilitada.

A configuração fixa as origens do listener, do proxy e da aplicação pública HTTPS, além do tenant e do cliente Entra. Mantenha `client-secret.txt` e as chaves no diretório privado da instalação, separado do workspace. As sessões corporativas usam cookies seguros e credenciais criptografadas por instalação.

A composição disponibiliza o leitor de membresia apenas ao servidor. A política de acesso ao produto, a montagem no host corporativo e a homologação do tenant têm etapas próprias. Na montagem, o listener deve aceitar tráfego apenas do ingresso confiável. A normalização do endereço e do Host serve ao roteamento dentro desse limite.
