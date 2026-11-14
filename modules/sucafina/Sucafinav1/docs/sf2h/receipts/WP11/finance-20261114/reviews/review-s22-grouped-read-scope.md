# Revisão independente — admissão agrupada de renovação

**PASS estático delimitado; desempenho e consumidores exigem Actions no novo W/S.**
108/108 verificações de conteúdo, imports e hashes passaram. Nenhum blocker encontrado.

Base: W32 `79531aefa2bf72a9d13deba5164f725ec7da0e0f`, tree `485a3ac2ac1322d03d7421a17eb1791153f11c1b`.

| Path em test/product/wp11 | Blob anterior | Blob candidato |
| --- | --- | --- |
| `renewal-case-read-scope.test.ts` | `novo` | `75a2cbcd0c3907fc2d14f18f2b35f131331ecfb2` |
| `renewal-choice-fixture.ts` | `9514f80dc7e8dbb9c8acf1822bbd4f1ea067c0e1` | `2da82bf379910826f4558b5b330c97cdaf6806df` |
| `renewal-human-choice-fixture.ts` | `18d95b84d01b26048af9a442c44cb32e8f14e9f5` | `3bbcabb4272ba2d083aa39b03142498178e95193` |
| `renewal-operation-verifier.ts` | `f85c1c8e7196aff1381513b2d5ed2109641d6a45` | `df3c335c95bf9d8d06d00474ff0bc391dd852b4e` |

## Semântica e consumidores

- Each CasePort source-admission invocation opens a new LocalStore read-only transaction. Its alternatives share one consistent snapshot; this is distinct from two independently mutable top-level observations inside that scope.
- Every original parser, canonical operation verifier, projection, authority and source check still executes. Every Promise sibling settles before the grouped scope closes.
- Nested writes poison the LocalStore root even if their callback catches the rejection; the group returns false and rolls back. The new test requires a valid canonical command, refused durable commit and unchanged snapshots across every surface.
- The final asynchronous authority callback is inside the protected snapshot. Only signal/request identity/binding digest checks occur afterward. No cross-invocation result, source or authority cache.
- Production CasePort is unchanged. It separately reads the case before and after its first verification, verifies again, then checks host authority. This review does not extend its global race qualification.
- Both the current-source history fixture and the separate human-choice fixture now consume the grouped factory through real CasePort callbacks. Financial calculations, C10 rules, persistence/replay and old tests are unchanged.
- The standalone per-scenario verifier function is byte-identical. Its seven top-level source/authority race cases remain intact. S22 passes do not qualify the new grouped factory.

## Produto e desempenho

S22 terminou com 14 passes e dois históricos além do limite de 180000 ms. O novo wrapper não muda esse limite nem qualquer teste anterior. Acrescenta quatro testes, com 19 assertions autoradas: nenhum write, nested write com comando válido recusado e rollback integral, source-CAS entre invocações e revogação de autoridade.

O perfil está em `profile-comparison.json`. A medida antiga de source-only excluía a abertura da transação; a nova inclui suas observações. Os contadores também se sobrepõem. Não se atribui ganho isolado por subtração desses tempos.

## Seleção afetada

- `test/product/wp11/renewal-case-read-scope.test.ts`
- `test/product/wp11/renewal-source-admission.test.ts`
- `test/product/wp11/renewal-read-scope.test.ts`
- `test/product/wp11/renewal-choice-history.test.ts`
- `test/product/wp11/renewal-choice-revision.test.ts`
- `test/product/wp11/implementation-quote-history.test.ts`
- `test/product/wp05/choice-history-bi.test.ts`

Nenhum teste, import executável de produto, Bun, typecheck, guard ou mutação remota foi executado nesta revisão. As três versões anteriores foram lidas via GitHub MCP no W32 fixo; os quatro arquivos aplicados pelo root conferem exatamente com a proposta. Provas instaladas/nativas, C/D e aceite integral permanecem abertos.
