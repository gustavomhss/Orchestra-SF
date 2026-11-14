> Anexo de leitura independente consolidado por S2-R2. AUX-C12-ORACLE-01 corresponde a R28-C12-ORACLE. AUX-C12-FINAL-SOURCE-01 e AUX-C06-CALLBACK-01 são contraprovas pendentes, sem promoção a bugs executados. Este anexo não constitui outro parecer obrigatório da campanha.

# Missão28 — leitura auxiliar independente C03 / C06 / C12

**Candidato único revisado:** `0ce090d7d1d4399d77b435debd59eb7cc903c202`, `gustavomhss/Orchestra-SF`. Plano: `dbf9547211d9b0fade619790de7c19c0869b7c7d`.

Este parecer auxilia S2-R2. Declaro ausência de autoria de produto, testes, fixtures, configuração e correções examinadas. Não sou worker nativo nem supervisor da campanha. Produto permaneceu somente leitura; não criei ou executei testes, typecheck, CI, comandos de produto ou mutações remotas. Li fontes remotas somente pelo GitHub MCP e os caches locais correspondentes. Os números de testes abaixo vêm de logs de Actions já existentes, não de execução nesta revisão.

## Resultado

**C03, C06 e C12: NEEDS_EVIDENCE para aceite integral deste SHA.** Há correções reais integradas, e os defeitos históricos de “não há recovery” e “reply de destinatário sem recibo inequívoco” não podem ser reapresentados como se o código estivesse inalterado.

A diferença mais concreta desta fatia é a integração C12: o executor no candidato já inclui a reserva Finance de tentativa indeterminada e a reconciliação sobre caso fresco, mas os testes C12 incorporados ainda exigem o retorno stale/409 do executor fonte anterior. O verde da fonte não qualifica esse executor composto. Também faltam, nesta evidência delimitada, a jornada AM04 completa no candidato e as contraprovas finais de fonte/callback descritas abaixo. Não há aprovação, merge ou GLOBAL_RELEASE.

## Escopo normativo lido

Leitura integral de AGENTS, COMMON de execução, seções C03/C06/C12 do pack S2-R2, consumer_edges, coverage e execution_proofs AM01–AM06. Li integralmente `specs/product-acceptance.md` (blob `ded082688fce327def0b48968fa3b89a5831029c`) do plano. Não carreguei pack de outro ator.

- C03/C12 exigem idempotência por ator/alvo/encarnação/conteúdo, recibo no mesmo commit do efeito, nova autorização no retry, conflito quando a mesma chave muda de conteúdo, preservação de estado parcial e nenhum redispatch por perda da resposta.
- C06 conserva a versão realmente observada, separada de expectedStorageVersion; usa fingerprint material do escopo e dependências, não versão global ou apenas total final; não revalida encarnação nova como antiga; indisponibilidade não revela fingerprint restrito nem cria recobrança automática.
- AM04 requer escolha e aplicação humanas reais, efeito por domínio, perda após commit, recibo original, um efeito, e estado parcial real. Uma escolha semeada e um segundo domínio somente planejado não fecham essa obrigação.
- Todos os AMs continuam obrigatórios. Fonte corrigida, consumidor integrado e prova executada são fatos distintos.

## Achado acionável AUX-C12-ORACLE-01 — P2

**Tipo:** divergência estática entre implementação integrada e oráculos de prova. Não executei o teste e não declaro um resultado FAIL observado.

**Owners:** WP11/C12 e owner Procurement da prova de recovery; WP10/S0 para composição. O reviewer não modifica esses paths.

**Fonte principal:** `modules/sucafina/Sucafinav1/product/decisions/apply.ts`, blob `6ad51e47b22eca073a0a81731575c463d98673e4`, linhas 114–145, no SHA revisado.

**Contraprova fria:**

1. `test/product/c12-receipt-recovery/consumer.ts`, blob `80e4b8f5eba72f95ba94f906c982e4d4ad902907`, linhas 56–67, agenda uma edição concorrente autorizada do objective e incrementa a versão do caso depois do commit do recibo.
2. O executor alvo, linhas 114–124, reabre o caso fresco, confirma mesma encarnação/participação/choice/change, relê o recibo autoritativo e reautoriza aplicação. Linhas 130–138 preservam os demais campos frescos e fazem o CAS da reconciliação. As linhas 142–145 reclassificam/retêm o recibo e podem retornar sucesso. A mudança de objective por si só não deve voltar a ser um stale irreconciliável.
3. `recovery-ui.test.ts`, blob `5bad0ed7698de7a75ce394773e7ec6d629ea3c10`, linhas 69/75, exige 409 e `case-changed-after-application`; linhas 91–92 exigem mudança ainda planned e lista central de receipts vazia; linha 99 exige retry409.
4. `recovery-http.test.ts`, blob `15aaff1ae0406f9b495c9f60b81b18d9c8174e64`, linha 84, e `normal-retry.test.ts`, blob `f1b39878522b5c154b6e250bb2fd1c93e2428025`, linhas 17/23/37/44–45, preservam a mesma expectativa antiga.
5. O executor efetivamente testado na fonte `0b483fbf2040e0551f817ea6211d54c7cb2e2d14` é o blob `2776a112cd24c1cb3bd4fe2791f7b232fb68286d`; comparei seus bytes com o alvo. Os quatro outros componentes centrais C12 — prepared-apply, decision-host, decision-http e UI decision-apply — são os mesmos blobs, mas apply.ts não é.

**Impacto:** a composição incorpora comportamento desejado novo sem prova coerente desse comportamento. Reutilizar os sete PASS da fonte como PASS do alvo encobre o delta; executar a seleção inalterada pode parar nas expectativas antigas antes de provar toda a recuperação.

**Correção segura pelo owner:** adaptar o cenário/oráculo à reconciliação fresca, mantendo perda real de resposta, recibo original, uma mutação, intenção original, revogação, encarnação e CAS. Se é necessário forçar “domínio committed / caso não reconciliado”, produzir essa interrupção específica em vez de presumir que toda edição irrelevante precisa falhar. Preservar a união Finance+C12 e não restaurar o executor antigo para satisfazer testes. Qualificar o SHA composto e publicar W/S, request e logs.

## C12 — correções verificadas e limites

### Fonte corrigida e consumidor presente

- `product/procurement/decision-http.ts` blob `fa83ce380647f02d8942f01ffbc1981cf1b2494d` monta a rota privada decision-recover com parser/admissão humana, não uma capability financeira nova.
- `product/procurement/decision-host.ts` blob `14e41977752f48fc0f204dc5e5893521a5bd1d30`, linhas 232–275, admite o modo recover, resolve a intenção durável original e exige recibo found antes de executar reconciliação. Linhas 181–186 não permitem resolver mutação quando o modo é recover.
- `product/decisions/apply.ts`, linhas 39–42 e 65–97, separa found de not-found, recusa recovery sem recibo e mantém applicationAttempt antes do possível dispatch. A marca createdHere evita tratar replay de transação anterior como autorização para novo dispatch.
- `product/decisions/application-attempt.ts` blob `d7ef49df787cc4b058f0992b1fbbdc5c0cb6634e` usa a mudança/caso/encarnação para reserva global à mudança, ainda que os receipts transacionais sejam por ator.
- `product/decisions/prepared-apply.ts` blob `90c3e981d8418c562342660bd3d56d03f9995383`, linhas 28–46, autoriza lookup antes/depois da leitura; chave/digest divergentes conflitam. Linhas 85–107 executam comando de domínio e persistem recibo no mesmo C08 domainSurface transaction; comparações incluem actor, incarnation, expectedVersion e digest. Não são dois commits independentes.
- `product/ui/decision-apply.ts` blob `a182c632c1714e3c48e6be07142adc7ed87d8f13` contém a ação de recuperação e valida o receipt. A falta anterior de endpoint/retomada não descreve o alvo.
- A retenção final compara exatamente case/receipt/review proof; isso é consistência, não nova concessão de autoridade.

### Prova executada na fonte, verificada independentemente

Li metadados do run, log do job e compare W→S pelo GitHub MCP:

| Campo | Valor |
| --- | --- |
| Fonte W2 | `0b483fbf2040e0551f817ea6211d54c7cb2e2d14` |
| Snapshot S2 | `f4a1e6e2743188276f42dd68e14b7c06a23ad55c` |
| Run / job | [43636531401 / 132574441676](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43636531401/job/132574441676) |
| W2→S2 | Um commit; somente `.ci-run.json` |
| Request blob | `2a3fb5dd04b5e9f1f9721495096b6c46451319ff` |
| Seleção | recovery-http.test.ts + recovery-ui.test.ts; timeout120000 |
| Resultado | 7 PASS / 0 FAIL / 225 assertions / 2 arquivos / 125,46s |
| Target apply.ts | Diferente do blob executado |

Os logs confirmam: ausência de recibo não altera domínio; reserva sem recibo permanece indeterminada e não redispatcha; digest/principal/payload/target/incarnation/key divergentes recusados; revogação depois do receipt read e no final state read recusa; reposição física antes da tentativa recusa; recuperação e repetição retornam recibo original com um efeito; contexto novo de browser, armazenamento vazio e SQLite reaberto.

**Limites concretos:** o GET é shell mínimo autorizado, os POST/renderer/script/C08/SQLite são reais; o processo Bun não foi reiniciado; a escolha foi semeada com cobertura explicitamente pending; o caso Planner ficou planned, não é AM04 Planner-applied/Procurement-refused; não há run único verde de19 testes. Os 12 resultados reaproveitados do primeiro run continuam sob aquele W/run, cujo agregado falhou. Esta revisão não converte esses limites em PASS do alvo.

### Contraprova pendente AUX-C12-FINAL-SOURCE-01

**Classificação: NEEDS_EVIDENCE, não vulnerabilidade executada.**

`apply.ts` linhas 45–60 faz authorizeApplication antes do último retainReceipt. A retenção relê somente cases/receipt/proof e valida Request/signal. `decision-host.ts` linhas 160–180 confere encarnação física e escopo na chamada anterior targetIsCurrent. O C08 `state-provider.ts` blob `2fd55c7304add0829d7434917c80664fe86356b9`, linhas 28–38, reautoriza principal/accessRevision/policy, não a fonte Procurement. A autoridade instalada calcula essas revisões pelos grants; mudança somente na fonte não altera necessariamente esses grants.

Uma substituição autorizada do mesmo ID, entre a última consulta da fonte e o read final de retenção, pode conservar case/receipt/grants. `source-lifecycle.ts` blob `d43a630254142bc5e5fb3589d1120a328abf2d1c`, linhas 164–208, mostra que exclusão/recriação ou replacement troca as encarnações sem exigir alteração dos namespaces centrais. O wrapper withCase não fornece outro fence da fonte depois de execute.

A prova existente cobre revogação de autoridade no read final e substituição antes da recuperação, não essa ordem exata. Solicitar prova do owner com o consumidor instalado, preservando os callbacks/identidades e mostrando recusa ou justificativa contratual do ponto de linearização. Uma leitura concorrente pode ser linearizada antes da substituição; sem uma obrigação de egress mais forte aplicada e sem execução, não promovo a janela a BUG confirmado.

## C03 / C06 — Colaboração

### Recibo inequívoco de reply e consumidor atual

`product/collaboration/recipient-actions.ts`, blob `22c6309c61b27b89914086a7602bf3bea61a988b`, é idêntico ao produtor `f34edcfff26d0041145e13ea612d8d67f58dcbff` conferido por fetch. Seu resultado devolve o saved.value durável e relaciona ação, principal, chave, commandDigest, intentDigest, fonte e reply id/incarnation/version. O replay passa por C08 e não aloca nova mensagem ou reabre thread resolvida.

As linhas 75–86 capturam identidades exatas dos callbacks/objetos de autoridade, persistence, transactionAll, read, mutationFence e review; as verificações cercam awaits. Não concluí autoridade apenas por projeções iguais. O fence final protegido compara recibo e thread com fonte/autoridade presentes. Boolean legado e mensagem editada não viram recibo por inferência de texto.

No alvo, `product/ui/work-collaboration.ts`, blob `d9362a92e0bc71c8068790bf308e2a88adcb3243`, já consome esse contrato:

- Linhas 102–118 preservam/restauram intenção em sessionStorage, limitada por escopo e prazo, sem tratar storage como credencial ou ACK.
- Linhas 120–125 validam mutationReceipt e reply por id/incarnation/version mais intenção/principal/chave; igual autor/texto não basta.
- Linhas 242–264 mantêm o payload/chave originais no retry e só limpam a intenção quando o receipt esperado é comprovado.
- Revogação limpa intent/DOM e bloqueia o consumidor.

Portanto o README ui-work anterior, que chama ACK de destinatário inconclusivo, é evidência histórica da base antiga; não descreve integralmente esse blob alvo.

Li o run [43628901092 / job 132550878448](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628901092/job/132550878448) independentemente: head `0499e3e313814baad066b3cccb14e4c37ee9fa1c`, SUCCESS,20PASS/0FAIL/247 assertions/8arquivos. Compare de `9dd3c830810d4f3e56f0e3474f5a633978c91831` ao snapshot contém somente .ci-run.json. Os nomes executados incluem mensagens iguais com identidades distintas, resposta perdida+SQLite reopen, replay de thread resolvida, intenção divergente, Boolean legado, versão editada, revogações finais e substituição física.

Esse é o produtor. A prova conserva o payload em memória do teste; não prova sozinha persistência/ACK positivo após reload do novo consumidor browser. Não localizei nessa fatia um run do SHA alvo que feche essa jornada.

### Confirmação por escopo, CAS e reuso

Li integralmente confirmation.ts, confirmation-observations.ts, confirmation-source.ts, confirmation-work.ts, source-fence.ts, answer-reuse.ts, answer-state-fence.ts, recipient-actions.ts, dispatch.ts e work-collaboration.ts do alvo.

- `confirmation.ts` blob `9d38a30265e6efc2c9667371087a87bcce8e682f`: projeção separa unavailable, removed/replaced, material-change e dependency-change; conserva observedSourceVersion, aplica expectedStorageVersion ao namespace, compara físico/fingerprints antes do commit e reobserva depois. Igualdade da versão global não substitui validade material.
- `confirmation-observations.ts` blob `8219b413786bf3d4db93df4c4d95172861b108e9`: observation receipt liga escopo/fonte/fingerprint ao binding e à lease; confere lease e entrada de mapa em torno da autorização.
- `confirmation-work.ts` blob `68f43ca3f03602fc7ac825fa8ac926d460a7dbfe`: identidade canônica de obrigação é sourceRef (com incarnation), campos ordenados e período; latest por escopo substitui manifesto anterior sem criar nova cobrança por cada versão global.
- `source-fence.ts` blob `6249086a1f78a3988bda27ee940b9fa20c5194b0`: Request atual, autorização de escopo e checkScopedSource voltam a ser verificados; não usa somente igualdade do total.
- `answer-state-fence.ts` blob `7b19cf14f220adb3a01530515ec5ad1657bc8f11`: captura identidades de persistence/transactionAll/currentSnapshots e verifica thread/baseline antes e depois do producer fence.
- `answer-reuse.ts` blob `012175e4acc2be40547089b43f248144beb6c712`: conserva baseline observada, fonte física, fingerprints e review basis; reobserva/reautoriza/reconfere estado antes de liberar. No ramo C05, linhas 42–47 capturam observe/fence por identidade.
- `dispatch.ts` blob `7d30096e973b003f222698bf2f605fc24031aba5`: usa as portas de Colaboração, sem um engine financeiro paralelo; review C05 answer-read pelo bridge recusa quando o contrato não pode transportar o pin necessário. Essa recusa explícita não é sucesso de equivalência UI/MCP.

**AUX-C06-CALLBACK-01 — NEEDS_EVIDENCE.** O ramo normal observe/fence de answer-reuse.ts linhas49–50 usa input.observe/input.fence dinamicamente; confirmation-source.ts também delega ao objeto produtor após awaits. Não demonstrei deriva de callback no host instalado, nem considero callback novo equivalente só por retornar o mesmo fingerprint. Falta a contraprova temporal desse produtor/consumidor ou a demonstração de uma imutabilidade efetiva do contrato. Não é um BUG executado.

Não executei CONFIRM-SCOPE no alvo. A inspeção estática acima e os testes source de recipient receipt não fecham todos os exemplos v7/v8, janeiro/fevereiro, dependência/material/race, revogação e encarnação do C06.

## Ledger complementar e passagem ao reviewer principal

Fontes C12 lidas integralmente: apply, prepared-apply, application-attempt, procurement c12, decision-host, decision-http, UI decision-apply; recovery-http, recovery-ui, normal-retry, consumer e fixture; HANDOFF C12, attempt01 INTEGRATION, attempt02 TESTS e handoff histórico Operations. Source-W2 versus alvo comparados pelos cinco blobs centrais e pelo diff de apply.ts.

Fontes adicionais de composição consultadas: state-provider read; product-authority principal/accessRevision; ui-authority revalidate/requestFor; business-services withCase; source-lifecycle completo. Não reivindico leitura integral dos grandes arquivos de composição que consultei apenas nesses trechos.

Este relatório não substitui a cobertura C01–C17 do reviewer principal. FIN-IND-001–005, cálculos/cobertura Finance, persistência de escolhas e Memory permanecem com os responsáveis paralelos definidos pelo principal. Entregar contraprovas e limites acima ao owner, sem alterar produto. Nova fonte ou novo candidato exige recheck independente; não antecipar crédito de mudança posterior.

## Complemento normativo — originais dos WPs

A pedido do reviewer principal, li integralmente os quatro arquivos originais do plano pelo GitHub MCP, no pin `dbf9547211d9b0fade619790de7c19c0869b7c7d`, além das seções do pack já lidas:

| Path sob docs/sf2h-plan/ | Git blob |
| --- | --- |
| work-packages/WP03.json | `875baa9afdc9006039b8b343fae88cc5bd7f9a9e` |
| work-packages/WP04.json | `a6d5f581be25aeeeee223a9ac0e099b4d22dcc7e` |
| work-packages/WP08.json | `42afe6b6194a9cd4de038743673923609059b6a0` |
| work-packages/WP11.json | `b11c665d8a0b529a3a1b2ad16012167b167a2c5c` |

A leitura não muda o parecer; torna mais explícitos seus gates:

- **WP11.T04.CHK.01/.02, DOD.01/.02 e CMP.01:** Planner aplicado/Procurement recusado, perda pós-commit, recibo autoritativo e ausência de redispatch são provas do módulo integrado, com sucesso parcial/pendência de aprovação/resultado desconhecido. O controle fonte com Planner apenas planned não as substitui.
- **WP08.T03.CHK.01–05, WP08.T04.CHK.20 e WP08.T06.DOD.01:** CONFIRM-SCOPE e resposta/obrigação canônicas precisam do mesmo efeito nos consumidores Meu trabalho/caso/rotina. Receipt de reply não equivale a confirmação, reuso ou attachment fechado.
- **WP03.T01.CHK.02/.04 e WP03.T05.CHK.01–04:** cálculo/simulação e execução devem compartilhar o domínio; contraprovas de privacidade e de base versus official são próprias, não satisfeitas por C12 isolado. Cobertura dessa frente segue com o auxiliar Finance.
- **WP04.INV.01/.02 e WP04.T04.CHK.02–04:** recovery não pode ganhar poder de holder/admin nem converter uma escolha em aprovações PR/sourcing/PO; cada etapa e sua revisão esperada permanecem próprias.


