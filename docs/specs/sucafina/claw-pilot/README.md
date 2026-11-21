# Piloto Claw SF

O Gateway stock OpenClaw 2026.8.1 usa a [configuração do piloto](openclaw.example.json). O Maestro recebe as solicitações e delega por `sessions_spawn` a quatro perfis de leitura, com sessões isoladas. Use um estado de Gateway por conta Entra. Mantenha a porta loopback e o token de controle sob custódia do operador. No ponto de entrada do usuário, fixe `agentId: maestro` e aceite apenas sessões do Maestro. As sessões filhas recebem trabalho por delegação com `context: "isolated"`. A API de controle stock permite seleção explícita de agente e é reservada ao operador.

A conexão corporativa depende da integração da factory Microsoft e da projeção autorizada de Meu trabalho em `dev`. Quando instaladas, `sf_pendencias` passa por `sf_work_list` para admitir a seleção e revalidar o principal antes de combinar o resultado com a Inbox persistida.

Ao lado da configuração Microsoft privada, instale `claw.json` com o mesmo dono e modo 0600. O arquivo aceita uma ou duas entradas, cada uma com o `principalRef` do usuário no tenant de recurso, um `period` com datas `start` e `end` e os `inboxRefs` aprovados para a pessoa. Cada referência é `digestSfValue({ source, externalId })` do item armazenado. A Inbox é compartilhada pela instalação, então cada perfil recebe apenas os itens atribuídos àquela conta.

Após login no SF, o titular abre a conexão com um POST vazio same-origin para `/sucafina/api/claw/connect`. O retorno contém `token` e `expiresAt`. Configure o MCP `/sucafina/api/claw/mcp` por HTTPS com `Authorization: Bearer <token>`, guardando a credencial na instância particular do Gateway. A capacidade dura até uma hora e depende da sessão Entra que a criou. Uma nova conexão substitui a anterior da mesma pessoa. Reiniciar a instalação encerra as conexões.

Guarde a URL e o token em `pending-connection.local.json`, modo 0600, ao lado de uma cópia de [`read-pending.mjs`](read-pending.mjs) fora dos workspaces dos agentes. Configure a [condição stock](inbox-trigger.js) com o caminho absoluto do leitor e autorize o executável apenas para o Maestro. O exemplo usa um endereço HTTPS inerte e mantém o MCP desativado até a conexão. A condição recebe só a assinatura das pendências.

Instale a condição com o caminho absoluto exato do leitor. A autorização e a automação devem apontar explicitamente para o Maestro.

```sh
reader=$(realpath /caminho/privado/read-pending.mjs)
openclaw approvals allowlist add --gateway --agent maestro "$reader"
openclaw automations add --name "Pendências do SF" --agent maestro --every 15m \
  --session isolated --no-deliver --trigger-script trigger.local.js \
  --message 'Leia sf_pendencias e delegue apenas quando necessário com context: isolated.'
```

O listener de instalação entrou em `dev` pelo PR #529. O port local toma como fonte o checkpoint `refs/checkpoints/claw-pilot`, preservado no worktree `claw-sf-pilot`. A prova anterior com Gateway stock usou dados sintéticos. Para qualificação corporativa, produza o pacote e o recibo da revisão efetivamente instalada e registre a leitura com duas contas Entra, a negativa de acesso cruzado e o retorno dos quatro especialistas ao Maestro.
