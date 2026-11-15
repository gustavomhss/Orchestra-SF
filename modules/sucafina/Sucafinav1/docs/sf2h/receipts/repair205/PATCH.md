# Missão 205 — patch completo, inerte para o consumidor 189

**Source:** `sf-thread-newlines` commit `26fca4e3a4f5fad0e83f853a0c0acb386b96bda3`; tree `2084b75e903cb3e6ee5dbc6392747a1956655c2a`. **Consumer observado:** `sf2-stack` HEAD `6130f682014662964a2f2fcd2c0c487a904ecd3e`; tree `6bef2964c3904aef5b92017c6e0e1aaa2d236a25`.

| Path | Blob PRE no consumidor | Blob POST a consumir |
| --- | --- | --- |
| `packages/app-shell/src/orchestra/chapters/sucafina/collaboration/index.tsx` | `b528b13c89ee5f66c398e0c7fc2b6cf1aa996639` | `619402f411f6592cc7bfdcd9d2d97a834d36c26c` |
| `packages/app-shell/test-browser/sucafina-native/s05.test.ts` | `5d02157e04299a299cd3c4fada3dd19913a59598` | `313372865426a047cc500d1dba891a75cb8fa047` |

## Diff integral — código + negativas

```diff
@@ -253,12 +253,14 @@ export function SfThread(props: SfThreadProps) {
   const copy = useCopy()
   const uid = createUniqueId()
   let draftInput: HTMLTextAreaElement | undefined
+  // HTML textarea DOM values use LF. Keep props.draft raw for the owner and POST.
+  const domDraft = () => props.draft.replace(/\r\n?/g, "\n")
   // A controlled textarea can still hold native keystrokes when the owner has not
   // accepted them. Reconcile the DOM on *state* changes as well as draft changes:
   // outcome-unknown/unavailable retain the exact owner draft without replaying POST.
   createEffect(() => {
     const state = props.state
-    const draft = props.draft
+    const draft = domDraft()
     if (!draftInput) return
     const next = mayDisplay(state) ? draft : ""
     if (draftInput.value !== next) draftInput.value = next
@@ -329,7 +331,7 @@ export function SfThread(props: SfThreadProps) {
         <form class="sf-collab-form" onSubmit={(event) => { event.preventDefault(); post() }}>
           <label class="sf-collab-field" for={uid + "-draft"}>
             <span>{copy.key("sf.s05.thread.compose")}</span>
-            <textarea id={uid + "-draft"} rows={4} ref={draftInput} value={props.draft}
+            <textarea id={uid + "-draft"} rows={4} ref={draftInput} value={domDraft()}
               disabled={!mayEdit(props.state)} onInput={(event) => props.onEditDraft(event.currentTarget.value)} />
           </label>
           <button class="mx-btn primary sf-collab-primary" type="submit" disabled={!canPost()}>
@@ -168,6 +168,8 @@ test("S05 thread preserves exact content, incarnation and version; unknown outco
     view.set("state", "ready")
     expect(view.host.textContent).not.toContain("Private discussion body")
     expect(view.host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("  Next owner\nstill exact  ")
+    expect(edits).toEqual(["new comment"]) // changing owner cannot synthesize an edit
+    expect(posts).toHaveLength(1) // changing owner cannot replay a POST
     view.button("Post comment").click()
     expect(posts).toEqual([
       { threadRef: ref("thread-1"), incarnation: "incarnation-canonical", expectedVersion: 7, text: "  Keep whitespace  " },
```

## Diff integral — assertions em bytes

```diff
@@ -167,7 +167,12 @@ test("S05 thread preserves exact content, incarnation and version; unknown outco
     view.set("draft", "  Next owner\r\nstill exact  ")
     view.set("state", "ready")
     expect(view.host.textContent).not.toContain("Private discussion body")
-    expect(view.host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("  Next owner\nstill exact  ")
+    const ownerDisplay = view.host.querySelector<HTMLTextAreaElement>("textarea")!.value
+    // Byte-level assertion distinguishes LF (0a) from hidden CRLF (0d 0a) in Bun diffs.
+    expect([...new TextEncoder().encode(ownerDisplay)]).toEqual([
+      ...new TextEncoder().encode("  Next owner\nstill exact  "),
+    ])
+    expect(ownerDisplay).toBe("  Next owner\nstill exact  ")
     expect(edits).toEqual(["new comment"]) // changing owner cannot synthesize an edit
     expect(posts).toHaveLength(1) // changing owner cannot replay a POST
     view.button("Post comment").click()
@@ -176,6 +181,9 @@ test("S05 thread preserves exact content, incarnation and version; unknown outco
       { threadRef: ref("thread-next"), incarnation: "incarnation-next", expectedVersion: 9,
         text: "  Next owner\r\nstill exact  " },
     ])
+    expect([...new TextEncoder().encode(posts[1]!.text)]).toEqual([
+      ...new TextEncoder().encode("  Next owner\r\nstill exact  "),
+    ])
   } finally {
     view.close()
   }
```

Os dois diffs compõem exatamente os dois POST blobs acima. Aplicar apenas por preimage SHA e HEAD CAS no branch de 189, sem merge do histórico de origem. Se divergir, reconciliar o delta sem sobrescrita.

## Bytes identificáveis da fixture

- Raw do owner/POST: `"  Next owner\r\nstill exact  "`; bytes ASCII/UTF-8 `20 20 4e 65 78 74 20 6f 77 6e 65 72 0d 0a 73 74 69 6c 6c 20 65 78 61 63 74 20 20` (27).
- DOM esperado: `"  Next owner\nstill exact  "`; bytes ASCII/UTF-8 `20 20 4e 65 78 74 20 6f 77 6e 65 72 0a 73 74 69 6c 6c 20 65 78 61 63 74 20 20` (26).
- A saída antiga do Bun não publicou os **bytes Received**; exibia duas strings visualmente iguais e zero linhas diferentes. Não se alega medição ausente. A assertion nova verifica os bytes de ambas as fronteiras na futura execução hospedada.

Não foram executados testes, typecheck, build, validators ou CI nesta sessão. Os requests condicionais estão em VALIDATION-REQUESTS.json.
