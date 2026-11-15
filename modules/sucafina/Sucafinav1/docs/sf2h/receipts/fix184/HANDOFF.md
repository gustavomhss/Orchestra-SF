# Missão 184 — S05 controlled thread draft: handoff para 162, 163 e 164

**Epoch:** \`native-fix-e1-browser184\` · **branch autora:** \`sf-ux-w10\` · **PR:** [#119](https://github.com/gustavomhss/Orchestra-SF/pull/119) (draft). **Modelo real:** GPT-6; Astra solicitado, não alegado; sessionID não exposto. **Autoridade original:** HEAD \`fd69ed12f556470dfbc1ff4d9096ccf3d04ef8c7\` / tree \`c72dda1e682ed698533730f5e4920351aebad889\`; fence do predecessor respeitado. ACK efetivo \`756919ab72214b29882ccecb13bd83ce4256c1a9\` (blob \`ae552dd337e461b55b1099f2c92e69e7a008d07b\`). Nenhuma branch nova, reset, force ou escrita externa ao allowlist.

## Falha real, causa e correção

GitHub Actions [browser164 run43766970018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766970018), job132974180913, material W \`6d42d6752497fc37be59c64a72b272a3d0860961\`: \`s05.test.ts:156\` recebe \`"new comment"\` de \`textarea.value\`, embora a prop controlada da origem ainda seja \`"  Keep whitespace  "\`, depois de \`outcome-unknown → Check original outcome → unavailable\`. S05 tinha 4 PASS / 1 FAIL. O callback \`onEditDraft\` na fixture coleta o texto de input, mas deliberadamente **não altera** \`props.draft\`. O próprio elemento HTML recebeu as teclas e a ligação \`value={props.draft}\` em Solid não reaplica o valor se só o \`state\` muda. Não é falha de trim, de schema, de versão ou de POST.

Ajuste **no componente puro S05**, sem nova store: \`createEffect\` observa \`props.state\` e \`props.draft\`; sincroniza \`draftInput.value\` com o texto controlado **byte-for-byte** quando a UI pode exibir conteúdo e limpa o DOM quando o acesso nega a exibição. Mantém o \`onInput\` delegado ao owner, o \`onPost\` com \`props.draft\` integral (sem trim, transformação ou replay), e o \`postFence\` original por \`threadRef + incarnation + version\`. \`onReconcileRead\` é **somente leitura**. O consumidor U44 já invalida \`projection/storageVersion/draft/pending\` nos seus transitions \`ownerKey/accessRevision/generation/ref\`, com requisições abortadas e stale responses recusadas; S05 não cria cache/owner paralelo.

O teste conserva rigorosamente \`toBe("  Keep whitespace  ")\` no estado unavailable, a exclusão de dados privados ao negar acesso e os quatro casos demais. Dentro do caso S05 existente acrescenta troca de \`threadRef\`, \`incarnation\`, \`version\`, mensagens e draft, confirmando que o novo owner não mostra conteúdo anterior nem herda o fence anterior. Verifica \`textarea.value\` com CRLF normalizado a LF pelo DOM mas \`onPost.text\` com o CRLF original, mais espaços de borda. **Não foi executado**; isto é cobertura escrita para Actions, não prova de PASS.

## Fonte autora: hashes verificáveis

| Path | Preimage da autora | Postimage exato |
| --- | --- | --- |
| \`packages/app-shell/src/orchestra/chapters/sucafina/collaboration/index.tsx\` | \`3127ace8fc21958b3e434fea6e8e8d08b917cc4e\` | \`b528b13c89ee5f66c398e0c7fc2b6cf1aa996639\` |
| \`packages/app-shell/test-browser/sucafina-native/s05.test.ts\` | \`912d5f7cdee87a310cffb2b6baf794497ebdc182\` | \`5d02157e04299a299cd3c4fada3dd19913a59598\` |

ACK commit/tree \`756919ab72214b29882ccecb13bd83ce4256c1a9\` / \`bab8445ec69faf5c2c7af8d6390227e8f3f37797\`. Source/test first commit/tree \`779b887ff66b3a22d27153548fc7d50f0312ea5d\` / \`6fae0e10d8d8823228bbc78f80d643c00e18c3a2\`. CRLF-literal correction commit/tree \`ee13ca9c8f86b69e2cab60734ea8947cbf241fb8\` / \`8d6488459206443dae58bc7d278d711ade15c02b\`. Todos por GitHub Git objects + \`update_ref(expected_sha,force=false)\`; nenhum push/gh/exec local.

## Consumidor 162: preimage/postimage e patch **inerte**

Na leitura atual do único consumidor \`sf2-stack\`, pre-HEAD \`8a81e11df2bf78a55de3166e07a53ee366aad2ab\`, pre-tree \`5cee64807f55d0ec169801795712844051c47e16\`:
- S05 source blob atual \`3127ace8fc21958b3e434fea6e8e8d08b917cc4e\` → **aplicar** \`b528b13c89ee5f66c398e0c7fc2b6cf1aa996639\`.
- Teste S05 **pós-fixture140** blob atual \`f7d032d5fdded022f40270727035577ae08228db\` → **aplicar** \`5d02157e04299a299cd3c4fada3dd19913a59598\`.
- \`platform-fixture.ts\` real blob \`72bc7ed9ca0e5a3a295d99c6b147daf8f0aaae15\`; **não alterar**. \`collaboration-pages/threads/index.tsx\` U44 blob \`a7aa673097db18283fe9384d5091617154a40dd0\`; **não alterar**. A versão do teste produzida agora preserva exatamente \`withBrowserPlatform\` e imports do C executado, ao contrário da fixture autoral antiga.
- Consumidor **ainda não aplicou** estes deltas nesta leitura; consumer post-commit/tree dependem da ação CAS de 162 e não foram inventados. Não fazer merge integral da PR#119 (sua ancestralidade carrega paths fora da entrega). Se qualquer preimage divergir, reconciliar o delta à versão observada antes de gravar.

**Patch completo de fonte e teste para a preimage do consumidor:**

\`\`\`diff
diff --git a/packages/app-shell/src/orchestra/chapters/sucafina/collaboration/index.tsx b/packages/app-shell/src/orchestra/chapters/sucafina/collaboration/index.tsx
--- a/packages/app-shell/src/orchestra/chapters/sucafina/collaboration/index.tsx
+++ b/packages/app-shell/src/orchestra/chapters/sucafina/collaboration/index.tsx
@@ -252,7 +252,18 @@
 export function SfThread(props: SfThreadProps) {
   const copy = useCopy()
   const uid = createUniqueId()
+  let draftInput: HTMLTextAreaElement | undefined
+  // A controlled textarea can still hold native keystrokes when the owner has not
+  // accepted them. Reconcile the DOM on *state* changes as well as draft changes:
+  // outcome-unknown/unavailable retain the exact owner draft without replaying POST.
+  createEffect(() => {
+    const state = props.state
+    const draft = props.draft
+    if (!draftInput) return
+    const next = mayDisplay(state) ? draft : ""
+    if (draftInput.value !== next) draftInput.value = next
+  })
   const [postFence, setPostFence] = createSignal<{ threadRef: string; incarnation: string; version: number }>()
   const locked = () => {
     const fence = postFence()
@@ -318,8 +329,8 @@
         <form class="sf-collab-form" onSubmit={(event) => { event.preventDefault(); post() }}>
           <label class="sf-collab-field" for={uid + "-draft"}>
             <span>{copy.key("sf.s05.thread.compose")}</span>
-            <textarea id={uid + "-draft"} rows={4} value={props.draft}
+            <textarea id={uid + "-draft"} rows={4} ref={draftInput} value={props.draft}
               disabled={!mayEdit(props.state)} onInput={(event) => props.onEditDraft(event.currentTarget.value)} />
           </label>
           <button class="mx-btn primary sf-collab-primary" type="submit" disabled={!canPost()}>
             {copy.key("sf.ui52.primary")}
diff --git a/packages/app-shell/test-browser/sucafina-native/s05.test.ts b/packages/app-shell/test-browser/sucafina-native/s05.test.ts
--- a/packages/app-shell/test-browser/sucafina-native/s05.test.ts
+++ b/packages/app-shell/test-browser/sucafina-native/s05.test.ts
@@ -157,6 +157,23 @@
     view.set("state", "denied")
     expect(view.host.textContent).not.toContain("Private discussion body")
     expect(view.host.textContent).not.toContain("Keep whitespace")
     expect(view.host.querySelector("textarea")).toBeNull()
+
+    // New owner binding must not inherit the old DOM value or the old post fence.
+    view.set("messages", [])
+    view.set("threadRef", ref("thread-next"))
+    view.set("incarnation", "incarnation-next")
+    view.set("version", 9)
+    view.set("draft", "  Next owner\r\nstill exact  ")
+    view.set("state", "ready")
+    expect(view.host.textContent).not.toContain("Private discussion body")
+    expect(view.host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("  Next owner\nstill exact  ")
+    view.button("Post comment").click()
+    expect(posts).toEqual([
+      { threadRef: ref("thread-1"), incarnation: "incarnation-canonical", expectedVersion: 7, text: "  Keep whitespace  " },
+      { threadRef: ref("thread-next"), incarnation: "incarnation-next", expectedVersion: 9,
+        text: "  Next owner\r\nstill exact  " },
+    ])
   } finally {
     view.close()
\`\`\`

## Critérios, contratos e qualificação

S05-AC01 e S05-AC02 têm correção de fonte publicada, **sem PASS hospedado novo**. WP08.T01, WP08.T02, WP08.T03, WP08.T06, UI51/52/53 e a matriz normativa permanecem fechados e inalterados. Component signatures blob \`e283b2021697fb6666e88a13707cb05469540ae0\`; component contracts blob \`5e53813bff5c4f515f9122393e308ad5336b041a\`; S05 workorder \`4c0ac7f6ea42a16c137c1ea361ef0fd3b407b50c\`. Nenhuma nova assinatura pública, schema, string i18n, permissão, fixture/timeout/oracle ou operação de domínio.

- **162 / PR65**: conferir HEAD/preimages no seu C atual, consumir somente dois post-blobs acima por CAS, publicar novo W/tree/consumer ACK real. Não tocar U44/F01/A12, a fixture real, transports nem gerados.
- **163 / PR107 — só depois do ACK 162 com W/tree novo:** seleção causal \`packages/app-shell\` / \`bun typecheck\` e guard canônico \`bun run check:guards --base origin/dev\`, com dedup da seleção W. O run anterior [43766055614](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766055614) falhou por erros de types/schema e guards fora do escopo S05; não reexecutar inputs inalterados nem declarar SDK/guard green pelo resultado antigo.
- **164 / PR106 — só depois do mesmo ACK:** no dispatcher existente \`.github/workflows/test-ci.yml\`, \`package=app\`, \`directory=packages/app-shell\`, \`runner=bun\`, seleção única \`["./test-browser/sucafina-native/s05.test.ts"]\` **com \`./\` obrigatório**, no W novo materialmente alterado. Confirmar 5 testes S05 e o novo ramo de owner+CRLF. Dedup de run43766970018, sem repetir S02 verde ou disparar suite ampla. F03/S01/decisions continuam sob seus donos e requests causais próprios.

**Validação pós-patch:** browser \`NOT_RUN\`; typecheck \`NOT_RUN\`; guards \`NOT_RUN\`; SDK \`NOT_RUN\`; integração 162 \`PENDING\`. Não foram executados testes, parser, validador ou build local nem novo dispatch. **Terminal: ARTIFACT_READY / handoff a 162. Meta nativa pausada, GLOBAL_RELEASE=false.**
