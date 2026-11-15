# W09 / S04 — handoff de pré-admissão (material inerte)

**Estado:** BLOCKED_OWNER / NOT_ARTIFACT_READY / NOT_INTEGRATED / NOT_QUALIFIED. **Não é entrega de produto.** GPT-6, rótulo solicitado "Astra"; session ID não exposto. Epoch reservado `ux-native-w09-e1`, **não ativo**. Base inicial `f8e442616c96651f3b26013b34b8ce697860e3e2` / tree `39fd91edd2a452097dc333cd2098d326ac87b1e0`; material C58 `422f1ed7b549021d7c62c834c9d9041279112af4`. Integrador único: 114/C00, PR #65.

[ACK](./ACK.json) · [manifesto de sete fontes preparadas e blobs reais](./STAGED-MANIFEST.json) · [patch de i18n compartilhado apenas para114](./SHARED-I18N-114.patch.txt) · [solicitação à114](https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6896744956).

## Escopo S04 conferido

Dois entrypoints exatos: `SfEvidencePanel` e `SfAttachmentField`. Contratos `COMPONENT-CONTRACTS.md@5e53813`, `component-signatures.ts@e283b20`, `component-locks.json@818728d` (`ui-evidence/ui-frame`), `contract-catalog.json@31dbec1` (`files`), `SURFACE-SPECS.md@d62847a`, work order `S04.json@be40396`, packet `W09.json@fce5b46`. O `EXECUTION-PROTOCOL.md` local difere do normativo em **duas linhas** com 105/101/45 antigos; a COMMON da coorte e overlay vigente exigem 114/120/119. Sem outro drift de assinatura S04 observado.

Produtores lidos, não alterados: `runtime/application.ts@a0deff8`, `runtime/assets.ts@11f6dd1`, `product/interface/document-http.ts@8f679de`, `apps/desktop/src/main/response-download.ts@cd869d3`. Fluxo existente autentica actor/role na transação, valida versão de registro, verifica limite e scanner, admite bytes em storage privado; asset-link assinado expira e download revalida acesso. **Nada disso é implementado ou inferido no componente de apresentação.** A06/W18 é a fonte real de bindings, F03/W04 do frame, F01 dos refs e tipos. Até integração desses produtores, prova instalada é impossível, embora autoria independente dos componentes seja determinável pelo contrato congelado após GO.

## Material remoto preparado, ainda fora do build de produto

Arquivos abaixo estão **somente em `receipts/native-ui/W09/staged/` e têm extensão `.txt`**. Não compõem a UI, não substituem produtores nem autorizam import compartilhado:

| Proposta de destino após GO | Fonte preparada |
| --- | --- |
| `shared/evidence/types.ts` | [types.ts.txt](./staged/types.ts.txt) |
| `shared/evidence/index.tsx` | [evidence.index.tsx.txt](./staged/evidence.index.tsx.txt) |
| `shared/evidence/s04.css` | [s04.css.txt](./staged/s04.css.txt) |
| `shared/attachments/guards.ts` | [guards.ts.txt](./staged/guards.ts.txt) |
| `shared/attachments/index.tsx` | [attachments.index.tsx.txt](./staged/attachments.index.tsx.txt) |
| `i18n/orchestra-chapters/sf-s04.ts` | [sf-s04.ts.txt](./staged/sf-s04.ts.txt) |
| `test-browser/sucafina-native/s04.test.ts` | [s04.test.ts.txt](./staged/s04.test.ts.txt) |

As fontes são rascunhos tipados para revisão **sem TSGo, build, DOM, compiler ou testes executados**. Na promoção, reconcile tipos comuns F01/F03 contra os exports reais (o subconjunto S04 em `types.ts` é **estrutural, não novo Schema público**), callbacks exatos e os imports após resolução da coorte. Não alegar compilação ou paridade instalada sem 119/120.

### Invariantes que precisam ser preservados

- `evidenceRef` candidata ou excerpt textual **não** é confirmação persistida; manter sourceRef e sourceVersion originais e distinguir confirmed, stale, unavailable e revoked.
- Estados `denied/session-expired/unavailable` não renderizam projeção privada antiga; fonte revogada não expõe título/trecho, nem recebe ação.
- `onOpenAuthorizedSource(sourceRef)` é pedido de abertura ao host que reautoriza, **não href arbitrário**.
- Seleção local de arquivo **não** é admissão. Somente `admissionState.kind=admitted` entregue pelo produtor significa admitido. `scanner-unavailable` e `blocked` são recusas distintas; não repetir envio automaticamente após perda de resposta.
- Download e remoção somente para referência admitida com capability explícita. Repassar `recordRef + recordVersion + attachmentRef` intactos a A06; não construir link assinado, manipular blob ou inventar scanner no front-end.
- Copy folha EN/PT-BR `SF_S04_COPY` / `SF_S04_COPY_BR` usa estilo Mx Orchestra. A inclusão em `src/i18n/orchestra.ts` é patch de **114**, preimage `2eeaa42e02a45b3301fc765c6c92635af5101079`; revalidar contra o HEAD do integrador antes de aplicar.

## O que bloqueia e qual é o próximo movimento

1. **114/S0** registra por output GO/lease real `ux-native-w09-e1` (ou impedimento causal). ACK e comentário não equivalem a GO. Não inferir aprovação pelo silêncio ou por branch de outro worker.
2. Com GO verificado, W09 confirma HEAD e blobs da família, publica nova autoridade/recibo, promove **somente** os sete arquivos para seus destinos na allowlist via GitHub MCP/CAS, fazendo correções de tipagem sem inventar produtor.
3. Entrega a 114 patch shared com pre/postimages atualizados, manifesto de exports, relação F03/A06 e pedido de composição. Nenhum generated/generated-effect manual.
4. **120** é único executor de seleção Actions para testes de produto; **119** compiler/guards. A seleção proposta `packages/app-shell/test-browser/sucafina-native/s04.test.ts` é guarda isolada, **não** prova de scanner, permissões reais, downloads, wiring F03/A06 ou e2e.
5. Depois de produto publicado, criar/atualizar PR para `sf2-stack`, handoff com pre/post, CI IDs/observações reais. Sem merge, deploy, Azure ou testes locais.

## Evidência observada nesta sessão

ACK remoto, sete blobs de material inerte, patch shared inerte, manifesto, fonte C58 e digests congelados. **Zero edits em paths de produto, zero Actions, zero build, zero approval de 114, zero app instalada.** Não marcar S04-AC01/02 como PASS, nem declarar fonte, scanner, ACL e download reais demonstrados. `GLOBAL_RELEASE=false`.
