# W13 — auditoria de ownership, consumo publicado e retenção de C12

## Resultado

O defeito de rota de destinatários é próprio de WP01 e tem produtor publicado consumível. A seleção de registros e período vinculada a um caso também tem produtor e consumidor próprio em preparação. A composição independente desse incremento não exige substituir BusinessServices nem case-port. O manifesto `w13-g03-published-inputs.manifest.json` congela 54 fontes (47 a consumir e 7 já idênticas), com os bytes de cada blob publicado.

A closure adicional de C12 possui 29 fontes identificadas, mas está **HELD por compatibilidade de callers e preservação de provas reais**, não por quantidade de arquivos. O novo case-port exige verificação semântica de operações. As fixtures publicadas que tentam adaptar essa assinatura incluem callbacks permissivos e, em WP11, removem uma prova real de execução parcial e replay. Nenhum desses arquivos foi sobrescrito.

Esta auditoria é estática. Não executou produto, typecheck, guards, suite ou CI. As execuções abaixo são recibos existentes fornecidos pelo monitor exclusivo, sempre em seus SHAs. Nenhum critério está declarado DONE.

## Pins reconciliados

| Papel | PR e head | Observação |
|---|---|---|
| Interface executada | PR31 W12 `cccd00c568aea65bb0c1b5cb4a82c2a236c7e775`, tree `b33c50679fa6c2a36a0e309064e1fa57ee4b0a0e` | Base da auditoria e da preservação. |
| Compose, fontes congeladas | PR32 `35b9fd4f532abeb1058f00281d4ad8885ca9966f` | Blobs exatos dos manifestos G03/C12. |
| Compose, head atual reconciliado | PR32 `ed10a3806a4ffdf6ad5891e2065d93a4c91412cf` | Compare MCP 35b9→ed10: nenhum dos 54 inputs G03 ou 29 inputs C12 mudou. Alterações de host/BI/Planner/aplicação fora da seleção não foram importadas por esta auditoria. |
| Collaboration | PR33 `2784daafbb0d3b58b6019822288a07fa38e5c5b0` | Host, HTTP, seletor por caso, destinatários e contexto de reunião publicados. |
| Operations | PR34 `ba8a09e371ce8d93eb917eabb102caaee5affaf4` | Apply forte já preservado no grupo. |
| Finance | PR35 `cfbf7c824d4351431d35533dbe2572de11084b9d` | Fixture WP11 atual ainda reduz a prova real; não é intake seguro. |
| Intelligence | PR36 `c21a990c57b714cd60bb7f915beb6be51acbafdb` | Há reparo publicado do helper Atlas, com outra assinatura de source-access que exige closure própria. |

Fontes foram lidas por GitHub MCP. O manifesto registra URLs de origem por pin, blobs, tamanhos e SHA256; cópias em reference servem apenas à hidratação por bytes exatos.

## G03 — o que já pode ser consumido

Critérios afetados: WP01.T04.CMP.02 e WP01.T04.SUC.01, além da recuperação/autoridade compartilhadas de T03.

O segundo bloco de `product/ui/work-collaboration.ts` usava `collaboration-recipient-list`. O HTTP publicado registra `collaboration-recipients`; o alias antigo retorna404. Os antigos testes de transporte reproduziam o alias e não provavam o mount real. WP01 assumiu a correção e uma fixture com diretório, autoridade, C08 e HTTP publicados.

A porta `case-selection.ts`, blob `ec80e2916c8a06cbb471cf02e30bb1cb5ebd9cc0`, aceita `{caseRef, period, sourceRefs, procurementSelectionRef?}`. Responsáveis não são campo desse draft; a escolha de destinatário é um ato separado do fluxo de pergunta. As rotas create/list/version e cycle-read existem. O consumidor próprio novo deve conservar seletores opacos emitidos pelo servidor, request/key exatos em incerteza e revisão explícita após mudança de caso; nunca gerar selectionRef ou registrar responsáveis no token.

O host `0376f81eb7978807106d259d6f65a9b4e1ed3a2a` depende somente de `cases.read`, `procurement.list` e `collections.resolveRequestCollection` para essa composição. Esses métodos existem no BCS retido. Portanto, a fixture própria pode compor o host publicado diretamente sobre o BCS real atual. Não depende do case-port novo exigido por C12.

A autoridade publicada `2c82d60d220d8d5365da8322bad648a64bbb62d2` passa os mesmos WeakSets privados a `state-provider.ts` `2fd55c7304add0829d7434917c80664fe86356b9`. O provider exige os contratos oficiais `state.ts` `755639b2a16265fe164ba2e6343738c1362d168c` e `state-layout.ts` `c3a6e039badc5ed49b20caa7153cb01979ebec9a`. A migração adiciona mapas e o namespace bi-artifacts ao formato legado, mantendo os guards atuais. A busca estática de Record<SfStateNamespace> e literais de versions encontrou somente o provider como construção exaustiva na árvore inspecionada. Isso não substitui o typecheck de Actions.

Mantêm-se HumanAuthority `78529a89586ce9f22d2b2cdd2cd0b1c61d20668a` já consumida, answer-reuse `134ce5cd8c4f0779380936de6a439c9ea124d932`, observer Dashboard `562cdca31a843ad893bc5f31eab039c55e7c9baa`, Hot Topics, BCS e case-port retidos. Não há mudança de configuração de identidade, política ou grants da instalação.

### Limite remanescente do ciclo

O `work-port.ts` publicado retorna `work-signals-unavailable` para seleção `sf:case-work-selection:` sem WorkSignals. BCS `4b02413b5a98e750187fa8f5fa54f3cb2415f4e3` não passa esse callback nem workDestination.

No head atual ed10, `workspace-services.ts` blob `5e3dadd39c4f7b4bcc5d4fa9f91bec1e25c64351` existe e compõe HTTP, reviews e BI sobre business.collaboration, mas não produz WorkSignals; `host-context.ts` `834b3c967d73411771e1f5aa82b683c6427e6769` não importa esse helper. Isso é um limite de composição localizado. O teste de configurar/listar/reabrir a seleção pode passar enquanto a leitura real do ciclo permanece503. Não substituir o callback ausente por uma lista vazia nem apresentar indisponibilidade como ausência de pendências.

## F01 — salvar novo draft, perder a resposta e recarregar antes do primeiro ID

Critérios: WP02.QLT.02, WP02.T02.QLT.02 e WP01.T03.DOD.01/CMP.01/SUC.01.

A versão publicada de `decisions/hot-topic-draft.ts` ainda exporta apenas register, readCurrent e list. register grava a correlação usando principal, caso e operationIdentity, mas devolve draftRef/version somente na resposta; exige ainda a versão exata do caso antes do replay. A UI recupera a mesma tentativa enquanto a memória está viva e recupera drafts cujo seletor já foi recebido. Recarregar antes do primeiro draftRef não permite identificar corretamente uma gravação pela ordem, nome ou registro-alvo.

Falta um lookup privado autorizado por identidade da tentativa original e identidade do caso. A resposta deve revelar somente o seletor/recibo autorizado, após revalidar caso, fonte, principal, policy/accessRevision, incarnation e correspondência do digest com a tentativa original. Deve distinguir not-found, found e unavailable sem tornar uma chave opaca em concessão de leitura. A consulta deve funcionar sob a versão atual legitimamente autorizada, preservando o recibo original; o client não deve persistir texto privado para suprir esse contrato.

Não há correção exclusivamente de UI que possa inventar o primeiro ID. Esse finding permanece separado dos quatro caminhos de recuperação já provados.

## F02 — CREATE de Hot Topic e encarnação atômica

Critérios: WP02.INV.02 e WP02.T04.CHK.01/DOD.01/QLT.02/CMP.01/CMP.02/SUC.01/SUC.02.

A porta própria `dashboard/hot-topics.ts` blob `9b959a09360bec0854016d1dd53905dc585f1931` já protege UPDATE com targetIncarnation e resultado original, recusando correlações antigas sem identidade. CREATE ainda grava apenas digest/id antes de a identidade física nova existir.

O source-lifecycle publicado35b9, blob `65867a3e6aa9b5b85266bb637fb22cf1c6c6d539`, conserva a ordem: callback de trabalho → guard → synchronizeSources/synchronizeScopes → commit. Não publica reserva de identidade nem finalizer após essa sincronização dentro do mesmo commit. O local mais forte `d0cab7f33b08806a6bb01a869fa789dc77e087ee` é preservado. Escrever sfSources diretamente dispara SF_SOURCE_IDENTITY_MUTATION.

O host Collaboration `aaae9db90459f8e6b34d9a1a2a1aedfda2a4affb` copia a correlação produzida pelo callback para C08 antes da finalização de lifecycle. Sua proteção contra preview sem commit é útil e será consumida em G03, mas não fornece a encarnação física do registro recém-criado ao callback de CREATE.

Próxima ação de owner: publicar reserva oficial da identidade ou finalização atômica que permita associar a correlação à identidade gerada pelo lifecycle no mesmo commit. WP02 então deve registrar essa identidade e resultado original no CREATE e contraprová-los com replay, delete/recreate no mesmo ID e concorrência. Segunda leitura seguida de segunda gravação não fecha a corrida. Igualdade de ID, dados, título ou digest não substitui identidade física.

## F04 — edição nova e retirada exclusiva de escrita

Critérios: WP01.T03.DOD.01/CMP.01/SUC.01, WP02.QLT.02, WP02.T02.QLT.02 e WP02.CMP.10.

Correção da descrição histórica: a capacidade privada de continuidade **existe**. O observer Dashboard já reemite a fonte no escopo atual, resolve a página original persistida, compara a identidade física e conserva fences. O reparo próprio W12 de originalPage passou em captura e histórico de registro. Não é correto afirmar que nenhuma continuidade entre accessRevision pode ser provada.

A lacuna precisa é o consumo autorizado dessa capacidade para um draft novo ainda não salvo. O endpoint atual `dashboard-hot-topic-source` recebe recordId/period e emite a referência atual; não prova que essa referência corresponde à fonte original privada exibida no editor. Comparar somente ID permitiria delete/recreate. Reutilizar captura de revisão automaticamente também mudaria grant e efeito.

Seam aditiva proposta ao host: reauthorizeDraftSource(originalRef) que revalide leitura atual, identidade física, referência original protegida e projeção atual, com fence/egress, e devolva continuidade autorizada ou indisponibilidade. A UI só conservará conteúdo original sob essa prova; fonte inacessível ou substituída deve fechar/purgar. A write-only negativa existente não foi afrouxada e continua registrada como falha no seu SHA.

## C05 WholeReview não é captura de registro nem C12

Critérios: WP01.DOD.03/CMP.02 e WP02.T03.CMP.01.

W12 realmente executou o primeiro meeting-number completo e a nova contraprova Budget/Budget; ambos passaram. O segundo caso de WholeReview recebeu403 depois de alterar o orçamento de 1300 para 2400 na mesma encarnação. Run43589003673/job132429524784, headcccd. A assertion200 e o conteúdo original continuam preservados.

`dashboard-services.ts` blob `0891d178833165fff098e3c05f3a64c5f5b35043` continua montando readers que exigem fonte/projeção atuais exatas. O reader histórico genérico existe: review-history `0c9a68225d114ba77617af4a0e3acc2607ea0e5a`, review-calculation-history `012c83ed8b6382bebc0046526985f2f900f04035`, review-read-integrity `2bd1fbd753e38f38ef58e4d71f364972ac22703e`, review-services `e795aa2e8667a0da134a00ce6012fe1f7f1dc712`.

É necessário montar esse reader no read/discovery da reunião preservada, com ACL atual, continuidade física e conteúdo original capturado, mantendo os fences de escrita atuais. Essa alteração é de composição compartilhada. O observer próprio já corrigido não substitui a leitura da reunião inteira. Detalhes permanecem em c05-current-closure.md e no finding publicadoW10.

## C12 — closure identificada e bloqueio concreto

Critérios: WP01.DOD.03/CMP.02/T05.CHK.03/T05.DOD.01/T05.CMP.01 e WP02.CMP.10.

A implementação publicada dispõe das peças de histórico Dashboard e receipt: dashboard-decisions `f8914c141ba5c72439f5fdba50e9153c4cd477d4`, dashboard-decision-evidence `4c205439aed7779dff66079a1ebaad1927d75d77`, BCS `4b02413b5a98e750187fa8f5fa54f3cb2415f4e3`, business-context `5cca27ce239c92a8e3c9f9f92f816f5224562904`, source-access `41741c5131ea66242c881126c22c6d03cfd9c3c3` e case-port `67203e058f6e08d9e32e0c51e0b1a01e5fadf322`.

A cadeia captura a projeção original em metadata protegida antes da preparação, verifica o fence no commit, reconhece a operação registrada e correlaciona receipt/case/choice/change/prova para resolver evidência histórica autorizada. Há implementação publicada a consumir. O problema não pode continuar descrito como “producer de receipt Dashboard inexistente”.

Os 29 inputs adicionais e os imports relativos/named exports estão inventariados no manifesto held. A leitura estática não substitui TypeScript nem prova de comportamento. Os blockers conhecidos são:

1. **Assinatura obrigatória nova:** case-port requer verifyScenarioOperations(value, context) e o verifica antes/depois da leitura protegida. O BCS novo usa createSfScenarioOperationAccess; nove calls nas fixtures retidas não passam essa função.
2. **WP11 não preservado pelo upstream:** o blob retido `ed68e903fdaaa313ea14b18f194ee319b6dbdf09` contém109 expect calls. Compose `4e01acf909609e40bf9fc5e64c633ea8189c6e8b` contém100; Finance atual `42cbc7e3440192c71df79e6adbe86f95aa75e6df` contém102. A contagem é somente indício textual: a inspeção confirma remoção do produtor Planner, UI authority, preparado real, valor42 persistido, prova durável, replay único e preservação contra digest de review diferente. O cenário virou um adapter de resultado unbound indisponível. Os três callbacks novos incluem booleans permissivos. Não copiar essas versões.
3. **WP13:** três arquivos mantêm os bytes anteriores, salvo callbacks access.allowed/active.value. Isso preserva assertions, mas não verifica operações replace não vazias. Sensitivity conserva condições substantivas, porém reúne quatro testes em um e perde isolamento. O owner deve publicar adaptação aditiva com o verificador real, mantendo os quatro casos.
4. **WP14:** o fixture Compose d31c8dc preserva e amplia provas reais, mas exige helper atlas-restart-reader9268b879 que omite o callback obrigatório. O helper corrigido f4fcfa9f é publicado em Intelligencec21. Já a fixture latestd44e2088 usa authorizeRecallCase, ausente no source-access4174 e presente no produtore4e648. A mistura exige fechar essa closure C17 de forma explícita; não importar só a fixture.
5. **Inputs fortes retidos:** hot-topic-draft `5e0b80a470958dd201db4283bde96d594935e68d` conserva domainSurface Dashboard; o blob remoto dc480 difere apenas para Planner e não é dependência necessária. Apply `4bdd12ac162d61465557363953e25dfd99fad5e8`, prepared-apply `a45436a6fef8598b7ef9eae33d061ddebf0aa43d` e receipt-review-binding permanecem intactos.

O caso WP11 forte de partial-domain não instancia case-port: pode e deve permanecer literalmente intacto durante a adaptação dos outros três callers. Para fixtures estritamente sem selectors, uma verificação restrita que recuse qualquer operação não vazia pode representar esse escopo sem fabricar autorização. Para WP13 com operações não vazias, a correção precisa da porta semântica real. Esta auditoria não gerou patch “true” nem uma implementação falsa para fechar tipos. O artefato wp11-empty-operation-callers.additive.patch propõe somente o guard failclosed dos três fixtures cujo cenário é vazio, sobre o blob retido ed68e903. Todos os 109 expect calls e o corpo real de partial-domain/replay são textualmente idênticos. É uma proposta de compatibilidade de componente para o owner, não consumo de verificador semântico real e não prova executada; não resolve os callers WP13 não vazios nem autoriza o intake held.

Handoff exato: Compose/Finance/Intelligence devem publicar a união aditiva dos callers compatíveis e o manifesto da closure C17 escolhida, sem remover consumidores/assertions. Depois consumir os 29 blobs mais essa união e executar somente as provas cirúrgicas afetadas e static. O teste real de lost-apply/reload deve alcançar o replay e a assertion de recibo único; o timeout prévio não é aceitação.

## Auditoria da matriz W12

A checagem independente encontrou153 textos/IDs literais (75+78),9tasks,36cláusulas gerais,16560referências resolvidas,171sources com blob/SHA256/bytes exatos no pincccd e1fonte externa explicitamente marcada. São405tests e1132observações. No W12:34PASS_SCOPED,2PASS_HARNESS,1FAIL e368não selecionados; o Markdown contém153linhas. As últimas falhas nomeadas continuam F04/C05/C12. W13 não recebe crédito antecipado.

Artefato: wp02-independent-w12-metadata-audit.json, SHA256 `a9d8aee3ab5aa18355629e64acf9c38f0e014c8bf54de5f9a43d70dda4d33835`. Nenhum teste local ou queryCI foi feito para esta auditoria.

## Próxima ação

Publicar o incremento próprio G03 consumindo os blobs congelados e executar sua seleção cirúrgica autorizada. Manter C12 held pelos blockers concretos acima e encaminhar a união aos owners. WholeReview, primeiro lookup de draft e reserva/finalizer do CREATE permanecem contratos/composição necessários. S0 ainda revisa o bundle e executa as provas nativas/globais e o epic final; os componentes não substituem esse aceite.
