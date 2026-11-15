# Missão72 — handoff terminal para71

**Fonte liberada para intake seletivo: W `22b4e97cfbb22703eeedb34af3b33ba74d323806`, tree `8b36c0ebd5412251c15b33b6cb726fcbedddce45`.** PR draft [84](https://github.com/gustavomhss/Orchestra-SF/pull/84), branch `auth-retention-fix`. Este recibo é documental; os SHAs do commit terminal e de sua árvore ficam fixados no comentário de handoff da PR65. O lease `auth-retention-browser72` termina com essa publicação. 71 continua o único writer de `sf2-stack`; 45 mantém compiler/guards; S0 mantém aceite FINAL.

## Resultado e evidência

M70-AUTH-01 foi reproduzido no produto original: [B0](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43671182262), job `132681354612`, mostrou **1 → 33 linhas** e **221 → 253 bytes** em `authentication_payloads` após 16 logouts contendo 32 handles nunca emitidos. Foi uma falha real na asserção de ausência de crescimento, depois de respostas204 válidas, não uma falha de fixture.

Na correção, [R1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43671466268), job `132682240447`, teve **138 pass / 2 skips herdados / 0 fail**, 1.279 asserções em 140 testes/11 arquivos. **As 24 regressões novas passaram**. Os dois skips de UID estrangeiro já existiam e exigem privilégios root. Runner S `dda8ba9d0624b921d7b206f96c55ea9aa25d4955` é filho único de W e acrescenta somente `.ci-run.json`. Cleanup terminou; nenhuma execução72 permanece em voo.

[CI72.json](CI72.json) conserva W/S/trees, requests, run/jobs, contagens, nonce Omni não aplicável, ausência esperada de artifacts e os logs de testes. [INDEPENDENT-RECHECK72.md](INDEPENDENT-RECHECK72.md) registra a revisão por um não autor dos cinco arquivos de produto e dos24 testes. O achado CR72-01 — liberação indevida da barreira local após timeout de persistência — foi corrigido antes de W e sua regressão passou. Essa revisão não aceita o target composto.

## Comportamento entregue

Há correlação SQLite durável para challenge emitido, callback pendente, login concluído, sessão ativa e revogação. Consumir o challenge remove seu ciphertext e preserva a identidade do callback pendente. Logout de handle desconhecido não admite linha ou entrada no mapa. Logout conhecido instala cancelamento local antes do primeiro await e persiste a revogação sem renovar seu horizonte. Falha de persistência responde503 e conserva a barreira local para retry; não é uma promessa de durabilidade entre processos após um logout que falhou.

Capacidade e transições usam o writer transacional comum às instâncias. A política persistida limita a **4.096 registros lógicos**, **512 challenges emitidos/pendentes**, **32 MiB de payloads**, **64 KiB por payload** e **128 exclusões totais por lote**. A manutenção roda ao abrir a composição e a cada60s, fora de requisições/raízes de negócio, e é drenada antes de fechar o store. Nenhuma sessão válida ou revogação necessária é expulsa para admitir novo login.

A sessão conserva expiração absoluta de até8h. Challenge não consumido vive até10min; o pai consumido fica até a expiração original do challenge mais8h, cobrindo o filho. Os prazos nunca são estendidos por refresh, logout repetido ou GC. Os limites contam também backlog e legados; 4.096 não significa4.096 sessões simultâneas, porque os pais também ocupam registros. AES/AAD, tenant, origin, chave, nonce, PKCE, sujeição do refresh e single-use são preservados.

[RETENTION-DESIGN72.md](RETENTION-DESIGN72.md) especifica os limites e suas consequências. A quota de bytes não é um limite do arquivo SQLite/WAL. A API genérica de segredos usada por callers internos permanece compatível e não ganhou uma quota global; seus bytes/linhas existentes são contados contra novas emissões Microsoft. Atualização com binários antigos ainda em execução não é suportada como prova: não se reconstrói um challenge já consumido e apagado pela versão antiga. Nenhum restart real de serviço ou operação de tenant foi feito.

## Intake concreto por71

1. Releia HEAD/autoridade e todos os preimages. [TARGET-RECONCILIATION72.json](TARGET-RECONCILIATION72.json) observou C32 `3e26a3c2b18b54d891f44adaac76b228a0daf4c0`, tree `87c3d65399a71f4bbf72c8714f7ee02e662b24e7`: LocalStore é post59; os demais preimages auth/composição conferidos ainda são C28.
2. O [patch completo de composição sobre C32](composition/COMPOSED-C32.patch), com [manifesto dos14 arquivos e pre/post hashes](composition/COMPOSED-C32-MANIFEST.json), reúne os cinco produtos, os seis arquivos de teste fonte, os dois casos readonly em um novo arquivo, o ponteiro da fixture e o mapa novo. É uma proposta inerte baseada nos preimages conferidos; reconcilie o target antes de aplicar. A unidade de origem continua documentada em [owned/MANIFEST.json](owned/MANIFEST.json), com pre/post completos e [patch fonte](owned/source-and-tests.patch). Para LocalStore, preserve59 conforme o próximo item; não copie o arquivo integral C28+72 sobre o target.
3. [composition/readonly59/auth-on-readonly59.patch](composition/readonly59/auth-on-readonly59.patch) parte do blob59 `a36440a750d5671a34c3ab41b2af48093af9f7ee` e produz `d9eaac043514141abb2f1f978a6fd2ceaf4040d6`. Os pre/post e hashes estão no [manifesto](composition/readonly59/manifest.json). A composição textual preserva byte a byte `readSnapshotRoot`, a proteção de escrita/dispose e o marcador readonly. Preserve também runtime/contract e os wrappers source-lifecycle/read-snapshot de59.
4. Materialize os dois casos adicionais de [readonly-composed.test.ts.txt](composition/readonly59/readonly-composed.test.ts.txt) no path de teste indicado pelo request composto. Eles verificam cancelamento local durante Graph na raiz readonly e envenenamento após tentativa aninhada de manutenção. Permanecem **INERT_NOT_RUN** nesta fonte. readonly59 usa `BEGIN IMMEDIATE`: outro writer não confirma logout enquanto a raiz segura o lock.
5. A alteração de entry exige reconciliar o mapa de composição Microsoft49. [composition/composition-pointer-and-map.patch](composition/composition-pointer-and-map.patch) entrega a mudança apenas do ponteiro da fixture e o novo mapa, preservando os arquivos históricos49/55 e suas asserções. Se74 mudar entry/installation/serve, gere os hashes dos três arquivos realmente compostos. O patch da fixture estrangeira permanece inerte, para o integrador autorizado.
6. Execute a seleção cirúrgica preparada em [composition/REQUEST-COMPOSED71.json](composition/REQUEST-COMPOSED71.json) somente após integrar a unidade,59 e o mapa correto. Registre novo W/S/run/job. Peça a45 os checks no candidato real e a revisão independente do target aplicado.
7. Responda na PR65 com ACK de consumo, commit/tree do candidato, blobs escolhidos, preimages e resultados reais. Não reutilize R1 como PASS desse candidato.

[DEPENDENCIES72.json](DEPENDENCIES72.json) fecha o conjunto de mudanças, dependências de composição e pins críticos. [CRITERIA72.json](CRITERIA72.json) liga os critérios, contraprovas e consequências.

## Gates mantidos

[REQUEST-45.json](REQUEST-45.json) e [pedido na PR32](https://github.com/gustavomhss/Orchestra-SF/pull/32#issuecomment-6888426195) pedem `bun typecheck` em `modules/sucafina` e `bun run check:guards --base origin/dev` na raiz. Não foi observado recibo45 para W no fechamento deste material. Não houve teste local, compiler local, guards local, workflow novo ou tomada de refs45.

Composição readonly59+72, lifecycle instalado e seu mapa, checks45 e rechecagem independente do candidato ainda exigem execução/recibo pelas autoridades correspondentes. Os resultados70 das outras findings, P03, M31/MI07, prova Microsoft live, ativação nativa, oito seleções finais, AM, reviews e C-G7D-G8 conservam seus estados anteriores. **GLOBAL_RELEASE=false; nenhum WP ou campanha recebe aceite por este handoff.**
