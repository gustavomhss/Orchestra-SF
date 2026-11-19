# Handoff — finish-reports-20261119

SHA: f50f4992678d01529c4227d9ab1f871362e677d9 (último código antes deste documento).
Data: 2026-11-19
Estado: partial

## Feito

- CAP03 renderiza os totais já calculados pelo produtor para o ano solicitado, somente quando selection.year corresponde à seleção. Nenhuma soma financeira no navegador. Budget → Reports mantém year.
- A descoberta expõe os recordRefs já autorizados pelo seletor; a projeção nativa usa a seleção emitida como identidade da seção, eliminando a colisão entre três seções chamadas dashboard. O título vem do produtor.
- UI47 permite retirar um registro da seleção sem alterar a fonte. A prévia agora conserva e renderiza projection.values e context.sourceRefs completos, com valor, moeda/unidade, período e referência de origem. Essa última exibição entrou em 17a513fe e ainda aguarda gate.
- UI48 oferece preparação explícita da sucessora quando review-update confirma disponibilidade; reutiliza o editor nativo e envia previousReviewRef somente após nova confirmação.
- Reports conserva provas de 25→24 registros, mesmos IDs físicos na sucessora, integridade dos demais campos, valor/moeda/período/referência e imutabilidade da revisão anterior. A seleção dirige explicitamente Projects, Budget, Hot Topics. Reload observa dashboard-review, a operação real do capítulo.
- extended-source-links mantém C02, digest, versionamento, acesso e revalidação; devolve URLs nativas para Dashboard, Planner e Procurement. Query e codec foram conferidos nos parsers: Planner mantém version original; Requests mantém request; Supplier usa r_ base64url. CAP25/27 não recebem ano/mês que não admitem.
- test-ci agora executa também o typecheck do app-shell antes do E2E SF. A compilação do app e dos E2E passou no run 44567280032; os cenários de navegador desse run ainda estão em execução neste checkpoint.
- source-destinations foi ligado às projeções reais CAP01/11/12 via createSfLiveContext e authority.readContextAdmission. A identidade é a mesma instância estável da fixture original. Não há stamp ou disponibilidade operacional fabricada. Os seletores públicos year/month são mapeados como os capítulos fazem para execYear/executiveMonth, opsYear/operationsMonth e secYear/securityMonth.
- A branch absorveu por merge os códigos qualificados de PR358, PR359 e PR360 até f94dde9e8b1a4d363806f7a54fe6ae86b69c30e8. Nenhuma alteração em runtime/application.ts.

## Pendente

- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:19 — concluir o gate dos quatro cenários depois do ingresso nativo compartilhado. Os runs de ingresso 44568058579 e Operations 44568624223 ainda falharam; o último mostrou F01 resolving antes do capítulo.
- packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx:343 — qualificar a nova renderização completa de referências e valores, que não fazia parte do snapshot inicial de Reports.
- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:308 — confirmar DOCX/PPTX originais e seus conteúdos; as asserções e GET review-download permanecem ativos.
- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:439 — confirmar o follow de Budget no browser com ano e total atuais.
- packages/app-shell/e2e/sucafina/review-agenda-support/first-agenda.ts:21 — o helper ainda pede o antigo picker multidomínio; UI47 expõe atualmente o catálogo Dashboard. A falta de ligação pública dos demais tipos permanece explícita, sem remover as asserções nem recriar o console.
- modules/sucafina/Sucafinav1/test/product/wp10/integration/source-destinations.test.ts:65 — aguardar o segundo gate depois de corrigir o mapeamento dos seletores executivos.
- wp10/composition.spec.ts e wp10/extended-flows.ts estão sob posse da branch finish-ingress-20261119. Não foram alterados aqui.

## Decisões e justificativas

- A retomada autorizada exige fechamento completo; novos gates necessários tratam causas observadas. Este checkpoint não é a entrega final.
- Asserções de negócio removidas sem substituição: nenhuma. A mensagem estática antiga de remoção foi substituída por estado nativo reviewing e contagem autoritativa 24; a tabela legada da sucessora foi reatada à linha nativa com ID, valor, moeda, período e referência não vazia.
- O teste de destinos não espera HTML de uma rota aposentada. As seleções de calendário antes extraídas de select/option são verificadas na projeção JSON nativa, sob a autoridade original, junto ao caminho do manifesto, origem, query exata, principal e revisão de acesso. O GET legado tem asserção própria 404. A negativa de período parcial/múltiplos meses permanece inalterada.
- O primeiro gate unitário confirmou as duas projeções Operations e falhou em CAP01 porque o teste enviava year em vez de execYear. O capítulo real usa execYear; corrigiu-se o teste, mantendo a expectativa do ano exato e sem alterar o produtor.
- Nenhuma linha de fonte, versão, contagem, coverage, digest ou aprovação é inventada. reviews.export.docx/pptx continuam Schema.Never. Os arquivos Office vêm apenas de GET review-download.

## Como retomar

1. Continuar nesta branch, sem importar automaticamente modificações paralelas nos arquivos sob outra posse.
2. Aguardar/corrigir o gate unitário source-destinations e registrar resultado exato.
3. Absorver o ingresso real depois da qualificação de F01; rodar reports.spec.ts com o novo preview e manter um worker/zero retries.
4. Resolver a ligação restante de first-agenda sem UI de console; depois integrar os arquivos qualificados e atualizar este handoff.

## Comandos e resultados

- Toda execução foi em GitHub Actions; nenhum shell local.
- Reports: [44567280032](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44567280032), snapshot 259fb8b7b1c7a41ec895f11b83140751b6bee0ad, composto do código Reports316b0fb8517b9bdd62af2fee5fa1ced73c0f640f e ingressoa6c4c09b9bf2303d7457b7d08872104276403704. Typecheck app e SF E2E success; resultado dos cenários ainda pendente neste checkpoint. Não qualifica as mudanças posteriores.
- Destinos 1: [44569514262](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44569514262), snapshot c1b2923bbdd09b83a91b226a16b8bbb6188db166, código1994b4764a45b97b84c323a10d54a8850a94d297. FAILURE, 1 pass/1 fail, 53 expectativas. A falha foi a seleção do ano CAP01 descrita acima.
- Destinos 2: branch ci-run-linux-source-links-20261119-2; snapshot1ebb39dbccaf85f39c07a269ca8ee9d969e6ba7a, código f50f4992678d01529c4227d9ab1f871362e677d9. Em execução/aguardando consulta do run.
- Guards e sf-ci final ainda não executados nesta fatia. Nenhuma declaração de GO.

```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/reports.spec.ts"]}
```

```json
{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/wp10/integration/source-destinations.test.ts"]}
```
