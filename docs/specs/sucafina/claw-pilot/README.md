# Piloto Claw SF

O Gateway stock OpenClaw 2026.8.1 usa a [configuração do piloto](openclaw.example.json). O Maestro recebe as solicitações e delega por `sessions_spawn` a quatro perfis de leitura, com sessões isoladas. Use um estado de Gateway por conta Entra.

A [factory Microsoft](../../../guides/sucafina-microsoft-installation.md) monta a projeção nativa de Meu trabalho com a autoridade e os produtores do piloto. A leitura `sf_pendencias` passa por `sf_work_list` para admitir a seleção e revalidar o principal antes de combinar o resultado com a Inbox persistida.

Ao lado da configuração Microsoft privada, instale `claw.json` com o mesmo dono e modo 0600. O arquivo aceita uma ou duas entradas, cada uma com o `principalRef` do usuário no tenant de recurso, um `period` com datas `start` e `end` e os `inboxRefs` aprovados para a pessoa. Cada referência é `digestSfValue({ source, externalId })` do item armazenado. A Inbox é compartilhada pela instalação, então cada perfil recebe apenas os itens atribuídos àquela conta.

Após login no SF, o titular abre a conexão com um POST vazio same-origin para `/sucafina/api/claw/connect`. O retorno contém `token` e `expiresAt`. Configure o MCP `/sucafina/api/claw/mcp` por HTTPS com `Authorization: Bearer <token>`, guardando a credencial na instância particular do Gateway. A capacidade dura até uma hora e depende da sessão Entra que a criou. Uma nova conexão substitui a anterior da mesma pessoa. Reiniciar a instalação encerra as conexões.

Guarde a URL e o token em `pending-connection.local.json`, modo 0600, ao lado de uma cópia de [`read-pending.mjs`](read-pending.mjs) fora dos workspaces dos agentes. Configure a [condição stock](inbox-trigger.js) com o caminho absoluto do leitor e autorize o executável apenas para o Maestro. O exemplo mantém o MCP desativado até a conexão. A condição recebe só a assinatura das pendências.

A integração do listener em `dev` segue pelo PR #529. O port local toma como fonte o checkpoint `refs/checkpoints/claw-pilot`, preservado no worktree `claw-sf-pilot`. A prova anterior com Gateway stock usou dados sintéticos. Para qualificação corporativa, produza o pacote e o recibo da revisão efetivamente instalada e registre a leitura com duas contas Entra, a negativa de acesso cruzado e o retorno dos quatro especialistas ao Maestro.
