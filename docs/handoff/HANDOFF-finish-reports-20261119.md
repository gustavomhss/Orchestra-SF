# Handoff — finish-reports-20261119

SHA de código: ef081b983ab9258f99d266611afb8a8204ce3600.
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

## Atualização — recuperação explícita C05

- Código de produtores anterior: dd0ab93f78ad9871c71704eb3e727e9f5e243b17; esta alteração liga somente o clique Retry action a retry=same-intent, depois de Reconcile action. Pergunta/resposta/edição/confirmação iniciais não recebem essa opção.
- A intenção retém o payload, a chave e a observação originais. A confirmação continua usando Prepared retido em Intent; não reconstruímos recibos ou autoridade. A política F02 revalida contexto, corpo, chave e registro da chamada anterior.
- Mantida a prova de resposta de criação recebida seguida de perda da leitura: o segundo POST explícito deve repetir exatamente corpo/chave e obter o mesmo recibo, com uma única escrita C08. Nenhuma asserção foi removida ou substituída por leitura somente.
- Gate de produtores [44591754105](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44591754105): SUCCESS, 5 pass, 0 fail, 42 expect; snapshot c64cd8dcbde4b2809f3f127759dc961b75237de8. As cinco provas C05 originais voltaram a aceitar agenda.section sem metadados extras.
- Gate do contrato F02 [44593918880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44593918880): SUCCESS, 22 pass, 316 expect; código670eff1f0cfb1569ec47fba1c23780970307cb37. É dependência desta mudança; não qualifica sozinho a UI.
- Reports6 [44589429193](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44589429193): FAILURE, 4 fail. Snapshot anterior ao conserto do loop de contexto5bd79e e aos bindings C05; RPT01/03 não montaramUI48 e RPT02/04 ficaram na leitura interrompida. Sem alegação de sucesso.
- Pendente: packages/app-shell/e2e/sucafina/reports.spec.ts:27,42,108,124 — executar o gate instalado com F01 estável, bindings originais completos e este botão de recuperação.

## Continuação — resposta original e corpo CDP

- Código 7ca827d14a6eb63d898c466101089bd475ef14cb. Reports8 [44601697015](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44601697015), snapshot dbce7953e3a968f35e7d768a075109bb38598370: FAILURE, 4 falhas após compilações. Job135834512207 failure; cleanup135846012341 success. O helper aguardava response.finished em review-flow.ts608.
- Auditoria somente de leitura [44605987156](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44605987156): SUCCESS. O artifact original mostra todas as 15 opções de agenda renderizadas; o transporte do navegador já consumiu os dados, mas CDP informa ERR_ABORTED e não conclui a espera. Nos runs3/4, JSON direto já havia produzido No data found. Não se repetiu essa tentativa isoladamente.
- Fixture agora encaminha a chamada original por route.fetch com maxRetries0/maxRedirects0 e entrega a própria resposta por route.fulfill({response: original}). Nenhum status, cabeçalho, corpo ou autorização é construído. Há uma chamada original por gesto; não há replay de POST. Os handlers de perda de resposta específicos, registrados depois, mantêm precedência. As provas de chave/corpo iguais e uma única escrita C08 continuam ativas.
- GET review-download e autenticação continuam no caminho original do navegador. Os formatos Office continuam proibidos como mutation/Schema.Never. A espera diagnóstica redundante finished foi retirada; a leitura e todas as asserções dos JSON originais continuam.
- Tipos CLI/app/SF-E2E da composição14: [44601278233](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44601278233) SUCCESS. Fonte/destinos após conserto de fixtures: [44602831989](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44602831989) SUCCESS, 9 pass/146 expect; não são prova de Reports instalado.
- Asserções removidas nesta alteração: nenhuma. Timeouts do spec e fixture permanecem180000, workers1/retries0.
- Pendente/unbound: reports.spec.ts27,42,108,124 — próximo gate de Reports deve qualificar agenda, C05, sucessora, revogação e bytes DOCX/PPTX. Não há resultado desse gate ainda.

## Fato nativo de evidência por valor

- Código 291d28f31a726343c15a6f2fa4e5fc9d84f9a407, absorvendo os3blobs UI/copy de dafe5523272e9e4dae6f80d20ee5cea577e1bdca. UI47 simples e multidomínio exibem uma quarta coluna Evidence/Evidência, traduzindo somente value.evidenceState original (confirmed/estimated/hypothetical/absent). Não inferimos evidência a partir de valor, fonte, disponibilidade ou presença de dinheiro.
- review-flow.ts73 e first-agenda.ts189 agora exigem as quatro células de cada valor: ID, valor com unidade/moeda, período e estado da evidência. As demais referências/contagens/valores e74expectativas da agenda continuam; a prova de cada campo ficou mais específica.
- O run Reports9 [44606978085](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44606978085), snapshot da22ff3ef01697a9859a93eba63fd543cde8a60c, terminou FAILURE, 4 falhas, com a versão anterior3colunas. Não qualifica este campo novo. A próxima verificação instalada deve incluir estes5arquivos juntos, depois de analisar o resultado anterior.
- Asserções removidas: nenhuma. Nenhum timeout, retry ou produtor mudou. Pendente: review-flow.ts73/first-agenda.ts189 — gate da renderização Evidence com os helpers atualizados.

## Respostas originais e bloqueios observados no run9

- Código9b0660736bb247bbedbd46664672036121ac6943. O run44606978085 FAILURE4 (job135853161059; cleanup135862483960SUCCESS) mostrou que só route.fetch/fulfill ainda deixa o CDP perder o body. A fixture agora retém os bytes e status da mesma APIResponse antes de entregar ao navegador; WeakMap é indexado pela Request exata. Asserções exigem a observação, comparam status e decodificam esses bytes. Não há fallback, segundo GET, resposta fabricada ou retry de POST. A UI continua sendo verificada contra o conteúdo original.
- model.ts/first-agenda.ts/review-flow.ts usam essa observação para descoberta/agenda/preservação/report-prepare. Office permanece GET original review-download, sem interceptação. As asserções de origem, corpo, valores, fontes, C05 e imutabilidade não foram removidas.
- Auditoria de leitura44611238509 SUCCESS: docs/handoff/observed-reports-read-44606978085.md no ramo audit-logs-20261119. O primeiro teste preservou todas as7escolhas na UI, mas Review selected sections retornou unavailable sem POST; o segundo preservou o dossier e a rota UI48 mostrou Sucafina route not admitted;3/4 falharam no corpoCDP. Isso não qualifica nenhuma jornada.
- Diagnóstico novo é fechado: resposta de reviews.review-agenda emite somente kind/status/producerStatus/reason; contexto retém somente IDs conhecidos e estados operacionais de reviews. Sem headers, cookies, corpo privado ou referências opacas no log.
- Pendente: reviews/agenda/multi-domain.tsx:90 — identificar o fence que impede o POST original; host/reviews-route.tsx:54 — determinar por que reviews.review-read não admite UI48 no contexto real; reports.spec.ts:27,42,108,124 — executar novamente o spec completo após incorporar a causa observada. Sem aumento de timeout/skip, sem sf-ci final executado.

## Snapshot do input reativo

- O run Operations44612655999 falhou em operation-input-schema antes doPOST para CAP25/CAP27; os probes literais passaram e a observação de shape confirmou somente campos esperados. A UI passava valores do createStore. Não se atribui essa falha a um símbolo específico sem evidência.
- SfMultiDomainAgenda usa a mesma fronteira: itens escolhidos estão no createStore e eram passados diretamente. O builder agora usa structuredClone(unwrap(option.item)), padrão já existente em procurement/settings/index.tsx248. A cópia preserva todos os campos/undefined e remove apenas a representação reativa; não usa JSON roundtrip e não relaxa schema, idempotência, owner ou seleção original.
- Código inicial unwrapc716d9a5aa528fa7e7c11253c8835e8b940106eb; snapshot completo neste commit. Reports10 run44613459367 está em andamento no snapshot4768b0958d63eb489378d86c44559e4153c3cd9d e NÃO inclui este builder. Vai medir a retenção dos bytes9b066, colunaEvidence e os diagnósticos de admission.
- Pendente: reviews/agenda/multi-domain.tsx87 e reports.spec.ts27 — gate posterior precisa verificar os mesmos7itens,8seções de preview, exclusão/reordenação e preservação original. Não foi removida nenhuma asserção nem alterado timeout.

## Gate Reports10 e sincronização da leitura original

- [Run 44613459367](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44613459367): **failure**, quatro jornadas; CLI/app/E2E typechecks passaram; cleanup 135882384984 success. Snapshot 4768b0958d63eb489378d86c44559e4153c3cd9d.
- RPT01 confirmou contract-mismatch antes do POST. O snapshot completo structuredClone(unwrap) já registrado em 7ba91ff corrige o builder sem ampliar schema.
- RPT02–04 preservaram no produtor (HTTP200 e valor original), mas a asserção da nova superfície iniciou antes de concluir a descoberta/leitura nativa. Artefato original 14573848222: RPT03/04 ainda exibiam Loading; RPT02 Currently unavailable. Extração [44615565757](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44615565757) success, documento em audit-reports10-20261119/docs/handoff/observed-reports-read-44613459367.md.
- prepareReview e exportReview agora aguardam o GET original review-read da navegação e comparam o corpo inteiro com a revisão salva antes das mesmas asserções de UI48/UI50. É a mesma sincronização já usada por openAndReopenMeeting; nenhum timeout aumentado.
- Removido apenas o interceptador diagnóstico de /api/ui/context: a descoberta mantém seu caminho nativo e cancelamento original. O buffer conserva somente respostas de Reports necessárias às asserções. Reabertura, reload, update e source usam os mesmos bytes retidos, sem GET substituto.
- Nenhuma asserção removida. Unbound: review-flow.ts:101 (primeiro ingresso UI48), :314 (UI50/export), first-agenda.ts:160 (equivalência integral do produtor) até gate Reports11.
