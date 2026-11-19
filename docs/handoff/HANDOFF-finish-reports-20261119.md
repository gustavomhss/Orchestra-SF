# Handoff — finish-reports-20261119

SHA: e664fccc3deb9ee42ba0255deca264a4005c48be (base deste ajuste; o commit atual acrescenta conclusão dos controllers, seletor primário e disponibilidade do leitor genérico).
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

- Reports 3: [44578568944](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44578568944), snapshot0c35116694f17d38b83d8ba3b2034bc6c0fc9736, Reports4f753c53b62dcbec079225ec9efca1c0e09d7f56 + ingresso0b0cf311a3b2813f2bc9fa9871b3fbe53ee2b345 + integração57aafbd892e5f3425f97ab53d6bb3b59345b69aa. FAILURE4/4 após compilações app/SF E2E e ingresso. UI47 e respostas200 observadas, mas Playwright response.json falhou com Network.getResponseBody: No data found. Locais: first-agenda.ts42 (catálogo Planner), review-flow.ts37 (descoberta), review-flow.ts117 (prévia após retirada). Job135752662286 failure; cleanup135757843297 success.
- Adicionada observação de finished/failure/status/tamanho e fase de UI nas respostas afetadas. Ela relança o erro original e não repete/substitui requests, especialmente POSTs. A causa do corpo indisponível ainda está em investigação.


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

### Continuação — Reports 4 e composição instalada

- Reports 4: [44581042555](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44581042555), snapshot 005624b218008a91eecbf92395b918a88f95b7e5; FAILURE 4/4. Typechecks app e SF E2E passaram; job135761432669 failure, cleanup135769419962 success. Catálogos de Dashboard/Planner/Procurement e previews reais foram lidos. RPT03 preservou o dossiê e releu a igualdade original; falhou ao abrir UI48. RPT01 ainda procurava o comando primário dentro do corpo da página, embora SfPageFrame o coloque no cabeçalho. RPT02 aguardou conclusão da resposta; RPT04 sofreu CDP No data found após preservação.
- Correção mínima: retirar referências de AbortControllers concluídos imediatamente após o retorno do transporte e antes de alterar estado. Aborts de requisições pendentes, owner/generation fences e validações continuam. O padrão era a mesma classe de ERR_ABORTED observada no CAP23; aguarda nova prova em Reports.
- O seletor de Review selected sections aponta ao botão único do SfPageFrame. A disponibilidade de UI48/49/50 exige reviews.review-read, exatamente o leitor genérico agora usado nessas telas.
- Adicionado diagnóstico dos eventos reais requestfinished/requestfailed e superfície/heading em falha. Não imprime cookies, Authorization, senhas, conteúdo privado do contexto ou grant fabricado.
- Ingress11 composto: [44582641085](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44582641085), snapshot 7fb4d28b4223d4a47331671253f8a1064ad91494; FAILURE no novo typecheck CLI (job135767084245). O tipo nativeReadBinding ainda aceitava só duas operações. Corrigido no branch finish-bindings-20261119, código a45298af5012ef787502fddaac6373bc9bdd6b41, união fechada das operações realmente observadas. Não houve teste de navegador neste run.
- Asserções removidas nesta continuação: nenhuma. UI48/exports/revisão/revogação permanecem unbound até o próximo gate nominal.

### Seleção de exportação da primeira agenda multidomínio
- A primeira agenda agora preserva sete seções originais, enquanto exportReview ainda só marcava os três grupos Dashboard. A UI50 já publica checkboxes por section.id para todas as seções; o helper agora marca essas opções reais, confere identidade, contagem e ordem no DOM e exige o POST com todos os IDs preservados. Mantém os três grupos Dashboard obrigatórios e a comparação exaustiva de todas as linhas/valores/períodos/fontes dos bytes DOCX/PPTX.
- Remapeamento: a igualdade entre o subconjunto de três páginas e o dossiê completo foi substituída pela igualdade entre os IDs realmente marcados no DOM e todas as seções preservadas. Nenhuma seção, valor, nota, identidade ou verificação de bytes foi retirada.
- Gates ingress12 44584522510, WP2 44584527788, Reports5 44584532213 e Operations44584656842 não executaram navegador: CLI passou, app typecheck falhou em sources.tsx (Schema.Schema serviços desconhecidos) e CAP19 setters readonly. Correção de tipo e validação do próprio codec no ingresso7fe991b0ec6679d97bfa795eac5f45998591521f; próxima composição usa esse código.

- Follow de Budget: a CAP03 formata o valor com Intl.NumberFormat. O helper confere separadamente o GET original 200/statusok, selection.year e data.totals.totalForecast numérico (1400), e a apresentação inglesa exata (1,400), em vez de esperar texto sem o separador de milhar. A releitura preservada continua idêntica; não recalcula finanças.

### Continuação C05 — 2026-11-19

- Revisão estática encontrou perda da preparação de confirmação: submitIntent limpa ui.prepared antes de finish comparar o recibo original. O Intent de confirmação agora conserva a preparação exata inspecionada pelo operador; finish usa esse valor, mantendo answerRef/observedVersion e a releitura original.
- O controle de inspeção usa botão explícito + Show, preservando os dois JSON originais e os mesmos rótulos. Retirado o details/summary preexistente para respeitar a restrição do console descomissionado.
- Asserções removidas: nenhuma. Sem alteração de retries, idempotência, timeout, permissões ou produtor.
- Gate Reports6 usa snapshot ac233ca04fcc609301673c7ce27667d53bd0ec0d anterior a esta correção; serve para revelar os próximos bloqueios reais. A confirmação C05 deste commit ainda exige sua prova no mesmo reports.spec.ts.

### Compatibilidade do descritor original de agenda — 2026-11-19

- A auditoria44585817131 revelou cinco falhas C05 em meeting-fixture.ts:28: a descoberta emitia recordOptions dentro de agenda.section e o consumidor original devolvia essa section ao dashboard-agenda, cujo contrato fechado rejeita metadados extras com400.
- Correção na origem: recordOptions fica em agenda, separado de section. A section conserva exatamente os campos originais de seleção; o adaptador native-ui/reviews.ts continua publicando os mesmos recordOptions nos itens somente de leitura usados por UI47. Nenhuma mudança no schema de comando, grants ou asserções.
- Pendente: gate estreito dos dois specs ui-review/review-context e review-context-history; native Reports/Dashboard continuam exigindo seus gates completos.
