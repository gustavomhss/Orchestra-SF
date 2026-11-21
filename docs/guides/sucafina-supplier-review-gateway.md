# Revisar fornecedores pelo Gateway

O pack de revisão lê o número `SUP-…`, a razão social e o status cadastrado de um fornecedor no Team da sessão pareada. A ferramenta recebe apenas `recordRef`. A resposta contém esses três campos. Para ativar, bloquear ou editar o cadastro, use a área nativa de Fornecedores.

## Configurar o pack

Use uma instalação Microsoft com `teams: "direct"`, os Times permitidos em `enabledTeamIds` e `clawSupplierReview: true` no descritor privado. Cada pessoa precisa de um papel de Procurement com acesso a Fornecedores e do grant `sf_supplier_read`.

Com a sessão Microsoft ativa, envie um POST vazio de mesma origem para `/sucafina/api/claw/vendor-review/connect` com `X-SF-Claw-Purpose: vendor-review`. Quando houver vários Times elegíveis, use `X-SF-Team-Profile` para indicar o Team. A credencial vale uma hora e fica vinculada à sessão, ao Team e ao pack que a emitiu.

Use um perfil privado do Gateway por conta pareada. Configure `mcp.servers.sf-vendor-review` com o [exemplo do pack](../../modules/sucafina/Sucafinav1/product/ai/packs/vendor-review/openclaw-mcp.example.json), substituindo o host de exemplo pelo da instalação. Passe o bearer do SF em `SF_VENDOR_REVIEW_TOKEN` ao processo do perfil. Carregue o [plugin OpenClaw](../../modules/sucafina/Sucafinav1/product/ai/packs/vendor-review/gateway) como `sf-vendor-review-gateway` e permita apenas `sf-vendor-review__sf_read_vendor_review` nesse perfil.

Se a instalação usar outra base de URL, substitua `/sucafina` pelo `mount` configurado tanto no pareamento quanto no endpoint MCP.

Use o token de operador do Gateway para chamar `POST /tools/invoke` na porta privada do perfil.

```json
{
  "tool": "sf-vendor-review__sf_read_vendor_review",
  "agentId": "maestro",
  "args": { "recordRef": "SUP-09001" }
}
```

Se o cadastro estiver fora do Team pareado ou a referência não existir, o resultado da ferramenta é `isError: true` e contém apenas `{"status":"denied"}`.

## Reproduzir a prova

```sh
bun run test:ci sucafina Sucafinav1/test/microsoft-installation.test.ts -t 'Installed purchase MCP and supplier review' --os linux --timeout 620000
```

O teste assina duas sessões Microsoft sintéticas e usa dois bancos temporários, um por Team. O Gateway consulta os dois cadastros por perfil, verifica os campos permitidos e exige negativas sem dados nos acessos cruzados. O teste também verifica que credenciais de Compras e Fornecedores não servem para o outro pack, que o MCP anuncia apenas a ferramenta de leitura e que os dois snapshots de fornecedores permanecem idênticos após as consultas. A mesma seleção roda a regressão instalada de Compras.
