# Comparação de compras pelo Gateway

Para criar outro pack com a mesma estrutura, use o [template de packs do Orchestra-SF](sf-pack-template.md).

Use um perfil OpenClaw isolado por conta SF, com o MCP de comparação disponível na instalação. Configure `mcp.servers.sfcompras` com a URL HTTPS terminada em `/sucafina/api/claw/mcp`, transporte `streamable-http` e filtro `{"include":["sf_comparar_compra"]}`. Use um filtro sem exclusões para habilitar a comparação por HTTP. Habilite o servidor e forneça a credencial SF do perfil ao processo em `SF_CLAW_PURCHASE_TOKEN`.

Adicione o [plugin do Gateway](../../modules/sucafina/Sucafinav1/product/ai/packs/procurement/gateway) a `plugins.load.paths`. O diretório deve resolver as instalações existentes de OpenClaw e `@modelcontextprotocol/sdk`. Habilite `plugins.entries.sf-purchase-gateway.enabled` e inclua `sf-purchase-gateway` em `plugins.allow` quando o perfil usar uma lista explícita. Permita `sfcompras__sf_comparar_compra` para o agente e reinicie o Gateway do perfil.

Envie `POST /tools/invoke` à porta privada do perfil, com o token de operador do Gateway e `Content-Type: application/json`.

```json
{
  "tool": "sfcompras__sf_comparar_compra",
  "agentId": "maestro",
  "args": { "requestRef": "PR-2026-0901" }
}
```

O Gateway encaminha a consulta de leitura ao SF com a credencial do perfil. Para um pedido fora do escopo, o HTTP retorna `200` e a resposta da ferramenta contém `isError: true` e o texto JSON `{"status":"denied"}`. A chave de operador deve ficar restrita à interface privada do Gateway.

A [prova do piloto](../qa/sucafina/procurement/gateway-tools-invoke.json) registra os quatro casos com duas contas Microsoft e pedidos de teste distintos. O SHA-256 é calculado sobre a concatenação do conteúdo dos três arquivos do plugin, em ordem alfabética de nome.

## Reproduzir o cenário sintético

```sh
bun run test:ci sucafina Sucafinav1/test/microsoft-installation.test.ts -t 'Installed purchase MCP' --os linux --timeout 620000
```

O teste executa o Gateway e o MCP instalado com duas sessões Microsoft simuladas e um banco temporário. Ele compara os dois pedidos pelos perfis A e B, envia o comando de confirmação de Compras pela sessão de A e relê a seleção pelo Gateway. O log registra o avanço da versão 1 para 2 e a leitura de uma única seleção no histórico persistido.

## Parear a instalação Microsoft por Team

A instalação Microsoft aceita `clawPurchasePeriod` no descritor privado, por exemplo
`{"start":"2026-01-01","end":"2026-12-31"}`. O período ativa o MCP de compras para
configurações com `teams: "direct"`. O principal precisa de acesso ao Team, de um
papel de Procurement e das operações `sf_request_read` e `sf_sourcing_compare`
no seu grant.

Com uma sessão Entra ativa, faça um POST vazio para `/sucafina/api/claw/connect`
na mesma origem, com `X-SF-Claw-Purpose: purchases`. Se houver mais de um Team
elegível, envie o seletor da instalação em `X-SF-Team-Profile`. Configure
`SF_CLAW_PURCHASE_TOKEN` no perfil Gateway com o token devolvido. O token fica
vinculado ao Team e à sessão que fizeram o pareamento. O Gateway envia somente
o bearer ao MCP, e um novo pareamento para o mesmo principal e Team revoga o
token anterior.
