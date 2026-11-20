# Workspace Sucafina com perfis do Microsoft Teams

Este guia descreve a entrada Web da instalação Microsoft do Sucafina. O responsável pela instalação precisa configurar o tenant do recurso, o aplicativo, a origem HTTPS, a leitura de Teams e a política de acesso. A seleção de um Team no navegador é uma intenção: cada consulta e cada ação continuam a ser autorizadas no servidor.

A qualificação desta implementação tem como alvo SF Web em Linux x64. Fixtures com OIDC assinado, banco real e navegador real não substituem a validação do tenant de produção, do consentimento e dos provedores externos.

## Entrar e escolher um perfil

Abra a entrada Sucafina da instalação e use **Entrar com Microsoft**. O retorno do login abre a interface nativa. A aplicação não usa uma sessão de operador local como alternativa ao login corporativo.

O perfil é identificado pelo conjunto instalação, tenant e object ID do Team. Nomes são apenas rótulos. Dois Teams com o mesmo nome continuam sendo perfis distintos.

- Com um Team elegível, a interface pode selecioná-lo automaticamente.
- Com vários Teams elegíveis, escolha o Team antes de abrir as áreas de negócio.
- Sem Team elegível, a interface explica a ausência de acesso. A administração pode continuar disponível para quem pertence ao grupo administrativo configurado.
- Se a consulta à Microsoft estiver indisponível, a interface apresenta a falha. Uma consulta incompleta não é tratada como uma lista vazia.

Participar do Team e habilitar seu perfil não concede, por si só, papéis ou ações do produto. As regras existentes de papéis, grants, destinatários e recursos continuam a ser verificadas.

## Janelas e troca de Team

Cada janela mantém sua própria seleção. Abrir a mesma aplicação em outra janela não muda o Team da primeira. A aplicação também separa abas de chat e intenções de recuperação por pessoa, instalação, tenant, Team e janela.

Ao trocar de perfil, sair da conta ou perder acesso, a interface cancela as requisições e streams do contexto anterior e remove seus dados da tela. Um retorno tardio não pode preencher a nova janela com dados do contexto anterior.

A troca voluntária de perfil pede confirmação quando há rascunho. Uma revogação de acesso remove os dados imediatamente. Se uma ação tiver resultado ainda desconhecido, a interface mantém seu identificador para consulta e não repete a escrita automaticamente.

**Ctrl+Shift+P** abre o seletor de Team. Os controles de navegação também estão disponíveis em janelas estreitas.

## Abrir e usar chats

**Novo chat** abre o workspace do Team atual. Abrir essa tela ou escolher uma aba existente não envia uma mensagem nem cria uma sessão. A criação ocorre quando a primeira mensagem é enviada.

O workspace mostra chats recentes, abas abertas e chats fechados recentemente. A pesquisa e a abertura de um chat fazem leituras autorizadas no servidor. Um link ou ID salvo não é uma permissão de leitura.

O envio usa o editor nativo de mensagens. Depois da admissão, a interface distingue a mensagem aceita da execução: aceitar a solicitação não significa que um modelo já começou ou que uma resposta foi produzida. Atualizações da sessão chegam pelo stream autenticado e são conferidas contra o perfil e a geração corrente antes de aparecerem.

Os controles **fechar aba** e **reabrir aba** também estão disponíveis por **Ctrl+W** e **Ctrl+Shift+T**, dentro do workspace. Reabrir faz uma nova leitura da sessão.

A interface guarda rascunhos de chat apenas em memória nesta versão. Eles podem permanecer entre abas da mesma janela enquanto o contexto continuar válido. Após uma renovação de contexto, ficam ocultos até a revalidação; uma mudança de pessoa, Team ou revisão os remove. Recarregar a página não restaura o texto não enviado.

Para recuperar a navegação, a janela pode guardar IDs de abas, IDs de solicitações e seus estados. Ela não grava títulos, mensagens ou rascunhos de chat nesse armazenamento. A lista e o conteúdo são buscados novamente antes da apresentação. Se o navegador não oferecer armazenamento isolado seguro, a janela funciona sem essa recuperação.

### Quando uma ação não é confirmada

Uma queda de conexão durante criação, envio ou interrupção pode deixar o resultado desconhecido. Use **Verificar solicitação** para consultar o estado pelo identificador original. Essa consulta não reenvia a ação.

Se a sessão não aparecer nessa leitura, a ausência não prova que a escrita nunca aconteceu. A interface conserva o estado indeterminado para evitar duplicar o pedido.

Se o servidor recusar o acesso ao chat, a interface limpa seus dados e explica a recusa. As áreas de negócio cuja autorização continua válida permanecem disponíveis. Uma sessão Microsoft encerrada exige novo login.

Se as atualizações em tempo real forem interrompidas, use o controle de atualização apresentado pela interface. O contexto e o conteúdo são revalidados antes de voltar à tela.

### Limites desta entrada

Os anexos já presentes podem ser identificados pelo nome, mas esta entrada não abre arquivos, não pesquisa o sistema de arquivos e não inclui anexos, shell, plugins ou MCP no envio. Essas capacidades exigem contratos e autorização próprios.

A configuração compartilhada de modelo e agentes não concede acesso a provedores, ferramentas ou credenciais. A execução depende das permissões e dos serviços que o responsável pela instalação disponibilizar.

## Administração de perfis

A administração é um destino independente da seleção de Team. O servidor verifica a associação atual ao grupo supremo configurado para cada leitura e alteração. Não é necessário participar do Team administrado, e a administração não concede acesso aos chats pessoais de seus participantes.

Use o object ID completo do Team para habilitar um perfil. A aplicação verifica o Team no Microsoft Graph antes da habilitação. A desativação e a remoção de um perfil existente continuam disponíveis sem depender da enumeração de Teams, desde que a admissão administrativa esteja válida.

As alterações usam a revisão lida da configuração. Se outra pessoa alterar a configuração antes da confirmação, a aplicação informa o conflito e pede uma nova leitura. Ela não reaplica a alteração automaticamente.

A configuração do perfil, a administração do produto e as permissões pessoais continuam separadas. Desativar um perfil impede sua seleção para negócio; remover ou alterar permissões também invalida o contexto corrente nas próximas verificações.

## Para o responsável pela instalação

A ativação Microsoft e os requisitos de tenant estão descritos em [Login Microsoft Entra](sucafina-microsoft-login.md). A leitura de Teams é uma capacidade explícita da configuração. O login mínimo continua distinto dessa capacidade.

Prepare papéis e grants pelo procedimento administrativo aprovado. Nenhum nome de usuário, endereço de e-mail, nome de Team, diretório do projeto ou ID conhecido de sessão substitui a identidade e a autorização corrente.

Não reutilize o armazenamento de uma instalação para outro tenant ou cliente Microsoft. A identidade da instalação permanece fixa. Mudanças desse vínculo exigem uma instalação e uma decisão de migração próprias.
