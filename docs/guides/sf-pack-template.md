# Criar um pack do Orchestra-SF

O pack de Compras é a referência para skills de leitura, ferramentas MCP, plugins OpenClaw e provas com escopos separados.

Use o [guia de aceite dos três primeiros packs](sf-packs-acceptance.md) para reproduzir a prova integrada e preparar o QA corporativo.

## Gerar

```sh
bun script/sucafina/create-pack.mjs vendor-review
```

O comando cria `modules/sucafina/Sucafinav1/product/ai/packs/vendor-review/` e recusa um diretório existente. Use um slug de até 24 caracteres com letras minúsculas, números e hífens.

| Arquivo | Responsabilidade |
| --- | --- |
| `skills/sf-read-vendor-review/SKILL.md` | Ensina quando chamar a ferramenta e como interpretar a resposta do SF. |
| `mcp/index.mjs` | Declara `sf_read_vendor_review`, valida a referência e projeta os campos públicos de uma leitura autorizada. |
| `gateway/` | Registra `sf-vendor-review__sf_read_vendor_review` e encaminha a leitura ao servidor configurado para o perfil. |
| `openclaw-mcp.example.json` | Entrada de exemplo para `mcp.servers.sf-vendor-review`, com um host inválido e uma referência à credencial do perfil. |
| `proof.mjs` | Define dois registros sintéticos, seus escopos e a resposta esperada de cada leitura própria. |

## Adaptar ao domínio

1. Ajuste o gatilho da skill, a descrição da ferramenta, os campos públicos e as expectativas da prova. Se mudar a entrada, mantenha o schema e a validação em sincronia no Gateway e no MCP.
2. Monte a rota MCP no host da área. Depois de validar o bearer, vincule `readVisible` à sessão Microsoft original, ao Team e ao grant da operação. A leitura deve filtrar pelo escopo e revalidar a identidade antes de devolver o resultado. O exemplo de Compras mostra como compor isso. [Host MCP de Compras](../../apps/cli/src/sucafina-product/team-purchase-mcp.ts)
3. Configure o plugin no Gateway privado e habilite a ferramenta somente nos perfis selecionados. Use o token do Gateway para a chamada de operador e mantenha o bearer do SF no processo do perfil. [Configuração de referência](sucafina-purchase-gateway.md)
4. Quando o fluxo tiver uma decisão humana, acrescente à prova do host o comando nativo e uma nova leitura que confira a decisão, a versão e o histórico gravados. [Prova instalada de Compras](../../modules/sucafina/Sucafinav1/test/microsoft-installation.test.ts)

## Reproduzir a prova sintética

```sh
bun run test:ci script test/sf-pack-template.node-smoke.mjs --runner node --os linux
```

O teste gera `vendor-review` em diretório temporário, executa o plugin em OpenClaw e chama a ferramenta MCP pelo `/tools/invoke`. Os dois perfis recebem o próprio registro. Os dois cruzamentos recebem apenas `{"status":"denied"}` como erro MCP, mesmo com HTTP 200. O teste também verifica credencial de operador inválida, filtro de exclusão e desativação do MCP sem chamadas posteriores ao servidor.

Para rodar a prova de um pack novo, adicione um arquivo `packages/script/test/sf-<slug>.node-smoke.mjs` como este e execute `test:ci script` selecionando esse arquivo com `--runner node --os linux`.

```js
import { gatewayProof } from "../../../modules/sucafina/Sucafinav1/product/ai/packs/vendor-review/proof.mjs"
import { runSfGatewayProof } from "./sf-purchase-invoke.node-smoke.mjs"

await runSfGatewayProof(gatewayProof)
```

A prova do template usa o servidor MCP gerado e uma leitura com escopo sintético. Para provar o pareamento e o armazenamento de um pack instalado, use também uma fixture do host, como a de Compras. [Prova de Compras pelo Gateway e pelo host](sucafina-purchase-gateway.md#reproduzir-o-cenário-sintético)
