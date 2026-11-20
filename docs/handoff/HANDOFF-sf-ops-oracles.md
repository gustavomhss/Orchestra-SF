# HANDOFF — sf-ops-oracles

## SHA e estado

- Estado: **PARTIAL — dois fixes causais de helper preparados; sem qualificação Actions deste delta**.
- Branch: `sf-ops-oracles`.
- Base congelada: `7a22b1a622c10191d58240cdd6acf34ca9cedad7`, a fonte do gate Operations observado.
- Código final: `99162bd58df649763612f0f866582499e6fcc78c`.
- Árvore de código: `3535da590c29a087361bfa3086ed10e089098f1b`.
- Commit inicial do delta: `4d49f1c87556103363e5b0c8aea9c951feea66cf`; o commit final remove somente uma exigência nova de campos opcionais de metadata, antes de qualquer gate.
- Nenhum PR, merge, dispatch, alteração de baseline, GO ou pacote foi feito por este trabalho. A base é uma composição de teste Operations: transportar somente o delta documentado, sem promover suas demais dependências por ancestralidade.

## Evidência original

[Run 44673130503](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44673130503), [job 136078549491](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44673130503/job/136078549491): **1 passou / 4 falharam**; os typechecks e ClamD passaram. Estes resultados pertencem à fonte-base, não ao código preparado aqui.

1. **OP-IMPORT-01**: `packages/app-shell/e2e/sucafina/operations-support/imports.ts:153:60`: `getByLabel("source", { exact: true })`, esperado valor `planner`, elemento não encontrado. Já haviam passado UI55 única, `data-sf-read-state=ready` e painel ready.
2. **OP-DOC-01**: `packages/app-shell/e2e/sucafina/operations-support/documents.ts:120:24`: o upload original devolveu HTTP 200 e `{ok:true}`; o helper esperava `value:{name}`. O diff tem três linhas removidas relativas a esse objeto, não três campos distintos.
3. PROC02 e PROC03 continuam com seus timeouts de 60 segundos **unbound**. Este recorte não os altera nem autoriza repetir o gate completo idêntico.
4. Reports completo permanece **unbound**, com diagnóstico já encerrado em seu handoff próprio.

## Causa e alterações

### Import — identidade acessível dos dois selects

Na UI original `packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx:590–616`, cada label envolve o select e suas opções. A copy oficial é exatamente `source` e `Destination`; não havia diferença de capitalização.

Na fonte oficial Playwright v1.59.1, [selectorUtils.ts](https://github.com/microsoft/playwright/blob/v1.59.1/packages/injected/src/selectorUtils.ts) linhas 65–94 e 115–128 fazem o matcher de label incluir o texto descendente das opções. [injectedScript.ts](https://github.com/microsoft/playwright/blob/v1.59.1/packages/injected/src/injectedScript.ts) linhas 474–480 usa esse matcher. Em [roleUtils.ts](https://github.com/microsoft/playwright/blob/v1.59.1/packages/injected/src/roleUtils.ts), linhas 805–809 marcam o próprio select como visitado antes de computar sua label; linhas 623–624 excluem essa recursão. O nome acessível do combobox conserva somente a copy da label.

O helper agora usa `getByRole("combobox", { name: "source", exact: true })` e o equivalente para `Destination`. São as duas ocorrências do mesmo defeito. Permanecem o escopo UI55, a prontidão, o valor inicial planner, a identidade exata do destino e todas as outras asserções. Nenhuma UI, tradução ou timeout foi alterado.

### Documents — recibo HTTP e readback de metadata

O produtor interno `modules/sucafina/Sucafinav1/runtime/assets.ts:152` produz `{ok:true,value:{id,name}}`. A fronteira pública original em `runtime/application.ts:213–218` serializa deliberadamente apenas `{ok:true}` no sucesso. Esse arquivo proibido não foi editado.

A UI nativa em `shared/attachments/bound-assets.tsx:185–189` aceita esse recibo e chama a reconciliação. `procurement/suppliers/index.tsx:145–165,787–791` faz o GET CAP27 original, selecionado pelo mesmo supplier, e apresenta as attachments desse readback. Esse é o oráculo correto dos campos de metadata.

O helper observa os GETs CAP27 que a própria UI já emite na navegação existente e na reconciliação após o único upload. Os waits são registrados antes das ações; cada corpo é consumido da Response original. Nenhum GET adicional, replay, fixture de resposta, route.fulfill ou grant é introduzido.

A prova agora exige:

- HTTP 200 e `ok:true` do upload original, recordVersion original, filename exato e bytes exatos do próprio POST.
- Readbacks originais HTTP 200, schema CAP27 canônico, selection e supplier exatos, mesmo contexto de autoridade e versão inicial correspondente à UI.
- Versão do readback após upload igual à inicial +1; exatamente uma nova attachment; todas as attachments anteriores inalteradas.
- Nome exato do novo arquivo, ID real com o mesmo regex anterior e unicidade do arquivo pelo nome.
- A asserção CAS+1 da UI, o nome/ID renderizados, o GET assinado original e seus bytes, digest, filename, reload, confirmação e revogação originais continuam intactos.

A prova `value.name` não foi suprimida para aceitar um recibo incompleto: o nome é exigido no novo asset da fonte autorizada que realmente o expõe. O schema declara `type/bytes/size` de metadata opcionais; não se exige sua presença. Bytes continuam comprovados no POST e no download originais.

## Escopo exato

1. `packages/app-shell/e2e/sucafina/operations-support/imports.ts`: somente dois locators por role/nome exato.
2. `packages/app-shell/e2e/sucafina/operations-support/documents.ts`: captura do readback original e transferência das provas de metadata.
3. Este handoff.

O trecho Documents que começa na asserção original da versão da UI (linha 123 da base; linha 169 do código final) até o fim permanece byte a byte idêntico. Import mantém seis rows, 72000→84000, 518000 inalterado, digest/manifest/receipt, CAS+1, um Apply, reconciliação/reload/reentrada, revogação e novo owner. Não há mudança de contrato público, schema, produtor, runtime, UI, assertion financeira ou controle de cancelamento.

## Verificação e limites

- Leitura do log original e das fontes no SHA exato; fonte oficial Playwright e guias exigidos pelo AGENTS de E2E consultados via GitHub.
- Conteúdo publicado relido e comparado com a base. A alteração cumulativa de código contém apenas os dois helpers.
- Não houve execução local nem gate por este agente. Typecheck E2E, guards e execução destes fixes permanecem pendentes; não se atribui o sucesso anterior de typecheck ao novo código.
- As Responses observadas continuam sujeitas à rede real. Este delta não relaxa erro de corpo indisponível/cancelamento nem afirma que a captura de JSON garante retenção de bytes.
- Os dois fixes não encerram Operations, Reports ou qualquer baseline `PENDING_REAL_COMPLETE_RUN`.

## Como retomar

A raiz pode revisar/transportar somente os dois hunks de helpers para a composição legítima e decidir uma seleção Actions ligada a estas causas concretas. Não promover toda esta base de teste, nem a dependência de codecs de outra PR, por um merge indireto. Não repetir o full Operations sem mudança causal referente aos dois timeouts que continuam unbound. O fechamento de guards, sf-ci único, freeze e pacote continua centralizado na raiz.
