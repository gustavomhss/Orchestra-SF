# W20 — composição própria que falta em Portfolio

Auditoria de fonte, sem execução local de produto, alterações no repo ou aceite. Base W19 `d357de0b1f58abc33e86e79ad3f93b8715ba0e83`; produtores PR35 `c449efc092e507fca2b4f61d1e7ce057faf05c89` e PR36 `8bb72c8cdeda149b000d91403c368642c3b53dec`. Os 33 inputs anteriormente entregues permanecem iguais.

## Fixture de escolha humana

`renewal-human-choice-fixture.ts`, blob `18d95b84d01b26048af9a442c44cb32e8f14e9f5`, é nova e não existe em W19. O hold é deliberado: nenhum dos 33 inputs a importa. Ela atende o conjunto ainda não selecionado de current-choice/choice-prepared/rejection; a cópia publicada está preservada no probe. Não se trata de arquivo idêntico ao candidato.

## Prévia de cobertura: recorte executável pelo WP10

A entrada `createPortfolioProduct.resolveCoverageAuthority` é opcional; atualmente não é fornecida. O verifier também não recebe `coveragePreview`. O fechamento de seis arquivos do WP13 mantém esse comportamento indisponível/condicionado até a composição própria.

| Dado exigido pelo produtor | Fornecedor real existente | Verificação da composição |
|---|---|---|
| Caso atual | `business.resolveCase` + `business.cases.read` | Caso inteiro, versão/incarnação, participantes e binding atual |
| Seleção humana | `registries.selection.read` | Baseline/alternative refs e critério exatos; não reconstruir a seleção |
| Regra | `registries.rules.resolve` | Mesmo caso, critério, unidade, período, parâmetro e revisão |
| Request e resultados | `plannerProduct.scenarios.resolve` + `business.results.readHistoricalScenario` | Request real e C08 autenticado; igualdade com alternativas selecionadas |
| Base e classificações | Caso + `business.baselineCoverage.readClassification` para os dois baseRef | Base realmente pertencente ao caso, classificações completas e hashes originais |
| Evidências | `business.context.context` | União de refs do caso/base/classificações/cenários/assessments/regra, autorização atual |
| Fence de retorno | `host.requestFor/revalidate`, `business.readSourceFences`, releituras dos ports acima | Mesmo Request não abortado, binding, digests integrais e fontes |

Criar um resolver privado que produza exatamente `PortfolioCoverageAuthority`; sua função `isStillValid` deve reler o mesmo conjunto e comparar as observações, sem cache entre chamadas. Passar o resolver ao product e construir serviço equivalente `createPortfolioCoveragePreview({units, preview, resolveAuthority})` para `createPortfolioProofVerifier.coveragePreview`, inclusive na reconstrução de provas após recriar os serviços.

O host existente recusa `not-applicable` sem produtor. Não usar as declarações sintéticas da fixture como fonte de produção, nem `supports: true`, nem alterar uma avaliação parcial para completa. A qualificação só fecha sensibilidade quantificada quando existem evidências suficientes; cenários hipotéticos continuam `conditioned`, `total: null` e não aplicados. A completude da análise não muda o estado financeiro original ou a aprovação humana.

## Reconciliação: serviço privado, ancestry e consumidores

`createPortfolioProduct.reconciliation` e `http.reconcile` exigem `PortfolioReconciliationHost.readPortfolio`. W19 não fornece esse callback. Os ports existentes permitem construí-lo: leitura autenticada de C08 através de `authority.state.read`, caso atual pelo case port, `portfolioBindings.readHistoricalBinding` e evidências atuais. O callback deve retornar o registro C08 original, binding e candidatos reais; deve obter o digest esperado de cada candidato do binding autenticado, jamais do navegador/modelo.

Há uma limitação concreta no helper atual: `history-provenance.ts` W19 só encontra alternativas ainda presentes no caso. Para uma alternativa substituída, o produtor publicou:

- `portfolio/proof.ts`, blob `e07714d6c390a655b6eac7f5c2d56193b7bbfc7b`: `createPortfolioCandidateHistoryReader({state,cases,results,evidence,host})`, com snapshot original da transação ou testemunho ChoiceRecord/ledger, C08 original e duas passagens de autorização/proveniência.
- `portfolio/history-provenance.ts`, blob `caa3b783b41f95287bba8a4bab3c652c8375c320`: recebe esse reader como `readHistoricalCandidate`, preservando as verificações de binding/seleção/caso/evidências.

Os dois arquivos foram lidos e arquivados byte a byte no novo diretório `followup-archive/pr36`; estão condicionais e não foram acrescentados silenciosamente aos 33 selecionados. O caminho tentado `portfolio/candidate-history.ts` não existe nesse pin; o API real é exportado de `proof.ts`.

O `decisions/portfolio-history.ts` atual usa versão original estritamente menor que a atual. Fonte pode mudar com caso em N/N; portanto não reutilizar esse helper indiscriminadamente, nem trocar apenas o operador por `<=`. O adapter privado precisa provar C08/binding/seleção/candidatos originais e autorização atual para essa situação, ou continuar indisponível.

A materialidade é opcional. `decision-materiality-services.ts` já compõe `registry.list` e `produce`, mas esses métodos ainda não constituem `readMaterialChange(condition, component, caseRef)`. O novo callback precisa ligar a condição realmente registrada ao cenário anterior/atual e obter os fingerprints `componentScope` dos componentes produzidos pelo Planner. Sem ligação inequívoca, o efeito permanece unknown. Não calcular valores pela narrativa ou pelo recibo.

O transporte own ainda não possui rota de reconciliação. Sua ativação exige ação autorizada, corpo fechado, `withCase`, preservação do Request/binding, releitura final e consumidor UI real. O product continua anunciando somente `sf_portfolio_evaluate` e `sf_sensitivity_evaluate` no caminho nativo; não existe novo contrato de reconciliação nesse pacote. Preservar `financialStatus`, nulls e referências originais. Um indicador de disponibilidade não substitui plano/admission/execution/artifact receipts governados.

## Provas ainda necessárias

Coverage exige execução hospedada positiva com classificações registradas reais, contraprovas de ACL/caso/seleção/regra/classificação/fontes e reconstrução fria do proof verifier. Reconciliação exige o ciclo real portfolio → escolha → mudanças/recibos, ancestry de alternativa substituída e source history em N/N, além de rejeições para digest/recibo/escopo ambíguo. UI instalada e nativo permanecem obrigações separadas. A auditoria presente não marca nenhum desses critérios como aceito.

O manifesto `followup-source-manifest.json` vincula 12 fontes W19 lidas aos blobs da árvore verificada e as duas capturas PR36 aos blobs retornados por MCP. Não houve alteração nos sources nem nos patches próprios de default deny do root.
