# W26 — prova do limiar exato na composição de Portfolio

Estado: **autoria própria concluída, sem execução de produto e sem aceite hospedado**. Este pacote é trabalho de implementação de WP10, não parecer independente.

## Arquivo a incorporar

`modules/sucafina/Sucafinav1/test/product/wp10/integration/portfolio-exact-threshold.test.ts`

O arquivo contém um teste completo. Orçamento novo do Bun: **300.000 ms**. Prazo cooperativo: **285.000 ms**, com `AbortSignal` recebido pela fixture e verificação também em cada chamada real de ambiente. Os 15 segundos finais ficam para liberação dos recursos. Nenhum orçamento existente foi alterado. O custo real ainda será medido no CI: a prova inclui cálculo, vínculo C08, recertificação após nova composição e repetição idempotente, cada qual com fases e contadores de chamadas reais de ambiente.

## Caminho exercitado

`financialCompositionFixture` abre SQLite e compõe a autoridade, Business Services e `createSfPortfolioServices` reais. O teste cria duas versões de Planner com valores mensais 100 e 80, emite referências reais, produz cenários pelo Planner e os persiste no C08. A associação desses resultados às alternativas do caso é preparação explícita da fixture. A cobertura de treinamento permanece pendente; não há uma promoção humana nem uma declaração de custo completo.

As unidades são emitidas pelo consumidor `product.http.sensitivityUnits`. A regra de sensitivity é registrada por admissão humana real. O cálculo recebe admissão e validação UI específicas de `sf_sensitivity_evaluate`; chama `product.http.sensitivity`, sem fornecer um callback de limiar, um avaliador de sensibilidade ou um engine substituto.

O resultado exigido é condicionado, com limiar exato do **subtotal conhecido**, três pontos reais `(-240, -80, 80)` para parâmetros `(80, 240, 400)`, referências autênticas e divulgação explícita do treinamento pendente. A fronteira exata é certificada pelo produtor canônico; o teste não força o número 320 ignorando o arredondamento IEEE. A fronteira fica fora dos três pontos amostrados.

Após persistir, uma segunda chamada real a `createSfPortfolioServices` cria produto, registries e verifier novos sobre o mesmo C08 e autoridade. `readSensitivity` precisa recertificar o resultado; uma repetição da mesma operação deve devolver o mesmo resultado sem adicionar registros ou alterar a versão do namespace. São observados exatamente dois cenários de origem, três amostras e um resultado de sensitivity. O caso e seus campos de escolha/preparação permanecem iguais aos anteriores ao cálculo.

A contraprova entra primeiro no mesmo escopo de caso autorizado e só então revoga o autenticador real da fixture. Tanto a leitura como a repetição idempotente devem recusar o mesmo destino, Request, input e identidade, sem `value`. Isso evita uma recusa trivial por falta de seletor ou troca do ID solicitado.

## Dependências e limites

O teste depende da composição de `createPlannerExactThreshold({ units, preview })` preparada separadamente pelo root em `agents/root/W26-exact-threshold-composition`. A mesma composição deve chegar ao cálculo e ao verifier. O pacote também registra os três produtores PR36 selecionados de persistência, threshold proof e verification, sem modificá-los. O manifesto de fontes identifica os bytes lidos, os bindings conhecidos e as diferenças do candidato ainda não publicado.

Esta prova cobre o caminho primário de `createSfPortfolioServices`. O fallback de `createSfDecisionDomainServices` foi inspecionado, mas não ganhou uma segunda prova funcional neste arquivo. Seu wiring próprio tem recibo separado do root. A nova composição não é reinício do store nem reinício do processo. Os métodos HTTP do produto são chamados diretamente; não se afirma teste do transporte HTTP, navegador ou MCP.

Não há admissão Task nativa, aceite de rotina residente, teste global, promoção, escolha humana, preparação ou aplicação de mudança nesta prova. Os demais casos WP13 continuam com seus próprios arquivos e recibos; esta adição não os substitui.

## Verificação efetuada

Somente inspeção de fontes, resolução estática dos sete imports relativos, contagem textual das declarações e verificações de bytes, SHA-256 e Git blob. Não foi executado Bun, importado produto, realizado build, typecheck ou teste local. `audit.json`, `source-manifest.json`, `import-audit.json`, `DELIVERY.json` e `seal.json` registram o alcance e os hashes. O CI hospedado permanece obrigatório e pode revelar uma recusa ou custo ainda não medidos.
