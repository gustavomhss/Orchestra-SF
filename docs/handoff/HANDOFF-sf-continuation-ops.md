# Handoff — sf-continuation-ops

## SHA e estado

- Estado: **IMPLEMENTED / PENDING_ACTIONS**. Código pronto para composição pela raiz; não é handoff complete nem prova de aceite.
- Branch: `sf-continuation-ops`.
- Base: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0`.
- Código final deste WP: `50a88887a9f8d6de5e6b4f0cb1ed99df408d9c16`.
- Commits de código, na ordem: `c600d46533ba1eb3dee7e37c1afc69ce7431697c` (total numérico), `b757cd82a6e972e6b4c21c4562e91993e2716097` (builders e anexos), `50a88887a9f8d6de5e6b4f0cb1ed99df408d9c16` (helpers e ingresso).
- Origem revisada: `finish-operations-20261119@ee565f567e11c27be68240841f6ebfbd49c9def1`, último código numérico `460706e14903bc821aa04ab903b2526ceb69e701`.
- Somente GitHub API; nenhum shell, teste local, gate, PR ou merge foi executado por este WP.

## Causas e mudanças

1. **Quote.total numérico.** O contrato em `packages/schema/src/sucafina/procurement.ts:10/50` exige NullOr(Finite); o handler antigo passava string. `sourcing/index.tsx:574–576` usa valueAsNumber apenas para total; vazio vira null, zero continua zero. Qty/unitPrice continuam NumericInput, sem cálculo local.

2. **Dados revisados atravessam o codec estrito.** Sourcing e Suppliers usam uma única cópia `structuredClone(unwrap(...))` no digest e no POST. Sourcing mantém a comparação exata com o review após await. Os builders de edição omitem somente optionals ausentes que antes eram materializados como undefined; nenhum valor informado, campo de score, ID ou CAS é removido. A identidade opcional do create de Supplier fica ausente, em vez de id:undefined.

3. **Anexos de Supplier no boundary Files original.** Suppliers monta SfBoundAssets com ref/version reais, allowedAction save original e releitura autorizada após admissão. O componente recebe apenas os novos discriminantes supplier/Suppliers; seus bytes, scanner, CAS, signed link e download não foram substituídos. Duas traduções legítimas sf.u14.attachments foram portadas. As mudanças bancárias e logs de diagnóstico da branch divergente não foram copiadas.

4. **Fatos de sourcing preservados na tela.** Campos ausentes da comparação mostram o texto existente Unavailable, seleção/justificativa vêm do registro, e fornecedor/quantidade do futuro PO são campos desabilitados do produtor. Nenhum ranking, FX ou total foi calculado pelo cliente.

5. **Helpers usam a UI nativa atual.** Documents cria Supplier pela confirmação humana, exige POST200 e payload, lê ID e número reais, usa o uploader SfBoundAssets, verifica versão +1, bytes exatos no GET assinado, nome do download, confirmação da evidência e revogação. Imports usa CAP23 original antes/depois para exigir um único ID novo, linha nativa e identidade no editor, usa CAP18 Manage/source revision com ano explícito e contexto separado para viewer.

6. **Respostas originais retidas.** `operations-support/runtime.ts:124` extrai o padrão response-stage de `dc38e037ec4232cab9bf25de38e97a096445861d`. O CDP captura o request do browser, status, headers e bytes originais antes da releitura nativa; entrega os mesmos bytes, sem request substituto, route.fetch, retry ou corpo fabricado. Sourcing, Supplier, Settings e Versions compartilham esse helper. As asserções 200/422, payload/CAS, fieldErrors, histórico e ausência de efeitos continuam.

7. **Ingresso no host real da Sessão 1.** Runtime lê o manifest privado wp04, valida origem loopback4174, mount /sucafina, três atores distintos, IDs emitidos, discovery e contexto original. Usa selectSfProfile da Sessão 1 e todas as navegações dos seis helpers passam por chapterURL absoluto com o triplet server/project/installation real. Query year/version permanece. Nenhuma configuração, grant, cookie, session, storage ou credencial é sintetizada.

## Evidência anterior e limites

- [Operations8 run44625548030](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44625548030), snapshot `e30d34135eb42381621039dd0afbc797bb30b3eb`: **1 passed / 4 failed**. OP-PROC-01 passou; PR/approval200 avançaram; sourcing parou antes do POST; Supplier create200 passou e upload não saiu; Imports perdeu o corpo POSTVersions200.
- O snapshot Operations8 registra apenas files.export.members em `packages/client/src/sucafina/bindings.ts:98–107`. Files.asset.upload ausente no catálogo instalado é causa concreta da recusa pré-rede; o PR#393 é a dependência original, não duplicada aqui.
- `runtime/application.ts:367–371` responde somente ok/warnings para sucesso. A antiga expectativa de created.body.value como ID de versão nunca correspondeu ao contrato. A prova agora exige diferença exata de IDs no GET CAP23, linha e editor originais; nenhuma identidade é derivada do payload enviado. Esse arquivo foi somente lido.
- Os deltas foram revisados por diff contra a base. **Nenhum typecheck ou cenário novo foi declarado PASS**; a validação executável é exclusivamente Actions.
- Run, artefato e digest deste candidato: **ainda inexistentes**. Nenhum baseline/coverage/hash de aceite foi alterado.

## Dependências da composição e conflitos

A raiz deve compor o candidato congelado antes de disparar o gate:

1. **Files #393**: `packages/client/src/sucafina/bindings.ts` blob `dcf4229af5745da305906a2c1f7ce42427fd62bd`, na PR head `d8938c31cd818648cfc78828eb32bcb68c04165e`. Não duplicar o registro dos codecs.
2. **Sessão 1**: host `wp04/host.ts` de `82c3047754cb5ca9b04a5ccdb22c9d0c510295c4` (WebUi real4174 e IDs no manifest); helper `native/select-profile.ts` de `1a8b2b1cc249d38f35a126c45d414f9dbdc93127`. O helper de perfil não existe na base isolada deste WP.
3. **Sessão 1, código ativo**: preservar Requests/page com snapshot/números, os reparos de Settings, C02 source ref/digest, request selector e demais deltas da branch sf-ui-c02. Sourcing/index e Suppliers/index têm mudanças aditivas dos dois WPs; **reconciliar os diffs, não substituir esses arquivos pelo blob inteiro de nenhum lado**.
4. **Configuração compartilhada**: a raiz seleciona Operations sozinho com e2e/playwright.production.config.ts, host wp04, bundle real, ClamD real e `SF_OPERATIONS_CLAMD_PORT`. Não passar PLAYWRIGHT_BASE_URL pelo request nem ampliar a allowlist. As URLs absolutas vêm do manifest. Não reutilizar matrículas entre WP04 e Operations em um mesmo gate.
5. **Artefatos autenticados**: configuração de integração deve impedir trace/video com enrollment/credenciais. Este WP não lê password de Daemon nem altera a configuração compartilhada.
6. `operations-support/installation.ts`, C12, suites.json, runtime/application.ts e paths reservados de Requests/WP04 não foram editados por este WP. Preservar as correções de C12 já presentes em f7dd58.

## Mapa de blobs

### Produção

| Path | Blob |
| --- | --- |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-u14.ts` | `1b5575458e1a521a3114a4b5dcfa0fff580e42e7` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx` | `f50d3c00f5b87204ee7a9870d77c50d4415b4054` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/sourcing/model.ts` | `2007f544e5f77e5ccf6439589808a7b1a1bacce2` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx` | `20c8c5d00058387c2590b57e8c58870dd69f0417` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/model.ts` | `6536b7cf8bcb72b09a87a922f0168d38a9098017` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/attachments/bound-assets.tsx` | `fcd382816615d1aeaf67585805903863fadb7e58` |

### Helpers

| Path | Blob |
| --- | --- |
| `packages/app-shell/e2e/sucafina/operations-support/documents.ts` | `40ecc44afc88201345dfbb342b1fc61ef9cb7b6c` |
| `packages/app-shell/e2e/sucafina/operations-support/imports.ts` | `9f50ba7e0386d10acd37d8ac7bf703b333be47ba` |
| `packages/app-shell/e2e/sucafina/operations-support/procurement-comparison.ts` | `fd6e1237736ce05dc2e70740d61b96dbad262998` |
| `packages/app-shell/e2e/sucafina/operations-support/procurement-refusal.ts` | `56cd9d2fde5d234b00879434b668051b7f586169` |
| `packages/app-shell/e2e/sucafina/operations-support/procurement-snapshot.ts` | `1ffe483fc7ba069f919f8cc278267feb5db99e72` |
| `packages/app-shell/e2e/sucafina/operations-support/procurement.ts` | `92a104398875e82a09a46b1e86016cbd783f6939` |
| `packages/app-shell/e2e/sucafina/operations-support/runtime.ts` | `c078bb8864cf4138557ae2e88f86e93b3bea4a4a` |

## Gate solicitado à raiz

**Uma execução** de `e2e/sucafina/operations.spec.ts` no snapshot já reconciliado, com os cinco cenários originais e ClamD real. Sem grep parcial, skip, timeout aumentado, retry ou enfraquecimento de asserção.

Este WP não agenda nem dispara o gate. Se houver falha, guardar a primeira asserção file:line e o boundary original; corrigir a causa antes de outro gate. Não repetir o mesmo gate sem mudança de código.

## O que permanece aberto / unbound

- Qualificação Actions da composição: pendente, portanto estado ainda não complete.
- Conflitos aditivos de Sourcing/Suppliers com sf-ui-c02: responsabilidade da integração.
- Histórico ainda não requalificado: `operations.spec.ts:18`, `:23`, `:28`, `:33` (quatro cenários Operations8); esses pontos descrevem a evidência anterior, não uma execução deste SHA.
- O comportamento posterior a upload/import deve ser aceito pelo gate completo, sem substituir artefatos, APIs ou permissões.

## Como retomar

1. Compor os blobs e dependências acima, resolvendo os dois paths sobrepostos com a Sessão 1.
2. Congelar o SHA do snapshot e executar o único gate Operations completo autorizado pela raiz.
3. Registrar run id, jobs, primeira falha file:line ou 5/5, artefatos e SHA real. Atualizar este handoff para complete somente após sucesso correspondente.
4. A raiz continua com ordem de merges, guards, sf-ci único final, baseline real e pacote. Este WP não emite GO, deploy ou SF_ORCHESTRA_WEB_PACKAGE_VERIFIED.
