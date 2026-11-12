# Acesso local neste Mac

A execução gerenciada deste Mac fica em `~/Library/Application Support/Sucafina`: `runtime` contém a cópia aprovada do módulo e do host; `installation` guarda configurações, chaves, bancos e bases do scanner com acesso privado. Os fontes em Documents permanecem preservados. O macOS recusou o início direto de executáveis em Documents pelo launchd; por isso os três serviços apontam para a cópia em Application Support. O atalho em Documents abre essa instalação.

A homologação está disponível em `http://localhost:4110/sucafina/dashboard`. O perfil ativo é **local-operator**, com a conta real do macOS. Não representa uma conta nem grupos do Microsoft 365. A faixa amarela identifica esse perfil em todas as telas.

Para reabrir uma sessão no Chrome, usar o atalho `/Users/gustavoschneiter/Documents/sucafina/Abrir Sucafina.command`. Ele prepara uma credencial de uso único em arquivo privado e abre a aplicação. A credencial dura dez minutos; a sessão HttpOnly dura oito horas. O atalho renova o acesso sem exibir tokens. A emissão exige o UID do dono e configuração privada com permissão 0600 em diretório 0700. Nenhuma rota HTTP emite acesso anônimo.

O operador possui a política administrativa das três superfícies somente neste perfil de homologação. Compras exige ainda a opção booleana explícita `localOperator.buyer: true` no arquivo privado para conceder o papel buyer apenas em Procurement. O padrão continua sem esse papel; a opção não altera a identidade local nem as permissões Microsoft. Os registros ficam em `business-local/installation.sqlite`, separados do perfil Microsoft em `business/installation.sqlite`. A auditoria identifica `macos:<installationId>:<uid>` e o nome real da conta do sistema. Não são criados usuários locais novos, empregados fictícios ou grupos Entra. Dados locais não são promovidos automaticamente ao perfil corporativo.

A opção `authentication: "local-operator"` é explícita no arquivo privado. A ausência da opção, ou `authentication: "microsoft"`, preserva a autenticação corporativa e não concede papéis quando ela está indisponível. Alternar o perfil exige atualizar somente a instância isolada; o aplicativo Orchestra existente não participa desse processo.

Para preparar o acesso pela linha de comando:

```sh
bun local/enroll.ts /absolute/private/installation.json --enable-local
./local/open.command /absolute/private/installation.json
```

O primeiro comando ativa explicitamente o perfil do dono e prepara um arquivo privado de entrada. Invocações posteriores podem omitir `--enable-local`; o helper recusa ativação implícita. O arquivo de entrada substitui a navegação, não publica a credencial em mensagens de console e não reutiliza senhas do Orchestra.

O teste de Chrome hospedado abriu o arquivo privado, autenticou e percorreu as 28 telas. A suíte desta correção aprovou 45 testes, incluindo persistência/auditoria com a conta local, negação de acesso anônimo e isolamento de sessões e dados nos dois sentidos entre Microsoft e local.

## Infraestrutura e perfil Microsoft


Esta instalação permanece externa ao produto Orchestra. O launcher usa uma instância própria do Orchestra em `http://localhost:4110`, com o módulo no mesmo processo e listener, e arquivos privados fora deste código. O início em primeiro plano não registra serviço. A instalação opcional dos três LaunchAgents próprios está descrita abaixo e preserva o aplicativo existente.

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

Abrir `http://localhost:4110/sucafina/dashboard`, `/planner` ou `/procurement`. No perfil Microsoft, sem os IDs reais o módulo responde 503 de configuração, sem conceder acesso. O perfil local explícito descrito acima usa autenticação própria de homologação. Se a porta estiver ocupada, o início falha. Para encerrar, usar Ctrl-C somente nesse terminal; não encerrar o app Orchestra existente. Alterar o arquivo privado exige novo início somente desta instância.

O launcher define XDG, banco do host, chave de credenciais e diretório temporário próprios **antes** de importar o host; também desativa herança de credenciais e configuração de projeto. O factory verifica esses caminhos antes de o host migrar o banco. O SQLite de negócio fica em `business/installation.sqlite`: dados, versões, sequências, auditoria e BLOBs privados participam da mesma transação. Credenciais cifradas ficam em tabela separada e não entram no backup de negócio.

Os cookies contêm apenas identificadores opacos. PKCE e tokens ficam cifrados no servidor com AES-256-GCM. Logout encerra somente esta sessão local, sem desconectar Teams ou Microsoft globalmente. Grupos são consultados novamente para autorizar cada operação.

Uploads são recusados quando o scanner está ausente ou não responde com resultado limpo. O adaptador usa [ClamD INSTREAM](https://docs.clamav.net/manual/Usage/ClamdProtocol.html); o daemon deve manter assinaturas atualizadas e sinalizar arquivos não completamente analisados (`AlertExceedsMax`), com limites compatíveis com os limites definidos na aplicação. Neste Mac, ClamAV 1.5.4 foi compilado da fonte oficial com SHA-256 conferido e instalado somente em `tools/clamav` do diretório privado. As três bases oficiais passaram pela verificação e o serviço em `127.0.0.1:43310` respondeu ao controle limpo e detectou EICAR, transmitido em memória. `scanner-qualification.json` no diretório privado registra essa verificação operacional. O atualizador privado verifica assinaturas 12 vezes por dia e notifica o ClamD após atualizações. A inicialização automática usa os três LaunchAgents de usuário descritos abaixo; sem sua ativação, scanner e atualizador precisam ser iniciados com os respectivos arquivos privados antes da homologação. A rota de prontidão informa configuração; não faz uma sondagem de saúde a cada acesso.

No perfil local, notificações destinadas à conta real do operador são entregues à caixa de entrada durável do aplicativo. Destinatários externos ou do diretório corporativo não são redirecionados para essa conta: permanecem pendentes. No perfil Microsoft, o envio continua dependendo de um transporte corporativo real; não são fabricados recibos de e-mail ou Teams. A existência destes adaptadores e de testes com provedor sintético não prova login, consentimento, grupos ou antivírus reais. A ativação só fica concluída após a validação com a organização.

## Interface e tamanhos de tela

Dashboard, Planner e Procurement compartilham os mesmos tamanhos de controles, tipografia e espaçamentos. Indicadores relacionados ocupam grades de colunas iguais; a visão executiva separa finanças, pessoas, entrega, operações, níveis de serviço e segurança. A navegação destaca a página atual.

Em telas menores, as grades reduzem o número de colunas e a navegação passa para o topo. Tabelas largas mantêm rolagem horizontal dentro do próprio painel. O aviso de homologação continua visível em todas as telas do perfil local.

A validação de layout usa Chrome no GitHub Actions em larguras de 1440, 1024 e 390 pixels, cobrindo as 28 páginas. Para reproduzir no checkout de validação, usar `bun run test:ci script test/fixture/sucafina/Sucafinav1/test/visual-layout.test.ts`. O teste cria apenas uma instalação temporária própria e um plano de teste pelo comando normal da aplicação; não usa os dados privados desta instalação.

Os editores usam campos alinhados em até quatro colunas, com áreas de texto em largura completa e ações separadas. Configurações repetidas e importação de planilhas ficam em painéis expansíveis; relatórios e backup permanecem disponíveis no painel correspondente. A barra superior permite alternar entre Dashboard, Budget Planner e Procurement.

A edição de um registro em tabela abre uma janela nativa do navegador. Escape ou o botão de fechar retornam à linha; erros aparecem dentro do editor. Após salvar e atualizar os dados, o foco volta à ação da mesma linha. O teste `form-layout.test.ts` verifica esses comportamentos com um registro temporário real, além de abrir os painéis expansíveis das 28 páginas nas três larguras.

## Inicialização no login deste Mac

A instalação usa três serviços de usuário exclusivos desta instalação, sem substituir o app Orchestra: scanner, atualizador de assinaturas e servidor. Preparar o plano não encerra nem inicia processos:

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

## Paridade com os artefatos

O Planner aceita planilhas `.xlsx` e `.xls` BIFF8 reais, com limites de tamanho, folhas e células, sem executar fórmulas nem aceitar links externos. A exportação All Members do Dashboard pode ser importada diretamente: Summary by Leader é auxiliar e os campos de talento não entram no roster. Em planos desbloqueados, a importação sincroniza as posições atomicamente; em planos bloqueados, apenas o roster é atualizado.

As páginas de negócio consultam alterações a cada 30 segundos enquanto visíveis. Campos modificados e editores abertos impedem a substituição do conteúdo até salvar ou navegar, preservando a escrita em andamento. Os links de notificações abrem o registro correspondente, quando autorizado, inclusive uma requisição fechada.
