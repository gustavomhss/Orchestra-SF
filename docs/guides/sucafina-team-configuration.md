# Configuração compartilhada do Chat por Team

A administração de equipes permite habilitar perfis do Microsoft Teams e editar a configuração compartilhada de cada perfil. A conta precisa ter a administração corporativa confirmada pela instalação. Ela pode abrir esse painel mesmo sem acesso de negócio a um Team.

Na entrada Web da instalação, abra **Team administration** / **Administração de equipes**. Leia a configuração atual e, na linha da equipe, escolha **Configure chat** / **Configurar chat**. O editor carrega a configuração persistida daquela equipe antes de habilitar o formulário.

## Navegação e leitura

O cabeçalho reúne **Atualizar acesso** e **Sair**. A seleção de equipe fica junto das ações de abrir o dashboard e iniciar um chat. Quando o contexto autorizado fornece o nome de uma equipe, esse nome identifica a seleção e a linha administrativa; o identificador original continua disponível como referência. Uma equipe sem nome fornecido pela fonte permanece identificada pelo seu ID.

A administração organiza cada equipe em uma linha com seu estado e suas próprias ações. O editor de configuração mantém os campos junto da ação de salvar. Em uma janela estreita, os grupos se reorganizam e o conteúdo pode ser percorrido verticalmente. Se houver um rascunho ao sair da edição, a confirmação distingue continuar editando de descartar o rascunho.

## Modelo e agente

Informe o identificador de modelo no formato `provedor/modelo`, exatamente como foi preparado para esta instalação. O campo é obrigatório neste editor: uma configuração vazia não seleciona um modelo para novas sessões do Chat. O editor não escolhe um provedor automaticamente.

O ID do agente padrão é opcional. Ao deixar esse campo vazio, a preferência é omitida. As definições compartilhadas de agentes já existentes são preservadas integralmente; este formulário não altera seus nomes, instruções ou demais propriedades.

Salvar essa preferência não verifica se uma pessoa possui uma conexão pessoal utilizável. O Chat também exige acesso atual ao Team, permissões explícitas para as ações de sessão e modelo, um provedor declarado para a instalação e uma conexão pessoal autorizada e ativa. Habilitar um Team ou administrar sua configuração não concede essas permissões.

O formulário não recebe chaves de API, tokens, endpoints, grupos ou grants. As credenciais pessoais e as permissões continuam sob seus produtores privados.

## Revisão e confirmação

A gravação envia a revisão obtida na leitura atual. O servidor confere novamente a sessão Microsoft, a administração corporativa e a revisão antes do commit. Quando outra alteração já mudou essa revisão, a gravação é recusada por conflito.

Após uma confirmação de gravação, a página atualiza o contexto e as permissões antes de oferecer mais controles. Em caso de conflito, leia a configuração atual antes de editar novamente. Uma falha de rede depois do envio ou uma navegação durante a gravação pode deixar o resultado desconhecido. A página informa essa condição e nunca reenvia a gravação automaticamente. Faça uma nova leitura explícita para observar o estado persistido.

Remover um perfil apaga sua configuração compartilhada. Habilitá-lo novamente não restaura a configuração removida.

## Contrato HTTP para operação autorizada

A leitura usa `GET <mount>/api/ui/team-profiles/configuration` com os quatro parâmetros `contractRevision`, `installationId`, `tenantId` e `teamObjectId`. A escrita usa `POST` na mesma rota, com os três primeiros parâmetros, e o comando fechado `ConfigurationCommand`: `profile`, `expectedRevision` e `document`. O contrato é `sf-team-profile/1`.

A revisão é opaca e deve ser preservada exatamente. O servidor exige a mesma origem e a sessão Microsoft vigente; os identificadores na URL e no corpo representam apenas a intenção da operação. A resposta de sucesso confirma a gravação, não uma admissão de negócio ou uma conexão com o provedor.
