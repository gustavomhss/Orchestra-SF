# Plano de rebase, resolução de conflitos e merge — fila auditada

> **PLANO DE EXECUÇÃO, NÃO EXECUÇÃO.** Este documento não autoriza merge, close, label, deploy ou alteração de proteção. Ele organiza a foto de 100 PRs auditada em `open-pr-audit.md` para tratamento determinístico, em fatias de no máximo 15.

## 1. Resultado da planificação

A foto congelada contém **100 PRs**.

- **17 não entram em fila de merge**: 8 já absorvidos pela base, 6 duplicados/sobrepostos com dono canônico e 3 fundidos externamente depois da foto.
- **83 candidatos residuais** entram em **6 waves**: `15 / 15 / 15 / 15 / 15 / 8`.
- O PR de auditoria **#334** foi criado depois da foto e não conta nas 100 unidades.
- A fila viva mudou durante e depois da auditoria. Por isso, cada wave começa por uma nova leitura de estado; um item pode sair de `REBASE` para `LANDED`, `DUPLICATE`, `ABSENT` ou `BLOCKED` sem ser forçado a produzir diff.

## 2. Regras fixas para todas as waves

### 2.1 Um wave por vez; rebase paralelo, merge serial

Até 15 branches podem receber análise/rebase em paralelo. **Merges são sempre serializados** na ordem interna do wave. Depois de cada merge, a próxima branch é confrontada novamente com o novo HEAD de `close-final-candidate`.

### 2.2 Protocolo por PR

1. Fixar `BASE_START=<HEAD atual de close-final-candidate>` e `PR_HEAD=<head observado>`.
2. Confirmar que a branch existe e que o head não mudou. Branch ausente vira `CLOSE_BY_ABSENTE`; lease divergente interrompe o item.
3. Testar inclusão real antes de rebase:
   - head ancestral da base;
   - diff vazio;
   - blobs/hunks já presentes.
   Se qualquer um provar absorção integral, marcar `LANDED/NO_MERGE`.
4. Para residual real, rebasear na base atual. `--force-with-lease` somente contra o head observado.
5. Conflito textual/mecânico: preservar as duas intenções e remover apenas duplicação comprovada.
6. Conflito semântico: resolver em branch de integração do item; nunca usar `ours/theirs` em arquivo inteiro, nunca apagar guard, prova, auth ou provenance para obter verde.
7. Validar via GitHub Actions. Teste local continua fora do protocolo desta campanha.
8. Vermelho próprio bloqueia merge. Vermelho compartilhado só pode ser aceito quando reproduzido na base no mesmo SHA temporal e com a mesma assinatura; nenhuma falha nova pode ser escondida como “shared”.
9. Fundir o PR residual e atualizar o pino da base. Se o rebase ficar vazio, não criar commit artificial.
10. Registrar: head antigo, head rebasado, conflitos e decisões por arquivo, run IDs, conclusão, merge SHA ou blocker.

### 2.3 Condições de parada do wave

O wave para no primeiro caso de: regressão própria sem dono, conflito de produto que muda decisão fechada, branch/head sem lease, alteração inesperada de paths protegidos, receipt/proveniência reescrita, ou CI que não distingue base de branch.

## 3. Fila que não recebe merge

### 3.1 Já absorvidos pela base — verificar e dispor, sem rebase

`#191, #208, #225, #226, #231, #232, #236, #276`

Ação: renovar a prova de ancestralidade/blob/hunk contra o HEAD vivo. Confirmada a inclusão integral, manter fora das waves e encaminhar como `CLOSE-SUGGESTED`. Se surgir residual, voltar ao wave correspondente ao domínio; não presumir que título igual significa landing.

### 3.2 Duplicados/sobrepostos — um dono canônico

| PR fora da fila | Dono/ação canônica |
|---|---|
| #259 | A falha de SVG já está resolvida pela remoção incorporada de #276/#295. Fechar somente após prova no HEAD vivo. |
| #272 | Mesmo head de #270; #270 é o candidato canônico para `close-final-candidate`. Resolver target e não fundir os dois. |
| #289 | Não é clone integral. Comparar contra #307, portar todo hunk único e só então dispor #289. |
| #328 | Conteúdo canônico em #332; já fundido externamente. Apenas registrar. |
| #329 | Dois blobs aparecem no #332. Não fundir isoladamente depois de #332; confirmar equivalência no HEAD vivo. |
| #331 | Conteúdo canônico em #332; já fundido externamente. Apenas registrar. |

### 3.3 Fundidos externamente depois da foto

`#262, #294, #314`

Ação: não repetir merge/rebase. Auditar apenas se o merge trouxe o conteúdo esperado e se não deixou residual em outro PR.

## 4. Waves executáveis

## Wave 1 — base, CI e famílias de conflito canônicas (15)

**PRs:** `#240, #244, #246, #251, #252, #253, #255, #256, #257, #274, #280, #290, #297, #307, #332`

**Objetivo:** formar uma base testável antes de mover o backlog histórico.

**Ordem interna:**

1. Pequenos fixes/fontes: `#255 → #256 → #274 → #240 → #244 → #246 → #252`.
2. Família CI-SF: `#280 → #290 → #297`. Cada PR é rebasado após o anterior; #297 mantém apenas o residual único, sem reintroduzir fixtures antigas.
3. Família Decisions/Reports: reconciliar os hunks únicos de #289 dentro de `#307`; #307 é o dono canônico desta linha.
4. Hidden risks: rebasear `#332` contra o HEAD vivo e eliminar apenas trechos já incorporados por #328/#331; preservar qualquer residual real de #329.
5. Gate/manifest/factory: `#253 → #257`.
6. Integração CI: `#251` **por último**, consumindo a base já corrigida. Não carregar ancestry estrangeira como se fosse entrega do A6.

**Gate de saída:** CI identifica com precisão PR-own vs baseline; typechecks limpos; nenhum skip, waiver, receipt fabricado, timeout inflado ou path protegido indevido.

## Wave 2 — provas AM/F04 e correções iniciais (15)

**PRs:** `#177, #178, #179, #180, #181, #182, #183, #184, #185, #186, #187, #188, #189, #190, #192`

**Ordem:** ascendente; `#190` por último entre os itens de código por estar `DIRTY`; `#192` encerra como documentação/arquivo histórico.

**Tratamento:** preservar recibos históricos e separar prova preparada de prova executada. Rebase vazio vira `LANDED`; receipt divergente não pode ser “atualizado” apenas para passar.

## Wave 3 — contratos de origem, memória, decisões e rotinas (15)

**PRs:** `#193, #194, #195, #196, #197, #198, #199, #200, #201, #202, #203, #204, #205, #206, #207`

**Ordem:** ascendente, com os `DIRTY` `#195, #196, #199` processados depois dos seus predecessores imediatos e antes dos consumidores que dependem deles.

**Gate de saída:** autoridade, CAS, histórico, ordinalidade e provenance continuam fail-closed. Patches “inert” só entram se o callsite real e os testes provarem uso; documentação não substitui wiring.

## Wave 4 — host nativo, bridge e superfícies operacionais (15)

**PRs:** `#209, #210, #211, #212, #213, #214, #215, #216, #217, #218, #219, #220, #221, #222, #223`

**Ordem:** `#217 → #218 → #221 → #209 → #219 → #220 → #222 → #223`, depois documentos/provas `#210–#214`, e por fim os conflitos pesados `#215 → #216` após a base de host estar estável.

**Gate de saída:** nenhuma bridge fica apenas preparada; host, origin, instalação e source contract devem apontar para produtores reais. Conflitos em `host-context`, `live-context`, Files e shell exigem revisão por hunk.

## Wave 5 — drafts, revisão, release prep e demo (15)

**PRs:** `#224, #227, #228, #229, #230, #233, #234, #235, #239, #245, #247, #248, #249, #250, #268`

**Ordem:**

1. Base nativa: `#224 → #229 → #233`.
2. Famílias de draft/dispatch: `#227 → #228 → #230 → #234 → #235`, serializadas porque compartilham context/drafts/routing.
3. Documentação simples: `#239`.
4. Coordenação e pacotes bloqueados: `#250 → #245 → #248 → #249 → #247`.
5. Demo sintética: `#268` por último; não converter preparação em prova live.

**Gate de saída:** documentos Azure/Entra/release permanecem honestamente `BLOCKED/NOT_RUN` até ambiente real. Nenhum pacote de prova pode declarar go-live por CI local ou sintético.

## Wave 6 — produto final, UAT, retirada do legado e promoção (8)

**PRs:** `#237, #270, #293, #301, #318, #319, #327, #333`

**Ordem obrigatória:**

1. `#301` — ADR docs-only, após confirmar diff de um arquivo.
2. `#318 → #319` — harnesses de execução/preflight, ainda sem transformar `READY` em `PASS`.
3. `#270` — candidato canônico da superfície Entra; #272 permanece fora.
4. `#293` — autenticação local/instalação; preservar o que já veio de #320 e remover ancestry estrangeira.
5. `#327` — retirar o console somente depois de equivalência/retarget dos consumidores nativos; APIs e manutenção continuam preservadas.
6. `#333` — **não mergear como está** se o diff ainda remover `.atlas`, skills ou arquivos fora do board. Recriar/limpar como docs-only antes de qualquer merge.
7. `#237` — promoção final. Atualizar para o **SHA exato final** de `close-final-candidate` e só então promover para `go-live-close`; ele não é um feature PR comum.

**Gate de saída:** candidato final único, todas as waves anteriores encerradas, nenhum residual aberto sem disposição, CI no SHA final, recibos vinculados ao mesmo tree/artifact e decisão explícita do dono para promoção.

## 5. Quadro operacional por wave

Cada wave deve publicar uma tabela com este formato:

| Ordem | PR | Head inicial | Estado prévio | Rebase head | Conflitos resolvidos | CI próprio | Baseline comparado | Resultado |
|---:|---:|---|---|---|---|---|---|---|
| 1 | #... | `sha` | CLEAN/DIRTY/... | `sha` ou `EMPTY` | paths + decisão | run/jobs | base SHA/run | MERGED/LANDED/BLOCKED/DUPLICATE |

Ao final do wave, publicar também:

- `BASE_START` e `BASE_END`;
- merges em ordem e seus SHAs;
- branches que ficaram vazias;
- duplicatas absorvidas;
- blockers com dono e arquivo exato;
- lista dos PRs do wave seguinte que agora precisam novo rebase.

## 6. Resultado esperado

Este plano evita dois erros: fundir a mesma correção várias vezes e rebasear 83 branches simultaneamente contra uma base que muda a cada merge. O paralelismo fica na inspeção/rebase de até 15; a composição final permanece serial, auditável e fail-closed.