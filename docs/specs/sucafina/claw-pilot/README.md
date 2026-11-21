# Piloto Claw SF em dev

O Gateway stock OpenClaw 2026.8.1 usa a [configuração do piloto](openclaw.example.json). O Maestro recebe as solicitações e delega por `sessions_spawn` a quatro perfis de leitura, com sessões isoladas. Use um estado de Gateway por conta Entra.

O Core expõe `Inbox.readStored(db)` para ler a Inbox persistida da instalação. O host corporativo precisa autorizar a pessoa e filtrar os itens antes de devolver qualquer conteúdo ao Gateway.

## Dependências para ligar o MCP

1. Integrar em `dev` a admissão do `serve --installation` e a factory Microsoft com origem HTTPS. A factory local já existe em `dev`.
2. Integrar a projeção nativa de Meu trabalho e a autorização `sf_work_list`. A composição do Claw usa o mesmo principal para autorizar a seleção, ler a Inbox e devolver o resultado.
3. Ligar `sf_pendencias` à factory, configurar os itens permitidos por conta e empacotar o CLI Linux, a factory e o Web da mesma revisão. O pacote precisa do recibo que o instalador corporativo verifica.
4. Na instalação corporativa, comprovar a leitura com duas contas Entra, a negativa de acesso cruzado e o retorno dos quatro especialistas ao Maestro.

Quando o endpoint estiver habilitado, guarde a URL e o token em `pending-connection.local.json`, modo 0600, ao lado de uma cópia de [`read-pending.mjs`](read-pending.mjs) fora dos workspaces dos agentes. Configure a [condição stock](inbox-trigger.js) com o caminho absoluto do leitor e autorize esse executável apenas no perfil Maestro. O exemplo mantém o MCP desativado até a conexão. O leitor devolve só a assinatura das pendências para a condição.

A referência original do piloto é `claw-sf-pilot`, com o checkpoint local `refs/checkpoints/claw-pilot`. A execução anterior em ambiente isolado serve como evidência do Gateway stock. A qualificação corporativa depende da revisão que realmente for instalada.
