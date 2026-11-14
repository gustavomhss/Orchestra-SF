> **Validação final pelo integrador:** produto `dae18b4f43f0daecf46264e876810025684a919d`; Bun 257 pass, Playwright 10 pass, zero falhas/skips/retries, geração oficial e typecheck aprovados. Recibos e escopo em [ci-evidence.json](ci-evidence.json). O texto histórico abaixo conserva a atribuição e o estado da revisão em sua data; estes resultados hospedados não são atribuídos a execução pelo revisor. Permanecem 10 limites nativos e 4 observações humanas.

# WP04 — limites de prova e próxima execução

Este documento separa o comportamento de produção entregue das provas que exigem outro ambiente ou observação humana. A matriz final deve atribuir cada resultado ao commit e ao run efetivamente observados. Nenhuma fixture, screenshot, mensagem de provider, catálogo ou envelope construído por teste constitui um recibo nativo.

## Dez critérios que exigem execução nativa

| Critérios | Capacidade e prova ainda necessária |
| --- | --- |
| `WP04.DOD.10` | Completar as provas residentes atribuídas a WP04, com produção e consumo reais. |
| `WP04.T01.CHK.18`, `WP04.T01.DOD.18`, `WP04.T01.SUC.18` | `sf_request_read` consumida pela ponte nativa de `WP10.T06`, comparada à UI e ao MCP com a mesma autoridade, base e versão. |
| `WP04.T03.CHK.18`, `WP04.T03.DOD.18`, `WP04.T03.SUC.18` | `sf_sourcing_compare` pela mesma composição nativa, preservando os componentes, valores, snapshots e provenance. |
| `WP04.T05.CHK.18`, `WP04.T05.DOD.18`, `WP04.T05.SUC.18` | `sf_supplier_read` e `sf_contract_read` pela composição nativa, preservando autorização e restrição bancária. |

O ambiente deste trabalho disponibiliza GitHub MCP e execução hospedada de testes. Não disponibiliza a Session residente de Orchestra, um `SkillLoadReceipt` emitido pelo runtime real ou uma montagem MCP empresarial autorizada para demonstrar esses critérios. A descoberta das ferramentas não encontrou interfaces Orchestra/SessionV2/SkillLoadReceipt. Não se criou identidade, credencial, provider ou acesso empresarial para preencher essa ausência.

**Próxima ação de S0/WP10:** compor este produto no ambiente nativo já autorizado, executar as quatro operações acima sob a mesma seleção e registrar instalação, projeto, principal, sessão, agente por id estável, versão do provider/política, skill e `SkillLoadReceipt`, export/handler, input digest, referências de fonte, versão e digest do resultado. Comparar os resultados UI/native/MCP; demonstrar chamada direta sem concessão, stale, indisponibilidade, revogação e ausência de ampliação de acesso. A saída deve vir do dispatcher e dos handlers de produção desta PR, com correlação ao commit composto. Guardar os recibos reais e reavaliar somente os critérios correspondentes.

Os testes de dispatcher, autoridade, schema, replay, host e revogação podem demonstrar os contratos e negativos nos limites executados. Os dois casos Playwright isolados do controller demonstram o controle de requisições concorrentes e de respostas obsoletas. Nenhum deles demonstra que um residente real executou uma skill. O host dos oito casos de Procurement usa SQLite, HTTP, autenticação e C02 reais, porém seus callbacks nativos deliberadamente não concedem execução; esses casos não são usados como evidência nativa.

## Quatro critérios que exigem observação de uma pessoa

| Critério | Medição necessária |
| --- | --- |
| `WP04.SUC.01` | Um aprovador identifica etapa, valor, diferença relevante, razão da escolha e próximo passo em até 30 segundos, sem abrir Settings. |
| `WP04.T03.SUC.01` | O leitor explica a liderança de A e seu custo adicional no cenário sintético usando apenas a comparação e sua decomposição. |
| `WP04.T04.CHK.01` | Nas três variantes PR/sourcing/PO, medir compreensão em até 30 segundos e registrar também respostas incorretas. |
| `WP04.T04.SUC.01` | O aprovador conclui o roteiro de compreensão sem Settings nem reconstrução manual da comparação. |

**Próxima ação de S0/revisor humano:** usar os mesmos registros e versões da composição autorizada. Para cada variante, registrar papel e identificador não sensível do participante, versão do produto, referência do registro, início/fim, perguntas e respostas literais, respostas incorretas, ajuda recebida e eventual abertura de Settings. Não contar a velocidade de uma automação como tempo humano. O caso A/B/C deve distinguir ranking e prêmio monetário, exclusão por não conformidade e notas fornecidas por pessoas. Corrigir a UI se a observação demonstrar um problema e repetir somente o roteiro afetado.

Os testes de teclado, foco, conflitos, dados apresentados e navegação constituem evidência automática desses comportamentos. As observações anexadas pelo teste de browser registram `humanTimingMeasured: false` para impedir a promoção indevida desses quatro critérios.

## Limites da qualificação

A PR permanece **DRAFT/BLOCKED para aceitação integral** enquanto esses 14 critérios não tiverem seus recibos específicos. Os critérios satisfeitos são qualificados somente no escopo cirúrgico indicado por suas provas; não se declara `GNATIVE`, `READY_FOR_REVIEW` integral nem `GLOBAL_RELEASE`.

As campanhas globais C/G7, D/G8, AM01–AM06 e as oito seleções finais continuam sob o integrador. Não foram substituídas por um teste de WP. Não houve merge em `dev`, merge da PR, deploy, execução epic/full-suite, alteração de alçadas, identidade empresarial nova ou autorização de acesso SAP/Fabric.

Uma mudança posterior de produto, testes, fixtures, config ou contratos deve revalidar a seleção afetada. Um commit posterior contendo exclusivamente recibos pode reutilizar a execução anterior somente com prova mecânica da identidade de todos os demais blobs; a identificação do commit de produto e do snapshot CI permanece separada.
