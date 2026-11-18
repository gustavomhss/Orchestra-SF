# Recheck independente — Operations / PR49

**Estado da revisão: COMPLETE_WITH_FINDINGS. Aceite integral do produto: NOT_GRANTED. Aprovação final de C: não concedida.**

Revisão de 14/11/2026, missão `review-operations-delta`, ator S1-R1. Declaro ausência de autoria do produto e das correções examinadas. A revisão e seus três auxiliares trabalharam somente por leitura; o coordenador é o único escritor desta documentação. Nenhum teste foi executado ou disparado.

**Resultado:** cinco correções de código demonstradas nos seus SHAs de origem e uma lacuna de evidência preenchida. Isso não significa seis findings encerrados na composição Operations: PR34 ainda conserva quatro implementações defeituosas corrigidas em PR52/58/60, o impasse C12 continua aberto e duas exportações permanecem vermelhas. O cenário original monetário de OPS-REV-01 foi corrigido e efetivamente consumido.

## 1. Identidade, continuidade e fronteira

| Fonte congelada | Head examinado | Tree |
| --- | --- | --- |
| PR52 / `operations-fixes` | [`d48065d391e1557d43b63525bdc7f55b168d5206`](https://github.com/gustavomhss/Orchestra-SF/commit/d48065d391e1557d43b63525bdc7f55b168d5206) | `fee20b161def03ccefd0fdde3820a9ed83076eb5` |
| PR57 / `sourcing-money` | [`2a185e05967f611d63796684379761ded991092b`](https://github.com/gustavomhss/Orchestra-SF/commit/2a185e05967f611d63796684379761ded991092b) | `5f3f826dcafe7ac78817290160d2540f6a7d1723` |
| PR58 / `import-recovery` | [`e1dc51a6df8cd40a125d960dce6fa5e5d8b33c5e`](https://github.com/gustavomhss/Orchestra-SF/commit/e1dc51a6df8cd40a125d960dce6fa5e5d8b33c5e) | `29a9b20832237eab91a1c15d678db57264bd1de2` |
| PR60 / `procurement-apply` | [`8e23e592602fb9f2fae9ce8f824322a073073e23`](https://github.com/gustavomhss/Orchestra-SF/commit/8e23e592602fb9f2fae9ce8f824322a073073e23) | `e69eb3bb67ad85175af1165dbeca86a04dfa42ae` |
| PR34 / `astra-operations` | [`15df31a67efab0aae6e2bff2b7eb8e5e59511324`](https://github.com/gustavomhss/Orchestra-SF/commit/15df31a67efab0aae6e2bff2b7eb8e5e59511324) | `c011ad6fe1647f9e92d68e6bd9ec723d4db26827` |

Missão e COMMON: [commit c708ec06](https://github.com/gustavomhss/Orchestra-SF/blob/c708ec0609dbfc95b259707d8c38481617f74f11/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-wave/review-operations-delta.json). Plano imutável: `dbf9547211d9b0fade619790de7c19c0869b7c7d`. O pack **S1-R1 completo**, COMMON e os três anexos obrigatórios foram lidos; [evidence.json](evidence.json) registra a leitura integral distribuída por segmentos, blobs e obrigações.

A PR49 continuava em `048b46acd3d70dc7ddafbea9e9b439f0d2e781d9`, exatamente o head esperado. Os dois handoffs anteriores são terminais, a missão autoriza nova revisão e não havia claim concorrente nos paths novos. A autoridade não foi inferida de silêncio. A escrita se limita a `docs/sf2h/receipts/reviews/operations/recheck-wave/`. Os pareceres de `6830fa15` e `048b46ac` permanecem integralmente preservados.

PR34 avançou do input `ba8a09e3` para `15df31a6`; PR60 avançou do produto `897484c9` para o head de recibos `8e23e592`. Esses deltas foram reconciliados. Os demais heads coincidem com os inputs da missão. Avanços posteriores ao corte precisam de recheck próprio; não recebem aprovação automática.

## 2. Matriz dos nove findings originais

A coluna de origem julga o cenário no **SHA da correção/prova** acima. A coluna PR34 julga separadamente `15df31a67efab0aae6e2bff2b7eb8e5e59511324`. `OPEN` no consumidor está apoiado nos blobs/caminhos ainda defeituosos, e não apenas na ausência de intake.

| Finding original | Resultado no SHA da correção/prova | Consumidor PR34 | Justificativa curta |
| --- | --- | --- | --- |
| D-OPS-01 | PR52: **RESOLVED_WITH_EVIDENCE** | **OPEN** | Schemas/chaves ainda antigos no consumidor. |
| I-OPS-02 | PR52: **OPEN** | **OPEN** | Teste verde reproduz 409→409→409; patches não aplicados. |
| OPS-REV-01 | PR57: **RESOLVED_WITH_EVIDENCE** | **RESOLVED_WITH_EVIDENCE** no cenário original | C02/C06 e valor legado corrigidos. Exportações têm dois findings existentes abertos. |
| OPS-REV-02 | PR60: **RESOLVED_WITH_EVIDENCE** | **OPEN** | Preparo/review atuais ainda não têm gate de etapa/pós-condição física. |
| OPS-REV-03 | PR52: **RESOLVED_WITH_EVIDENCE** | **OPEN** | Busca atual ainda corta antes de ACL/deduplicação. |
| OPS-REV-04 | PR58: **RESOLVED_WITH_EVIDENCE** | **OPEN** | Admissão atual ainda usa o blob antigo sem proof durável. |
| E-OPS-01 | **NEEDS_RECHECK** | **NEEDS_RECHECK** | Não foi demonstrada recuperação C12 positiva completa pela UI. |
| E-OPS-02 | PR58: **RESOLVED_WITH_EVIDENCE** | **NEEDS_RECHECK** | SQLite reaberto + runtime reconstruído + replay autorizado; execução não pertence à PR34. |
| E-OPS-03 | **NEEDS_RECHECK** | **NEEDS_RECHECK** | Casos foreign UID continuam sem execução observada. |

[findings.json](findings.json) conserva o ID e escopo originais, severidade, causa, owner, critérios, pins de commit/blob/linha, limites e próxima ação para cada finding. A classificação `RESOLVED_WITH_EVIDENCE` é delimitada ao escopo declarado; não aprova integralmente WP04/WP06, uma coleção de heads ou o candidato C.

## 3. Correções documentais da PR52

### D-OPS-01 — reuso de schema e identidade da intenção

O [registry corrigido](https://github.com/gustavomhss/Orchestra-SF/blob/d48065d391e1557d43b63525bdc7f55b168d5206/modules/sucafina/Sucafinav1/product/documents/schemas.ts) (blob `fbe4b70444d4a7341a30372c754842a5aca3ce70`, linhas 62–90) procura definição equivalente sob acesso e fonte atuais, prefere schema já referenciado por candidato e preserva CAS/source fence/ledger. O [workbench](https://github.com/gustavomhss/Orchestra-SF/blob/d48065d391e1557d43b63525bdc7f55b168d5206/modules/sucafina/Sucafinav1/product/documents/workbench.ts) (`3d21a461c88da2372eae57d0e066ff59d9f21f55`, linhas 33–45) conserva as chaves de schema e extração durante resultado incerto. A proteção de `sameExtraction` não foi removida.

O [run 43625203326](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625203326) executou **8 pass/0 fail**, 96 expectativas: duas submissões completas, candidato confirmado, respostas perdidas depois de commit e recusas por divergência semântica/revogação/substituição. O teste Chromium usa renderer, handler, serviços e SQLite reais com transporte controlado; não prova recuperação da intenção em outra sessão de browser.

Na PR34, schemas `50e20b20…` e workbench `d9769a4f…` continuam derivando ID/chave da operação. O seam document-services é idêntico nas duas branches; não há compensação alternativa. **OPEN no consumidor**.

### OPS-REV-03 — limite depois de autorização

[capabilities.ts da PR52](https://github.com/gustavomhss/Orchestra-SF/blob/d48065d391e1557d43b63525bdc7f55b168d5206/modules/sucafina/Sucafinav1/product/documents/capabilities.ts) (`2753c07ee03472d35d3b93789e3cb9ba309f6a41`, linhas 151–197) aplica autorização/fonte corrente e deduplicação antes do orçamento. A 101ª fonte é testemunha de limitação e também é revalidada no egress; fontes sem match não escapam dessa revalidação.

O [run 43626678715](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43626678715) terminou **4 pass/0 fail/2 filtered out**, 37 expectativas. Cobriu candidatos repetidos, prefixo inacessível, limite 100/101 e mudança/revogação no egress. Dois casos de cardinalidade usam reader/política sintéticos declarados; não qualificam ACL nativa de 104 anexos.

Na PR34, [o blob `6b655187…`](https://github.com/gustavomhss/Orchestra-SF/blob/15df31a67efab0aae6e2bff2b7eb8e5e59511324/modules/sucafina/Sucafinav1/product/documents/capabilities.ts) conserva `records.slice(0,100)` antes de ACL/deduplicação e metadata baseada no corpus bruto. **OPEN no consumidor**.

## 4. C12: correção de intenção e impasse de recuperação são casos distintos

### OPS-REV-02 — PR60 corrige o preparo que prometia uma mutação ignorada

[prepared.ts](https://github.com/gustavomhss/Orchestra-SF/blob/8e23e592602fb9f2fae9ce8f824322a073073e23/modules/sucafina/Sucafinav1/product/procurement/prepared.ts) (`e613a1bf32fe1ee75574139cf699c34843cf25d1`, linhas 39–95) restringe PR a `draft/pr_rejected`, representa no-op explicitamente e exige a pós-condição de cada campo físico solicitado depois de `domain.execute`, tanto na prévia quanto no Apply. [scenario-preparation.ts](https://github.com/gustavomhss/Orchestra-SF/blob/8e23e592602fb9f2fae9ce8f824322a073073e23/modules/sucafina/Sucafinav1/product/procurement/scenario-preparation.ts) propaga a causa; [prepared-review.ts](https://github.com/gustavomhss/Orchestra-SF/blob/8e23e592602fb9f2fae9ce8f824322a073073e23/modules/sucafina/Sucafinav1/product/procurement/prepared-review.ts) verifica etapa, intenção projetada e moeda. O bridge recompõe a mutação pelo produtor reforçado.

O [run 43626285237](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43626285237) confirma **10 pass/0 fail**, 141 expectativas. Os positivos HTTP/SQLite em `draft/pr_rejected` persistem exatamente 100→150, com um recibo, replay, digest/ator/fonte/CAS e revogação. Em `po_draft`, o preparo e review recusam, e um digest nunca emitido não autoriza Apply.

Limites: escolha/caso são fixtures semeadas com cobertura de custos pendente; a entrada legada é negativo sintético. O save ignorado e a intenção mista são controles em clone descartável. Não houve reparo de recibo histórico, prova de modelo ou restart/recovery C12.

PR34 mantém os três blobs anteriores — `9c1b657d…`, `8c83680a…`, `d6382e93…` — sem os gates e sem pós-condição. O delta de runtime nessa branch trata consumo monetário, não o comando desse cenário. **OPEN no consumidor**.

### I-OPS-02 — o green novo demonstra o defeito

O [run 43624678702](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43624678702) passou suas duas assertions de cenário, mas seu resultado material é:

- primeiro Apply **409**;
- retry idêntico **409**;
- runtime/SQLite reconstruídos e repetição da intenção original **409**;
- um efeito financeiro e um recibo durável, porém nenhum receipt no caso;
- `runtimeReconstructed=true`, `sqliteReopened=true`, `processRestarted=false`, `recoveryAccepted=false`.

[O teste declara esse propósito](https://github.com/gustavomhss/Orchestra-SF/blob/d48065d391e1557d43b63525bdc7f55b168d5206/modules/sucafina/Sucafinav1/test/product/operations-fixes/c12-concurrency.test.ts), inclusive nas linhas 8–9. UI, host, executor e HTTP são os mesmos blobs em PR52 e PR34: a versão antiga é recusada antes do lookup durável e a UI não constrói a recuperação. O controle API com versão corrente e digest original consegue 200 com o mesmo recibo; isso não é recuperação disponível ao usuário.

Os patches `c12-receipt-recovery.NOT_APPLIED.patch` e `c12-current-executor.NOT_APPLIED.patch` são **propostas não aplicadas e não executadas**. **I-OPS-02 permanece OPEN; E-OPS-01 permanece NEEDS_RECHECK** como lacuna de recuperação C12 completa. Não se inventa novo defeito de persistência nem duplicação financeira.

## 5. Monetário: cenário original resolvido, exportações abertas

O [helper por etapa](https://github.com/gustavomhss/Orchestra-SF/blob/2a185e05967f611d63796684379761ded991092b/modules/sucafina/Sucafinav1/product/procurement/monetary.ts) é idêntico na PR57 e PR34, blob `c9a224b12c13b7cec506be90527300caa7e984fd`. Sourcing usa snapshot submetido mesmo com PO futura já existente; o fallback legado recebe projeção temporária `po:null`.

No [run 43626658534](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43626658534), cinco casos passaram: EUR100×1,08 conserva USD108 depois de FX2 em C02/C06/comparison, inclusive o fingerprint. Naquele SHA, `rawLegacyValue=200` era **diagnóstico de consumidor ainda incorreto**, não prova de sua correção. O run anterior de 58 casos pertence ao W inicial e inclui os cinco revalidados; não são 63 testes distintos.

Na PR34, [runtime/procurement.ts](https://github.com/gustavomhss/Orchestra-SF/blob/15df31a67efab0aae6e2bff2b7eb8e5e59511324/modules/sucafina/Sucafinav1/runtime/procurement.ts), blob `20a3ec5a30ac0fce6b35f05750d1b3dced11c45b`, usa a mesma base em request.value, registro em memória, Requests sem C02 e resumo/detalhe. Sua prova própria confirmou os oito casos monetários. **OPS-REV-01 original está RESOLVED_WITH_EVIDENCE no produtor e nesse consumidor.**

O agregado [43628901747](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628901747) continua **FAILURE: 10 pass/2 fail/0 skip**, 212 expectativas. Além dos oito monetários, passaram dois cenários Atlas. As duas regressões normais de exportação falharam:

| Finding existente | Esperado | Observado |
| --- | --- | --- |
| OPS-CONSUMER-EXPORT-01 | PO futura USD200, FX2/current, estimate, sem aprovação própria | USD108, FX1,08/submitted, pending-approval e aprovação emprestada do sourcing |
| OPS-CONSUMER-EXPORT-02 | Linhas 40/60 | Linhas 100/100 |

[downloads.ts](https://github.com/gustavomhss/Orchestra-SF/blob/15df31a67efab0aae6e2bff2b7eb8e5e59511324/modules/sucafina/Sucafinav1/runtime/downloads.ts) conserva preimage `fa365f9d350be341348ab69d789e40779c8b9756`. Nas linhas 241–247, o wrapper resolve a requisição inteira para a PO futura; linhas 205–206 reutilizam o total da quote por linha. O [patch publicado](https://github.com/gustavomhss/Orchestra-SF/blob/15df31a67efab0aae6e2bff2b7eb8e5e59511324/modules/sucafina/Sucafinav1/docs/sf2h/receipts/operations-consumers/attempt-01/downloads-owner.patch) é **NOT_APPLIED/NOT_VALIDATED**. Esses dois IDs permanecem abertos separadamente, sem ampliar retroativamente OPS-REV-01.

## 6. Importações: correção real e prova de reabertura discriminante

### OPS-REV-04 — par bytes/proof durável

[staged-files.ts da PR58](https://github.com/gustavomhss/Orchestra-SF/blob/e1dc51a6df8cd40a125d960dce6fa5e5d8b33c5e/modules/sucafina/Sucafinav1/product/imports/staged-files.ts), blob `0d42f5242acd3d1c93bc110422285b96975b8ea0`, grava bytes e proof da entrada na mesma transação. A recuperação exige identidade/digest/expiração originais, revalida alvo/autoridade e reconcilia catálogo de resultado incerto sem apagar material possivelmente publicado.

O [run 43626093062](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43626093062) passou 14 casos, incluindo sete de admissão, quatro Apply e três regressões. Interrupção antes do catálogo, ACK perdido, divergências, revogação, expiração e recuperações concorrentes têm contraprovas.

**Limite:** órfãos antigos sem proof são preservados e recusados; não há migração ou recuperação universal desses órfãos. A PR34 ainda usa o blob antigo `b24558f415f48921b43255169ec0cc82d7037ddb`, que recusa blob existente antes de reconciliar catálogo. **OPEN no consumidor**.

### E-OPS-02 — a nova prova faz Apply depois do reopen

[apply-restart.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/e1dc51a6df8cd40a125d960dce6fa5e5d8b33c5e/modules/sucafina/Sucafinav1/test/product/review-fixes/import-recovery/apply-restart.test.ts), blob `19949fd9821bb8768b9feffcc398b5313aa5fbef`, perde a resposta depois do commit, fecha SQLite, demonstra que o driver antigo não funciona, cria novos store/authority/services/host, autentica novamente, recupera manifesto/detail/recibo e repete o mesmo Apply **depois** da reabertura. Compara os snapshots completos de domínio, revisões, transações, auditoria e recibos sem duplicação. Inclui logout persistido e revogação de grant mesmo após login novo.

O [run final 43627493939](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627493939) executou **4 pass/0 fail**, 84 expectativas, depois de ajuste tipado da fixture. Isso preenche a lacuna original da leitura isolada de audit.length. **RESOLVED_WITH_EVIDENCE no W2 da PR58**.

Não foi kill de processo, restart do desktop/server, prova de IdP/scanner corporativo ou browser E2E. Seis componentes centrais do consumidor são byte idênticos PR58↔PR34, mas o novo teste não existe na PR34 e seus runs não foram executados nesse pin. **NEEDS_RECHECK para crédito no candidato consumidor**.

### E-OPS-03 — dois skips preservados

Os logs oficiais de [43554658437](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43554658437) e [43555674548](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43555674548) confirmam `skip` para diretório e banco com UID estranho. O [teste atual](https://github.com/gustavomhss/Orchestra-SF/blob/15df31a67efab0aae6e2bff2b7eb8e5e59511324/modules/sucafina/Sucafinav1/test/local-store.test.ts) conserva `skipIf(process.getuid?.() !== 0)`, linhas 574–588. As seleções desta onda não preenchem essa lacuna. **NEEDS_RECHECK**, sem alegar bypass.

## 7. Typechecks, guards e proveniência

| Origem / SHA efetivamente examinado | Run de checks | Sucafina | CLI | Guards |
| --- | --- | --- | --- | --- |
| PR52 `c9b14ba6` | [43627083716](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627083716) | **FAIL** | PASS | PASS |
| PR57 `a3b7fb9b` | [43626850572](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43626850572) | **FAIL** | PASS | PASS |
| PR58 `e1dc51a6` | [43627773376](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627773376) | **FAIL** | PASS | PASS |
| PR60 `897484c9` | [43627354338](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627354338) | **FAIL** | PASS | PASS |
| PR34 `15df31a6` | [43629903794](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43629903794) | **PASS** | **PASS** | **PASS** |

Nos quatro checks de origem, o FAIL integral é TS2741 no caller WP14 por falta de `procurementEvidenceWrites`. Nenhum diagnóstico próprio não significa typecheck aprovado. PR34 tem o caller corrigido, blob `d7d2a69837560f42438d470b83724c1a61939a73`, e os dois typechecks foram **executados**, sem skip. Esse PASS não reclassifica retroativamente as quatro origens, nem transforma o funcional 10/2 em sucesso.

Foram auditados nove runs funcionais, cinco checks e os dois logs históricos de UID. Requests, jobs, SHAs W/S, blobs, seleções exatas, resultados e limites estão em [evidence.json](evidence.json). As relações W→S acrescentam somente o request correspondente. Deltas produto→head foram inspecionados; execuções continuam atribuídas ao W real.

Na PR52, o delta final documental também acrescenta quatro linhas a um HANDOFF anterior; a identidade dos inputs executáveis é preservada, mas não se declara esse head um D final admissível pelo envelope append-only. A publicação desta revisão acrescenta somente arquivos novos.

A revisão verificou conteúdo oficial dos logs e identidades Git; não recalculou SHA256 dos logs nem baixou/reinspecionou ZIPs. Limites de fixture, provider, scanner, browser e processo são conservados. O escopo canônico de 15 WPs, 74 tasks, 17 contratos e 1.610 critérios não foi reduzido ou aprovado por associação.

## 8. Encaminhamento

1. **S0/astra-operations:** consumir sob lease vigente os deltas comprovados PR52/58/60, preservando o intake monetário e caller Atlas já corrigidos. Reconciliar novos HEADs e provas afetadas.
2. **WP01/WP04/WP11:** aplicar recuperação de recibo C12 e fechar I-OPS-02 pelo consumidor; completar E-OPS-01. O green de reprodução já existente não basta.
3. **Owner de downloads + S0/Compose:** reconciliar o patch proposto e fechar OPS-CONSUMER-EXPORT-01/02 com os mesmos oracles, preservando PO submetida/cancelada.
4. **WP10:** apresentar execução discriminante dos dois casos de UID; manter E-OPS-03 pendente até lá.
5. **Revisor sucessor:** partir deste corte, conferir somente deltas e evidências pertinentes; não repetir diagnósticos já demonstrados nem inventar aceite de C.

[HANDOFF.md](HANDOFF.md) registra a passagem e os próximos consumidores. Esta revisão termina com parecer publicado e produto ainda sem aceite integral. Nenhuma branch/PR nova, teste, alteração de produto, merge ou aprovação final foi realizada.
