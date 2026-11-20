# Orchestra Sucafina Edition — homologação local

A **Orchestra Sucafina Edition** é a **única interface do produto**, integralmente no shell Orchestra (`/`), preservando sidebar, temas e identidade visual Orchestra com camada de marca Sucafina. Os GETs HTML `/sucafina/dashboard`, `/sucafina/planner` e `/sucafina/procurement` foram aposentados e, após admissão, respondem 404 (`legacy console decommissioned — use /`). Projeções JSON, POSTs, downloads/arquivos autorizados e autenticação continuam nos endpoints próprios; não há console paralelo.

A execução gerenciada deste Mac fica em `~/Library/Application Support/Sucafina`: `runtime` contém a cópia aprovada da adaptação legada de homologação e do host Orchestra; `installation` guarda configurações, chaves, bancos e bases do scanner com acesso privado. Os fontes em Documents permanecem preservados. O macOS recusou o início direto de executáveis em Documents pelo launchd; por isso os três serviços apontam para a cópia em Application Support. O atalho em Documents abre essa instalação.

A entrada de homologação é `http://localhost:4110/` na Orchestra Sucafina Edition, condicionada à admissão same-origin do shell. O perfil **local-operator** usa a conta real do macOS, não uma identidade Microsoft 365. Dashboard, Planner e Procurement deixam de ter páginas HTML separadas.

Para reabrir uma sessão no Chrome, usar o atalho `/Users/gustavoschneiter/Documents/sucafina/Abrir Sucafina.command`. Ele prepara uma credencial de uso único em arquivo privado; após resgate, o HTTP 303 aponta para `/` (shell Orchestra). A credencial autentica o backend local e não dispensa admissão pelo shell. Dura dez minutos; a sessão HttpOnly dura oito horas. A emissão exige UID do dono, arquivo 0600 e diretório 0700. Nenhuma rota emite acesso anônimo.

O operador possui a política administrativa das três superfícies somente neste perfil de homologação. Compras exige ainda a opção booleana explícita `localOperator.buyer: true` no arquivo privado para conceder o papel buyer apenas em Procurement. O padrão continua sem esse papel; a opção não altera a identidade local nem as permissões Microsoft. Os registros ficam em `business-local/installation.sqlite`, separados do perfil Microsoft em `business/installation.sqlite`. A auditoria identifica `macos:<installationId>:<uid>` e o nome real da conta do sistema. Não são criados usuários locais novos, empregados fictícios ou grupos Entra. Dados locais não são promovidos automaticamente ao perfil corporativo.

A opção `authentication: "local-operator"` é explícita no arquivo privado. A ausência da opção, ou `authentication: "microsoft"`, preserva a autenticação corporativa e não concede papéis quando ela está indisponível. Alternar o perfil exige atualizar somente a instância de homologação; outras instalações do Orchestra não são reconfiguradas.

Para preparar o acesso pela linha de comando:

```sh
bun local/enroll.ts /absolute/private/installation.json --enable-local
./local/open.command /absolute/private/installation.json
```

O primeiro comando ativa explicitamente o perfil do dono e prepara um arquivo privado de entrada. Invocações posteriores podem omitir `--enable-local`; o helper recusa ativação implícita. O arquivo de entrada substitui a navegação, não publica a credencial em mensagens de console e não reutiliza senhas do Orchestra.

Evidência histórica: o Chrome percorreu 28 páginas do console **agora aposentado**; isso não comprova a montagem autenticada dos capítulos nativos no shell. Testes de persistência/auditoria, negação de acesso e isolamento de perfis continuam relevantes ao backend.

## Infraestrutura e perfil Microsoft


Este ambiente de homologação é uma instância isolada do próprio servidor Orchestra em `http://localhost:4110`, com backend Sucafina no mesmo processo/listener e capítulos nativos no shell Orchestra. Não há aplicativo ou console separado. Os arquivos privados permanecem fora deste código; LaunchAgents opcionais são exclusivos deste ambiente.

A ativação Microsoft foi adiada por orientação do responsável: “microsoft nao tem ainda, vamos ter que pular”. O adaptador permanece preparado; sem aplicação registrada, o acesso corporativo continua indisponível. O acesso local é um perfil distinto e identificado.

O ambiente foi preparado em `/Users/gustavoschneiter/Documents/sucafina/.local/Sucafinav1/homologation`. O `installation.json` ainda exige os IDs públicos reais da aplicação Microsoft e os nomes exatos de grupos. As chaves independentes foram geradas no diretório privado; nunca copie esse diretório para CI, arquivos de distribuição ou repositórios.

Para preparar outra instalação vazia:

```sh
bun local/prepare.ts /absolute/private/installation-directory
```

O preparo não inicia serviço, não cria usuários/grupos e não substitui configurações existentes. Diretórios devem pertencer ao usuário e permitir acesso somente ao dono. Um diretório existente permissivo é recusado.

No Entra, um administrador deve registrar uma aplicação para apenas o tenant da organização. Para esta homologação em loopback, configurar a plataforma **Mobile and desktop applications** como cliente público e cadastrar o callback exato `http://localhost:4110/sucafina/auth/callback`. O fluxo usa authorization code com PKCE, sem client secret. O callback precisa estar cadastrado; não basta usar o callback genérico de outro aplicativo. Ver [registro de aplicativos desktop](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-configuration) e [regras de redirect URI](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url).

Autorizar as permissões delegadas Microsoft Graph `User.Read`, `User.ReadBasic.All` e `GroupMember.Read.All`, com consentimento administrativo quando exigido pelo tenant. O fluxo também solicita `openid profile offline_access`. As políticas da organização podem impor restrições adicionais. Não conceder permissões de aplicação nem criar senha para substituir a identidade humana.

Preencher no arquivo privado `installation.json`:

- `tenantId` e `clientId`: GUIDs reais da aplicação autorizada.
- `groups.dashboard.admin`, `groups.planner.admin`, `groups.procurement.admin`: nomes exatos dos grupos existentes cujos membros podem fazer a primeira configuração de cada superfície. Outros papéis podem ser mapeados nesse mesmo objeto. Não há nomes presumidos.
- `scanner`: `null` até haver um ClamD local ativo; depois `{ "host": "127.0.0.1", "port": <porta real> }`.

Grupos ausentes, duplicados ou sem associação atual não concedem acesso. O primeiro mapa de uma superfície só é persistido quando um usuário autenticado prova associação ao grupo admin configurado. Um mapa já persistido, inclusive vazio ou com nomes apagados pela interface, nunca é substituído pelo bootstrap.

O launcher usa os artefatos nativos do mesmo checkout. Neste Mac Intel eles já foram compilados no diretório privado. Para repetir a compilação, a partir do checkout Orchestra:

```sh
node native/omni/scripts/build-artifacts.mjs darwin-x64 --out /absolute/private/installation-directory/tools/omni
```

A dependência `jose` está fixada em 6.2.16, versão elegível pela quarentena de dependências do host. A 6.2.17 ainda não completou 72 horas; sua correção trata `maxTokenAge` negativo, opção que este cliente não utiliza. A validação exige `exp`, `iat`, emissor, audience, tenant, oid, nonce, assinatura RS256 e identidade Graph correspondente.

Para iniciar em primeiro plano, após instalar as dependências do checkout e do módulo:

```sh
./local/start.command /Users/gustavoschneiter/Documents/HuGR/orchestra-local-installation /Users/gustavoschneiter/Documents/sucafina/.local/Sucafinav1/homologation
```

A prontidão técnica está em `http://localhost:4110/sucafina/status`, sem divulgar IDs, grupos ou credenciais. O status distingue configuração de comprovação real e identifica uploads indisponíveis sem scanner. A porta desta instalação é fixa em 4110.

Para homologar a interface, abrir `http://localhost:4110/` e comprovar a admissão same-origin e os capítulos nativos da Edition. Os GETs HTML `/sucafina/dashboard`, `/sucafina/planner` e `/sucafina/procurement` respondem 404 após admissão; operações JSON e downloads autorizados permanecem. Sem IDs Microsoft reais, o backend responde 503 de configuração, sem concessão de acesso. Se a porta estiver ocupada, o início falha. Para encerrar, usar Ctrl-C somente no terminal desta instância.

O launcher define XDG, banco do host, chave de credenciais e diretório temporário próprios **antes** de importar o host; também desativa herança de credenciais e configuração de projeto. O factory verifica esses caminhos antes de o host migrar o banco. O SQLite de negócio fica em `business/installation.sqlite`: dados, versões, sequências, auditoria e BLOBs privados participam da mesma transação. Credenciais cifradas ficam em tabela separada e não entram no backup de negócio.

Os cookies contêm apenas identificadores opacos. PKCE e tokens ficam cifrados no servidor com AES-256-GCM. Logout encerra somente esta sessão local, sem desconectar Teams ou Microsoft globalmente. Grupos são consultados novamente para autorizar cada operação.

Uploads são recusados quando o scanner está ausente ou não responde com resultado limpo. O adaptador usa [ClamD INSTREAM](https://docs.clamav.net/manual/Usage/ClamdProtocol.html); o daemon deve manter assinaturas atualizadas e sinalizar arquivos não completamente analisados (`AlertExceedsMax`), com limites compatíveis com os limites definidos na aplicação. Neste Mac, ClamAV 1.5.4 foi compilado da fonte oficial com SHA-256 conferido e instalado somente em `tools/clamav` do diretório privado. As três bases oficiais passaram pela verificação e o serviço em `127.0.0.1:43310` respondeu ao controle limpo e detectou EICAR, transmitido em memória. `scanner-qualification.json` no diretório privado registra essa verificação operacional. O atualizador privado verifica assinaturas 12 vezes por dia e notifica o ClamD após atualizações. A inicialização automática usa os três LaunchAgents de usuário descritos abaixo; sem sua ativação, scanner e atualizador precisam ser iniciados com os respectivos arquivos privados antes da homologação. A rota de prontidão informa configuração; não faz uma sondagem de saúde a cada acesso.

No perfil local, notificações destinadas à conta real do operador são entregues à caixa de entrada durável do aplicativo. Destinatários externos ou do diretório corporativo não são redirecionados para essa conta: permanecem pendentes. No perfil Microsoft, o envio continua dependendo de um transporte corporativo real; não são fabricados recibos de e-mail ou Teams. A existência destes adaptadores e de testes com provedor sintético não prova login, consentimento, grupos ou antivírus reais. A ativação só fica concluída após a validação com a organização.

## Leitura de Teams no perfil Microsoft HTTPS

O perfil corporativo `deployment: "azure-https"`, `authentication: "microsoft"` aceita a opção privada `"teams": "direct"`. Ela habilita a leitura das Teams das quais a pessoa autenticada é membro direto. A configuração é carregada pelo servidor; uma seleção, parâmetro ou cabeçalho do navegador não pode habilitar essa capacidade. A opção não se aplica ao cliente público de loopback descrito acima.

Para habilitar a capacidade, acrescente esta propriedade ao arquivo privado de configuração Microsoft já preparado:

```json
{
  "teams": "direct"
}
```

Mescle essa propriedade à configuração existente; o bloco não substitui o arquivo completo. O valor deve ser exatamente `"direct"`; para desabilitar, remova a propriedade e recarregue a configuração da instância. `false`, `null` e outros valores são recusados. A identidade fixa da instalação, definida pelo tenant e pela aplicação, permanece a mesma.

Sem a opção, o login HTTPS solicita somente `openid profile offline_access User.Read`. Com ela, acrescenta a permissão **delegada** Microsoft Graph `Team.ReadBasic.All`. O consentimento deve ser concedido no tenant de recurso conforme suas políticas; habilitar a opção no arquivo não comprova esse consentimento e não concede papéis ou permissões de negócio. Não são necessárias permissões de aplicação, escrita de Teams ou enumeração de usuários/grupos para essa leitura. Consulte a [API joinedTeams](https://learn.microsoft.com/en-us/graph/api/user-list-joinedteams?view=graph-rest-1.0) para o contrato de associação direta e as permissões.

Tokens e escopos retornados ficam na sessão privada cifrada. Uma credencial antiga sem o escopo confirmado não é promovida por essa opção. Quando uma renovação retorna token sem informar os escopos, a leitura de Teams permanece indisponível com `consent_required` até uma nova autenticação confirmar o conjunto solicitado. A omissão de escopos no resgate inicial do código segue o contrato do [fluxo authorization code da Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow); ela não é usada para inferir o consentimento de um refresh token antigo.

A leitura não transforma acesso a um canal compartilhado em associação à Team anfitriã. Também não altera os mapas de papéis existentes, inclusive mapas vazios, nem as concessões explícitas da instalação. Falha de consentimento, indisponibilidade do provedor ou paginação incompleta retorna um estado de erro, sem apresentar uma lista vazia como prova de ausência de Teams.

A administração suprema tem uma opção independente, `"supremeAdminGroupId": "<Object ID do grupo corporativo>"`, no mesmo arquivo privado. Informe o GUID completo do grupo no tenant de recurso, sem nome, e-mail ou prefixo `group:`. Sem essa opção, a função administrativa é negada. O backend consulta a associação atual ao grupo com a permissão delegada mínima `User.Read`; papéis de superfície, ownership de Team e operador local não substituem essa prova. A listagem administrativa e a desabilitação/remoção de um profile existente não dependem da enumeração de Teams.

Habilitar um profile exige também ler a Team Microsoft pelo ID imutável e confirmar seu tenant. O grupo supremo do produto não concede permissões administrativas no Entra ou no serviço Teams; se o Microsoft Graph recusar a leitura, a habilitação falha sem registrar o profile. Consulte [checkMemberGroups](https://learn.microsoft.com/en-us/graph/api/directoryobject-checkmembergroups?view=graph-rest-1.0) e [Get team](https://learn.microsoft.com/en-us/graph/api/team-get?view=graph-rest-1.0).

A política compartilhada é mantida em tabelas próprias do SQLite privado da instalação, com revisão crescente, compare-and-swap e auditoria da pessoa verificada. Uma restauração de snapshot de negócio não restaura uma política antiga de profiles. O servidor relê a opção de grupo e de Teams em cada operação administrativa; alterações de origem, mount, tenant, aplicação, workspace ou chaves exigem reconfiguração explícita da instância. A configuração de profiles não copia dados de negócio, credenciais ou preferências pessoais, e não concede grants de negócio.

Esta etapa prepara o leitor vinculado à sessão autenticada. A seleção de perfil por Team, sua admissão, o isolamento dos dados e a comprovação corporativa da migração continuam sujeitos às etapas e aos gates do [plano Teams Profile](../../../../docs/architecture/teams-profile-migration.md). A opção, por si só, não qualifica a instalação para produção.

## Permissões explícitas para sessões corporativas

A seleção de uma Team determina o contexto compartilhado. Para sessões privadas do Core, cada registro de `grants` pode declarar `sessionActions` para o `principalRef` corporativo já verificado. A ausência da propriedade equivale a uma lista vazia; nenhum papel de superfície ou grupo supremo preenche essa lista.

| Ação | Uso autorizado, ainda sujeito ao owner e ao recurso atual |
| --- | --- |
| `read` | Listar e consultar sessões, mensagens, eventos e contexto privados. |
| `create` | Criar um novo ID no owner atual ou repetir a mesma criação. |
| `fork` | Solicitar uma cópia de sessão autorizada; a nova sessão também exige `create`. |
| `move` | Alterar a localização técnica sem transferir o owner. |
| `write` | Renomear, arquivar, remover e alterar o estado de reversão. |
| `prompt` | Registrar prompt ou contexto sintético. |
| `run` | Iniciar ou retomar execução, compactar, executar comando/skill ou gerar resposta. |
| `model` | Escolher agente/modelo ou alterar políticas de modelo e permissão. |
| `control` | Interromper uma execução ou processo autorizado. |

Para acrescentar leitura e gravação de prompts a um grant existente, por exemplo, declare `"sessionActions": ["read", "prompt"]`. Isso não permite iniciar execução. Um prompt com retomada automática exige também `run` antes de registrar trabalho; sem esse grant, use somente o fluxo explícito de gravação sem retomada. Definir agente/modelo em uma nova sessão exige `model`. Os controles de execução C15, seleção, recibos de skills, provedor e recursos continuam obrigatórios.

Os campos separados `referenceActions` (valor conhecido: `list`) e `migrationActions` (valores conhecidos: `map`, `cut`, `recover`) também têm ausência equivalente a lista vazia. Esses catálogos não ativam endpoints: referências exigem uma ACL instalada para a fonte real; migração exige o fluxo de manutenção, grupo supremo atual, mapeamentos de owners e journal verificados. A configuração sozinha não autoriza um corte ou restore. `replay` não é um grant de sessão comum; bytes históricos só entram pelo mapeamento privado de recuperação.

Todos os arrays recusam valores desconhecidos, repetidos, nulos ou de outro tipo. O servidor relê a política privada e os direitos de recursos durante cada operação; mudar um desses conjuntos invalida admissões anteriores. Sessões vinculadas a um caso continuam sujeitas à ACL corrente desse caso. Uma falha ou lista de exceções incompleta não vira acesso irrestrito.

A ativação de um armazenamento corporativo exige a migração e seu controle de geração persistente separado dos backups de negócio. Selecionar uma Team não executa migração, cria um grant, copia dados legados nem reatribui IDs existentes. Os gates de isolamento, recuperação e instalação do plano continuam sendo requisitos de aceite.

## Evidência histórica do console aposentado (não é aceite da Edition)

Os antigos componentes e estilos de sidebar verde descritos abaixo são apenas registro da implementação desativada; a Edition usa exclusivamente a interface Orchestra.

As capturas legadas não representam os capítulos nativos. Comportamento de colunas, controles e navegação dessa tela não é prova atual.

O teste histórico de layout exercitava Chrome em 1440, 1024 e 390 pixels sobre 28 páginas hoje aposentadas. Esse roteiro não comprova a interface atual e deve ser retargetado para capítulos nativos antes de ser usado como gate da Edition.

Os editores usam campos alinhados em até quatro colunas, com áreas de texto em largura completa e ações separadas. Configurações repetidas e importação de planilhas ficam em painéis expansíveis; relatórios e backup permanecem disponíveis no painel correspondente. A barra superior permite alternar entre Dashboard, Budget Planner e Procurement.

A edição de um registro em tabela abre uma janela nativa do navegador. Escape ou o botão de fechar retornam à linha; erros aparecem dentro do editor. Após salvar e atualizar os dados, o foco volta à ação da mesma linha. O teste `form-layout.test.ts` verifica esses comportamentos com um registro temporário real, além de abrir os painéis expansíveis das 28 páginas nas três larguras.

## Inicialização no login deste Mac

O ambiente de homologação usa três serviços de usuário próprios, sem substituir outras instalações do Orchestra: scanner, atualizador de assinaturas e servidor. Preparar o plano não encerra nem inicia processos:

```sh
./local/install-startup.command --prepare /caminho/absoluto/Orchestra /caminho/absoluto/instalacao-privada
```

Os três plists e `service-installation.json` são privados e podem ser conferidos antes da ativação. O responsável pela instalação identifica os processos privados antigos pelo executável, diretório de trabalho, configuração e porta; somente esses processos podem ser encerrados para a adoção. A ativação usa `--activate` com os mesmos caminhos, e exige a confirmação técnica da adoção pelo identificador da instalação. Nunca encerrar um processo só porque ocupa a porta. As portas HTTP e do scanner devem ser distintas.

Depois da ativação, os LaunchAgents iniciam no login do proprietário e reiniciam os processos caso terminem. O atalho chama `ensure.command`, verifica a origem dos serviços carregados, o HTTP local e o PING do scanner, e só então prepara a credencial de uso único. A espera admite até um minuto para o carregamento inicial das assinaturas do scanner. Se o plano estiver ausente ou alterado, a abertura falha com uma mensagem, sem iniciar um listener concorrente.

## Backups e avisos internos

O factory local inicia a manutenção periódica e também a desperta após operações gravadas. Snapshots horários, sujeitos à retenção diária, ficam em diretórios privados separados por perfil; incluem o snapshot e os bytes dos anexos, conferidos antes da publicação. O painel Backups permite capturar e restaurar cópias, com confirmação e proteção contra revisão obsoleta. A cópia selecionada é fixada antes de uma eventual poda por retenção. Esses backups são locais ao Mac: uma cópia fora da máquina requer um destino autorizado e não é presumida.

Notifications mostra avisos realmente entregues ao operador local, com recibo durável e marcação de leitura. Um destinatário indisponível não bloqueia os avisos válidos seguintes. Lembretes e escalações seguem somente os períodos preenchidos nas configurações; campos vazios não recebem números inventados.

Sign out encerra a sessão atual; para entrar novamente, usar Abrir Sucafina. O estado de manutenção aparece na prontidão técnica, enquanto os detalhes de backup e avisos exigem autenticação.

## Recuperação contínua e retenção

A recuperação contínua usa Litestream 0.5.18, instalado em `tools/litestream/litestream` no diretório privado. O arquivo oficial deve ser conferido pelo SHA-256 publicado antes da extração. A configuração v0.5 usa uma réplica local, sincronização de um segundo, snapshots horários e retenção de 35 dias, incluindo os arquivos L0 que preservam a resolução dos pontos de recuperação. Essa frequência é uma configuração; falhas, desligamento e falta de espaço podem aumentar o atraso observado.

Preparar e revisar o quarto serviço, sem substituir os outros três:

```sh
bun run local/recovery-service.ts --prepare /caminho/privado/installation.json /caminho/privado/tools/litestream/litestream
```

Depois da revisão, `--activate` com os mesmos argumentos registra o LaunchAgent exclusivo da instalação. Uma etiqueta já carregada não é substituída pelo comando. O plano não contém restauração automática do banco inteiro: uma recuperação de negócio não deve reativar credenciais antigas. O executável e a configuração ficam vinculados por SHA-256 aos metadados privados; alterações exigem nova revisão.

No painel Backups, o operador pode selecionar a aplicação e um instante UTC no formato `2026-11-12T15:30:00.000Z`. O ponto corresponde ao último commit retido estritamente anterior ao instante solicitado. A ferramenta restaura primeiro para um diretório temporário privado, confere a integridade SQLite, e importa somente os dados e anexos da aplicação selecionada, com confirmação e revisão atual. As sessões atuais, recibos de notificações e sequências já emitidas são preservados; uma cópia verificada do estado atual precede a substituição.

Os snapshots horários da camada diária são retidos por 35 dias no Dashboard/Procurement e por 14 dias no Planner. Os arquivos mensais ficam por sete anos de calendário. A manutenção realiza mensalmente uma restauração real dos arquivos das três aplicações em uma base temporária e, quando a réplica está configurada, também verifica sua recuperação. Falhas não recebem progresso de sucesso e são tentadas novamente. O painel distingue uma réplica configurada de um exercício concluído e registra a duração observada.

Uma réplica e arquivos no mesmo disco não protegem contra perda deste Mac. Um destino externo autorizado continua necessário para essa proteção. O objetivo de RPO de uma hora e RTO de quatro horas precisa ser medido no volume real e revisto em exercícios periódicos; os testes de aceitação usam bases temporárias e não constituem garantia para qualquer volume futuro.

## Contratos de dados preservados após aposentadoria do console

O Planner aceita planilhas `.xlsx` e `.xls` BIFF8 reais, com limites de tamanho, folhas e células, sem executar fórmulas nem aceitar links externos. A exportação All Members do Dashboard pode ser importada diretamente: Summary by Leader é auxiliar e os campos de talento não entram no roster. Em planos desbloqueados, a importação sincroniza as posições atomicamente; em planos bloqueados, apenas o roster é atualizado.

As páginas de negócio consultam alterações a cada 30 segundos enquanto visíveis. Campos modificados e editores abertos impedem a substituição do conteúdo até salvar ou navegar, preservando a escrita em andamento. Os links de notificações abrem o registro correspondente, quando autorizado, inclusive uma requisição fechada.

## Configuração compartilhada de Team (contrato v1)

Uma Team habilitada pode receber um documento compartilhado em
`<mount>/api/ui/team-profiles/configuration`. A leitura administrativa usa GET
com a consulta fechada `contractRevision=sf-team-profile/1&installationId=...&tenantId=...&teamObjectId=...`.
A alteração usa POST com a mesma consulta sem `teamObjectId`, o cookie da sessão
Microsoft atual, `Origin` igual à origem pública configurada e
`Content-Type: application/json`.

O corpo contém `profile` completo, `expectedRevision` numérico igual à revisão
corrente do catálogo e `document: { version: 1, settings: ... }`. A revisão é
compartilhada com habilitar, desabilitar e remover Teams; uma alteração
concorrente retorna conflito e exige reler o estado antes de propor outro
documento. Uma repetição semanticamente idêntica com a revisão corrente não
cria novo evento de auditoria. A política corrente e o pertencimento ao grupo
supremo são verificados de novo dentro da escrita.

O subconjunto inicial de `settings` admite `model`, `default_agent` e
`agents`. Cada agente pode declarar `name`, `description`, `system`,
`model`, `variant`, `mode`, `hidden` e `disabled`. O identificador de
modelo usa `provedor/modelo`; o documento não concede acesso ao provedor.
O leitor recusa campos fora desse contrato, inclusive credenciais, conexões
pessoais, headers, comandos, providers, MCP, plugins, skills, caminhos,
permissões e aprovação de ferramentas. Documentos de no máximo 64 KiB e no
máximo 100 agentes têm limites adicionais por campo.

O GET retorna `origin: "installation-team-store"`, a referência completa da
Team, a revisão e o documento. Esse rótulo identifica a origem dos dados,
sem substituir a autorização. O banco privado guarda a configuração e a
auditoria fora dos snapshots de negócio. Remover uma Team impede a leitura
ativa de seu documento; a configuração histórica não muda de titular nem é
reatribuída a outra Team.

No Core corporativo, abrir os serviços de uma localização exige uma
configuração atual obtida por uma admissão privada de sessão. Um documento
ausente, uma revisão antiga ou uma sessão revogada impedem a abertura; não
há descoberta substituta em `orchestra.json`, no diretório global ou em
`.orchestra`. Serviços mutáveis ficam separados por Team, pessoa, revisões
e lease da requisição, ainda que usem a mesma pasta técnica. Criar ou ler uma
sessão continua exigindo as ações explícitas e as ACLs de recurso correntes;
configurar uma Team não concede essas ações.

Esta fonte fechada ainda não qualifica execução de modelo, credenciais
pessoais, MCP, plugins, hooks ou tarefas agendadas. Essas fronteiras precisam
de seus próprios vínculos e verificações de proprietário antes da ativação
corporativa. Nenhum documento legado é importado ou adotado automaticamente.

## Conexões pessoais vinculadas à Team

A política privada Microsoft pode declarar `connectionActions` com
`read`, `create`, `update` e `remove`, e `connectionResources` como uma
lista fechada de `{ category: "integration" | "mcp", resourceId: "..." }`.
Os dois campos ausentes significam listas vazias. Uma operação precisa do
verbo e do recurso exatos, além da pessoa, Team, sessão, geração e direitos
de negócio atuais. O grupo supremo, um papel financeiro, a escolha de Team
e a permissão de modelo não preenchem esses campos.

O armazenamento privado separa cada registro por instalação, tenant, Team,
pessoa, categoria, recurso e identificador. Metadados de listagem contêm
somente chave, rótulo, revisão e estado; os valores são consumidos
internamente pelos adaptadores de credenciais. Cada escrita compara a
revisão corrente e grava registro, auditoria e revisão global na mesma
transação. Remover deixa um tombstone sem o valor cifrado. Uma repetição com
revisão antiga não substitui um registro novo.

O cifrador v1 deriva uma chave separada da chave de sessão privada já
provisionada, e vincula a autenticação do ciphertext ao proprietário
completo e aos metadados do registro. A instalação confere versão e
fingerprint; ausência, mudança de chave, corrupção ou lacuna de auditoria
causam indisponibilidade, sem gerar uma chave substituta nem regravar
segredos antigos. A restauração física integral requer o procedimento
separado de migração e recuperação; a verificação local não é prova contra
a reposição integral de banco e controle.

Credenciais antigas do Core, herança de outra instalação e o arquivo global
`mcp-auth.json` permanecem preservados e em quarentena no fluxo corporativo.
Não são adotados por nome de servidor, caminho, ID técnico ou escolha de
Team. Conexões do ambiente do processo não são listadas nem resolvidas por
uma Integration corporativa. A configuração compartilhada continua sem
segredos e sem definições de servidores MCP. O armazenamento de estado MCP
não autoriza conexão, execução de ferramenta ou OAuth externo: sem um
contrato privado concreto para esse servidor, esses caminhos permanecem
fechados. O AISDK corporativo também recusa a criação e o uso de um SDK sem
uma definição privada de provedor admitida, mesmo que exista um nome de
modelo compartilhado ou uma chave no ambiente. Essa suspensão explícita
não é a conclusão da integração LLM/MCP. O ramo técnico mantém os hooks e
provedores existentes. Esta fatia não declara um provedor ou tenant real
qualificado.
