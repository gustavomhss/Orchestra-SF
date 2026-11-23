# Auditoria adversarial Sucafina — suplemento de produto

Base de código: [dev `5b48dab52621037168ad4e3a6243c79a4fe5ad6e`](https://github.com/gustavomhss/Orchestra-SF/commit/5b48dab52621037168ad4e3a6243c79a4fe5ad6e). Leitura somente; nenhum código de produto modificado. Este documento complementa [product-audit-findings.md](sandbox:artifact-extract/product-audit-findings.md) e [product-audit-final.json](sandbox:artifact-extract/product-audit-final.json).

## Resultado

Foram inspecionados individualmente **103 arquivos adicionais, com 102 hashes de imagem distintos**, cobrindo CAP01, CAP05 e CAP11–16. Com o primeiro lote, são **206 arquivos vistos, 202 imagens distintas e 16 famílias de negócio (CAP01–16)**. Esses números não representam 206 estados funcionais: há variações de tema, idioma, viewport, posição de rolagem e oito arquivos test-finished nos dois lotes.

O suplemento acrescenta **B12/P2** (confirmação de pesos sem contexto) e **B13/P3** (revisões repetitivas), além de ampliar **B6/P2** para contratos. O conjunto do auditor de produto fica com **13 achados únicos: 10 P2 e 3 P3**. Os relatórios de root e dos outros auditores devem ser consolidados por causa/owner, não somados cegamente.

As capturas continuam sendo evidência histórica dos SHAs abaixo. A fonte atual foi conferida para sustentar os problemas semânticos; não houve nova execução visual na dev. Mudanças posteriores em detalhe e tabela impedem declarar equivalência de cada pixel ou target de interação.

## Cobertura e origem

| Lote | Arquivos vistos | Imagens distintas | Fonte | Run | Seleção |
|---|---:|---:|---|---|---|
| native-dashboard | 8 | 8 | [e315777d9ae9](https://github.com/gustavomhss/Orchestra-SF/commit/e315777d9ae9631321c254455aef3961cb651d94) | [45086595355](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45086595355) | CAP01 somente |
| operations-earlier | 23 | 23 | [744d24f26086](https://github.com/gustavomhss/Orchestra-SF/commit/744d24f26086481aa567a999b919dbe220a13306) | [45086824985](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45086824985) | CAP11/12 EN somente; demais famílias superseded |
| business-operations | 49 | 49 | [45c47f11b6d2](https://github.com/gustavomhss/Orchestra-SF/commit/45c47f11b6d2c9fd518af7e24b46dc7ee481913e) | [45090642771](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45090642771) | CAP13/15/16 + PT11/12 |
| finance-final | 23 | 22 | [10a7aaa7b69b](https://github.com/gustavomhss/Orchestra-SF/commit/10a7aaa7b69b6f80d8dfbac454007e7742f89bc2) | [45101169602](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45101169602) | CAP05/14 + dois test-finished; CAP17–19 em outro auditor |

| Família | Capturas nomeadas adicionais |
|---|---:|
| CAP01 | 8 |
| CAP05 | 11 |
| CAP11 | 16 |
| CAP12 | 16 |
| CAP13 | 13 |
| CAP14 | 10 |
| CAP15 | 11 |
| CAP16 | 16 |

Há mais dois arquivos test-finished no finance-final. O de índice 102 tem pixels idênticos ao índice 100, CAP14 PT. No primeiro lote, 103 arquivos correspondiam a 100 hashes distintos. O inventário completo lido contém 70 superfícies e 165 padrões de rota; a cobertura visual própria aqui é CAP01–16, não todas as 165 rotas ou todos os estados.

### Como a evidência histórica foi delimitada

- CAP01: somente o lote native-dashboard. CAP11/12 em inglês: somente operations-earlier; as outras famílias desse run foram substituídas pelo lote posterior.
- CAP13/15/16 e CAP11/12 PT: business-operations. CAP05/14: finance-final. CAP17–19 desse run pertencem à auditoria de comportamento.
- Os arquivos específicos dos achados B12/B13 e da ampliação de B6 permanecem na dev verificada. O diff dos SHAs inclui, entretanto, shared/detail (botão Back, linha título/ações, quebra flex) e shared/table (target 44 px do sort e padding do cabeçalho).
- Portanto, defeitos de conteúdo, contexto e hierarquia sustentados pelo código podem ser atribuídos à dev. Um alinhamento antigo ou altura de botão antiga não pode ser atribuído à dev apenas por essa captura.
- Nenhuma captura substitui inspeção de teclado, leitor de tela, movimento, race de rede ou controle pendente. As únicas operações locais foram leitura, visualização de PNG e verificação determinística de arquivos.

## Achados novos e ampliação

### B12 — P2: CAP16: confirmação de excesso de pesos aparece sem uma exceção identificada

**Classificação:** Problema de decisão e confirmação. **Confiança:** Alta para a apresentação incondicional: captura original + fonte dev; impacto de uma escolha indevida não executado. **Superfícies:** CAP16.

**Observado:** A revisão de subitem mostra no topo a caixa 'Confirm weights exceeding total allocation' antes do título da revisão. A captura informa apenas um campo alterado. A caixa não identifica peso, limite, excesso ou regra que exige a exceção. É apresentada em toda revisão de contrato/item/subitem.

**Causa:** O ramo review-edit renderiza a caixa sem condição; o estado confirmedWeights é enviado como confirmed nos comandos nativos. A UI não apresenta uma justificativa específica de excesso junto à decisão. Avisos do produtor entram no estado apenas na resposta de sucesso; a revisão não os usa para decidir quando mostrar a caixa.

**Reprodução:** Abrir um subitem autorizado, alterar somente uma nota e ir para Review changes. Examinar o topo da revisão e o contexto da caixa de confirmação. Repetir com edição do nome do contrato, cujo formulário tem apenas nome e ano.

**Efeito para o usuário:** A interface pede consentimento para uma exceção sem explicar sua necessidade. Isso pode induzir marcação por hábito e torna uma revisão normal ambígua. Não foi demonstrada alteração matemática errada, bypass de autorização ou dano no produtor.

**Correção proposta:** Vincular a confirmação a uma condição real, reconhecida pelo produtor, e explicar a regra e os valores que a justificam. Apresentar ao lado os dados de peso/limite realmente fornecidos. Uma revisão comum não deve parecer conter erro de alocação. Preservar o significado e as validações do campo confirmed; não criar cálculo financeiro ou validação de domínio paralela para inventar um excesso.

**Critérios de aceitação:**

- Editar apenas texto, com alocação válida, oferece revisão clara sem sugerir uma exceção inexistente.
- Quando o produtor exige consentimento, a revisão identifica o escopo e o motivo real; o usuário consegue revisar os pesos antes de autorizar.
- Cancelar/revisar/retomar não reaproveita um consentimento de outro contexto ou alteração.
- O comando conserva versão, idempotência, validação e permissões originais; não basta mudar a etiqueta ou marcar a caixa automaticamente.

**Fonte dev:**

- [packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx:795–829](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx#L795-L829)
- [packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx:448–489](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx#L448-L489)
- [packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx:74–110](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx#L74-L110)

**Capturas inspecionadas:**

- [48: CAP16-subitem-review-top-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-subitem-review-top-dark-desktop-test-data.png)
- [47: CAP16-subitem-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-subitem-review-dark-desktop-test-data.png)
- [78: CAP16-review-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP16-review-pt-BR-dark-390-test-data.png)

**Sobreposição:** Nenhuma das correções atribuídas a #613/#713/#716 cobre CAP16; não foi aberto ticket nem feita mudança.

**Limites:** Capture source 45c47f11; módulo operations/performance/index.tsx não consta nas mudanças até a dev pinada. Shared/detail e shared/table mudaram depois; este achado é sobre a decisão e o conteúdo, não equivalência de pixels.

### B13 — P3: Revisões operacionais repetem o payload inteiro em Effects depois do antes/depois

**Classificação:** Refinamento de densidade e hierarquia. **Confiança:** Alta para a repetição: capturas originais + fonte dev; gravidade é julgamento de UX. **Superfícies:** CAP11, CAP12, CAP13, CAP14, CAP15, CAP16.

**Observado:** Depois da comparação Original / Current source / Proposed values, a seção Effects lista outra vez todos os campos da proposta. CAP16 define22 campos de subitem; a captura tem um campo alterado e ainda assim apresenta o conjunto inteiro. Em390 px, o bloco final repete valores longos e entradas vazias antes das ações. CAP14 também repete os15 campos.

**Causa:** Os callers passam os mesmos fields/reviewFields/proposedFields para proposed e effects.details. SfEffectList renderiza todos os detalhes, aberto, como lista; SfChangeReview põe essa seção após todas as linhas da comparação.

**Reprodução:** Editar apenas uma observação de um registro operacional ou contrato; abrir a revisão; percorrer a comparação e depois Effects até os botões. Comparar o conteúdo repetido ao bloco de valores propostos.

**Efeito para o usuário:** O espaço de decisão fica dominado por cópias do payload, não pelo que mudou ou pelo efeito. Em telas estreitas, o usuário atravessa uma revisão extensa para uma alteração pequena; isso aumenta esforço e dificulta localizar a diferença relevante. Não é prova de erro funcional ou inacessibilidade.

**Correção proposta:** Manter uma comparação completa e verificável, destacando primeiro as mudanças. Reservar Effects para consequências de domínio efetivamente conhecidas e apresentar o payload completo como detalhe acessível quando necessário. Evitar a cópia aberta de todos os campos e representar vazio/ausência com texto honesto, conservando a distinção entre eles.

**Critérios de aceitação:**

- Uma alteração de um campo é identificável no primeiro bloco da revisão, com acesso por teclado ao contexto completo.
- A proposta continua inspecionável com suas fontes, versões, ausências e mudanças remotas; não remover o contrato de revisão para encurtar a página.
- Effects acrescenta significado ou funciona como detalhe recolhível claramente rotulado, sem repetir uma longa lista aberta por padrão.
- Em320/390 px, o usuário encontra confirmação/cancelamento sem ter de percorrer uma segunda cópia do mesmo formulário.

**Fonte dev:**

- [packages/app-shell/src/orchestra/chapters/sucafina/operations/service/index.tsx:911–920](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/operations/service/index.tsx#L911-L920)
- [packages/app-shell/src/orchestra/chapters/sucafina/operations/security/index.tsx:1058–1065](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/operations/security/index.tsx#L1058-L1065)
- [packages/app-shell/src/orchestra/chapters/sucafina/operations/risks/collection.tsx:598–607](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/operations/risks/collection.tsx#L598-L607)
- [packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx:808–823](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx#L808-L823)
- [packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/index.tsx:450–459](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/index.tsx#L450-L459)
- [packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx:121–140](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx#L121-L140)
- [packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx:266–309](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx#L266-L309)

**Capturas inspecionadas:**

- [23: CAP11-import-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-import-review-dark-desktop-test-data.png)
- [29: CAP11-sla-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-sla-review-dark-desktop-test-data.png)
- [37: CAP13-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-025ef-g-and-a-real-reviewed-write-chromium/CAP13-review-dark-desktop-test-data.png)
- [47: CAP16-subitem-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-subitem-review-dark-desktop-test-data.png)
- [48: CAP16-subitem-review-top-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-subitem-review-top-dark-desktop-test-data.png)
- [53: CAP15-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d2a07-s-and-a-real-reviewed-write-chromium/CAP15-review-dark-desktop-test-data.png)
- [63: CAP12-review-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP12-review-pt-BR-dark-390-test-data.png)
- [68: CAP13-review-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP13-review-pt-BR-dark-390-test-data.png)
- [73: CAP15-review-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP15-review-pt-BR-dark-390-test-data.png)
- [78: CAP16-review-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP16-review-pt-BR-dark-390-test-data.png)
- [91: CAP14-dark-320-review-actions-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-320-review-actions-test-data.png)
- [94: CAP14-dark-desktop-create-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-desktop-create-review-test-data.png)
- [95: CAP14-dark-desktop-delete-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-desktop-delete-review-test-data.png)

**Sobreposição:** Componente transversal de revisão; coordenar com owners dos módulos e evitar refazer #613/#713. Não foi feita mudança.

**Limites:** As capturas são históricas dos SHAs listados; callers relevantes e renderer de revisão permanecem na dev analisada. Não se afirma altura exata da página atual.

### B6-S1 — P2: CAP14 amplia B6: moeda opcional recebida só aparece no editor, e sua ausência não é comunicada

**Classificação:** Extensão do contexto financeiro. **Confiança:** Alta: captura original de Amount sem unidade + fonte dev. **Superfícies:** CAP14.

**Observado:** O detalhe de contrato mostra Amount 144,000 / Amount type Annual; as revisões mostram montantes 36,000 ou 144,000 sem moeda. Não há mensagem de moeda desconhecida. A existência de currency em uma linha real não foi fotografada; sua omissão do detalhe/revisão é comprovada pelo código.

**Causa:** A projeção SfDomainContract admite currency opcional. EDIT_SECTIONS não inclui currency; detalhe e editFields usam esse conjunto. A única apresentação de currency é um hint no formulário, condicionado a selectedRow().currency !== undefined. Assim, o detalhe e a revisão não exibem a moeda nem declaram sua ausência.

**Reprodução:** Abrir Vendor contracts > contrato com valor > detalhe > edição > revisão. Verificar o mesmo contexto de unidade nesses estados. Em cenário controlado adicional, fornecer currency na projeção autorizada para verificar que detalhe/revisão também a mostram após a correção.

**Efeito para o usuário:** O valor comercial fica sem a unidade necessária para interpretá-lo. Um contrato com moeda disponível perde essa informação no detalhe/revisão; um contrato sem moeda parece completo. Não se alega que o montante esteja corrompido.

**Correção proposta:** Mostrar a moeda original, em modo de leitura, junto ao valor e em toda a revisão; se ausente, informar explicitamente a limitação. Não transformar currency em campo gravável, pois o comando não o admite, nem deduzir moeda de idioma, localização ou fornecedor.

**Critérios de aceitação:**

- Com currency real, detalhe/edição/revisão comunicam a mesma unidade.
- Sem currency, os mesmos estados explicitam ausência, mantendo vazio/null/zero e precisão do montante.
- Nenhuma moeda padrão é inventada e o payload nativo mantém seus campos autorizados.

**Fonte dev:**

- [packages/schema/src/sucafina/domain/fields.ts:148–160](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/schema/src/sucafina/domain/fields.ts#L148-L160)
- [packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/index.tsx:37–63](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/index.tsx#L37-L63)
- [packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/index.tsx:549–561](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/index.tsx#L549-L561)
- [packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/index.tsx:574–585](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/index.tsx#L574-L585)
- [packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/model.ts:65–75](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/model.ts#L65-L75)

**Capturas inspecionadas:**

- [93: CAP14-dark-desktop-contract-detail-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-desktop-contract-detail-test-data.png)
- [94: CAP14-dark-desktop-create-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-desktop-create-review-test-data.png)
- [95: CAP14-dark-desktop-delete-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-desktop-delete-review-test-data.png)
- [91: CAP14-dark-320-review-actions-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-320-review-actions-test-data.png)

**Sobreposição:** Agrupar com B6, não contar como segundo defeito independente; sem cobertura atribuída a #613/#713/#716.

**Limites:** Captura finance-final 10a7aaa7; módulos contracts/index.tsx e model.ts não mudaram até dev. Cenário currency presente é inferência estática, ainda requer captura controlada.

## Observações limitadas e contraevidências

### SO1 — A revisão Annual Entry ÷12 carece de explicação do efeito, mas não é prova de base anual perdida

**Status:** not-promoted.

A captura mostra annual=252,000, field=Budget, Original/Current 'Not available'. O orçamento 240,000 da lista pertence a owner.budget. formFor inicializa annual:'', e draftFields revisa parâmetros do comando annual-entry, não o campo owner.budget. Sem ler o handler original, não se pode equiparar as duas coisas ou afirmar substituição de 12 meses. O spec abre/revisa/cancela esse comando; não valida seu efeito.

**Próximo passo preciso:** Ler a semântica do produtor e capturar uma revisão que torne claro escopo e efeitos reais. Não adicionar cálculo anual paralelo nem preencher o base com owner.budget por suposição.

[packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx:334–345](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx#L334-L345) · [packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx:515–542](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx#L515-L542) · [packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/model.ts:196–200](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/model.ts#L196-L200)

Capturas: [82: CAP05-dark-desktop-annual-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-desktop-annual-review-test-data.png) · [85: CAP05-dark-desktop-list-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-desktop-list-test-data.png) · [87: CAP05-dark-desktop-twelve-months-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-desktop-twelve-months-test-data.png)

### SO2 — Cabeçalhos de detalhe e alvos de tabela antigos não certificam a dev

**Status:** historical-only.

Os compares mostram mudanças posteriores em shared/detail/detail.css e index.tsx: botão Back com 44 px, linha de título/estado/ações reorganizada e quebra flex. shared/table/table.css adiciona min-height 44 px ao sort button e padding ao cabeçalho confortável. Não converter desalinhamentos ou alvos desses screenshots antigos em defeitos atuais sem nova captura.

### SO3 — Separadores numéricos e unidades pedem contrato semântico

**Status:** not-promoted.

Há valores literais 98.4/0.6 em PT e KPI Training 94, mas não foi provado que o tipo de fonte fornece unidade ou formato numérico uniforme. CAP16 explica expressamente que 1 representa 100%. Não corrigir com percentuais inventados nem reinterpretar valores de origem.

### SO4 — A falta de antes/depois não é universal

**Status:** counterevidence.

CAP01 inline review mostra 128→129. CAP05 revisão mensal mostra 19,100→19,500 e desvio mostra texto original/proposto. Esses exemplos impedem generalizar B1 para toda revisão financeira.

Capturas: [1: CAP01-dark-desktop-inline-review-test-data.png](sandbox:artifact-extract/additional/native-dashboard/packages/app-shell/e2e/test-results/sucafina-design-wave-one-i-1695b-ce-data-review-and-captures-chromium/CAP01-dark-desktop-inline-review-test-data.png) · [80: CAP05-dark-320-month-review-actions-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-320-month-review-actions-test-data.png) · [84: CAP05-dark-desktop-deviation-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-desktop-deviation-review-test-data.png)

### SO5 — Responsible person e Owner não devem ser fundidos por conveniência

**Status:** not-defect.

O campo da lista Responsible person aparece Unavailable, enquanto detalhe traz Owner conhecido. Os campos da fonte são distintos; não substituir ausência por outro campo nem tratar isso como falha de localização.

Capturas: [31: CAP13-delete-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-025ef-g-and-a-real-reviewed-write-chromium/CAP13-delete-review-dark-desktop-test-data.png) · [32: CAP13-detail-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-025ef-g-and-a-real-reviewed-write-chromium/CAP13-detail-dark-desktop-test-data.png) · [35: CAP13-operations-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-025ef-g-and-a-real-reviewed-write-chromium/CAP13-operations-dark-desktop-test-data.png) · [64: CAP13-detail-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP13-detail-pt-BR-dark-390-test-data.png) · [65: CAP13-operations-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP13-operations-pt-BR-dark-390-test-data.png) · [67: CAP13-operations-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP13-operations-pt-BR-dark-desktop-test-data.png)

### SO6 — Estados capturados não provam ausência de flakiness

**Status:** evidence-limit.

Não houve execução local nem medição de interação ao vivo. Screenshots não demonstram teclado, leitor de tela, hover, animação, race de rede, cancelamento pendente ou todas as alturas/idiomas. Passing test e screenshot bem composto não são um selo de UX impecável.

## Manifesto visual: todos os arquivos efetivamente vistos

Cada linha representa um arquivo original fora dos anexos duplicados de relatório. O JSON complementar contém SHA256 completo, dimensões, run, artifact ID, fonte e status viewed. A inspeção foi realizada nas imagens originais, sem alterar cores, dimensões ou composição. Os índices 63–66 foram reabertos após uma saída truncada; só a segunda visualização foi considerada efetiva.

| Índice | Lote | Captura vista | Dimensões | SHA256 (prefixo) |
|---:|---|---|---|---|
| 0 | native-dashboard | [CAP01-dark-1440x800-test-data.png](sandbox:artifact-extract/additional/native-dashboard/packages/app-shell/e2e/test-results/sucafina-design-wave-one-i-1695b-ce-data-review-and-captures-chromium/CAP01-dark-1440x800-test-data.png) | 1440×800 | `a57c1e451f69502e` |
| 1 | native-dashboard | [CAP01-dark-desktop-inline-review-test-data.png](sandbox:artifact-extract/additional/native-dashboard/packages/app-shell/e2e/test-results/sucafina-design-wave-one-i-1695b-ce-data-review-and-captures-chromium/CAP01-dark-desktop-inline-review-test-data.png) | 1440×1100 | `ee85ed04a86b8f5f` |
| 2 | native-dashboard | [CAP01-dark-desktop-people-test-data.png](sandbox:artifact-extract/additional/native-dashboard/packages/app-shell/e2e/test-results/sucafina-design-wave-one-i-1695b-ce-data-review-and-captures-chromium/CAP01-dark-desktop-people-test-data.png) | 1440×1100 | `dfdbe65d4c439752` |
| 3 | native-dashboard | [CAP01-dark-desktop-signals-test-data.png](sandbox:artifact-extract/additional/native-dashboard/packages/app-shell/e2e/test-results/sucafina-design-wave-one-i-1695b-ce-data-review-and-captures-chromium/CAP01-dark-desktop-signals-test-data.png) | 1440×1100 | `9ec591f2b44de0fb` |
| 4 | native-dashboard | [CAP01-dark-desktop-test-data.png](sandbox:artifact-extract/additional/native-dashboard/packages/app-shell/e2e/test-results/sucafina-design-wave-one-i-1695b-ce-data-review-and-captures-chromium/CAP01-dark-desktop-test-data.png) | 1440×1100 | `7b41df77ca9f2a24` |
| 5 | native-dashboard | [CAP01-light-320-test-data.png](sandbox:artifact-extract/additional/native-dashboard/packages/app-shell/e2e/test-results/sucafina-design-wave-one-i-1695b-ce-data-review-and-captures-chromium/CAP01-light-320-test-data.png) | 320×1100 | `6f8d2d440d05589d` |
| 6 | native-dashboard | [CAP01-light-desktop-test-data.png](sandbox:artifact-extract/additional/native-dashboard/packages/app-shell/e2e/test-results/sucafina-design-wave-one-i-1695b-ce-data-review-and-captures-chromium/CAP01-light-desktop-test-data.png) | 1440×1100 | `7f53734e37d3560b` |
| 7 | native-dashboard | [CAP01-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/additional/native-dashboard/packages/app-shell/e2e/test-results/sucafina-design-wave-one-i-1695b-ce-data-review-and-captures-chromium/CAP01-pt-BR-dark-desktop-test-data.png) | 1440×1100 | `cb93760ced3abc64` |
| 8 | operations-earlier | [CAP12-campaign-departments-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-7dbbc-s-and-a-real-reviewed-write-chromium/CAP12-campaign-departments-dark-desktop-test-data.png) | 1440×1100 | `d4f9a011a0149b34` |
| 9 | operations-earlier | [CAP12-campaign-editor-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-7dbbc-s-and-a-real-reviewed-write-chromium/CAP12-campaign-editor-dark-desktop-test-data.png) | 1440×1100 | `f3e1a08d9b3a314b` |
| 10 | operations-earlier | [CAP12-campaign-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-7dbbc-s-and-a-real-reviewed-write-chromium/CAP12-campaign-review-dark-desktop-test-data.png) | 1440×1100 | `afb4584171e9d548` |
| 11 | operations-earlier | [CAP12-campaign-review-top-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-7dbbc-s-and-a-real-reviewed-write-chromium/CAP12-campaign-review-top-dark-desktop-test-data.png) | 1440×1100 | `fba15fd03a0d98c4` |
| 12 | operations-earlier | [CAP12-department-editor-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-7dbbc-s-and-a-real-reviewed-write-chromium/CAP12-department-editor-dark-desktop-test-data.png) | 1440×1100 | `ba417d98e71646eb` |
| 13 | operations-earlier | [CAP12-incident-delete-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-7dbbc-s-and-a-real-reviewed-write-chromium/CAP12-incident-delete-review-dark-desktop-test-data.png) | 1440×1100 | `f9fc7dc3621d8968` |
| 14 | operations-earlier | [CAP12-incident-delete-review-top-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-7dbbc-s-and-a-real-reviewed-write-chromium/CAP12-incident-delete-review-top-dark-desktop-test-data.png) | 1440×1100 | `8477ac8c094d6a1b` |
| 15 | operations-earlier | [CAP12-operations-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-7dbbc-s-and-a-real-reviewed-write-chromium/CAP12-operations-dark-desktop-test-data.png) | 1440×1100 | `4a874ba54f3392bd` |
| 16 | operations-earlier | [CAP12-incidents-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-7dbbc-s-and-a-real-reviewed-write-chromium/CAP12-incidents-dark-desktop-test-data.png) | 1440×1100 | `5ba1f6694b22a17f` |
| 17 | operations-earlier | [CAP12-operations-light-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-7dbbc-s-and-a-real-reviewed-write-chromium/CAP12-operations-light-desktop-test-data.png) | 1440×1100 | `96057032f9f339cb` |
| 18 | operations-earlier | [CAP12-unscoped-actions-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-7dbbc-s-and-a-real-reviewed-write-chromium/CAP12-unscoped-actions-dark-desktop-test-data.png) | 1440×1100 | `88add6fc56b8ce39` |
| 19 | operations-earlier | [CAP11-application-editor-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-application-editor-dark-desktop-test-data.png) | 1440×1100 | `e76f5b504e765529` |
| 20 | operations-earlier | [CAP11-application-health-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-application-health-dark-desktop-test-data.png) | 1440×1100 | `13f5b943778355cf` |
| 21 | operations-earlier | [CAP11-categories-editor-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-categories-editor-dark-desktop-test-data.png) | 1440×1100 | `c41d11caa6a02870` |
| 22 | operations-earlier | [CAP11-import-editor-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-import-editor-dark-desktop-test-data.png) | 1440×1100 | `3ed02b7e585ca745` |
| 23 | operations-earlier | [CAP11-import-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-import-review-dark-desktop-test-data.png) | 1440×1100 | `f9a3bc2773ef40f3` |
| 24 | operations-earlier | [CAP11-import-review-top-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-import-review-top-dark-desktop-test-data.png) | 1440×1100 | `9d79a2a9ecdc0eb4` |
| 25 | operations-earlier | [CAP11-operations-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-operations-dark-desktop-test-data.png) | 1440×1100 | `2bd3500f503e4f14` |
| 26 | operations-earlier | [CAP11-operations-light-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-operations-light-desktop-test-data.png) | 1440×1100 | `c29403434ff99534` |
| 27 | operations-earlier | [CAP11-settings-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-settings-dark-desktop-test-data.png) | 1440×1100 | `49ea299f32722927` |
| 28 | operations-earlier | [CAP11-sla-editor-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-sla-editor-dark-desktop-test-data.png) | 1440×1100 | `5b4574ec405eb3bf` |
| 29 | operations-earlier | [CAP11-sla-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-sla-review-dark-desktop-test-data.png) | 1440×1100 | `df9ae83dfca77a8a` |
| 30 | operations-earlier | [CAP11-ticket-ledger-dark-desktop-test-data.png](sandbox:artifact-extract/additional/operations-earlier/packages/app-shell/e2e/test-results/sucafina-design-wave-three-b8356-s-and-a-real-reviewed-write-chromium/CAP11-ticket-ledger-dark-desktop-test-data.png) | 1440×1100 | `94d2fd499b6e7209` |
| 31 | business-operations | [CAP13-delete-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-025ef-g-and-a-real-reviewed-write-chromium/CAP13-delete-review-dark-desktop-test-data.png) | 1440×1100 | `148ffe610aec92aa` |
| 32 | business-operations | [CAP13-detail-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-025ef-g-and-a-real-reviewed-write-chromium/CAP13-detail-dark-desktop-test-data.png) | 1440×1100 | `8fb06ca987a1c635` |
| 33 | business-operations | [CAP13-editor-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-025ef-g-and-a-real-reviewed-write-chromium/CAP13-editor-dark-desktop-test-data.png) | 1440×1100 | `5c3f113b9f631967` |
| 34 | business-operations | [CAP13-filtered-empty-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-025ef-g-and-a-real-reviewed-write-chromium/CAP13-filtered-empty-dark-desktop-test-data.png) | 1440×1100 | `1ec70d38d7ca1dd4` |
| 35 | business-operations | [CAP13-operations-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-025ef-g-and-a-real-reviewed-write-chromium/CAP13-operations-dark-desktop-test-data.png) | 1440×1100 | `e7cc78cd67d00ca3` |
| 36 | business-operations | [CAP13-operations-light-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-025ef-g-and-a-real-reviewed-write-chromium/CAP13-operations-light-desktop-test-data.png) | 1440×1100 | `2377eb641c6b6413` |
| 37 | business-operations | [CAP13-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-025ef-g-and-a-real-reviewed-write-chromium/CAP13-review-dark-desktop-test-data.png) | 1440×1100 | `ceb3008ae377668e` |
| 38 | business-operations | [CAP13-review-top-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-025ef-g-and-a-real-reviewed-write-chromium/CAP13-review-top-dark-desktop-test-data.png) | 1440×1100 | `e3daf3b452dc60c1` |
| 39 | business-operations | [CAP16-item-editor-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-item-editor-dark-desktop-test-data.png) | 1440×1100 | `783750ff3db11eda` |
| 40 | business-operations | [CAP16-items-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-items-dark-desktop-test-data.png) | 1440×1100 | `a24eaf561eeed793` |
| 41 | business-operations | [CAP16-operations-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-operations-dark-desktop-test-data.png) | 1440×1100 | `63486ffa5374cefb` |
| 42 | business-operations | [CAP16-operations-light-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-operations-light-desktop-test-data.png) | 1440×1100 | `83615719b2680b82` |
| 43 | business-operations | [CAP16-owner-assignments-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-owner-assignments-dark-desktop-test-data.png) | 1440×1100 | `6e0792688d3a7c86` |
| 44 | business-operations | [CAP16-subitem-detail-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-subitem-detail-dark-desktop-test-data.png) | 1440×1100 | `85ae534f7bf914cd` |
| 45 | business-operations | [CAP16-subitem-editor-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-subitem-editor-dark-desktop-test-data.png) | 1440×1100 | `4264c47498bf54f2` |
| 46 | business-operations | [CAP16-subitem-quarters-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-subitem-quarters-dark-desktop-test-data.png) | 1440×1100 | `6ce8db71ed41d4b7` |
| 47 | business-operations | [CAP16-subitem-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-subitem-review-dark-desktop-test-data.png) | 1440×1100 | `167c326135650705` |
| 48 | business-operations | [CAP16-subitem-review-top-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-36e21-y-and-a-real-reviewed-write-chromium/CAP16-subitem-review-top-dark-desktop-test-data.png) | 1440×1100 | `c6f42ec8ef4647ee` |
| 49 | business-operations | [CAP15-detail-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d2a07-s-and-a-real-reviewed-write-chromium/CAP15-detail-dark-desktop-test-data.png) | 1440×1100 | `432e5324e61722d8` |
| 50 | business-operations | [CAP15-editor-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d2a07-s-and-a-real-reviewed-write-chromium/CAP15-editor-dark-desktop-test-data.png) | 1440×1100 | `b7aa5b37bcae3f76` |
| 51 | business-operations | [CAP15-operations-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d2a07-s-and-a-real-reviewed-write-chromium/CAP15-operations-dark-desktop-test-data.png) | 1440×1100 | `b03e3166d3ca9cf9` |
| 52 | business-operations | [CAP15-operations-light-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d2a07-s-and-a-real-reviewed-write-chromium/CAP15-operations-light-desktop-test-data.png) | 1440×1100 | `976a200b437f5f51` |
| 53 | business-operations | [CAP15-review-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d2a07-s-and-a-real-reviewed-write-chromium/CAP15-review-dark-desktop-test-data.png) | 1440×1100 | `0e5afc6501462a9a` |
| 54 | business-operations | [CAP15-review-top-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d2a07-s-and-a-real-reviewed-write-chromium/CAP15-review-top-dark-desktop-test-data.png) | 1440×1100 | `71367022bf87771e` |
| 55 | business-operations | [CAP11-editor-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP11-editor-pt-BR-dark-390-test-data.png) | 390×900 | `a12817500e38439f` |
| 56 | business-operations | [CAP11-operations-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP11-operations-pt-BR-dark-390-test-data.png) | 390×900 | `8b8e3f2c85f0a912` |
| 57 | business-operations | [CAP11-operations-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP11-operations-pt-BR-dark-desktop-test-data.png) | 1440×1100 | `4a0408bdafb123fb` |
| 58 | business-operations | [CAP11-review-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP11-review-pt-BR-dark-390-test-data.png) | 390×900 | `ec7e417d796fe9e0` |
| 59 | business-operations | [CAP12-departments-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP12-departments-pt-BR-dark-390-test-data.png) | 390×900 | `6eb49bd4eb5e8987` |
| 60 | business-operations | [CAP12-editor-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP12-editor-pt-BR-dark-390-test-data.png) | 390×900 | `644082e4add938a7` |
| 61 | business-operations | [CAP12-operations-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP12-operations-pt-BR-dark-390-test-data.png) | 390×900 | `ef7720879f05d6d1` |
| 62 | business-operations | [CAP12-operations-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP12-operations-pt-BR-dark-desktop-test-data.png) | 1440×1100 | `0e28a0d52347a3be` |
| 63 | business-operations | [CAP12-review-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP12-review-pt-BR-dark-390-test-data.png) | 390×900 | `54ea83d6469c0631` |
| 64 | business-operations | [CAP13-detail-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP13-detail-pt-BR-dark-390-test-data.png) | 390×900 | `c7d117d33d40100d` |
| 65 | business-operations | [CAP13-operations-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP13-operations-pt-BR-dark-390-test-data.png) | 390×900 | `029993fc157ca5cc` |
| 66 | business-operations | [CAP13-editor-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP13-editor-pt-BR-dark-390-test-data.png) | 390×900 | `6955dcaa9244aa27` |
| 67 | business-operations | [CAP13-operations-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP13-operations-pt-BR-dark-desktop-test-data.png) | 1440×1100 | `4fdf171c264773b9` |
| 68 | business-operations | [CAP13-review-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP13-review-pt-BR-dark-390-test-data.png) | 390×900 | `7cc9d090153b5f9b` |
| 69 | business-operations | [CAP15-detail-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP15-detail-pt-BR-dark-390-test-data.png) | 390×900 | `b81206a239f466a3` |
| 70 | business-operations | [CAP15-editor-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP15-editor-pt-BR-dark-390-test-data.png) | 390×900 | `735a87446a5a9c83` |
| 71 | business-operations | [CAP15-operations-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP15-operations-pt-BR-dark-390-test-data.png) | 390×900 | `c7c78ed73c7020d9` |
| 72 | business-operations | [CAP15-operations-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP15-operations-pt-BR-dark-desktop-test-data.png) | 1440×1100 | `5baca989a663a482` |
| 73 | business-operations | [CAP15-review-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP15-review-pt-BR-dark-390-test-data.png) | 390×900 | `b367749e0c4b3010` |
| 74 | business-operations | [CAP16-editor-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP16-editor-pt-BR-dark-390-test-data.png) | 390×900 | `bd866d5b6188993f` |
| 75 | business-operations | [CAP16-operations-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP16-operations-pt-BR-dark-390-test-data.png) | 390×900 | `773be1e612c4e4c1` |
| 76 | business-operations | [CAP16-operations-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP16-operations-pt-BR-dark-desktop-test-data.png) | 1440×1100 | `19493e332369c4ef` |
| 77 | business-operations | [CAP16-quarter-editor-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP16-quarter-editor-pt-BR-dark-390-test-data.png) | 390×900 | `3dd39ad4cb91375a` |
| 78 | business-operations | [CAP16-review-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP16-review-pt-BR-dark-390-test-data.png) | 390×900 | `650f19ab8de401a9` |
| 79 | business-operations | [CAP16-subitem-detail-pt-BR-dark-390-test-data.png](sandbox:artifact-extract/additional/business-operations/packages/app-shell/e2e/test-results/sucafina-design-wave-three-f0ec3-d-390 px-editors-and-reviews-chromium/CAP16-subitem-detail-pt-BR-dark-390-test-data.png) | 390×900 | `b485c7b6586c46b0` |
| 80 | finance-final | [CAP05-dark-320-month-review-actions-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-320-month-review-actions-test-data.png) | 320×900 | `a7198415e5800367` |
| 81 | finance-final | [CAP05-dark-320-monthly-records-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-320-monthly-records-test-data.png) | 320×900 | `b25ad40ee6d029e9` |
| 82 | finance-final | [CAP05-dark-desktop-annual-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-desktop-annual-review-test-data.png) | 1440×1100 | `24897dec59ee3b2e` |
| 83 | finance-final | [CAP05-dark-desktop-create-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-desktop-create-test-data.png) | 1440×1100 | `59e4d20b284a28de` |
| 84 | finance-final | [CAP05-dark-desktop-deviation-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-desktop-deviation-review-test-data.png) | 1440×1100 | `7ddd9711e7d4ae8e` |
| 85 | finance-final | [CAP05-dark-desktop-list-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-desktop-list-test-data.png) | 1440×1100 | `86a1f854493cc26f` |
| 86 | finance-final | [CAP05-dark-desktop-month-editor-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-desktop-month-editor-test-data.png) | 1440×1100 | `473bb10aa68f942a` |
| 87 | finance-final | [CAP05-dark-desktop-twelve-months-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-dark-desktop-twelve-months-test-data.png) | 1440×1100 | `e2ab61f9c4de0dc6` |
| 88 | finance-final | [CAP05-light-320-list-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-light-320-list-test-data.png) | 320×900 | `12437613a24871bd` |
| 89 | finance-final | [CAP05-light-desktop-list-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-light-desktop-list-test-data.png) | 1440×1100 | `d177a74fa14185f9` |
| 90 | finance-final | [CAP05-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP05-pt-BR-dark-desktop-test-data.png) | 1440×1100 | `9eb84e068ab018d1` |
| 91 | finance-final | [CAP14-dark-320-review-actions-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-320-review-actions-test-data.png) | 320×900 | `c6338cc3e93dda64` |
| 92 | finance-final | [CAP14-dark-320-editor-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-320-editor-test-data.png) | 320×900 | `c302569634c9333f` |
| 93 | finance-final | [CAP14-dark-desktop-contract-detail-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-desktop-contract-detail-test-data.png) | 1440×1100 | `7b191eb6135fdcba` |
| 94 | finance-final | [CAP14-dark-desktop-create-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-desktop-create-review-test-data.png) | 1440×1100 | `d75f117ee0c34852` |
| 95 | finance-final | [CAP14-dark-desktop-delete-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-desktop-delete-review-test-data.png) | 1440×1100 | `eb3ee3841ed0cb87` |
| 96 | finance-final | [CAP14-dark-desktop-fifteen-field-editor-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-desktop-fifteen-field-editor-test-data.png) | 1440×1100 | `0bf07cbd735e80b9` |
| 97 | finance-final | [CAP14-dark-desktop-list-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-dark-desktop-list-test-data.png) | 1440×1100 | `086aaa8beb3211e3` |
| 98 | finance-final | [CAP14-light-320-list-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-light-320-list-test-data.png) | 320×900 | `8169935aa1b28ea3` |
| 99 | finance-final | [CAP14-light-desktop-list-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-light-desktop-list-test-data.png) | 1440×1100 | `3cf6fb8f63f4e25d` |
| 100 | finance-final | [CAP14-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/CAP14-pt-BR-dark-desktop-test-data.png) | 1440×1100 | `c21dec8005c7344a` |
| 101 | finance-final | [test-finished-1.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/test-finished-1.png) | 1440×1100 | `1da44e28aa1c75ea` |
| 102 | finance-final | [test-finished-2.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-d5fcf-original-financial-commands-chromium/test-finished-2.png) | 1440×1100 | `c21dec8005c7344a` |

## Fontes adicionais lidas nesta etapa

| Arquivo | Blob | Linhas |
|---|---|---:|
| [packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/model.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/model.ts) | `65702261d6a85def1c2bf8bc74c926340783be0f` | 211 |
| [packages/app-shell/src/orchestra/chapters/sucafina/operations/risks/collection.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/operations/risks/collection.tsx) | `9dd64dfec0bca80d87c153b5ad862323d8b88219` | 661 |
| [packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx) | `1cc7f0e61adfd0432fbe4c5386dabd84f51cf6c3` | 350 |
| [packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/model.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/model.ts) | `bed358ca18a15de5a29d37ea304ad69820dc2dec` | 113 |
| [packages/schema/src/sucafina/domain.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/schema/src/sucafina/domain.ts) | `1fab36149820253c0c34bc9452c9187ee3f59913` | 73 |
| [packages/schema/src/sucafina/domain/fields.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/schema/src/sucafina/domain/fields.ts) | `cdb09915b945861ebba3b7337a5182e962e199a8` | 298 |
| [packages/schema/src/sucafina/domain/operations.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/schema/src/sucafina/domain/operations.ts) | `7605856c97eee8fcc44a5fca3214ddf6e34f68ae` | 740 |

## Entrega e limites de responsabilidade

Este documento é um diagnóstico, não uma certificação de acabamento. Não cria aprovação tácita dos estados que não aparecem. Os critérios de aceitação propõem trabalho concreto para os owners preservando fontes, moedas, ausências, versões e autorização. Nenhum ticket, comentário, PR ou mensagem externa foi enviado por este auditor.

O arquivo [product-audit-supplement.json](sandbox:artifact-extract/product-audit-supplement.json) é o manifesto estruturado. O primeiro relatório mantém os 11 achados originais e suas evidências; este suplemento define os dois adicionais e uma extensão sem duplicar B6.

