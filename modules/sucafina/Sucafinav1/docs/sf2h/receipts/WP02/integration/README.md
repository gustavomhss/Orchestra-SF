# WP02 → WP10: proposta consolidada de integração

**Estado: proposta não aplicada ao branch do owner e sem teste integrado.** Os três patches anteriores foram consolidados contra `sf2-host-ready` em `dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f`. Os quatro arquivos-base foram obtidos pelo GitHub MCP e conferidos pelo hash Git do blob.

## Artefatos

- `wp10-integration-combined.patch` — delta único; substitui a aplicação separada de agenda, C06/C12 e feedback de preview.
- `wp10-integration-combined.json` — pin do produtor, hashes SHA-256 dos inputs, base, proposta e reconstrução, além dos pré-requisitos WP02.
- SHA-256 do patch: `ada59ee693cc5b098f4348e7b1135df81810e968706ff8e9e61441007c87be6f`.

## Delta preservado

| Arquivo WP10 | Proposta |
| --- | --- |
| `apps/cli/src/sucafina-product/business-services.ts` | Instancia agenda e observers C06; expõe o record host e `bindDashboardPreparedReview(verifyPreparedBinding)`. O callback privado continua obrigatório. Um único retorno contém todos os producers, sem duplicar `dashboardRecords`. |
| `modules/sucafina/Sucafinav1/product/integration/source-inventory.ts` | Acrescenta as identidades canônicas `itperf-item` da agenda de performance. |
| `modules/sucafina/Sucafinav1/product/integration/source-projections.ts` | Resolve os itens de performance pela projeção autorizada da página e pelos campos selecionados. |
| `modules/sucafina/Sucafinav1/product/integration/dashboard-preview.ts` | Propaga erros por campo e detalhes de conflito do producer WP02. |

## Verificação realizada

`git apply --check --whitespace=error-all` terminou com código 0 sobre cópias temporárias exatas dos quatro arquivos no pin. A reconstrução em uma segunda cópia temporária produziu os mesmos bytes da proposta em 4/4 arquivos. Cada patch de origem também passou individualmente no pin; suas adições foram preservadas, com união explícita do retorno de `business-services.ts`.

Essa é uma verificação de aplicação textual e integridade. Não houve execução local de testes/typecheck, aplicação em fontes produtoras do repo, publicação em branch WP10 ou prova de consumidor nativo.

## Pré-requisitos e trabalho do consumidor

O owner precisa consumir os producers WP02 (`agenda`, `confirmation-issuer`, `confirmation`, `prepared-review` e o contrato de feedback de `commands`) antes de compilar a proposta. O manifesto registra os hashes das versões presentes no workspace; esses hashes não substituem o SHA do commit WP02 que o owner escolher integrar.

Ainda faltam a persistência protegida de C06/histórico, a composição WP11 de draft/Case/Choice/PreparedChange e concessão humana, aplicação e receipt C12 com reenvio, o consumidor real ReviewHost.select de WP07 e o consumo de rotina WP09 e o caminho de feedback da UI. O verifier C12 deve comparar o comando completo com o prepared change protegido sob o lock; comparar somente `commandDigest` é insuficiente. `dashboard-page` histórico continua recusado até existir prova de captura/dependências e ACL dos registros componentes.

Após compor esses owners, executar typecheck e CI cirúrgico integrado UI/native/MCP. O sucesso da aplicação textual não altera as obrigações ainda pendentes.

Os patches individuais nesta pasta ficam como proveniência. Para a integração, usar apenas o patch consolidado acima.
