# Handoff — sf-reports-observed

SHA: 4ccf99576e6886b178c5502fc02bfa41bef6730c (último commit de código; o commit deste handoff é posterior)
Data: 2026-11-20T02:20:37Z
Estado: partial

## Feito

- Composição pronta para o gate Reports, publicada somente em `sf-reports-observed`. Nenhum gate, PR ou merge de PR foi iniciado pelo autor deste recorte. A integração já abriu o snapshot `4cdba6118ff547d9ed23cd5cdb284e55e218d675` na branch `ci-run-linux-sfc-reports-observed`, sobre o código4ccf9957; sua conclusão permanece pendente.
- Primeiro parent real: UI congelada em `f34b80103f91cc9c075f9679cb9030e5258a1793`, tree `810493dc6ed55dfb86fe5c778bd12739ec7857ac`. A releitura imediatamente anterior à escrita incluiu `24054686cb119f193738da11a28664bea7d88213` (Settings) e `f34b8010` (validação das continuations Word). Todo o trabalho do dono fora dos quatro paths reconciliados de Reports foi preservado.
- Segundo parent real: integração congelada `18a913220a6805bef1c62a58a26a310f991d6a0a`. Os dez blobs modificados desde `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` são idênticos aos dessa integração. Não houve conflito com os paths modificados pela UI.
- O commit composto aponta para tree `07d41439fb0b7a839eb51c4a45a8ef2ea8620c16`. GitHub compare contra o primeiro parent confirmou exatamente vinte paths, dezenove blobs copiados e um conteúdo novo: o agendamento da leitura de Responses em `review-flow.ts`. Readback desse arquivo coincidiu integralmente com o patch revisado. Compare contra o segundo parent confirmou zero commits atrás e merge-base `18a9132`.

### Proveniência dos recortes

| Recorte | Origem | Conteúdo preservado |
| --- | --- | --- |
| UI corrente | f34b80103f91cc9c075f9679cb9030e5258a1793 | C02/C05, preserved/answer, lost-created-thread-read, select-profile, Settings e parser OOXML do dono |
| Ingresso Reports | 40f935a39f1a686a2b0ac011999632ea37ffa581 | production-installation.ts e fixture.ts, blobs49005d72 e d930f147 |
| Ingresso Decisions e config unificada | fba289d484d0c0ff2463cbc26ab587777516a8db; código cc8aa60c5febe2e8e7dbca3d2f2a6edd8ab0edb1 | wp03/installation-fixture.ts e playwright.production.config.ts, blobsbe901681 e42f1dba0 |
| Cancelamento da seleção pendente | 042fe208f907c779bc4b65aa5544a4ffb4762dc6; código9c8502cf67b56820cc9a3bcde38c17ea1036e2e5 | reviews/agenda/index.tsx, quatro linhas causais, blobe36ee6c7 |
| Captura inicial do JSON original | edb8ec2c9aeab49440a1110bd08549fa233ecd93; handoff f1ba888b8dbef32d2169e8529d1d845ec3281c4c | Descoberta original, estendida aqui às esperas equivalentes antes de click/goto/reload |
| Observer de agenda | 6c37fd3675d092ebc79758be2da846451a6bc670; código d93f7f482b9b24cd895b8f6406727f0f8aab0dd7 | host-context.ts b30a7782, review-agenda-health.ts9a2b1a69, teste e04f557d e handoff original |
| Shared já integrado | 18a913220a6805bef1c62a58a26a310f991d6a0a | Dez blobs integrais dos quatro merges abaixo |

A ordem de merges já existente no segundo parent é:

1. PR #399 — `a5b15b51b78469a054ba97b0e87fd1e36e31f73a`, inicialização da autoridade original na fixture private-admission.
2. PR #398 — `589adb7cae06c584e1e51eeac9db7cd24dc987ea`, renovação das observações canônicas Atlas.
3. PR #404 — `5efe5a3ff3a2c382a18b28f0d575825eafab5ede`, estabilidade da identidade de acesso em ready().
4. PR #401 — `18a913220a6805bef1c62a58a26a310f991d6a0a`, escopo das provas BI completas no dispatch consumido.

Os arquivos operations-support/installation.ts e private-admission.check.ts nesta composição vêm exclusivamente do shared já integrado. Nenhum recorte adicional da branch Operations ou do PR #393 foi importado.

### Ingresso real em4174

Reports inicia o CLI original em `127.0.0.1:4174`, anuncia a origem pública original do preview e usa `connectInstalledShell` com a identidade/configuração/credencial emitidas pela instalação real. O proxy de produção aponta para esse listener somente nas seleções exatas correspondentes. Decisions e os demais três specs que compartilham startPlannerInstallation usam o mesmo listener privado coerente. Nenhuma dessas seleções executa o fallback legado de4110.

O recorte substitui deliberadamente a alternativa de autenticação Reports do commit UI `7554bb4a476d2e693348462c0fed216ebec4200c`. O ingresso original portado de40f já passou pela entrada, discovery e seleção das três fontes no [gate44653389217](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44653389217). Não há alteração de política, concessão de grant, principal fabricado ou bypass de admissão. O helper native/select-profile da UI é preservado para seus demais consumidores.

A fixture exige opções efetivas trace/video/screenshot desabilitadas antes de enrollment ou leitura de credencial. As configurações locais da spec continuam desabilitadas; a proteção falha antes do ingresso se alguma composição mudar essa condição. Não há novo logging de secrets, headers, cookies ou corpos.

### Captura da Response original

A falha observada em RPT02/RPT04 foi `response.json: Protocol error (Network.getResponseBody): No data found for resource with given identifier` depois de status200, em `review-flow.ts:40:47` do snapshot anterior. O log não prova exclusivamente eviction, portanto esse diagnóstico não é declarado.

Havia uma janela concreta: waitForResponse obtinha a Response, mas o helper só iniciava json/body após aguardar click, goto ou reload. A correção inicia o consumo assim que a mesma Response chega e aguarda em Promise.all a leitura e a ação original. Não há nova GET, replay, route mock, CDP, Response substituta, resposta sintetizada ou contexto fabricado.

Os três pontos críticos são:

1. Descoberta e previews: preservam a resposta original que contém seleção, refs e catálogo completo; as expectativas de25registros,24retidos e imutabilidade permanecem.
2. Preservação e releituras: capturam o resultado da única mutação e o GET original que a UI faz, mantendo status, payload exato, previousReviewRef, versão e conteúdo preservado.
3. Exportação: retêm o JSON do POST review-report e os bytes da própria Response GET review-download, antes de aguardar o fim do click. Os oráculos de MIME, Content-Disposition, origem, pathname, artifactRef e conteúdo Office continuam sendo aplicados. Bytes reais continuam vindo exclusivamente de GET ?sf=review-download.

A mesma janela existia nas leituras CAP03/CAP04 disparadas por navegação/confirmação/reload do próprio helper; elas receberam a mesma mudança de agendamento. Os predicates originais, métodos, URLs, contagens de mutações e valores financeiros permanecem. As leituras APIRequestContext que já consumiam imediatamente seus corpos não mudaram.

O helper conserva dezoito waitForResponse e232linhas de expect. Essa comparação textual é somente revisão de escopo, não prova runtime nem substituto dos oráculos. A única expressão de expect renomeada usa a Response original no callback em vez de await encadeado; a igualdade integral com saved permanece.

### Observer original, já qualificado em unidade

O código de observer é byte a byte o de d93f7f, inclusive os testes. Ele observa a montagem, o handler e os métodos originais, a admissão sf_dashboard_read, o Request/stamp original e duas leituras coerentes de metadata C08. Preserve também exige humanActions reviews.preserve antes e depois. A operação original conserva sua própria human.admit; não se chama agenda/preserve/preview durante a observação.

O [run44657226869](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657226869), snapshot `c182dd60b9b96cd2a0559dcc7236c3a71c0c0dbd`, terminou success. A integração registrou4pass,0fail,27expect. O status terminal foi confirmado via GitHub. O handoff original copiado de6c37fd registra o estado anterior pendente; este checkpoint acrescenta a qualificação recebida sem reescrever a evidência de origem.

## Pendente

- Gate Reports completo disparado pela integração no snapshot `4cdba6118ff547d9ed23cd5cdb284e55e218d675`, parent `4ccf99576e6886b178c5502fc02bfa41bef6730c`. GitHub compare confirmou somente `.ci-run.json`, um commit à frente e zero atrás. Run id e conclusão estão sendo acompanhados pelo integrador; o unitário do observer não qualifica os quatro cenários de navegador.
- `unbound(packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:127:25)` no snapshot `0d7e3ec545def9b247253b5215a5d1ed93b94ae9`: RPT01/RPT03 tinham o botão Review selected sections desabilitado porque faltavam observações operacionais instaladas de agenda/preserve. Observer foi corrigido e qualificado em unidade; falta provar o navegador. A expectativa correspondente está agora em review-flow.ts:132.
- `unbound(packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:40:47)` no mesmo snapshot: RPT02/RPT04 falharam ao consumir a Response original. O consumo imediato está implementado, mas falta qualificação no novo snapshot. O JSON de discovery continua sendo consumido em review-flow.ts:40.
- Os antigos erros de CAP04 e downloadJSON500 de reports15 não foram atribuídos sem prova a este patch. Os contratos originais permanecem para o gate completo.
- Typecheck integrado, guards finais, sf-ci e pacote pertencem à integração. Este recorte não declara nenhum deles verde.

## Decisões e justificativas

- Asserções removidas: nenhuma. Não há skip, aumento de timeout, alteração de seletores dos testes ou enfraquecimento de baseline.
- Controles inexistentes: não foi acrescentado console legado. A UI nativa do dono, incluindo remoção individual25→24, sucessora, apresentação, origem autorizada e C05, permanece.
- Não houve edição de runtime/application.ts, suites.json, schemas dos exports ou registry. reviews.export.docx/pptx continuam Schema.Never.
- A composição possui ancestry real dos dois parents, sem editar sf-ui-c02 ou sf-join-four. Código e handoff foram publicados com [skip ci].
- Sem GO, deploy ou SF_ORCHESTRA_WEB_PACKAGE_VERIFIED. Nenhum baseline, coverage ou digest foi inventado.

## Como retomar

1. Partir da branch sf-reports-observed; código4ccf99576e6886b178c5502fc02bfa41bef6730c, seguido deste handoff.
2. Acompanhar o snapshot já criado pela integração, `4cdba6118ff547d9ed23cd5cdb284e55e218d675`; não criar um segundo gate idêntico. O parent de código é4ccf9957 e o request confirmado contém somente:

```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/reports.spec.ts"]}
```

3. Registrar o SHA do snapshot, run/job, resultado por RPT e o primeiro file:line se houver falha. Não repetir gate idêntico sem mudança concreta.
4. Somente após o gate correspondente success, atualizar a qualificação do handoff e integrar na ordem coordenada. Se surgir falha nova, corrigir a causa preservando autoridade e oráculos antes do próximo gate.
5. O sf-ci único final, os guards contra origin/dev e o pacote congelado continuam centralizados no integrador.

## Comandos e resultados

- `bun typecheck` (app-shell): não executado localmente nem nesta branch; pendente de Actions.
- `bun run check:guards --base origin/dev`: não executado neste recorte.
- `bun run test:ci` Reports: snapshot4cdba611 disparado pela integração; conclusão pendente. Nenhum segundo gate foi iniciado por este recorte.
- Unidade review-agenda-health: run44657226869 success,4pass/0fail/27expect, executado pela integração sobre os mesmos três blobs de código do observer.
- Verificação estrutural via GitHub: parents confirmados;20paths de composição;19blobs copiados idênticos; readback do novo review-flow idêntico; zero divergência em relação à ancestry congelada18a.
- sf-ci: não disparado; sem resultado por job neste recorte.
- Artefato/baseline: nenhum novo. O artefato anterior do Reports falho, ID14592331717, é diagnóstico e não baseline.
- Pacote/sha256: nenhum pacote produzido por este recorte; permanece responsabilidade do freeze final.
