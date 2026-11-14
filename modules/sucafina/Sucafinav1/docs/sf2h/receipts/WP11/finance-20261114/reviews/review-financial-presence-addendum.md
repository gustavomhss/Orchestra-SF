# Adendo independente de presença — R1 / W13

## Resultado delimitado

**R1 está corrigido estaticamente nos três blobs capturados do W13.** O componente ausente de um mês não endereçado volta a permanecer `null/absent`, com sua condição de ausência. O forecast explicitamente editado continua quantificado pela projeção canônica pós-comando. Não identifiquei um novo bloqueio no delta examinado. **A execução dos testes deste W13 continua pendente**; esta conclusão não é PASS de CI nem aceite integrado.

O relatório anterior `review-financial-addendum.md/json` permanece intacto: R1 continua corretamente registrado como aberto no pin W10 que aquele relatório examinou.

## Pin e integridade

- Produto informado pelo root: **W13 `7a67364aeb5c478be54e533910c4b4c91bbd1ebe`**, tree `fdc061f1ab7bbb0b28f591550af391e500dc7c8b`.
- Captura congelada: `/workspace/scratch/a97ca4c53050/finance-W13-changes.json`.
- SHA256 da captura: `ab4e62997816a7833360c70f0146b6f9ff643b69fbf883360048418ebba07771`.
- Recalculei os três Git blobs a partir de `content`: **3/3 correspondem a `sha`**. O vínculo commit/tree foi fornecido pelo root; esta revisão não reconsultou o remoto nem validou a árvore inteira.

| Arquivo sob modules/sucafina/Sucafinav1 | Git blob conferido |
| --- | --- |
| product/planner/scenario-port.ts | `fc15d2d9130e23d0a290f5a14f61423152d2c72c` |
| test/product/wp03/scenario-engine-fixture.ts | `fd6a6b8b75152e858961360d16f7432233700b2f` |
| test/product/wp03/scenario-qualification.test.ts | `8ba0ad3e8e4ce04df044dbe77df8e745008f5191` |

## Traço estático da correção

Em `product/planner/scenario-port.ts:88–95`, `changed` contém os IDs endereçados. `absentBefore` contém os componentes que a projeção original qualificava como `amount:null/evidenceState:absent`. O novo guard conserva ausência se o pós-comando ainda é null **ou** se o componente era ausente e não está em `changed`. A iteração continua sobre os componentes pós-comando, preservando contribuições legitimamente introduzidas e sem retornar ao guard W3 que bloqueava qualquer alvo antes ausente.

Isso discrimina diretamente o contraexemplo W10:

| Caso | Qualificação W13 derivada do código |
| --- | --- |
| Somente `replace`/`include missing:11=1000`, horizonte novembro–dezembro | Novembro `1000/hypothetical`; dezembro `null/absent`, apesar do zero estimado incidental produzido pelo save. |
| Também informar explicitamente `missing:12=0` | Dezembro está em `changed`: `0/hypothetical`, não ausente. |
| `defer missing:10` para novembro | Outubro e novembro estão em `changed`: `0/hypothetical` e `1000/hypothetical`; dezembro não endereçado permanece `null/absent`. |
| Pós-comando ainda não quantificável, incluindo FX ausente | O primeiro termo do guard conserva null mesmo se o componente foi endereçado. |

Replace/include/exclude continuam limitados ao próprio alvo; defer inclui origem e destino. Não há autorização implícita para os outros meses da linha.

Em `scenario-port.ts:123–128`, somente missing de células endereçadas são retirados da lista anterior para serem rederivados. O recorte `entry.field.slice(0, entry.field.lastIndexOf(":"))` remove o nome da medida, preservando o ID completo: `missing:12:budget` vira `missing:12`; `HR:Finance:11:budget` vira `HR:Finance:11`. Assim, a condição de dezembro sobrevive quando dezembro não foi endereçado. Todos os novos missing pós-comando continuam sendo acrescentados. No HR editado, o missing do budget rate que ainda existe volta pela projeção canônica; resolver forecast não resolve o rate independente.

O patch não altera execução do engine, fonte original, request, revalidações ou cálculo financeiro. `scenario-port.ts:106` continua usando `plannerKnownSubtotal`; os valores conhecidos continuam vindo de `input.qualify` sobre a projeção canônica. O ramo com operações continua `total:null`, `comparisonStatus:conditioned` e `preview-not-applied` (`:129`). A correção é de presença e disclosure, sem fórmula financeira paralela.

## Testes discriminantes presentes

`test/product/wp03/scenario-engine-fixture.ts:11,20` agora recebe horizonte opcional, clonado na assessment; o padrão continua novembro. A fixture mantém domínio real, SQLite, issuer de fonte e admissão existentes; classificação de cobertura permanece explicitamente pending.

`scenario-qualification.test.ts:60–102` cobre replace e include, cada um sem/com zero explícito em dezembro. O teste executa diretamente o comando real numa cópia para demonstrar o zero estimado incidental, depois exige do simulador dezembro ausente quando intocado e hipotético quando explicitamente informado. Verifica subtotal 3000, `total:null`, condições corretas, outra linha intocada, repetição, request e snapshot original.

`scenario-qualification.test.ts:104–132` cobre defer outubro→novembro com terceiro mês ausente. Exige exatamente os três componentes `0/hypothetical`, `1000/hypothetical`, `null/absent`, subtotal 1000, condição de dezembro e imutabilidade/repetição. Os testes anteriores de ausência, zero, FX, HR e revogação continuam no arquivo, sem alteração no delta.

Esses testes discriminam a regressão apontada: o W10 falharia nas expectativas de dezembro. Sua presença não demonstra aprovação no W13; nenhum deles foi executado pelo revisor.

## Achados e limites

- **R1 / alta no W10:** correção estática suficiente no delta W13; confirmação executada pendente.
- **Novos bloqueios no delta de três arquivos:** nenhum identificado após conferir o traço e as novas expectativas.
- **Gate restante:** executar as regressões no pin publicado via Actions e revisar o resultado, incluindo os casos FX/HR já existentes. Não inferir aprovação a partir do Test4/W7.

Test4 `43581792536` pertence à evidência anterior: 15 pass / 4 fail por timeout. Seus quatro casos antigos de qualificação passaram, mas não continham estas regressões de meses adjacentes. A investigação de desempenho é conduzida pelo owner; não ampliei escopo nem propus aumentar timeouts.

Escopo: somente os três conteúdos congelados, seu diff contra W10 e os caminhos canônicos já lidos na revisão anterior. Nenhum outro working dirty foi lido, nenhuma fonte foi editada e nenhum produto, teste, build ou CI foi executado/despachado. Os relatórios W10 e demais achados G1/G2/WP13 não foram reabertos ou reclassificados. Não há declaração global de READY, DONE ou C/D.
