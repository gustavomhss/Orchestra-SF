# Revisar contratos pelo Gateway

O pack consulta um contrato pelo número exibido em **Contratos de Fornecedores**. A resposta traz número, título, fornecedor, vencimento e modalidade de renovação. Use a tela nativa para renovação ou edição.

## Configurar o pack

Em uma instalação Microsoft, configure `teams: "direct"`, `enabledTeamIds` e `clawContractReview: true` no descritor privado. A pessoa precisa de papel no Dashboard, acesso à página **Contratos de Fornecedores** e grant `sf_contract_read`.

Com a sessão original aberta, faça um POST vazio de mesma origem para `/sucafina/api/claw/contract-review/connect` com `X-SF-Claw-Purpose: contract-review`. Se houver vários Times elegíveis, selecione o Team com `X-SF-Team-Profile`. A credencial vale por uma hora e restaura a sessão e o Team do pareamento.

Use um perfil privado do Gateway por conta pareada. Configure `mcp.servers.sf-contract-review` com o [exemplo do pack](../../modules/sucafina/Sucafinav1/product/ai/packs/contract-review/openclaw-mcp.example.json), substituindo o host de exemplo. Se o `mount` for personalizado, substitua também `/sucafina` no pareamento e no MCP. Passe o bearer do SF ao processo em `SF_CONTRACT_REVIEW_TOKEN`.

Carregue o plugin `sf-contract-review-gateway` e permita `sf-contract-review__sf_read_contract_review` no perfil. Use o token de operador na porta privada do Gateway para chamar `POST /tools/invoke`.

```json
{
  "tool": "sf-contract-review__sf_read_contract_review",
  "agentId": "maestro",
  "args": { "recordRef": "CT-09001" }
}
```

Um contrato fora do Team pareado, indisponível para a sessão ou inexistente retorna `isError: true` com apenas `{"status":"denied"}`.

## Reproduzir a prova

```sh
bun run test:ci sucafina Sucafinav1/test/microsoft-installation.test.ts -t 'alongside contract review' --os linux --timeout 620000
```

A prova usa dois perfis do Gateway pareados a Times sintéticos distintos. Cada perfil lê o próprio contrato e recebe uma negativa sem dados ao consultar o contrato do outro. Os snapshots de contratos são comparados antes e depois. A mesma seleção verifica a retirada de acesso à página e a regressão dos packs de Fornecedores e Compras.
