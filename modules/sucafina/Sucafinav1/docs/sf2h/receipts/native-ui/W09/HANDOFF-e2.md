# W09/S04 — handoff terminal e2 para 114, 120 e 119

**Estado:** `ARTIFACT_READY` (S04 autoria exclusiva publicada) / **NOT_INTEGRATED** / **NOT_QUALIFIED** / `GLOBAL_RELEASE=false`.
**Autor real:** GPT-6 (rótulo Astra solicitado), runtime session ID não exposto; Github `gustavomhss`. **Epoch ativo no aceite:** `ux-native-w09-e2`; `ux-native-w09-e1` revogado para novas entregas pelo fence S0. O ACK real é [ACK-e2.json](./ACK-e2.json), commit `b3857e3be552938ad3924b5773ec4ef5712ef3b6`. Nenhuma terminação de processo/chat e1 foi alegada.

## Entrega imutável

- Branch existente: `sf-ux-w09`, PR #118 **draft**; HEAD de entrada `296a851f4fbe54660cad5d0c24a0bda8cba5a02c`, casamento exato com fence; sucessor ACK commit `b3857e3`.
- **Produto:** `28bb783ae0568148217286be6130d9ff49b6cf0b`, tree `d06fa3e0ab8a3bbdfdd4b4d9c542c6dcddc36b35`. [Manifesto completo de pre/post blobs](./ARTIFACT-MANIFEST-e2.json). [Patch integral de produto, somente oito novos arquivos](./PRODUCT-e2.patch). Todos os preimages eram ausentes na árvore de entrada; nenhum source anterior foi resetado/reescrito.
- Sete fontes preparadas no [STAGED-MANIFEST.json](./STAGED-MANIFEST.json) foram materializadas com correções de segurança/tipos. Acrescentado `shared/evidence/guards.ts` na mesma allowlist.
- Exports exatos: `SfEvidencePanel(props: SfEvidencePanelProps): JSX.Element` e `SfAttachmentField(props: SfAttachmentFieldProps): JSX.Element`. Tipos auxiliares `SfEvidence`, `SfAttachment`, `SfFileAdmission`, props exportados dos entrypoints; os opaque refs/`SfVersion` usam o pacote Schema F01 congelado.
- Arquivos: `shared/evidence/{index.tsx,types.ts,guards.ts,s04.css}`, `shared/attachments/{index.tsx,guards.ts}`, `src/i18n/orchestra-chapters/sf-s04.ts` e `test-browser/sucafina-native/s04.test.ts`.

## Semântica implementada (fronteira visual, não produtor)

1. Evidência: candidate/confirmed/stale continuam distintos; sourceRef/sourceVersion/coverage intactos; seleção e abertura só por callbacks opacos ao host. Nenhum `href` arbitrário, bytes, HTML executável, fetch, scanner ou auth no componente. `denied`, `session-expired`, `unavailable`, `invalid`, `not-found`, `loading`, `outcome-unknown`, `stale/conflict` global, além de `revoked/unavailable` no item, ocultam conteúdo privado; texto de fonte é renderizado como texto.
2. Anexo: seleção de arquivo não é admissão; `selected` só permite `onAdmit` mediante formato/tamanho/contagem, nunca a presume. `scanner-unavailable` é recusa, separada de `blocked`, `failed` e `admitted`. Remoção/download só exibidos para `status=admitted` e flags explícitas, com `recordRef + recordVersion + attachmentRef` entregues intactos ao consumidor A06.
3. Perda de resposta: o mesmo `selectionRef` despachado permanece travado apesar das trocas de fase; remoção trava por tupla attachmentRef/version+recordRef/version para não repetir mutação ambígua. Acessibilidade com status/alerts/controles; locale e precisão da fonte na apresentação numérica, responsive com tokens Mx.
4. Fonte original: `application.ts`, `assets.ts`, `document-http.ts`, `response-download.ts` rechecados na branch W09 e `sf2-stack`, **blobs idênticos** listados no manifesto. Nenhum serviço/cópia privada/Schema permissivo foi criado.

## Composição **só 114** (patch compartilhado NÃO APLICADO)

- [SHARED-I18N-114-e2.patch.txt](./SHARED-I18N-114-e2.patch.txt) é patch integral e exclusivo de `packages/app-shell/src/i18n/orchestra.ts`. **Preimage atual em `sf2-stack` conferido:** `2eeaa42e02a45b3301fc765c6c92635af5101079`. Integrador deve revalidar antes de aplicar e compor com os demais workers; W09 não escreveu o registry.
- Importar `SF_S04_COPY/SF_S04_COPY_BR` de `./orchestra-chapters/sf-s04` e espalhar em `ORCHESTRA_COPY/ORCHESTRA_COPY_BR`. `sf.common.*` depende da tabela comum congelada em surface-manifest COPY-01 (também de composição114). As duas chaves S04 adicionais `admissionPending/referenceRemovalPending` já constam na folha.
- Consumidores F03/I00 importam somente os exports de `@/orchestra/chapters/sucafina/shared/evidence` e `.../shared/attachments`; recebem DTOs autorizados. `onOpenAuthorizedSource` deve chamar a leitura/abertura A06 real e reautorizar; o host deve purgar refs e seleção em troca/revogação de owner. Sem clique implícito, fallback local de ACL ou duplicação de bytes.
- F01/W02 possui `packages/schema/src/sucafina/context.ts` na sua branch de autor, mas esse arquivo **não está presente na árvore isolada W09**. F03/W04 e A06/W18 também não foram compostos no candidato único. Isso é bloqueio de integração/compilação isolada, não autorização para substituir o produtor.
- A PR #118 carrega documentos de coorte herdados no compare com `sf2-stack`. **Não fazer merge bruto da PR**: importar os oito leaves de produto W09 e patches exatos liberados, preservando a base e escritores atuais.

## Solicitações de qualificação

**120 (único dispatcher Actions):** depois da composição coerente e admissão F01/F03/A06 pela 114, selecionar cirurgicamente `packages/app-shell/test-browser/sucafina-native/s04.test.ts`; cinco testes puros de guarda (candidate/confirmed/revoked/denied/selection vs admitted/formatos-limites/flags). Deduplicar por árvore, seleção, runtime/config/fixtures e registrar W/S/run/job/attempt. Esse teste isolado **não prova** scanner, ACL, abertura/download real, desktop ou fluxos instalados; essas provas continuam pendentes. **Status:** `NOT_RUN`.

**119 (compiler/guards):** sobre a mesma composição coerente, `bun typecheck` em `packages/app-shell`, guards homologados, tipos F01/ref e i18n tipada; registrar diagnósticos e devolver a W09 os que forem de seus oito paths. Sem testes/validators/parser/typecheck locais por W09, sem geração manual/SDK editado. **Status:** `NOT_RUN`.

**S04-AC01/02:** fronteiras implementadas por código, mas nenhum PASS de integração/qualificação foi reivindicado. Escaneamento/admissão/download/ACL reais = `NOT_PROVEN`. Nenhum receipt sintético, nenhum merge, deploy, Azure, restart nem Goal reativada.

**Terminal e2:** autoria encerrada em `ARTIFACT_READY`; slot de escrita S04 pode ser liberado após handoff explícito a 114. Novos edits exigem nova autoridade/fence compatível. `GLOBAL_RELEASE=false`.
