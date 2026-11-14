# R4 BI — revisão independente do teste completo e da fixture

**Conclusão: nenhum finding concreto na revisão estática focal.** O teste novo `scenario-bi-complete.test.ts` e a revisão da fixture foram lidos integralmente contra os produtores reais reutilizados. Este parecer não é resultado de CI, não concede aceite global e mantém aberta a interpretação compartilhada FIN-R2-REV-01.

Revisor: Astra `/root/cold_review`, sem autoria no produto, teste ou fixture. Data UTC: 2026-11-14T17:12:25.274002+00:00. Nenhum teste/typecheck/guard local ou operação remota foi executado. A revisão R2 anterior permanece intacta; este receipt tem destino novo em WP05.

## Pins

Manifest: `work-planner-bi/scenario-bi-candidate-manifest.json`. Base declarada: `88b9b6bff53a4f64d37d04ddc868f1443cecf5b3`; parent de publicação informado: `9de58454924b072b6e571b5b4ebcd70f95e596df`. Ainda não atribuo o parecer a um commit R4. Os seis arquivos foram copiados para leitura e conferidos por Git blob SHA e SHA-256 contra o manifest.

| Path relativo a Sucafinav1 | Blob revisado/conferido |
| --- | --- |
| `product/planner/scenario-bi.ts` | `68d6b2e8c1f4ee0badb169565d5041f80d6e937b` |
| `product/analytics/factory.ts` | `9cc4cc81538a7247cd87893f958acf5665194eb5` |
| `product/analytics/waterfall.ts` | `fef3b0546384fcb0739fcf11ef531406c60ad760` |
| `test/product/wp03/scenario-bi-fixture.ts` | `14445a3e32ab1c906a993fd628d011b8d22659c9` |
| `test/product/wp03/scenario-bi.test.ts` | `f35fbae07684e507421a009244b603530f16b1e9` |
| `test/product/wp03/scenario-bi-complete.test.ts` | `edad0b7bf1c54b3654b5a0595bcfb6e34d38102b` |

O foco novo é o sexto arquivo e a alteração da fixture. A revisão anterior de WP13 permanece responsável pelos cinco arquivos originais; não foi retroativamente ampliada.

## Origem dos valores e da completude

O novo teste invoca `createRenewalChoiceHistory({ training: "bundled" })` e `reviseImplementation()`. A cadeia reaproveitada cria uma cópia real da versão Planner por `Versions.copy` e grava `f10=70000` via `OPEX.save` com revisão esperada. O produtor confere que o digest da projeção original permaneceu igual. Trata-se da revisão do forecast explícito de novembro, preservando a fonte anterior; o teste não sobrescreve um total nem muda uma flag de cobertura.

`preparePhase` lê os componentes canônicos, classifica a base versionada, registra a cobertura, revisa as alternativas pelo port de mutações e publica cenários/comparação em C08. O motor produz `60000+70000+105000=235000`; a renovação continua `240000`. A ordem da comparação é renovação como baseline e transição como candidata, portanto a diferença candidata menos baseline é `-5000`.

A cobertura passa por `classifyCoverage`, `supportsCoverageClassification`, `baseline.register`, `addAlternative`, `assessCostCoverage` e validação canônica. Declarações N-A e grants da fixture são sintéticos e explícitos; os componentes e o julgamento são das implementações reais. A fixture não introduz uma fórmula de custo por categoria. O teste confirma N-A exatamente em `contract_exit`, `internal_costs`, `other_relevant_costs`; treinamento e migração apontam aos mesmos componentRefs da implantação. A exigência de um único segmento `implementation:11` de70000, junto ao total235000, discrimina duplicação de custo compartilhado.

O teste exige cenários e comparação completos, valores canônicos de total/diferença com estado confirmado, igualdade de `projection.decision` aos resultados persistidos e waterfall reconciliado de240000 para235000. O resultado selecionado é explicitamente source-only (`operations: []`), evitando alegar que uma simulação ou premissa virou dado confirmado.

## Fixture: delta exato e negativos preservados

Verifiquei independentemente a mudança `3524e36303db8ac9d562a16840fa040eb225f54b` → `14445a3e32ab1c906a993fd628d011b8d22659c9`: reverter em memória somente `viewId: selected.viewId === "BI10" ? "BI10" : "BI09"` para `viewId: selected.viewId` reconstrói exatamente o blob anterior. Isso restringe o tipo da apresentação à união BI09/BI10. O produtor recusa viewIds não suportados antes de ler a fonte. Nenhum número, cobertura, autorização, assertion ou timeout mudou nessa fixture.

Li também `scenario-bi.test.ts` final `f35fbae07684e507421a009244b603530f16b1e9`. Os negativos continuam separando componente zero confirmado de componente sem valor e moeda sem FX; a classificação humana pendente não é promovida por haver subtotal numérico. Permanecem recusas por revisão de acesso, projeção pareada alterada, mutação do pedido, lease encerrada e tentativa real de escrita aninhada cujo erro foi capturado. O último exige `attempted: true` dentro do callback, `rejected: true`, ausência de value e snapshots iguais. A prova de adiamento permanece no mesmo arquivo, com diferença anual zero e períodos reais.

## Autoridade, leitura e limites

O caso completo passa por C08, resolução de alternativas atuais, escopo/caso/fonte e revalidações do host. Antes de `plan.readView`, captura o digest dos três snapshots; depois exige igualdade e mantém choices/preparedChanges/receipts vazios. As escritas necessárias de criação/revisão das fontes ficam na preparação, antes desse baseline. A leitura BI não é apresentada como decisão aplicada.

O teste completo chama diretamente o port BI sob a admissão `sf_bi_view` da fixture WP11; essa admissão original usa o payload BI11 e `readCurrent` captura seu contexto. Assim, o alcance demonstrado é o produtor sob autoridade controlada e o consumo BI direto. Não é prova do binding de um transporte/UI instalado nem de outro caller. Os negativos de acesso continuam em `scenario-bi.test.ts`; o novo positivo não os substitui.

O prazo de180000ms permanece. O run hosted do R4 precisa terminar com suas assertions antes que haja qualquer afirmação de sucesso ou desempenho. Não revisei resultados ainda não executados. A dependência `readPortfolioSnapshot` permanece inalterada; **FIN-R2-REV-01 — OPEN_SHARED_CONTRACT_INTERPRETATION (WP10/S0, INV.11/C08/C17)** continua aberta. Este receipt não a dispensa.

**Disposição:** revisão focal apta a acompanhar o candidato R4 e os runs cirúrgicos previstos, mantendo os limites acima e sem declaração de aceite global. O JSON contém os hashes de todas as dependências inspecionadas e os pins completos.
