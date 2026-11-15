# 20 missões de execução — UX nativa Sucafina

**Fonte única:** [dispatch.json](dispatch.json) + [manifesto original das 78 ordens](../manifest.json) + [protocolo](../EXECUTION-PROTOCOL.md). Esta página é gerada textualmente do manifesto das cartas: o texto completo dos prompts aparece em cada `cards[].prompt` sem divergência manual.

**Estado:** DESENHO RECONCILIADO, lançamento condicionado a preflight e GO da autoridade corrente S0/71/45 e releases dos owners pertinentes; nenhum dos 20 assentos foi efetivamente iniciado. Todos podem inspecionar somente em modo read-only até C00 publicar um launch-record válido. 20 é teto de capacidade desejada, **não** 20 escritores autorizados ou 20 runners. Não há garantia de 10× sem medir caminho crítico real.

**Piloto:** P0 `U11.title-save` salva apenas `pr.title` com CAS/owner-fence no produtor, não é aprovação e não recebe receipt C12; P1 `U13.pr-approval` é aprovação verdadeira de PR submetida pelo holder com M31/MI07 preservados. Ambas exigem web e desktop instalados. `U10.queue` fornece a fila; Q01/Q02 as provas.

**Despacho:** primeiro C00 reconcilia HEAD/authority/preimages e publica os locks; assim que a própria família de contrato de um output estiver FROZEN, esse autor pode começar sem aguardar outros produtores, mas integração e qualificação são estados distintos. 58 ordens restantes e `U10.overview`/`U11.complete`/`U13.complete` não são canceladas. S0/71 conserva a stack, 45 o dispatcher; nenhuma segunda fila/gerador/controlador. 3 FINAL realmente independentes R01 produto/UX/native, R02 finanças/segurança, R03 IA/MCP/Atlas/Relay/docs, todos no mesmo C.

## C00 — I00 — Integração única

**Autoria:** 45 path(s) · **Locks:** ctx, surface-specs, transport · **Integração posterior:** coordenador I00

```text
PAPEL REAL: sessão independente C00, sole integration authority, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/I00.json e exatos required_reads/contratos/locks de sua ficha. FASE A — PREFLIGHT SOMENTE LEITURA, SEM GO: leia HEAD real, ACKs vivos S0/71/45/owners, C/tree e blobs de fontes e contratos, faça a reconciliação de autoridades e execute APENAS validação documental; inicie pelo template e NÃO exija launch-record já publicado pelo próprio C00. Sem autoridade, produza diagnóstico factual e BLOCKED_AUTHORIZATION PARA ESCRITA, sem criar branch, escrever produto, atribuir lease, disparar CI/testes de produto ou declarar GO. FASE B — SÓ APÓS autorização explícita S0 e da nova custódia de integração (a lease71 anterior encerrou), contrato de cada família congelado, SHA/tree material, owner ACKs e capacidade real: publique launch-record no controle autorizado e conceda GO por output disjunto. A ausência de uma dependência bloqueia apenas os consumidores afetados; não crie uma segunda fila ou um segundo integrador.
Você é único integrador I00: reconcilie 8 achados da revisão77, live stack, lançamentos e release/ACK dos owners; teste validação documental e declare somente GO por output com permissão real; mantenha uma fila de 78 ordens, injete componentes, codegen uma vez e seleções pelo dispatcher 45. Não vire segundo controller nem decida regras que não constem dos contratos.

Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
```

## W01 — D01 — Broker desktop e sessão Microsoft isolada

**Autoria:** 4 path(s) · **Locks:** ctx, transport · **Integração posterior:** F02

```text
PAPEL REAL: sessão independente W01, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/D01.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output D01. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para D01. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.
Identidade/owner: select=ids funciona sem directory da conexão B, context exige hostId, auth return-intent one-use com safeReturn original, desktop partition real; mutation fence original dentro da transação.
Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: apps/desktop/src/main/sucafina/**; apps/desktop/src/preload/sucafina.ts; apps/desktop/src/renderer/sucafina.ts; apps/cli/src/sucafina-product/native-ui/desktop-enrollment.ts.
LOCKS AUTORIA: ctx, transport. INTEGRAÇÃO POSTERIOR: F02.
```

## W02 — F01 — Contexto, seleção e ciclo de navegação

**Autoria:** 10 path(s) · **Locks:** ctx, transport, ui-change-review, ui-frame · **Integração posterior:** F03

```text
PAPEL REAL: sessão independente W02, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/F01.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output F01. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para F01. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.
Identidade/owner: select=ids funciona sem directory da conexão B, context exige hostId, auth return-intent one-use com safeReturn original, desktop partition real; mutation fence original dentro da transação.
Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/app-shell/src/orchestra/chapters/sucafina/context/**; packages/app-shell/src/orchestra/chapters/sucafina/navigation-state/**; packages/schema/src/sucafina/context.ts; packages/client/src/sucafina/context.ts; packages/app-shell/test-browser/sucafina-native/context.test.ts; packages/app-shell/src/i18n/orchestra-chapters/sf-context.ts; packages/protocol/src/groups/sucafina.ts; packages/server/src/sucafina-installations.ts; packages/server/src/handlers/sucafina.ts; apps/cli/src/sucafina-product/native-ui/context.ts.
LOCKS AUTORIA: ctx, transport, ui-change-review, ui-frame. INTEGRAÇÃO POSTERIOR: F03.
```

## W03 — F02 — Transporte autenticado e router de projeções

**Autoria:** 6 path(s) · **Locks:** ctx, domain-read, transport · **Integração posterior:** F01

```text
PAPEL REAL: sessão independente W03, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/F02.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output F02. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para F02. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.
Identidade/owner: select=ids funciona sem directory da conexão B, context exige hostId, auth return-intent one-use com safeReturn original, desktop partition real; mutation fence original dentro da transação.
Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/client/src/sucafina/transport.ts; packages/client/src/sucafina/transport/**; packages/schema/src/sucafina/common.ts; apps/cli/src/sucafina-product/native-ui/router.ts; apps/cli/src/sucafina-product/native-ui/transport/**; modules/sucafina/Sucafinav1/test/native-ui-contract/transport.test.ts.
LOCKS AUTORIA: ctx, domain-read, transport. INTEGRAÇÃO POSTERIOR: F01.
```

## W04 — F03 — Composição comum de página e estados

**Autoria:** 4 path(s) · **Locks:** surface-specs, ui-frame · **Integração posterior:** coordenador I00

```text
PAPEL REAL: sessão independente W04, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/F03.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output F03. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para F03. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.

Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/**; packages/app-shell/src/orchestra/chapters/sucafina/shared/states/**; packages/app-shell/src/i18n/orchestra-chapters/sf-common.ts; packages/app-shell/test-browser/sucafina-native/page-frame.test.ts.
LOCKS AUTORIA: surface-specs, ui-frame. INTEGRAÇÃO POSTERIOR: .
```

## W05 — F04 — Harness instalado e corpus isolado

**Autoria:** 3 path(s) · **Locks:** ctx, surface-specs, transport, ui-frame · **Integração posterior:** F01, F02

```text
PAPEL REAL: sessão independente W05, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/F04.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output F04. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para F04. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.

Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/app-shell/e2e/sucafina/native/fixture/**; packages/app-shell/e2e/sucafina/native/fixture.ts; packages/app-shell/test-browser/sucafina-native/fixture/**.
LOCKS AUTORIA: ctx, surface-specs, transport, ui-frame. INTEGRAÇÃO POSTERIOR: F01, F02.
```

## W06 — S01 — Tabela, lista e detalhe

**Autoria:** 4 path(s) · **Locks:** ui-frame, ui-table · **Integração posterior:** F03

```text
PAPEL REAL: sessão independente W06, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/S01.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output S01. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para S01. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.

Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/app-shell/src/orchestra/chapters/sucafina/shared/table/**; packages/app-shell/src/orchestra/chapters/sucafina/shared/detail/**; packages/app-shell/src/i18n/orchestra-chapters/sf-s01.ts; packages/app-shell/test-browser/sucafina-native/s01.test.ts.
LOCKS AUTORIA: ui-frame, ui-table. INTEGRAÇÃO POSTERIOR: F03.
```

## W07 — S02 — Grid mensal acessível

**Autoria:** 3 path(s) · **Locks:** ui-frame, ui-grid · **Integração posterior:** F03

```text
PAPEL REAL: sessão independente W07, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/S02.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output S02. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para S02. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.
Grid/adapter TSV: coordenada UI mês 0..11 → produtor 1..12 uma única vez; preview e apply pelo monthly-edit/monthly-host, CAS por linha, parcial sem repetir linhas aplicadas, entrada 320px, sem motor financeiro no client.
Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/app-shell/src/orchestra/chapters/sucafina/shared/monthly-grid/**; packages/app-shell/src/i18n/orchestra-chapters/sf-s02.ts; packages/app-shell/test-browser/sucafina-native/s02.test.ts.
LOCKS AUTORIA: ui-frame, ui-grid. INTEGRAÇÃO POSTERIOR: F03.
```

## W08 — S03 — Rascunho, revisão e recibo

**Autoria:** 5 path(s) · **Locks:** ctx, transport, ui-change-review, ui-frame · **Integração posterior:** F03

```text
PAPEL REAL: sessão independente W08, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/S03.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output S03. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para S03. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.

Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/app-shell/src/orchestra/chapters/sucafina/shared/draft/**; packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/**; packages/app-shell/src/orchestra/chapters/sucafina/shared/receipt/**; packages/app-shell/src/i18n/orchestra-chapters/sf-s03.ts; packages/app-shell/test-browser/sucafina-native/s03.test.ts.
LOCKS AUTORIA: ctx, transport, ui-change-review, ui-frame. INTEGRAÇÃO POSTERIOR: F03.
```

## W09 — S04 — Evidência e anexos

**Autoria:** 4 path(s) · **Locks:** files, ui-evidence, ui-frame · **Integração posterior:** F03, A06

```text
PAPEL REAL: sessão independente W09, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/S04.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output S04. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para S04. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.

Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/app-shell/src/orchestra/chapters/sucafina/shared/evidence/**; packages/app-shell/src/orchestra/chapters/sucafina/shared/attachments/**; packages/app-shell/src/i18n/orchestra-chapters/sf-s04.ts; packages/app-shell/test-browser/sucafina-native/s04.test.ts.
LOCKS AUTORIA: files, ui-evidence, ui-frame. INTEGRAÇÃO POSTERIOR: F03, A06.
```

## W10 — S05 — Componentes de relações, threads e confirmação

**Autoria:** 3 path(s) · **Locks:** ctx, domain-read, reviews, ui-collaboration, ui-frame · **Integração posterior:** F03

```text
PAPEL REAL: sessão independente W10, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/S05.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output S05. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para S05. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.

Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/app-shell/src/orchestra/chapters/sucafina/collaboration/**; packages/app-shell/src/i18n/orchestra-chapters/sf-s05.ts; packages/app-shell/test-browser/sucafina-native/s05.test.ts.
LOCKS AUTORIA: ctx, domain-read, reviews, ui-collaboration, ui-frame. INTEGRAÇÃO POSTERIOR: F03.
```

## W11 — A03 — Bindings finos: Procurement

**Autoria:** 7 path(s) · **Locks:** ctx, procurement, transport · **Integração posterior:** F01, F02

```text
PAPEL REAL: sessão independente W11, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/A03.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output A03. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para A03. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.

Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/schema/src/sucafina/procurement.ts; packages/client/src/sucafina/procurement.ts; apps/cli/src/sucafina-product/native-ui/procurement.ts; packages/schema/src/sucafina/procurement/**; packages/client/src/sucafina/procurement/**; apps/cli/src/sucafina-product/native-ui/procurement/**; modules/sucafina/Sucafinav1/test/native-ui-contract/procurement.test.ts.
LOCKS AUTORIA: ctx, procurement, transport. INTEGRAÇÃO POSTERIOR: F01, F02.
```

## W12 — U10 / U10.queue — Procurement overview e filas

**Autoria:** 1 path(s) · **Locks:** bi, ctx, procurement, surface-specs, ui-bi, ui-frame, ui-table · **Integração posterior:** F01, F02, F03, A03, S01

```text
PAPEL REAL: sessão independente W12, partial output only, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/U10.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output U10.queue. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para U10.queue. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.
Fila Requests da fonte real com principal, owner, negativa; P0 navega para U11.title-save sem depender de BI overview.
Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/app-shell/src/orchestra/chapters/sucafina/procurement/queues/**.
LOCKS AUTORIA: bi, ctx, procurement, surface-specs, ui-bi, ui-frame, ui-table. INTEGRAÇÃO POSTERIOR: F01, F02, F03, A03, S01.
```

## W13 — U13 / U13.pr-approval — Aprovações PR, sourcing e PO

**Autoria:** 1 path(s) · **Locks:** ctx, procurement, surface-specs, ui-change-review, ui-frame, ui-table · **Integração posterior:** F01, F02, F03, A03, S01, S03

```text
PAPEL REAL: sessão independente W13, partial output only, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/U13.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output U13.pr-approval. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para U13.pr-approval. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.
P1 ESPECIAL: aprovar/rejeitar PR real submetida sob holder/etapa/valor/versão persistidos. Nunca usar title-save como substituto, nem enfraquecer M31/MI07.
Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/**.
LOCKS AUTORIA: ctx, procurement, surface-specs, ui-change-review, ui-frame, ui-table. INTEGRAÇÃO POSTERIOR: F01, F02, F03, A03, S01, S03.
```

## W14 — A01 — Bindings finos: Dashboard, projetos e contratos

**Autoria:** 7 path(s) · **Locks:** ctx, domain-read, transport · **Integração posterior:** F01, F02

```text
PAPEL REAL: sessão independente W14, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/A01.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output A01. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para A01. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.

Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/schema/src/sucafina/domain.ts; packages/client/src/sucafina/domain.ts; apps/cli/src/sucafina-product/native-ui/domain.ts; packages/schema/src/sucafina/domain/**; packages/client/src/sucafina/domain/**; apps/cli/src/sucafina-product/native-ui/domain/**; modules/sucafina/Sucafinav1/test/native-ui-contract/domain.test.ts.
LOCKS AUTORIA: ctx, domain-read, transport. INTEGRAÇÃO POSTERIOR: F01, F02.
```

## W15 — A02 — Bindings finos: Planner

**Autoria:** 7 path(s) · **Locks:** ctx, planner, transport · **Integração posterior:** F01, F02

```text
PAPEL REAL: sessão independente W15, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/A02.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output A02. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para A02. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.
Grid/adapter TSV: coordenada UI mês 0..11 → produtor 1..12 uma única vez; preview e apply pelo monthly-edit/monthly-host, CAS por linha, parcial sem repetir linhas aplicadas, entrada 320px, sem motor financeiro no client.
Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/schema/src/sucafina/planner.ts; packages/client/src/sucafina/planner.ts; apps/cli/src/sucafina-product/native-ui/planner.ts; packages/schema/src/sucafina/planner/**; packages/client/src/sucafina/planner/**; apps/cli/src/sucafina-product/native-ui/planner/**; modules/sucafina/Sucafinav1/test/native-ui-contract/planner.test.ts.
LOCKS AUTORIA: ctx, planner, transport. INTEGRAÇÃO POSTERIOR: F01, F02.
```

## W16 — A04 — Bindings finos: Casos, alternativas e efeitos

**Autoria:** 7 path(s) · **Locks:** ctx, decisions, transport · **Integração posterior:** F01, F02

```text
PAPEL REAL: sessão independente W16, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/A04.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output A04. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para A04. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.

Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/schema/src/sucafina/decisions.ts; packages/client/src/sucafina/decisions.ts; apps/cli/src/sucafina-product/native-ui/decisions.ts; packages/schema/src/sucafina/decisions/**; packages/client/src/sucafina/decisions/**; apps/cli/src/sucafina-product/native-ui/decisions/**; modules/sucafina/Sucafinav1/test/native-ui-contract/decisions.test.ts.
LOCKS AUTORIA: ctx, decisions, transport. INTEGRAÇÃO POSTERIOR: F01, F02.
```

## W17 — A05 — Bindings finos: Portfólio e sensibilidade

**Autoria:** 7 path(s) · **Locks:** ctx, portfolio, transport · **Integração posterior:** F01, F02

```text
PAPEL REAL: sessão independente W17, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/A05.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output A05. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para A05. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.

Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/schema/src/sucafina/portfolio.ts; packages/client/src/sucafina/portfolio.ts; apps/cli/src/sucafina-product/native-ui/portfolio.ts; packages/schema/src/sucafina/portfolio/**; packages/client/src/sucafina/portfolio/**; apps/cli/src/sucafina-product/native-ui/portfolio/**; modules/sucafina/Sucafinav1/test/native-ui-contract/portfolio.test.ts.
LOCKS AUTORIA: ctx, portfolio, transport. INTEGRAÇÃO POSTERIOR: F01, F02.
```

## W18 — A06 — Bindings finos: Imports, documentos e assets

**Autoria:** 7 path(s) · **Locks:** ctx, files, transport · **Integração posterior:** F01, F02

```text
PAPEL REAL: sessão independente W18, complete work-order, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/A06.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output A06. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para A06. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.

Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/schema/src/sucafina/files.ts; packages/client/src/sucafina/files.ts; apps/cli/src/sucafina-product/native-ui/files.ts; packages/schema/src/sucafina/files/**; packages/client/src/sucafina/files/**; apps/cli/src/sucafina-product/native-ui/files/**; modules/sucafina/Sucafinav1/test/native-ui-contract/files.test.ts.
LOCKS AUTORIA: ctx, files, transport. INTEGRAÇÃO POSTERIOR: F01, F02.
```

## W19 — U11 / U11.title-save — Pedido e progressão PR/PO

**Autoria:** 3 path(s) · **Locks:** ctx, files, procurement, surface-specs, ui-change-review, ui-evidence, ui-frame, ui-table · **Integração posterior:** F01, F02, F03, A03, S01, S03

```text
PAPEL REAL: sessão independente W19, partial output only, UX nativa Sucafina.
REPO gustavomhss/Orchestra-SF. PR99 base de execução documental ux-20-dispatch@cbac654784714f68779ae1434d30e6ea8970c4d1; PR76 sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a; canônico dbf9547211d9b0fade619790de7c19c0869b7c7d; PR91 review77@16712630025cad3de647f2ea49ecbcdb2cc854fa como achados de origem, NÃO autoridade concorrente.
Leia AGENTS aplicáveis, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/EXECUTION-PROTOCOL.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20/README.md, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/manifest.json, modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/work-orders/U11.json e exatos required_reads/contratos/locks de sua ficha. Primeiro leia HEAD real e campos de launch-record publicados por C00 para seu output U11.title-save. Se não existir GO **explicitamente autorizado** por S0/71, SHA/tree material e fonte pinados, contrato/assinaturas atuais FROZEN, ator/branch/lease com owns sem colisão, responda BLOCKED_AUTHORIZATION em vez de escrever, testar ou criar branch.
Depois de GO, leia delta de preimages e altere SOMENTE owns da ficha para U11.title-save. Não edite registry/ACL/SQL/produtores ou paths de outro writer; forneça patch compartilhado inerte com pre/post SHA ao I00. Contratos determinam assinaturas, fields, auth, copy e erros: divergência vira BLOCKED_CONTRACT para a parte afetada, nunca solução improvisada. Um artefato compilável futuro não significa integrado; não crie stubs, mocks permissivos, engine financeira paralela nem schema Any.
P0 ESPECIAL: somente pedido PR draft/rejected real e campo pr.title; CAS versions['requests:'+id].version, X-SF-Native-Owner na transação, sem receipt C12 inventado. P0 NÃO aprova; P1 U13 segue e M31/MI07 continuam.
Entrega obrigatória ARTIFACT_READY: HEAD/tree/blobs pre/post, identidade/lease, exports e fragmento de I00, evidências reais e NOT_RUN separados, blockers/consumers e ACK/lease terminal. Só integrar/qualificar no mesmo candidato real C via 45. Sem merge, full-suite não autorizada, Azure, ou GLOBAL_RELEASE por conta própria.
EXCLUSIVIDADE DE PATHS: packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/title/**; packages/app-shell/src/i18n/orchestra-chapters/sf-u11.ts; packages/app-shell/e2e/sucafina/native/journeys/u11.spec.ts.
LOCKS AUTORIA: ctx, files, procurement, surface-specs, ui-change-review, ui-evidence, ui-frame, ui-table. INTEGRAÇÃO POSTERIOR: F01, F02, F03, A03, S01, S03.
```
