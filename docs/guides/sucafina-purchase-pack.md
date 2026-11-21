# Pack de compras do Orchestra-SF

O pack usa o ranking, os critérios de elegibilidade e o câmbio registrados no SF. Ele devolve o link da comparação nativa para a pessoa responsável confirmar a escolha.

## Configurar o Gateway

Use o [bundle de compras](../../modules/sucafina/Sucafinav1/product/ai/packs/procurement) em um Gateway OpenClaw vinculado a uma instalação SF que habilite `sf_comparar_compra` no MCP. A instalação precisa vincular a sessão do Gateway à identidade do usuário e conceder a capacidade `sf_sourcing_compare` com acesso à fonte do pedido.

1. Instale o bundle com `openclaw plugins install <caminho-do-pack> --accept-capabilities` e habilite a skill `sf-revisar-compra` no perfil.
2. Configure `mcp.servers.sfcompras` com o [exemplo do bundle](../../modules/sucafina/Sucafinav1/product/ai/packs/procurement/openclaw-mcp.example.json). Use a URL e a credencial fornecidas pela instalação. Reserve o perfil para a pessoa à qual a credencial está vinculada. Forneça `SF_CLAW_PURCHASE_TOKEN` pelo mecanismo de segredos do Gateway.
3. Permita `sfcompras__sf_comparar_compra` no perfil. Informe a referência autorizada emitida pelo dossiê de sourcing para carregar a comparação.
4. Confirme a escolha na tela nativa. Para verificar a versão e a seleção registrada, reabra o dossiê de sourcing e informe a referência da revisão atual.
