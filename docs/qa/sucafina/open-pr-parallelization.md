# Matriz de paralelização das waves de PRs

> **PLANO, NÃO EXECUÇÃO.** Nenhum merge, close, label, deploy ou alteração de proteção é autorizado por este documento.

Este documento complementa `open-pr-merge-plan.md`. A classificação usa a lista atual de arquivos alterados de cada PR e as dependências semânticas já registradas na auditoria. **Não existe obrigação de preencher 15 workers.** Quando a topologia só admite uma lane, a execução é serial.

## 1. O que significa “paralelizável”

### P — paralelo seguro para preparação

Pode executar ao mesmo tempo:

- releitura de head/branch e prova de inclusão;
- cold review;
- análise de conflito;
- rebase inicial contra o mesmo `BASE_START`, quando os paths continuam disjuntos;
- CI da própria branch.

Isso **não** autoriza merge simultâneo. Depois que qualquer PR entra na base, os demais precisam confirmar ancestry/diff outra vez antes da integração.

### C — paralelo somente para leitura

Os PRs podem receber auditoria em paralelo, mas não rebase resolvido/push simultâneo porque compartilham ancestry, arquivos, receipts ou decisão de produto. Apenas a raiz da cadeia recebe alteração; os descendentes aguardam.

### S — serial

Há arquivo compartilhado, dependência de produtor/consumidor, postimage/receipt vinculado ou integração final. Executar na ordem declarada.

### B — barreira

Nada depois da barreira é qualificado até os predecessores estarem `MERGED`, `LANDED`, `DUPLICATE` ou `BLOCKED` com disposição explícita.

## 2. Regras globais

1. **Leitura pode ser amplamente paralela.** Alteração de branch não.
2. **Uma lane por família de arquivos compartilhados.** Dois agentes nunca resolvem simultaneamente a mesma família contra bases diferentes.
3. **Merge é sempre unitário e serial.** Após cada merge, atualizar `BASE_HEAD` e reavaliar a próxima branch.
4. **Disjunção de nomes não basta quando existe dependência semântica.** Receipts, postimages, gates e promoção podem impor serialismo sem arquivo idêntico.
5. **Head mudou, classificação expira.** Recalcular changed files e dependencies antes do dispatch.
6. Os números de workers abaixo são **tetos de preparação inicial**, não metas de ocupação.

## 3. Fila sem merge

### Paralelo somente para verificação read-only

Podem ser auditados simultaneamente:

- absorvidos: `#191, #208, #225, #226, #231, #232, #236, #276`;
- fundidos externamente: `#262, #294, #314`.

### Revisão em pares/famílias

Também é read-only, mas cada relação deve ter um único revisor responsável:

- `#259 ↔ #276`;
- `#272 ↔ #270`;
- `#289 ↔ #307`;
- `#328/#329/#331 ↔ #332`.

Nenhum item desta seção recebe rebase ou merge. Qualquer fechamento futuro exige autorização separada.

## 4. Wave 1 — base, CI e conflitos canônicos

**Classificação geral: parcialmente paralelizável.**

### P1 — raízes independentes, até 8 preparações iniciais

`#240, #244, #255, #256, #257, #274, #307, #332`

Essas raízes têm conjuntos próprios no início da wave. Ressalvas:

- `#255` é a raiz da cadeia CI-SF;
- `#274` é a raiz da cadeia de workflow;
- `#307` deve absorver primeiro todo hunk único de `#289`;
- `#256` será reencontrado por `#252`, portanto precisa entrar antes dele.

### S1 — cadeia CI-SF

`#255 → #280 → #290 → #297`

Motivo: compartilham `installation.test.ts`, browser/visual/presentation, Procurement, Microsoft fixture e, no fim, gate/workflow. Não paralelizar rebase resolvido nem conflito.

### S2 — Decisions/Reports

`#307 → #252`

Motivo: `#252` e `#307` compartilham helpers de Decisions/Reports. `#307` é o dono canônico da reconciliação com `#289`; `#252` só recebe o residual depois.

### S3 — núcleo de CI

`#274 → #246 → #252 → #253 → #251`

Motivo: os cinco tocam `.github/workflows/sf-ci.yml`, e `#246/#251/#252/#253` compartilham gate, manifest, scripts e documentação CI. `#251` é o integrador e fica por último.

### Barreiras

- **B1:** concluir as raízes independentes.
- **B2:** concluir `#255 → #280 → #290 → #297` antes de `#246`, pois há testes compartilhados.
- **B3:** `#252` aguarda tanto `#307` quanto `#246`.
- **B4:** `#251` encerra a wave.

## 5. Wave 2 — AM/F04 e reparos iniciais

**Classificação geral: parcialmente paralelizável.**

### P1 — raízes AM disjuntas

`#177, #178, #179, #180`

Os quatro usam diretórios AM e receipts distintos.

### P2 — reparos independentes

`#181, #185, #186, #187, #188, #189`

São docs/guards, Work schema, live-context, workbook/BI, collaboration e client transport em escopos separados.

### S1 — fechamentos AM

- `#178 + #180 → #182`;
- `#177 → #183`;
- `#179 → #184`.

`#182` compartilha o correlator AM01 de `#178` e fecha AM01/AM02. `#183/#184` são fechamentos posteriores das respectivas famílias.

### S2 — fechamento instalado

`#182/#183/#184 + P2 → #190 → #192`

`#190` é a composição F04/installed-host e não deve ser tratado como reparo isolado. `#192` arquiva/loga depois que a composição estiver definida.

**Teto inicial:** 10 preparações úteis; não despachar os descendentes antes das raízes.

## 6. Wave 3 — origem, memória, decisões e rotinas

**Classificação geral: parcialmente paralelizável.**

### P1 — raízes independentes

`#193, #194, #195, #196, #197, #198, #199, #201, #202, #203, #204`

Os paths de implementação são disjuntos: AM01, desktop bootstrap, Atlas, BI semantics, Files, Memory, Routine host, Decisions schema, AM02 reopen, supplier export e Today resume.

### S1 — dependências por arquivo/contrato

- `#193 → #200` — mesmo teste AM01 hypothetical;
- `#197 → #205` — Files/native transport compartilha arquivos do #197;
- `#201 → #207` — revisão C12/postimages depende do contrato Decisions estabilizado.

### B1 — reconciliação final

`todos os anteriores → #206`

`#206` reconcilia fila, manifests e handoff terminal; é barreira, não lane paralela.

**Teto inicial:** 11 preparações.

## 7. Wave 4 — host nativo, bridge e superfícies

**Classificação geral: duas cadeias de código + preparação documental paralela.**

### P1 — cadeia owner/host, raiz

`#209`

### S1 — owner/host

`#209 → #222 → #215 → #216`

Motivo:

- `#209`, `#222` e `#215` alteram `owner-runtime231.tsx` e integração de host;
- `#215` acrescenta shell guard sobre a composição;
- `#216` é a frontier/origin bridge e depende do owner-runtime final.

### P2 — cadeia source/files, raiz

`#221`

### S2 — source/files

`#221 → #223`

Motivo: ambos alteram `memory-http.ts`; `#223` ainda consome Files/Memory já estabilizados nas waves anteriores.

### P3 — docs e provas independentes

`#210, #211, #212, #213, #214, #217, #218, #219, #220`

Podem ser preparados simultaneamente em seus diretórios próprios. Entretanto, postimages e afirmações devem ser recalculados depois de S1 e S2; preparação paralela não equivale a aceite.

### B1

`S1 + S2 → revalidação de P3 → encerramento da wave`.

**Teto inicial:** 11 preparações, distribuídas em duas raízes de código e nove pacotes documentais.

## 8. Wave 5 — drafts, release prep e demo

**Classificação geral: cadeia de produto, cadeia CI/release e pequenas lanes independentes.**

### S1 — fundação nativa

`#224`

`#224` cruza People, live-context, Procurement, host-context e vários contratos. É a raiz obrigatória; não paralelizar sua integração com os drafts.

### Depois de #224, duas cadeias podem ser preparadas em paralelo

#### S2A — Files/Reviews

`#229 → #228`

Ambos alteram `live-context.ts`; `#228` acrescenta Files/Reviews e vem depois.

#### S2B — drafts/dispatch

`#227 → #230 → #234 → #235`

Os quatro compartilham dezenas de arquivos em `context`, `draft-revalidation`, People, Procurement e testes. Apenas residual único passa de um para o próximo.

### P1 — independentes da cadeia de produto

`#233, #239, #245, #268`

- `#233`: core/skill receipts;
- `#239`: changelog/guia;
- `#245`: identidade Azure em diretório próprio;
- `#268`: demo Flamengo em diretório próprio.

Podem receber preparação simultânea. `#268` continua sem prova live e deve ser integrado depois dos contratos de ambiente relevantes.

### S3 — bundles CI/release com ancestry comum

`#250 → #248 → #249 → #247`

As PRs atuais compartilham workflows, gate, manifest e documentação CI por ancestry. Seus arquivos autorais podem ser revisados em paralelo, mas **as branches como bundles não podem receber integração paralela**. Limpar/reconciliar uma por vez.

### B1

`S2A + S2B + S3 + P1 qualificado → encerramento da wave`.

**Teto inicial:** 6 preparações reais (`#224, #233, #239, #245, #250, #268`).

## 9. Wave 6 — UAT, produto final, retirada do legado e promoção

**Classificação geral: preparação documental paralela; produto e promoção seriais.**

### P1 — docs/harnesses disjuntos

`#301, #318, #319, #333`

- `#301`: um ADR;
- `#318`: runtime campaign;
- `#319`: blocked harness;
- `#333`: na releitura atual, apenas `consolidation-board-2026-11-17.md`.

O #333 deve ter changed files reconfirmados no dispatch, porque a foto antiga registrava um head anterior muito maior.

### S1 — produto final

`#270 → #293 → #327`

Motivo:

- `#270` e `#293` compartilham `modules/sucafina/Sucafinav1/local/entry.ts`;
- `#327` compartilha `local/entry.ts` com ambos, `runtime/application.ts` com #270 e factory tests/scripts com #293;
- descomissionar o console antes de reconciliar auth/installation quebraria consumidores e provas.

### B1 — promoção

`P1 + S1 + todas as waves anteriores → #237`

`#237` toca workflows, produto, UAT, factory, skills e recibos em escala massiva. É **estritamente serial, final e não paralelizável**. Deve apontar para o SHA exato final de `close-final-candidate`.

**Teto inicial:** 5 preparações (`#270` + quatro docs/harnesses). Depois, uma única cadeia de produto e uma promoção final.

## 10. Resumo de capacidade real

| Wave | Tipo | Teto inicial de preparação | Integração |
|---|---|---:|---|
| Sem merge | read-only | até 15 | nenhuma |
| 1 | parcial | 8 | três cadeias + integrador final |
| 2 | parcial | 10 | fechamentos AM e F04 seriais |
| 3 | parcial | 11 | três dependências + barreira final |
| 4 | parcial | 11 | duas cadeias de código; docs revalidados depois |
| 5 | parcial | 6 | fundação, duas cadeias de produto e uma cadeia CI/release |
| 6 | parcial | 5 | produto serial; promoção final unitária |

Os tetos não são metas. Se changed files, lease ou base divergirem, reduzir a concorrência imediatamente. **Nunca aumentar paralelismo para preencher capacidade.**