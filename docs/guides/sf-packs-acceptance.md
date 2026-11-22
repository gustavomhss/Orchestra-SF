# Aceite dos packs do Orchestra-SF

Compras, Fornecedores e Contratos formam a primeira leva do [template de packs](sf-pack-template.md). A prova sintética usa Gateway e MCP reais, sessões Microsoft simuladas e bancos temporários por Team.

## Evidência e reprodução

| Entrega | Evidência |
| --- | --- |
| Template gera skill, MCP, plugin e prova | [PR #598](https://github.com/gustavomhss/Orchestra-SF/pull/598) · [CI do template](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44962331878) |
| Compras compara, confirma pelo comando nativo e relê a versão gravada | [PR #592](https://github.com/gustavomhss/Orchestra-SF/pull/592) · [CI de Compras](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44957757633) |
| Fornecedores limita a resposta aos dados cadastrais permitidos | [PR #599](https://github.com/gustavomhss/Orchestra-SF/pull/599) · [CI de Fornecedores](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44963427146) |
| Contratos aplica visibilidade do Dashboard e revalida o lote antes de responder | [PR #603](https://github.com/gustavomhss/Orchestra-SF/pull/603) · [CI integrado dos três packs](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965484818) |

Para repetir a prova instalada dos três packs, selecione o cenário de CI de Contratos. O comando executa também as regressões de Fornecedores e Compras.

```sh
bun run test:ci sucafina Sucafinav1/test/microsoft-installation.test.ts -t 'alongside contract review' --os linux --timeout 620000
```

## Preparar o QA corporativo

1. Identifique o SHA efetivamente instalado no QA e os três handlers habilitados. Use o `mount` desse slot nos três endpoints. Confirme os bearer próprios de cada pack e os perfis locais do Gateway antes da matriz.
2. Use dois Times privados habilitados e duas contas Microsoft de teste. Coloque um pedido, um fornecedor e um contrato sintéticos em cada Team. Dê a cada conta os grants de leitura do pack e a visibilidade nativa correspondente. Restrinja a confirmação de Compras a quem tiver o papel de comprador naquele pedido.
3. Abra duas sessões Microsoft separadas. Em cada perfil privado do Gateway, pareie a sessão original com o Team e obtenha a credencial dedicada de cada pack. Mantenha bearer do SF, token de operador do Gateway e cookies fora do recibo. [Compras](sucafina-purchase-gateway.md) · [Fornecedores](sucafina-supplier-review-gateway.md) · [Contratos](sucafina-contract-review-gateway.md)

| Pack | Ferramenta no `POST /tools/invoke` | Entrada |
| --- | --- | --- |
| Compras | `sfcompras__sf_comparar_compra` | `requestRef` do pedido |
| Fornecedores | `sf-vendor-review__sf_read_vendor_review` | `recordRef` do fornecedor |
| Contratos | `sf-contract-review__sf_read_contract_review` | `recordRef` do contrato |

## Executar e registrar

Para cada ferramenta, faça quatro chamadas com os registros sintéticos abaixo. Isso totaliza 12 chamadas para os três packs.

| Perfil | Registro | Esperado |
| --- | --- | --- |
| A | Team A | HTTP 200 e resultado MCP `ok` com os campos esperados |
| A | Team B | HTTP 200, `isError: true` e somente `{"status":"denied"}` |
| B | Team A | HTTP 200, `isError: true` e somente `{"status":"denied"}` |
| B | Team B | HTTP 200 e resultado MCP `ok` com os campos esperados |

Um `401`, `403` ou `404` externo é falha de prontidão para esta matriz. Registre a fase e o código observado. Para Fornecedores e Contratos, compare os snapshots antes e depois das consultas. Para Compras, a pessoa responsável confirma a cotação no SF nativo. Faça uma nova leitura pelo Gateway e verifique no SF a cotação, a versão e a entrada no histórico.

Registre o SHA instalado, o slot, o horário, os aliases de perfil e Team, as referências sintéticas, o status HTTP, a resposta MCP sanitizada e a releitura de Compras. Feche o aceite corporativo com os 12 resultados e a persistência confirmada. Registre o G09 no fluxo próprio.
