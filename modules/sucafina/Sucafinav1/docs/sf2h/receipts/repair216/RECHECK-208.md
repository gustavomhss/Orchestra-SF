# Rechecagem causal independente 208 — REV208-NEW-002

**Owner do recheck:** 208 (independente), após composição pela missão 211 e prova efetiva pelo dispatcher 214. **Estado:** REQUESTED, NOT_RUN; nenhum ACK ou runID foi observado.

**Produto submetido:** fonte missão216 `a47a987ac65041ef32782822739256f6b1b90591` / PR #195, store blob `b5caa2d662e12b9e74460a7c9291b61b967b32e2`, teste AM05 blob `a935ce97e97f03f1f6a02f03cabc6b271a0ec645`. Integrar no mesmo material C da 211/PR191; aplicar antes o patch do consumidor fora de lease em `OUT-OF-LEASE-211.md`, sobre a preimage `f68e20ef62f14c98ca9ccda9e2fec0a5c579b4de` ou rebase causal verificado se a base mudou.

## Causal source comparison

- **Antes** (blob `0d7a1fa1d0f138d99fd0dc358ab898ebf828dcbf`): validava `event.seq` como inteiro >=0, mas comparava `digestSfValue({ ...event, seq: expected.seq })` com `versioned([record])` (seq canônico constante), apagando o ordinal persistido da checagem; depois `sort` por `seq` não confiável.
- **Depois**: preserva formato `events: [id,event][]`, não muda identidade do kernel (`seq` excluído do hash da identidade pelo `eventId`), verifica `event.seq === log.size+1` na **ordem física** antes de inserir em `log`, recusa ID repetido e event metadata alterado via identidade canônica sem ordinal, não faz sort. Qualquer evento recusado devolve `store=[]` e `log=Map()`; `append` bloqueia o journal inválido e avança a partir do head validado no novo processo.

## Matriz de casos exigidos

| Caso | Entrada real | Expectativa independente |
| --- | --- | --- |
| P01 | 2 registros aprovados por Gitleaks e C09 no mesmo owner, C08/SQLite | `seq=[1,2]`, IDs únicos, ambos visíveis por leitura autorizada |
| P02 | driver SQLite descartado e reaberto; reemit do 2º; 3º evento legítimo | mesmo journal, retry `already-committed`, terceiro ordinal 3, sem duplicação |
| N01 | duplicar ordinal do segundo evento dentro de C08: `[1,1]` | `rejected>0`, registro vazio, read `SF_MEMORY_READ_UNAVAILABLE`, C09 pendente, 0 append |
| N02 | permutar posição dos eventos, sem mudar seus ordinais: `[2,1]` | sem sort/reparo, mesma negação causal |
| N03 | alterar seq do segundo evento para inteiro seguro 9: `[1,9]` | mesmo fail-closed, sem inventar autorização |
| R01 | regressões existentes da missão198 e WP10: scanner hit/ausente/limpo, C08 rollback, C09 idempotência | sem perdas ou relaxamento de gates |

O novo teste selecionável está em `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am05/sequence-integrity216.test.ts`. Ele usa a instalação real da fixture `withAtlasConsumer`, `openLocalStore`, `enqueueSfLedgerEvent`, `emitFromLedger`, scanner Gitleaks pinado, e `f.reopen()` fechando/reabrindo SQLite. Injeções de corrupção são confinadas a instalações/owners de prova descartáveis, uma para cada variante. Nada é resetado/migrado no produto.

**Risco de composição que 208 deve examinar:** `atlas-memory.ts` reprojeta `approved` para leitura; subconjunto filtrado pode começar no ordinal persistido 2. Patch inerte 211 renumera SOMENTE esse subconjunto transitório `index+1` após a verificação do journal completo. Se ausente, C09 `already-committed` de registros posteriores pode falhar. Não confundir esse reindex de projeção com sort ou normalização do journal persistido.

**Dados que 208 precisa receber:** SHA da árvore exata integrada pela 211; blob pós-aplicação do consumidor; seleção normalizada/fixture/scanner/runner do dispatcher214; runIDs reais (ou NOT_RUN), resultados esperados/observados incluindo transação não commitada e outbox pendente. Rejeitar evidência de outra árvore/material C ou de `readiness` Azure. Sem PASS por inspeção estática isolada.

**Aceite:** só após leitura das provas reais e confirmação independente de REV208-NEW-002. Status atual **NOT_RUN / REVIEW_REQUESTED**. GLOBAL_RELEASE=false.
