# Handoff — finish-reports-20261119

SHA: d6bbaa6f7a9b0e8fd5998d2d62d95242fdda38ec (último código antes deste documento).
Data: 2026-11-19
Estado: partial

## Feito

- CAP03 renderiza os totais já calculados pelo produtor para o ano solicitado, somente quando selection.year corresponde à seleção. Nenhuma soma financeira no navegador. Budget → Reports mantém year.
- A descoberta expõe os recordRefs já autorizados pelo seletor; a projeção nativa usa a seleção emitida como identidade da seção, eliminando a colisão entre três seções chamadas dashboard. O título vem do produtor.
- UI47 permite retirar um registro da seleção sem alterar a fonte. A prévia agora conserva e renderiza projection.values e context.sourceRefs completos, com valor, moeda/unidade, período e referência de origem. Essa última exibição entrou em 17a513fe e ainda aguarda gate.
- UI48 oferece preparação explícita da sucessora quando review-update confirma disponibilidade; reutiliza o editor nativo e envia previousReviewRef somente após nova confirmação.
- Reports conserva provas de 25→24 registros, mesmos IDs físicos na sucessora, integridade dos demais campos, valor/moeda/período/referência e imutabilidade da revisão anterior. A seleção dirige explicitamente Projects, Budget, Hot Topics. Reload observa reviews.review-read (GET ?sf=review-read&reviewRef=...), a leitura original que aceita todos os domínios preservados.
- extended-source-links mantém C02, digest, versionamento, acesso e revalidação; devolve URLs nativas para Dashboard, Planner e Procurement. Query e codec foram conferidos nos parsers: Planner mantém version original; Requests mantém request; Supplier usa r_ base64url. CAP25/27 não recebem ano/mês que não admitem.
- test-ci agora executa também o typecheck do app-shell antes do E2E SF. A compilação do app e dos E2E passou no run 44567280032; os quatro cenários de navegador falharam no ingresso compartilhado antes do fluxo de Reports.
- source-destinations foi ligado às projeções reais CAP01/11/12 via createSfLiveContext e authority.readContextAdmission. A identidade é a mesma instância estável da fixture original. Não há stamp ou disponibilidade operacional fabricada. Os seletores públicos year/month são mapeados como os capítulos fazem para execYear/executiveMonth, opsYear/operationsMonth e secYear/securityMonth.
- A branch absorveu por merge a integração até 4c9132c5454dc6adef5b7c08e1af00ab54b14728. Nenhuma alteração em runtime/application.ts.

- UI47 recebe recordOptions {recordRef, recordId, label} do mesmo loop de descoberta autorizado, sem decodificar referências opacas no cliente. Os itens exibem o label e a identidade física; o preview envia somente os seletores originais, sem usar metadata como autoridade. A prova de seleção de um Hot Topic em WP2 usa esse vínculo.

- UI47 agora liga o catálogo e a prévia multidomínio originais: reviews.review-agenda-options (GET), reviews.review-agenda (POST) e reviews.review-preserve (POST). Schemas fechados, registro de rotas, cliente, health e host usam os produtores existentes. A disponibilidade exige vínculo montado atual, admissão/revalidação e duas leituras C08 consistentes; preservação exige a ação humana original.
- first-agenda conserva 74 expectativas e a jornada original de Budget, Projects, Hot Topics, IT Risks, IT Operations, Planner e Procurement. Mantém retirada de IT Risks, reordenação, valores completos, referências e leitura da revisão. O setup chama o seed real já existente antes do processo da instalação.
- UI48/49/50 usam a leitura genérica original porque dashboard-services:109/119 rejeita referências Planner/Procurement; não foi ampliada a autoridade da leitura Dashboard.
- O segundo gate encontrou dois contratos incompletos de ação secundária (tone/busy) e o tipo Bun fetch.preconnect no ingresso compartilhado. Os dois contratos do Reports foram corrigidos em d6bbaa6f7a9b0e8fd5998d2d62d95242fdda38ec; o fetch permanece sob posse de finish-ingress-20261119.

## Pendente

- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:19 — qualificar os quatro cenários no snapshot com ingresso corrigido, codec de entrada e leitura genérica. Reports2 não executou navegador: typecheck falhou.
- packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx:314 — qualificar labels e identidades de registro emitidos pelo produtor; próximo gate de navegador inclui esta alteração.
- packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx:345 — qualificar a nova renderização completa de referências e valores, que não fazia parte do snapshot inicial de Reports.
- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:308 — confirmar DOCX/PPTX originais e seus conteúdos; as asserções e GET review-download permanecem ativos.
- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:439 — confirmar o follow de Budget no browser com ano e total atuais.
- packages/app-shell/e2e/sucafina/review-agenda-support/first-agenda.ts:21 — helper multidomínio implementado, aguardando gate; preserva as 74 expectativas originais. Não qualificado por run anterior.
- wp10/composition.spec.ts e wp10/extended-flows.ts estão sob posse da branch finish-ingress-20261119. Não foram alterados aqui.

## Decisões e justificativas

- A retomada autorizada exige fechamento completo; novos gates necessários tratam causas observadas. Este checkpoint não é a entrega final.
- Asserções de negócio removidas sem substituição: nenhuma. A mensagem estática antiga de remoção foi substituída por estado nativo reviewing e contagem autoritativa 24; a tabela legada da sucessora foi reatada à linha nativa com ID, valor, moeda, período e referência não vazia.
- O teste de destinos não espera HTML de uma rota aposentada. As seleções de calendário antes extraídas de select/option são verificadas na projeção JSON nativa, sob a autoridade original, junto ao caminho do manifesto, origem, query exata, principal e revisão de acesso. O GET legado tem asserção própria 404. A negativa de período parcial/múltiplos meses permanece inalterada.
- O primeiro gate unitário confirmou as duas projeções Operations e falhou em CAP01 porque o teste enviava year em vez de execYear. O capítulo real usa execYear; corrigiu-se o teste, mantendo a expectativa do ano exato e sem alterar o produtor.
- O formulário antigo de título/formato antes da preservação não é um fato armazenado por esse produtor. A jornada agora inicia na seleção explícita de Budget, preserva as mesmas seções/dados e escolhe formato na UI50. A montagem deixou de dirigir DOM aposentado; não removeu a prova dos conteúdos.
- Nenhuma linha de fonte, versão, contagem, coverage, digest ou aprovação é inventada. reviews.export.docx/pptx continuam Schema.Never. Os arquivos Office vêm apenas de GET review-download.

## Como retomar

1. Continuar nesta branch, sem importar automaticamente modificações paralelas nos arquivos sob outra posse.
2. O gate unitário source-destinations foi qualificado pelo run 44570310022; conservar seus seletores e provas de origem, período e autoridade.
3. Compor o ingresso corrigido e a correção de campos opcionais, rodar reports.spec.ts com o catálogo multidomínio e a leitura genérica; manter um worker/zero retries.
4. Corrigir apenas as falhas observadas, integrar os arquivos qualificados e atualizar este handoff.

## Comandos e resultados

- Toda execução foi em GitHub Actions; nenhum shell local.
- Reports: [44567280032](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44567280032), snapshot 259fb8b7b1c7a41ec895f11b83140751b6bee0ad, composto do código Reports316b0fb8517b9bdd62af2fee5fa1ced73c0f640f e ingressoa6c4c09b9bf2303d7457b7d08872104276403704. Typecheck app e SF E2E success; resultado final FAILURE, quatro cenários interrompidos no helper de ingresso anterior à correção de ConnectionRecovery. Job 135712365559 failure; cleanup 135724059688 success. Não qualifica as mudanças posteriores.
- Destinos 1: [44569514262](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44569514262), snapshot c1b2923bbdd09b83a91b226a16b8bbb6188db166, código1994b4764a45b97b84c323a10d54a8850a94d297. FAILURE, 1 pass/1 fail, 53 expectativas. A falha foi a seleção do ano CAP01 descrita acima.
- Destinos 2: [44570310022](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44570310022), branch ci-run-linux-source-links-20261119-2, snapshot 1ebb39dbccaf85f39c07a269ca8ee9d969e6ba7a, código f50f4992678d01529c4227d9ab1f871362e677d9. SUCCESS, 2 pass / 0 fail / 55 expect. Job 135723210009 e cleanup 135724617221 success. Qualifica os destinos e a projeção de calendário unitários; não qualifica a renderização UI47.
- Reports 2: [44576103909](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44576103909), snapshot 28fc6667009e5a3e581c1c401ff9d647883e9f39, Reports cc0285d8b7396b81d863359e0b5f4137f026e01c + ingresso 49234909ad66e323ceb43b6a6ecdf067336c418b + integração 4c9132c5454dc6adef5b7c08e1af00ab54b14728. FAILURE no typecheck app: owner-runtime231.tsx:300 (fetch.preconnect), agenda/index.tsx:255 e multi-domain.tsx:153 (tone/busy). Job135743911588 failure, cleanup135749224099 success. E2E não executado. Não inclui a leitura genérica 59a9fcf nem os contratos de ação corrigidos d6bbaa6f7a9b0e8fd5998d2d62d95242fdda38ec.
- Guards e sf-ci final ainda não executados nesta fatia. Nenhuma declaração de GO.

```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/reports.spec.ts"]}
```

```json
{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/wp10/integration/source-destinations.test.ts"]}
```
