# Revisão independente — contratos e runtime, recheck da onda paralela

## Parecer

**REQUEST_CHANGES / HOLD das rotas ainda abertas. GLOBAL_RELEASE não concedido.**

A revisão finita está concluída. O produto continua com lacunas de consumo/integração e provas obrigatórias pendentes. Esta é uma revisão preliminar por SHAs, **não a aprovação de uma coleção de branches como candidato C**.

Os três resultados centrais são:

- **CR-C11-001 está RESOLVED_WITH_EVIDENCE no WP10 examinado.** O wrapper já preservava `observation` no W27. Não exigir uma segunda implementação da correção.
- **O recibo exato de ACK está implementado e tem provas específicas no produtor atual da PR41.** O caller montado em WP10 continua diferente e ainda pode inferir ACK por texto/autor: **CR-C03-001, P2, OPEN**, recorrência do problema conhecido da PR54.
- **A proposta de quatro para duas transações já foi aplicada em WP10**, com duas observações, seis autenticações e quatro revalidações no caminho positivo. Isso não resolveu a jornada completa: X29 continua FAILURE por prazo cooperativo.

Os registros estruturados de origem, severidade, estado, prova, owner, ação e limites estão em [FINDINGS.json](FINDINGS.json). O achado de ACK foi publicado primeiro em [FINDING-CR-C03-001.md](FINDING-CR-C03-001.md), commit `7124fce97198ca37a866ee2e39641c85c0694a48`. Este relatório acrescenta o call chain e a contraprova estática alcançável, sem alterar aquele registro.

## Independência, escopo e autoridade

A sessão S3-R3 foi solicitada como nova e independente. Não teve autoria, integração ou escrita nos produtos julgados. Três auxiliares somente de leitura apoiaram **este único parecer**; não representam três aprovações finais.

Foram lidos AGENTS, COMMON, o JSON da missão e o pack **S3-R3 completo**, com divisão explícita de todos os campos entre os leitores, e os quatro anexos obrigatórios. O índice de cobertura no EVIDENCE não tem campos faltantes. Nenhum pack de outro ator foi necessário.

Norma: `dbf9547211d9b0fade619790de7c19c0869b7c7d`. Missão: `c708ec0609dbfc95b259707d8c38481617f74f11`. Conservam-se **15 WPs, 74 tasks, 17 contratos e 1.610 critérios**. Esta rodada aprofunda C03/C05/C06/C08/C09/C11/C16/C17; não declara execução ou revalidação individual dos 1.610 critérios.

Escrita restrita a `docs/sf2h/receipts/reviews/contracts/recheck-wave/`, na mesma `review-contracts` / PR51. O HEAD inicial `fa520193f5df9d6585d5f4c40d071215efb42923` correspondeu à missão. O HANDOFF anterior declara encerramento da revisão e disponibilidade para consumo; sua passagem foi lida antes de aceitar esta janela. A ausência de commits não foi usada como prova de encerramento. Nenhum produto, contrato compartilhado, recibo antigo ou branch alheia foi alterado.

**Nenhum teste, typecheck, guard ou CI foi executado/disparado por esta revisão**, conforme instrução explícita. Os resultados abaixo são leituras de execuções existentes. A inspeção textual de patches não executa produto.

## Pins e reconciliação de HEADs

| Papel | PR / branch | SHA de produto ou fonte examinado | Árvore |
| --- | --- | --- | --- |
| Composição/runtime WP10 | #29 / astra-wp10 | `d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7` — W30 | `8f2cd84288df2a9d70402219df871765fe1890ca` |
| Produtor Colaboração | #41 / collab-resume | `62e5629dbf31be2bb662dda152c96021f22b0ca5` | `6a52cb85d78260d5420acac3a4db35ce23873e83` |
| Proposta e negativos ACK | #54 / work-ack | `92243fc68ff81df7fc563ec081ac9db686a24dfa` | `94fb867b702380e49a330b031c6dd27cf73a2516` |
| Diagnóstico/proposta Reuso | #61 / work-reuse | `854f3dd9a5257c83b703424a8fd73d831f705f46` | `4e4cfbdb032a8e3fbb56a2c7094b7acf223af576` |
| Comparador histórico | #44 / compose-resume | `ad7fcdef7739e1bc471e42fac082452799de751b` | `885ce466354d2b8dcf674472561c9c1fc3b632ff` |

WP10 avançou dois commits desde o pin W28 da missão; Colaboração avançou quatro desde `9ec98ac…`. Esses deltas foram reconciliados. PR54/61 conservaram seus pins.

Depois do freeze, a PR29 avançou para `54317229d7f8fcb7e92921c2f4a8dc6f9310270b`. A comparação completa é um filho direto de W30 com **40 adições somente evidenciais**, sem modificação/remoção de produto, testes ou recibos anteriores. Os resultados U30/CHECK30/X29 desse dossiê foram lidos mantendo W30 como produto. Esse delta documental não cria um novo C nem concede aceitação D. Alterações futuras de fonte permanecem pendentes de recheck.

## Matriz de decisão dos contratos pedidos

| Contrato | Produtor/caller efetivamente examinado | Disposição |
| --- | --- | --- |
| C03 | RecipientActions PR41 e Boolean retido em WP10/PR54/61; UI WP10 realmente servida | Produtor corrigido; caller WP10 ainda viola ACK exato. CR-C03-001 OPEN. |
| C05 | Receipt/review fences PR41, hooks de composição WP10 e saída compartilhada C16 | Fences do produtor presentes; mount incompleto e transporte compartilhado explicitamente bloqueado. |
| C06 | Confirmation/observations/answer-reuse PR41 e proposta PR61 versus host WP10 | Validade material e versão observada preservadas na fonte; consumo e latência da composição continuam pendentes. |
| C08 | State provider, product authority, montagem CLI e rotas HTTP | CAS/recibo atômico/reautorização presentes; `recipientAuthority` ausente no mount examinado causa recusa segura. |
| C09 | Case-event source access → BusinessContext, produtor e assinatura atuais | Caller corresponde ao produtor atual. Dois casos C28 passaram; não provaram toda a jornada financeira. |
| C11 | Analysis port/store → wrapper CLI instalado | CR-C11-001 resolvido no WP10. A27 captura corrompida e U30 visibilidade são pendências distintas. |
| C16 | AgentV2/SkillV2/SessionV2 → contribution → transporte MCP privado → dispatch | Cadeia real montada; 39 operações/AM01–AM03 não recebem aceite pela leitura. C05 segue indisponível nessa saída. |
| C17 | BusinessContext → Atlas público/scanner/store C08 e histórico financeiro | Implementação real e geração CHECK30 confirmadas; restart→recall→UI integral, A27 e janela entre observações exigem seus rechecks. |

### C11 — correção existente, não uma nova tarefa de implementação

O [wrapper atual](https://github.com/gustavomhss/Orchestra-SF/blob/d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7/apps/cli/src/sucafina-product/analysis-stale-commit.ts) recebe o quarto argumento, faz clone/freeze antes dos awaits e o encaminha nos dois ramos: lifecycle e `prepare`. A [montagem CLI](https://github.com/gustavomhss/Orchestra-SF/blob/d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7/apps/cli/src/sucafina-product/host-context.ts) instala esse wrapper no store real e o usa em `createSfAnalysisHost/runSfAnalysis`. O produtor continua exigindo observação, CAS e identidade do output para reconciliar `ready → stale`.

A correção de origem é `c3b02c7693c1ff3b702596c7c8458f913972a404`; o mesmo wrapper já está no W27 `ab8fb4f…`. Os seis blobs de wrapper, contexto, store, provider, fixture e teste são iguais entre o W de A21 e W30. A21 confirma quatro casos de lifecycle: observação isolada, output original preservado, CAS, perda de autoridade/lease/caso/abort e separação do cancelamento humano.

Isso sustenta **RESOLVED_WITH_EVIDENCE no WP10 pinado**, sem transformar A21 inteiro em green: o run tem 188 pass/11 fail. O achado original continua correto para a composição antiga PR44, que ainda conserva o wrapper anterior. A revisão histórica e seus arquivos permanecem intactos.

### C03 — o caller WP10 ainda pode confirmar a mensagem errada

A fonte [work-collaboration.ts](https://github.com/gustavomhss/Orchestra-SF/blob/d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7/modules/sucafina/Sucafinav1/product/ui/work-collaboration.ts) guarda uma tentativa pendente, chama `collaboration-thread-reply`, procura uma única mensagem nova com o mesmo texto/autor e então limpa `replyRequest`. Ela não consome `mutationReceipt`. O [produtor na mesma árvore](https://github.com/gustavomhss/Orchestra-SF/blob/d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7/modules/sucafina/Sucafinav1/product/collaboration/recipient-actions.ts) grava Boolean no C08 e devolve uma projeção corrente.

O caller não é arquivo órfão: `product/interface/http.ts` importa e injeta `caseQuestionScript`; `local/entry.ts` monta `createSfWorkbenchHttp`; `runtime/application.ts` despacha o produto. O host também monta os endpoints reais de Colaboração.

**Contraprova estática alcançável, não executada nesta revisão:**

1. A tentativa original grava M1 com texto T, mas a resposta HTTP se perde.
2. O mesmo autor, ainda autorizado e com thread aberta, edita M1 para U. A API montada `collaboration-thread-edit` mantém id/incarnation, incrementa version e guarda a revisão.
3. O autor publica M2 com o texto T.
4. O retry original obtém seu Boolean histórico e uma projeção corrente contendo M1 editada e M2.
5. O predicado do caller descarta M1 pelo texto e aceita M2 como único match, podendo limpar a tentativa original sem comprovar sua identidade.

A edição e sua ligação são visíveis em [thread-history.ts](https://github.com/gustavomhss/Orchestra-SF/blob/d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7/modules/sucafina/Sucafinav1/product/collaboration/thread-history.ts), `http-routes.ts`, `host.ts` e `threadHistoryWrites` da composição. A conclusão de identidade é estática; frequência operacional e incidente real não foram demonstrados.

**CR-C03-001 / P2 / OPEN** é uma recorrência do problema ACK conhecido na PR54 em **outro caller instalado**. A proteção negativa da PR54 tem outro blob e não está no WP10. O producer fix da PR41 também não está nesse mount. Owner: WP01/UI e WP10/S0; WP08 entrega a correção já existente, sem precisar reimplementá-la.

### ACK — o produtor PR41 já entrega o resultado exato

Em [RecipientActions da PR41](https://github.com/gustavomhss/Orchestra-SF/blob/62e5629dbf31be2bb662dda152c96021f22b0ca5/modules/sucafina/Sucafinav1/product/collaboration/recipient-actions.ts), o retorno é aditivo: `value.mutationReceipt`. O recibo vincula thread, principal, chave, commandDigest, **intentDigest da intenção inteira**, encarnação da fonte e a tupla `id/incarnation/version` da resposta.

A transação grava mensagem e recibo conjuntamente. O retorno usa `saved.value`; replay ocorre antes de alocar identidades ou avaliar novo append/reabertura. A tupla identifica a resposta; texto e autor só verificam essa identidade. Boolean legado ou versão original indisponível continuam inconclusivos, sem síntese de recibo.

A liberação final revalida humano/host, thread, fonte física e valor durável sob snapshots protegidos. Para C05, ator e destinatário precisam de leases atuais, inclusive self por `requireSelfLease: true`, após os últimos awaits. O HTTP privado transmite o campo sem removê-lo.

S1/S2/S3 somam **24 execuções PASS, 22 nomes distintos e 285 assertions**, com W/S separados. S2 é prova de compatibilidade C05 edit/reopen/resolve/reuse; não é prova independente de recibo exato de resolve/replay. As fixtures usam HTTP/C08/SQLite reais, com autenticação/leases fornecidos como fronteiras declaradas.

O reopen conserva a intenção na memória do teste. **Persistência da intenção no navegador e ACK positivo após reload continuam pendentes do consumidor.** A soma desses testes não concede attachment, confirmação humana, aprovação financeira ou execução nativa.

### C05/C06 — autoridade, preservação e reuso ainda exigem composição

Em [business-services WP10](https://github.com/gustavomhss/Orchestra-SF/blob/d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7/apps/cli/src/sucafina-product/business-services.ts), a chamada real a `createCollaborationHost` não injeta `recipientAuthority`. A versão do host é anterior à closure atual de C05. O [authorizer retido](https://github.com/gustavomhss/Orchestra-SF/blob/d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7/modules/sucafina/Sucafinav1/product/collaboration/recipient-authority.ts) recusa destinatário distinto sem prova privada e exige lease atual no commit. Isso é um bloqueio funcional seguro; não foi encontrado fallback permissivo.

Na fonte PR41, C05 também tem uma fronteira de contrato separada: [dispatch.ts](https://github.com/gustavomhss/Orchestra-SF/blob/62e5629dbf31be2bb662dda152c96021f22b0ca5/modules/sucafina/Sucafinav1/product/collaboration/dispatch.ts) devolve `review-answer-output-contract-unavailable` quando existe `reviewContext`, pois o `AnswerProjection` compartilhado ainda não carrega o pin imutável. O sucesso do HTTP privado não fecha esse transporte C16. Owner do contrato e decoder precisa compor a evolução sem retirar a recusa.

A implementação PR41 de confirmation/answer-reuse conserva campos/período/dependências materiais, identidade física, versão observada histórica e versão corrente de storage separadas. O fence revalida o estado protegido antes/depois do await. Nenhum novo defeito foi sustentado nesse mecanismo corrigido.

A otimização de reuso proposta na PR61 deriva da fonte W6 já publicada. PR41 usa `answerReference` e membership da thread autenticada para evitar leituras genéricas redundantes; preserva releitura canônica e fences. O preimage do patch PR61 é outro host, diferente do WP10. Não aplicar ou atribuir a prova por nome de branch.

R01 mediu `answer-confirm` em 2.685,07 ms mais `answer-read` em 3.886,46 ms: **6.571,53 ms sequenciais**. A chamada de attachment chegou em 6.616,59 ms e recebeu o fallback 404 de uma **fixture sem mount**. Esse 404 não é defeito do endpoint instalado: [portfolio-http WP10](https://github.com/gustavomhss/Orchestra-SF/blob/d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7/apps/cli/src/sucafina-product/portfolio-http.ts) já mapeia `decision-answer-question` à mutação real, com retry histórico e validação. O próximo passo é intake compatível, autoridade real e prova desse mesmo consumidor, sem outro endpoint e sem aumentar o prazo.

### Quatro para duas transações — aplicada, checks preservados, jornada ainda falha

A proposta PR59 permanece documentalmente `NOT_APPLIED` em sua própria branch. Em WP10, foi aplicada em W28. A aplicação textual em memória aos preimages W27 produziu **exatamente** os blobs atuais de [source-lifecycle.ts](https://github.com/gustavomhss/Orchestra-SF/blob/d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7/modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts) e [planner-sources.ts](https://github.com/gustavomhss/Orchestra-SF/blob/d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7/modules/sucafina/Sucafinav1/product/integration/planner-sources.ts). Nenhum código de produto foi executado nessa conferência.

| Por resolução positiva | Fallback | Capacidade atual |
| --- | ---: | ---: |
| Transações de fonte | 4 | 2 |
| Observações independentes | 2 | 2 |
| Autenticações diretas | 6 | 6 |
| Revalidações diretas | 4 | 4 |

Cada observação prepara novamente o selector em snapshot isolado, autentica uma vez na preparação e duas no kernel. `current` e `again` continuam independentes. Mantêm-se checagens de fonte/encarnação/projeção, mutação do snapshot, Request signal e egress. Não existe cache entre invocações. O fallback de portas sem a capacidade opcional permanece.

Os dois casos estruturais passaram em C29: primeira/segunda chamada na mesma instância, A→B→A, revogação final, chamada posterior negada e abort. F29 aprovou os três arquivos completos de fences, 10/10. O abort usa scope já materializado; não prova primeira materialização ou fila.

**X29 continua FAILURE**, 0 pass/1 fail, na primeira recertificação do binding. Fixture: 8.721 ms; `host.evaluate-and-store`: 276.519 ms; prazo cooperativo: 285.000 ms. O trace registra 4.762 resoluções e 22 simulações; os spans inclusivos se sobrepõem. Releitura, recomposição, retry e revogação da cauda não foram comprovados. A contagem estrutural não demonstra speedup integral ou equidade de lock.

### C09/C16/C17 — implementação real e limites das provas

O caller `business-context.ts:258–262` fornece exatamente `host/state/authorizeCase/authorizeEvidence` ao produtor `createSfCaseEventSourceAccess` atual. Não adicionar a propriedade obsoleta `cases` de outra versão. Dois casos C28 passaram: continuidade do evento com avanço de versão, revogação/replay e rejeição de referências forjadas/substituídas. Usam C08/SQLite/outbox/BCS/Atlas reais, mas o ledger contém texto sintético declarado; não fecham a jornada financeira.

C16 tem cadeia concreta: composition root → contribution por Location → AgentV2/SkillV2 → carga observada por SessionV2 → lease privada → par MCP Client/Server em memória → decoder/dispatch/port real. As fontes verificam perfil/skill/caso/operation, privacidade da lease, colisão de provider, revogação e fechamento do transporte antes do último guard. Isso confirma implementação montada, não execução satisfatória das 39 rotas.

C17 usa os factories públicos de Atlas, store síncrono sobre staging C08 e scanner canônico. Ausência/could-not-run não é clean. CHECK30 confirmou a geração oficial, `check:generated`, ausência de diff e typecheck Atlas nesse W30. Ainda faltam as provas integradas pertinentes de commit → novo processo → autorização → recall → consumidor UI no candidato final.

Duas pendências distintas permanecem:

- **A27-CAPTURE-INTEGRITY / NEEDS_RECHECK:** Atlas recusou captura corrompida, mas stale preflight devolveu ok quando esperado denied. Foi assertion, não timeout; os probes posteriores de revogação não chegaram. Fontes W28 mudaram, então A27 não é declarado como execução de W30.
- **R1-W23-C17-BETWEEN-OBSERVATIONS / NEEDS_RECHECK:** wrapper fixa o objeto Request/binding e compara duas leituras, enquanto o leitor histórico fixa method/url/headers dentro de cada invocação. A janela externa entre invocações precisa de sua contraprova. Autenticações de principal/acesso/política continuam presentes. Não se afirma bypass ou vazamento executado.

## Provas existentes: resultado integral separado do subconjunto pertinente

W, S, jobs, hashes de blobs, comparações e limites completos estão em [EVIDENCE.json](EVIDENCE.json).

| Corte / run | Resultado integral | Evidência pertinente e limite |
| --- | --- | --- |
| A21 / 43604032487 | FAILURE — 188 pass / 11 fail | Quatro casos lifecycle C11 PASS; seis blobs relevantes iguais ao WP10 atual. |
| A27 / 43624030665 | FAILURE — 59/1 | Captura corrompida/preflight; cauda de revogação não alcançada. |
| C28 / 43627315630 | FAILURE — 8/1 | C09/C17 2/2 e autoridade 5/5 PASS; oracle inicial de fontes falhou. |
| C29 / 43628006308 | FAILURE — 3/3 | Dois casos 4→2 PASS; falhas UI/pool preservadas. |
| F29 / 43628418430 | SUCCESS — 10/0, 132 assertions | Três arquivos completos de fences. |
| X29 / 43628663680 | FAILURE — 0/1 | Prazo 285 s; primeira recertificação; não é run em voo. |
| U30 / 43629303473 | FAILURE — 3/1, 35 assertions | Cancelar visível quando esperado oculto; negativos/startup/lifecycle PASS. |
| CHECK30 / 43629131094 | FAILURE — 13 diagnósticos Sucafina | Zero WP10; CLI/testes WP10/Atlas/geração/guards passam separadamente. |
| Colaboração S1 / 43628901092 | SUCCESS — 20/0, 247 assertions | Receipt HTTP=C08, mensagens iguais, replay, edição, fences/revogação. |
| Colaboração S2 / 43629467025 | SUCCESS — 1/0, 2 assertions | Compatibilidade C05; cinco filtrados. |
| Colaboração S3 / 43630483191 | SUCCESS — 3/0, 36 assertions | Correções selecionadas de testes/fixture; cinco filtrados. |
| Colaboração CHECK / 43630776800 | FAILURE — 69 diagnósticos | Iguais ao baseline: zero acrescidos/removidos. Guards PASS, 14 avisos. |
| PR54 / 43625483916 | FAILURE — 4/1 | Negativos de ACK passam; typecheck falha com nove externos; outro produtor/caller. |
| PR61 R01 / 43625766773 | FAILURE — 2/2 | Waiter e typecheck; diagnóstico de fonte retida/fixture. |
| PR61 R02 / 43626770240 | FAILURE — estáticos | Nove externos, zero próprios; runtime não repetido. Recibo lido; log não relido por esta revisão. |

U30 registra `analysis.cancel-hidden`: `isVisible() === true`, esperado false. Os asserts posteriores do positivo não foram alcançados. O diagnóstico CSS permanece inferência, sem `computedStyle` capturado. É o finding já registrado **WP10-U30-CANCEL-VISIBILITY**, preservado sem recontagem como descoberta nova.

CHECK30 executou geração/consistência/diff Atlas. O check documental posterior pula esses passos e não é a origem desse PASS. A árvore W30→S de CHECK30 difere só por `.astra-wp10-check.json`, mas possui linhagem preservada com `ahead_by=37`; não foi descrita como “um commit”. Nos slices test-ci indicados, W→S acrescenta somente `.ci-run.json`.

Metadata de artifacts foi consultada quando pertinente; nenhum ZIP foi inspecionado por esta revisão. Guards passados não transformam typecheck ou jornadas falhas em sucesso.

## Findings preservados e decisão de consumo

F01–F15 da composição anterior permanecem indexados com estado/owner originais em EVIDENCE. Esta rodada não os reconta como onze novos bugs nem modifica seus recibos. As onze entradas de FINDINGS são **disposições de recheck**: correção reconhecida, bug de caller, dependência corrigida, lacunas de integração/contrato, falhas históricas e gates.

A revisão também não presume disponibilidade do writer de produto. A ação pertence aos owners atuais e à composição por S0, usando os SHAs publicados:

1. **WP01/UI + WP10/S0:** fechar CR-C03-001 consumindo o receipt já publicado; provar intenção/identidade, perda de resposta, mensagens iguais, retry/reload e revogação no mesmo caller.
2. **WP10/S0 + WP08 + WP00/C16:** compor recipient/review authority e saída C05 compatíveis. Manter a recusa até a autoridade e o pin existirem.
3. **WP10 e produtores pertinentes:** continuar o custo residual de X29, recheck A27/C17 e corrigir U30 pelo owner; preservar assertions, checks e budgets. Não reimplementar observation ou 4→2 já existentes.
4. **S0:** congelar um único C e reunir gates/pareceres finais. Não transportar verdes entre árvores por nome de branch.

AM01–AM06 continuam exigindo carga e uso das 18 skills/cinco perfis, paridade das 39 operações/oito packs, concessão/revogação/isolamento, aplicação humana idempotente, Atlas/scanner/restart/consumo e Relay/Schedule reais. O mesmo C precisa das oito seleções mínimas, adicionais pertinentes, geração/typechecks/guards e **três pareceres independentes finais**. D somente arquiva evidência pelo envelope, com guard próprio.

**Encerramento desta sessão:** DONE da revisão finita, com REQUEST_CHANGES/HOLD de produto. [HANDOFF.md](HANDOFF.md) contém o estado e a próxima ação. Não houve merge, deploy, nova branch/PR, comando a autores, teste ou alteração de contratos.
