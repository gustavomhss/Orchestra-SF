# HANDOFF — sf-sourcing-json

## SHA e estado

- Estado: **PARTIAL**. Correção mínima preparada; ainda sem gate de produto sobre este SHA.
- Branch: `sf-sourcing-json`.
- Base original de Operations: `69340e89c46825b6556d36e8d6a09dce2122c901`.
- Commit de código: `c4218a0911e10c1ca791b784dc0ded22ca7bcd75`.
- Tree do código: `1cf32ac138ccf046b7f27e90b55397d9755ac512`.
- Único arquivo de código: `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx`.
- Blob anterior: `480ab4022424ccbf7c1924890ce5218ba040d2fe`.
- Blob corrigido: `97a00de98586ffcf3e17390587c3336cdf3bcad2`.
- Proveniência das duas linhas: correção de Sourcing já existente na Sessão 1, commit `9b51a7ab76668db203bacb07b82606649a62bfcb`. Este recorte porta somente o preenchimento explícito dos índices sem score com `null`.

## Evidência original de Operations

- Run de produto: `44662419134`, attempt 1, job `136043588889`, conclusão **failure**.
- Snapshot: `9ea42e72f6aebed5685cd5b2b48df993a1e8f33d`, parent/base de produto `69340e89c46825b6556d36e8d6a09dce2122c901`.
- Resultado preservado: PROC01 passou; PROC02 e PROC03 terminaram por timeout de 60 s; Import e DOC continuam com falhas distintas em triagem.
- Evidência retida original: artefato `14596666417`, `playwright-ubuntu-24.04-1`, 68.608.517 bytes.
- SHA-256 do ZIP de evidência: `28ca71a87e76cb8fc85cb370d0da714b5d8e8503f574b396c192c7efa4cd5cd3`.

## Leitura do trace sem executar produto

- Reader: `sf-ops-current-artifact-audit`, código `874dc5d52e012a8c12c435bd093caff0c54bf6bf`, HEAD documental `7800b47360a5314b6d00fdd46aa07a8770491dd1`.
- Run de leitura: `44666025425`, snapshot `6fefcedea6be9b69ff81fef4387a6b6cff7881b3`.
- Jobs `136055405361` e `136055908327`: **success**.
- Ação original de download registrou o SHA-256 calculado do ZIP igual ao digest acima. O reader validou repository/workflow/run/attempt/snapshot/artifact, request original Linux x64 e os cinco casos/retry 0.
- Foram lidos somente eventos permitidos dos traces originais Playwright 1.59.1 / trace version 8. Nenhum replay, browser, produto, corpo de resposta, DOM privado ou URL privada foi executado ou publicado pelo reader.

### O que o trace prova

PROC02 completou o preenchimento dos scores em `operations-support/procurement-snapshot.ts:137:32` e `:140:48`, abriu a revisão em `:121–124`, completou a asserção de botão, criação CDP e habilitação de Fetch em `operations-support/runtime.ts:136`, `:137` e `:171`, e completou o clique de `:175:18` em aproximadamente 21.518 ms desde o início do trace de teste.

PROC03 completou a mesma sequência por `operations-support/procurement-refusal.ts:157:32`, `:160:48` e `:141–144`; seu clique em `runtime.ts:175:18` terminou em aproximadamente 21.415 ms.

Em ambos, nenhum call Playwright estava aberto no primeiro evento de timeout e não havia erro individual de API anterior. O primeiro evento de erro de teste não registra timestamp. A Promise comum em `runtime.ts:176` não aparece como evento Playwright; ela é o próximo await no código após o clique, não uma localização observada diretamente no trace.

## Causa estática e correção

1. `modules/sucafina/Sucafinav1/src/initial-settings.ts:28–31` define o primeiro critério comercial como preço calculado, com `auto: true`.
2. `sourcing/index.tsx:609–611` mantém esse campo desabilitado. Os dois helpers originais preenchem somente os campos habilitados.
3. A nova quotation começa com `scores: []` e `cscores: []` (`index.tsx:278–281` na base).
4. Na base, o setter copiava `[...scores]` e atribuía diretamente `values[criterion]` (`:268–271`). Preencher os critérios 1 e 2 sem preencher o critério calculado 0 produz um buraco e depois um `undefined` explícito no índice 0.
5. `packages/schema/src/sucafina/procurement.ts:11,54–55` admite somente número finito, string ou `null` em cada score. `packages/client/src/sucafina/transport.ts:199–211` valida o objeto original antes do `JSON.stringify` e do fetch em `:419`. O codec de wire também exige `Schema.Json` antes de publicar bytes.
6. A correção acrescenta somente o comentário de proveniência semântica e `while(values.length<=criterion)values.push(null)` antes da atribuição. O índice calculado conserva ausência explícita de score; o produtor continua responsável pelo cálculo de preço.

Esse defeito de payload é concreto no caminho alcançado pelos dois casos. A associação ao timeout é sustentada pelo ponto do trace e pela ordem do transporte; um novo gate ainda precisa comprovar o comportamento completo após a correção.

## Preservação e merges

- Nenhum merge, PR, dispatch ou gate foi executado por este recorte.
- Permanecem idênticos à base todos os fences de identidade, contexto, revisão, snapshot/plain clone, CAS, payload/digest, pending operation e resposta.
- `Requests`, models, domínio, transporte, codec, schemas, helpers e specs não mudaram.
- Não houve mudança em limite de timeout, asserção, retry, skip, baseline, suites, cobertura ou recibo.
- Este branch não incorpora os observers Files/Import nem a correção de navegação Import; eles continuam recortes separados a serem reconciliados pelo integrador.

## Verificação e como retomar

- Revisão por GitHub confirmou a base exata e o hunk único de duas linhas. Não houve shell nem teste local.
- Gate de produto deste código: **pendente**, sob coordenação da sessão integradora e limite global de dois gates.
- Integrador deve compor este único hunk com os demais fixes qualificados de Operations e executar uma vez o spec afetado no snapshot exato, depois da revisão.
- Manter os resultados antigos: PROC02 e PROC03 **unbound** em `packages/app-shell/e2e/sucafina/operations.spec.ts:18:3` e `:23:3` até evidência verde; a espera seguinte no helper é `operations-support/runtime.ts:176`.
- Import e DOC permanecem causas distintas; esta correção não os qualifica.
- `sf-ci` final, guards finais e pacote congelado continuam sob responsabilidade da raiz, depois de todos os merges. Este handoff não declara GO, deploy, hash de baseline nem `SF_ORCHESTRA_WEB_PACKAGE_VERIFIED`.
