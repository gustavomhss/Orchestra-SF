# NUI-N0 — missão de cold review independente antes do GO

**Escopo exclusivo:** norma e despacho UX nativa SF / PR99. Não pertence às 20 cartas autoras nem substitui os R01/R02/R03 FINAL do produto. Autor da PR99 não pode assinar esta revisão independente.

## Pins e autoridade — reconcilie HEAD vivo

- Repo `gustavomhss/Orchestra-SF`, PR99 `ux-20-dispatch`; HEAD documental observado `18cc22510e9716345985f50995c1128ea8340198`, **não assumir que permanece atual**. Norma de arquitetura `cbac654784714f68779ae1434d30e6ea8970c4d1`, PR76 original `de7da0689f1a2aba2ebe190f83d807ca949e2c5a`, revisão77 PR91 `16712630025cad3de647f2ea49ecbcdb2cc854fa`.
- Canônico `dbf9547211d9b0fade619790de7c19c0869b7c7d` (15 WPs/74 tasks/17 contratos/1.610 critérios). Material C51 `529142f63683de8e4b1f7d4232f88faf8ffcef6c`, tree `d679b541596dab3b280a87e15e4a0b29ee518262`. Terminal100 `a6abd2c8d321daf1089f4d440027c46209a89cbe` documental, lease 100 ENDED (71 também). Re-pin stack e source-family antes de concluir.

## Leitura obrigatória

1. AGENTS aplicáveis, `execution/parallel-20/{README.md,GO-NOGO.md,PREFLIGHT-C51-READBACK.md,ADVERSARIAL-AUDIT.md,VALIDATION-DELTA.json}`.
2. `execution/{manifest.json,EXECUTION-PROTOCOL.md,CONTRACTS.md,COMPONENT-CONTRACTS.md,component-locks.json,host-signatures.ts,component-signatures.ts,route-signatures.ts}`.
3. `execution/{contract-catalog.json,surface-manifest.json,work-orders/*.json}`, **todas 78 ordens**, `parallel-20/{dispatch.json,PROMPTS.md,launch-record.template.json,validate_dispatch.py,test_validator_inputs.py}` e `../criteria-trace.json` com campaign imutável.
4. Material C51, terminal100, releases de produtores/owners e autoridade real S0/105 após ACK vivo, 101 produto CI, 45 compiler; diferenciar ACK antigo de lease vigente.

## Revisão e testes documentais exigidos

- Conferir execução EXCLUSIVAMENTE via GitHub Actions no `test-ci` existente de `preflight-actions.node-smoke.mjs`, que roda `validate_dispatch.py`, `validate_plan.py --strict` e **doze regressões** de `test_validator_inputs.py`; anexar comando, exit, stdout/artefato. Sem execução observada, marcar NOT_RUN, não PASS.
- Conferir os 1.610 canonicalPointer/IDs/digest; 78 ordens/20 cartas/19 autores/58 remanescentes; 305 ops, 70 superfícies/165 rotas; ownership exato/prefix e demais leases ativas, grafos autoria vs integração vs qualificação, source/copy/schema digests; nenhum registry duplicado.
- Conferir PR99 como proveniência real de `source.commit`, separada de PR76; C00 preflight read-only não exige seu próprio launch-record prévio; ACK e lease encerrados da 71 e 100 não dão GO.
- **Unicidade C00**: se C00 editar shared paths, exigir MESMO ator e MESMA lease do único integrador material designado por S0. Caso diferente, C00 apenas leitor/coordenador com patches inertes; nunca dois writers da stack.
- P0 `U11.title-save` só CAS `pr.title`, sem receipt C12 ou aprovação; P1 `U13.pr-approval` aprovação real separada, M31/MI07 retidos. Validar negative owner A/B, typed fence na transação original, Microsoft/desktop Session, callback, POST incerto, late response e autorização real.
- V2 views A12/U43 não PASS sem produtor real/ACL/CAS; MonthlyGrid TSV, zero/null/mês 0..11→1..12 e source host; 305 bindings typed, piloto subset real, desktop broker, no stubs/Any/retry mutação incerta.
- Casos de ataque: seleção B+URL A, owner switch e stale response, lease duplicada e borrowed path C00, ACK100 reciclado, source drift pós-pin, auth redirect aberto, view v2 sem persistência, TSV perdendo zero, P03 FAIL promovido, screenshot como prova funcional, retry por timeout, CI sem chave completa, reviewer com autoria.

## Saída obrigatória

Um parecer **assinado por outra sessão/reviewer independente**, com HEAD/tree e blobs, identidade observável, comandos/resultados reais, findings por severidade e arquivo/linha/contraexemplo/owner/patch mínimo, gate GO ou FIX-FIRST/NO-GO por família, blocked dependencies, e links na PR99. Sem alterar produto, disparar CI, merge, deploy, Azure ou declarar GLOBAL_RELEASE. Não aceitar autoria como auditoria independente.

DOCUMENTARY_STRUCTURE_PASS não equivale a S0 GO, ARTIFACT_READY, INTEGRATED, QUALIFIED ou FINAL canônico.

## Adendo de roteamento S0
Control `8819df6169abd94aaa89d50a21f113e5596d2aae`: missão105 PREPARED_NOT_STARTED, não ACK; produto CI101/test:ci, compiler/guards45. O reviewer N0 deve testar 12 regressões e não confundir esses escopos.

## Evidência posterior — não é aprovação N0

ACK105 publicado no produto em `d083b422b6a587f47873abde4d866e35017ff8b8` (lease S0-C-e15-browser105); material até C53 `180212940105e7b9ad15171b067c1c1b7841df5f`. A designação inicial PREPARED é histórica. Isso NÃO torna o reviewer N0 independente nem concede GO à UX, e os doze testes Python seguem sem execução observada.

## Regra de testes do usuário

NÃO executar Python, unittest, Node, Bun, typecheck ou qualquer teste localmente. Inspecionar W/S/run/job/attempt do workflow GitHub Actions gerado pelo `ACTIONS-PREFLIGHT-REQUEST.json`, logs, conteúdo da request e vínculo com PR99/HEAD. Se faltar execução real, resultado `NOT_RUN`, nunca PASS. A revisão do código/documentos sem execução local é permitida, sem confundir com prova.

**Evidência de pré-teste:** GitHub Actions run [43706300252](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43706300252) concluiu FAIL por campaign ausente no checkout da PR99; os validadores Python **NÃO** iniciaram, portanto zero assertions canônicas foram revalidadas nesse run. Exigir no próximo Actions run Git blob canônico `71b56906…` obtido do SHA `dbf95472…`, com hash comprovado, e depois 3 subtests Node efetivamente completados. Não aceitar o primeiro run como PASS.

## Evidência Actions concluída antes do parecer N0
Run [43706901262](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43706901262) / job132789826273 / W 87b536aca6ff3e444c468362c991decb23e104b4: documental PASS (3 Node, 12 Python, 1.610 critérios e hash canônico). Primeiro run 43706300252 permanece FAIL, corrigido causalmente. O reviewer independente ainda deve reexaminar o snapshot e os logs, verificar contratos/segurança/owners e publicar parecer próprio. Não é autoaprovação.

**Revisão adversarial de controle (autor do delta, não independente):** em PR99@1a9ac1a0, `validate_dispatch.py` foi corrigido para impedir que ACK/leases ENDED 105/106 sejam reutilizados como atuais, exigir control SHA/live successor verificado externamente e aplicar igualdade de actor+lease para C00 em modo compartilhado. `test_validator_inputs.py` tem **21 casos** (9 novos) e o runner Actions passa a inspecionar sintaxe das três assinaturas TS. O run verde #43706901262 é HISTÓRICO, não valida esse código. **N0 independente ainda não ocorreu; `authoring_GO=false`.**
