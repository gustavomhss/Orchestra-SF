# RecipientActions.reply — produtor aplicado e entrega ao consumidor

## Resultado e escopo

O produtor foi aplicado e qualificado em **`9dd3c830810d4f3e56f0e3474f5a633978c91831`**, na mesma `collab-resume` / PR #41, depois da passagem explícita do escritor anterior em `9ec98ac9cdc807d2b95040274f4312df768d932d`. O preimage do patch de PR #54 / `work-ack@92243fc68ff81df7fc563ec081ac9db686a24dfa` foi conferido antes da aplicação.

No produto, mudaram somente `product/collaboration/recipient-actions.ts` e o auxiliar `product/collaboration/authority.ts`. Nenhum host-binding, contrato compartilhado, engine ou arquivo UI foi editado. Os quatro arquivos novos de teste/fixture usam C03, C08, HTTP e SQLite reais; autenticação e leases são fronteiras explicitamente fornecidas pelas fixtures.

O recibo é persistido no mesmo commit C08 que a mensagem e é devolvido a partir do **`saved.value` original**. Ele vincula ação, intenção completa, principal, chave, thread, encarnação da fonte e mensagem por `id/incarnation/version`. O replay passa pelo C08 antes de alocar IDs ou avaliar um novo append/reabertura. Boolean legado e versão original indisponível permanecem inconclusivos.

Além da proposta recebida, o incremento acrescenta liberação final sob snapshots protegidos, com recibo persistido, thread, fonte física e autoridade atuais. No caso C05, ator e destinatário precisam de leases reais; o caminho self recebe explicitamente `requireSelfLease: true` e é verificado depois do último await. Os defaults dos demais consumidores de autoridade são preservados.

## Pins e resultados funcionais

| Evidência | Identidade e resultado |
| --- | --- |
| Produto W | `9dd3c830810d4f3e56f0e3474f5a633978c91831` |
| Árvore W | `a36dee98b9aef866e2d78ad7af416653206e5d02` |
| Snapshot S1 | `0499e3e313814baad066b3cccb14e4c37ee9fa1c` |
| Árvore S1 | `612b4cd7b90de76f1947e90daed7e2100e2ae2c9` |
| Request S1 | `ci-request.01.json`; SHA256 `3ef4abbabdce95d93480c17d284cfe3130aaa794c79faf0bcbca50aaf12fd3e9` |
| Run / job S1 | [43628901092 / 132550878448](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628901092/job/132550878448) |
| Resultado S1 | **20 PASS / 0 FAIL / 247 assertions / 8 arquivos / 220,66 s**; cleanup `132552344789` SUCCESS |
| Snapshot S2 | `e97b04631bc573768d5afac8491ac8444dc22850` |
| Árvore S2 | `3ffa9010495927fecb641f85c53988f6e835d62f` |
| Request S2 | `ci-request.02.json`; SHA256 `79bb73cb5c601c1ed9db2b38abcd9bb5959c69550f9a282b084aaa2210d666d1` |
| Run / job S2 | [43629467025 / 132552649884](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43629467025/job/132552649884) |
| Resultado S2 | **1 PASS / 0 FAIL / 5 filtrados / 2 assertions / 1 arquivo / 92,59 s**; cleanup `132553571067` SUCCESS |

Cada S é filho direto de W e acrescenta **somente `.ci-run.json`**. Produto, testes, fixtures e configuração são idênticos ao W. Os nove postimages de W foram conferidos por blob no GitHub. As requests foram deduplicadas antes da execução, validadas pelo workflow canônico e executadas sequencialmente. Nenhum teste ou compilação de produto foi executado localmente. Nenhum deadline ou assertion existente mudou.

Nos dois runs, Omni declarou **not applicable**: zero spawns e zero delegações, sem prova de execução nativa. Ambos concluíram SUCCESS, incluindo cleanup, e não produziram artifacts. Os logs exatos foram capturados pelo GitHub MCP. Total funcional: **21 PASS / 0 FAIL / 249 assertions**.

A seleção principal contém 13 casos novos e sete regressões existentes. A seleção adicional contém somente:

```text
C05 edited answers after SQLite reopen resolve and reuse the newly confirmed response
```

Essa repetição é justificada pelo delta concreto em `recipientActions.resolve`: a resolução de uma conversa de review atravessa agora o lease self estrito e a liberação do recibo. Ela preserva o prazo de 120000 ms e os oráculos originais. Os outros quatro casos do run C05 `43625515062` não foram repetidos. Os cinco PASS anteriores permanecem vinculados a `9e1f44af7689946d27d37ed48b9f5e9849417121`, sem transplante automático para o novo produtor. A seleção não qualifica latência/SLO.

## Nove requisitos comprovados

| Requisito | Prova observada em S1 |
| --- | --- |
| Reply inicial | Um append; identidade exata; recibo retornado pelo HTTP real igual ao `transactions[key].value` do C08. |
| Mensagens iguais | Mesmo autor/texto, chaves e identidades distintas; retry da primeira devolve seu recibo original. |
| Resposta perdida | Retorno descartado, handle SQLite antigo efetivamente fechado, arquivo reaberto, consumidor recomposto e admissão nova; mesmo recibo, sem append ou avanço de versão. |
| Thread resolvida | Replay do reply devolve o recibo original e a projeção resolvida; sem reabrir ou acrescentar histórico. |
| Intenção divergente | Mesma chave com body ou expectedStorageVersion diferente gera conflito e conserva C08. |
| Boolean legado | Fixture de compatibilidade explicitamente declarada; permanece inconclusivo, sem síntese ou backfill. |
| Versão divergente | Edição humana real incrementa a versão; o novo conteúdo não substitui a versão original do recibo. |
| Revogação | Recusa antes do retry, depois da leitura final, com host ainda válido e após o último await do fence C05; sem mensagem/recibo divulgado. |
| Fontes e review | Substituição física com o mesmo ID textual é recusada; novo reply conserva `sourceFence: "all"`, `checkNamespaces: reviews` e o fence de commit. |

Os nomes exatos, tempos, contagens, seleção, hashes e limites de cada prova estão em [validation.json](validation.json). Os logs originais estão em [logs/01-recipient-receipt.log](logs/01-recipient-receipt.log) e [logs/02-review-resolve.log](logs/02-review-resolve.log).

O Boolean foi produzido por uma fixture de compatibilidade que altera somente o valor de uma transação real; não se afirma execução do produtor antigo. A substituição física é uma injeção hostil explícita depois da exclusão canônica; o teste usa o produtor real de identidade física e verifica outra encarnação.

## Handoff por SHA — work-ack / ui-work / S0

O [contrato aditivo](CONTRACT.md) já está publicado no SHA do produtor. O campo de sucesso é `value.mutationReceipt`, com `kind: "recipient-thread-action-v1"`. Os tipos são exportados pelo módulo de Colaboração. O HTTP privado existente transmite esse campo sem alteração de contrato compartilhado. S0 deve revisar a composição e os consumidores desse output aditivo pelo SHA.

O consumidor precisa conservar a intenção inteira, incluindo body, thread, chave e expectedStorageVersion originais. Para retry, readmitir exatamente esse payload sob autorização atual. Associar o ACK à intenção/principal/chave/thread e à tupla de mensagem retornada. Texto, autor, posição, contagem e projeção corrente não identificam a operação. A projeção acompanhante pode conter mensagens posteriores e uma thread já resolvida.

**O teste de reopen conserva o payload na memória do teste. Não prova persistência da intenção no navegador nem ACK positivo após reload da UI.** Essas provas pertencem ao consumidor no candidato composto: persistir/restaurar a intenção, obter admissão atual e demonstrar ACK positivo, perda de resposta, igualdade de mensagens, replay após resolução, divergência, revogação e substituição da fonte. O ACK não equivale à confirmação humana, attachment/reuso autorizado ou aprovação financeira.

## Gate estático e obrigações preservadas

O gate `Astra WP08 checks` será executado no head deste commit de entrega, usando o workflow existente e sem mudar configuração. **O resultado exato desse head será registrado na PR #41**, com SHA/tree/run/job/artifact, comparação de diagnósticos e guards. Este arquivo não atribui ao novo produtor o gate anterior. Esse registro externo evita criar um novo commit documental depois do gate e exigir outro gate recursivo.

O baseline `43627225976` no handoff `9ec98ac9…` tem typecheck FAILURE com 69 diagnósticos herdados/zero próprios e guards PASS. Guards e revisão estática não são prova funcional. Uma eventual igualdade ao baseline não transforma o typecheck global em sucesso.

Permanecem íntegros os 63 arquivos de evidência do escritor anterior, os 330 critérios documentados e os handoffs WP07/WP08/WP09 naquele SHA. Continuam abertas a composição do host, o contrato C16 para pin C05, a observação efetiva apresentada na UI, a persistência de intenção e o ACK do consumidor, o consumidor WP07/WP14 de resultado não vazio, o histórico C17, as rotinas/execução nativa WP09, os deltas Finance/WP13, a latência/SLO e os gates integrados. Os links e blobs exatos estão em `validation.json` e no dossiê anterior preservado na PR.

**Entrega do produtor para revisão/composição por SHA. Nenhum merge, reset, force push, branch/PR de produto novo, deploy, novo acesso ou reinício de Orchestra. Sem encerramento agregado de WP07/WP08/WP09 e sem GLOBAL_RELEASE.**
