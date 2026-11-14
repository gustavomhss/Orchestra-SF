# Finance resume R2 — parecer independente focal

**Resultado:** revisão estática concluída sem regressão concreta de runtime identificada nos deltas examinados. Há uma pendência normativa, **FIN-R2-REV-01 — OPEN_SHARED_CONTRACT_INTERPRETATION**, atribuída a WP10/S0. Este parecer não concede aceite global nem transforma provas pendentes em PASS.

Revisor: **Astra /root/cold_review**, agente novo sem autoria nos arquivos de produto, testes ou fixtures desta entrega. Data UTC: 2026-11-14T16:37:49.643785+00:00. Escrevi somente estes pareceres e cópias de leitura sob `review-intake-R2`; não editei produto, não executei testes locais e não fiz operação remota.

## Pins e alcance

Base R1 informada pelo integrador: `3c20b46b4aa97bced6fb3f13c2f9c891cf8cf3b5`, tree `de5d3f65d6d262c05a6447aa21f26c63dfbbf1c1`. As bases locais pertinentes foram conferidas por Git blob SHA e SHA-256. Os deltas foram congelados a partir dos manifests WP11, WP13 e Planner/BI e confrontados com esses manifests. A revisão é deste conjunto de **21 blobs**, ainda sem SHA de commit R2 fornecido ao revisor; o integrador deve conferir sua incorporação byte a byte na árvore publicada.

A origem Finance PR35 é `ec052c2c3bef96f492512f3d5f663919580f25c8`; PR40 final é `e8949be0e31952d5be4987c099003cd0b46e2add`; PR37/W20 é `7defe5c9930774c6aa5a15a5f677b4406d08683c`. O plano é `dbf9547211d9b0fade619790de7c19c0869b7c7d`, com campaign SHA-256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`, conferido localmente. AGENTS e COMMON foram lidos; C08/C17 canônicos e trechos aplicáveis dos anexos `product-acceptance.md` e `resident-runtime.md` foram consultados. Não repeti a auditoria histórica dos 303 critérios.

O manifesto WP13 mudou durante a preparação de entrada: `source-scenario.test.ts` passou de `c8720ec...` para **`01d7a1a299c61ebe824634c39e3d598cf2f59dc3`**. O parecer examina este último blob; não atribui revisão ao anterior por equivalência presumida.

## Pendência normativa — FIN-R2-REV-01

**Estado: OPEN_SHARED_CONTRACT_INTERPRETATION. Owner: WP10/S0.** A implementação `product/portfolio/read-snapshot.ts` cria uma raiz nova e usa as leituras de C08/domínios no mesmo snapshot LocalStore. Ela recusa uma transação previamente aberta **alheia ao helper**: `currentSnapshots()` sem o registro AsyncLocalStorage próprio, aberto e compatível não chega a `work()`. Somente leitores descendentes da raiz criada pelo próprio helper podem ingressar, com o mesmo persistence, Request retida e digest de autoridade.

Isso é tecnicamente suportado pelo LocalStore analisado, mas não resolve a redação normativa. COMMON `sf2h-integral-20261112.INV.11` proíbe literalmente leituras entre superfícies em transação já aberta. C08 declara portas de domínio fora da transação central; C17 e o anexo resident-runtime §4.3 coletam fontes/documentos antes da transação de metadados/Atlas, mantendo callback único e sem transações aninhadas nesse ciclo.

O verificador Finance W33 já adota uma raiz readonly nova, e W20 contém padrão correlato de leitura protegida. São precedentes de implementação; não são alteração autorizada do plano. Não identifiquei neste exame um escape de escrita ou resultado que constitua bug de runtime desse mecanismo, e não marquei INV.11/C08/C17 como satisfeitos. WP10/S0 deve registrar a interpretação aplicável ao contrato atual ou solicitar correção no owner. Nenhum contrato, engine ou arquivo compartilhado foi modificado por esta revisão.

## Análise dos deltas

### WP03: identidade de rate card e ausência versus zero

A alteração em `runtime/planner.ts` só exporta `plannerHeadcountInputs(row)`, delegando ao `versionOf(row).hc` existente. O diff contra o blob Finance `c90fd36885b2b15e834ddf7a7b37b1919a6a76ad` não muda cálculo. No port, a qualificação privada usa esse mesmo resultado normalizado, incluindo `position.rateId` e `rate.id`, em vez de normalizar apenas o ID do card.

Isso alinha a seleção de `chosenRate` com a seleção já usada por `calculated()`: referência explícita numérica `999` vira a string `999`, continua explícita e não ativa o fallback automático por localização. Referências numéricas válidas e um card de preço zero continuam utilizáveis. O gate `fteInputsKnown` ainda observa os campos crus, portanto a normalização não transforma FTE/start/end ausentes em presença confirmada. As fontes de actual e forecast permanecem independentes da qualificação do budget; moeda/FX e fórmulas não foram alteradas.

O objeto normalizado é empregado apenas na qualificação interna. A projeção pública continua usando `safe`, com as mesmas regras de redação de rates, rateId, annualCost e overrides. A fixture corrigida prepara as referências reais de Finance e viewer antes de capturar o snapshot inteiro. A comparação final continua exigindo igualdade integral; não exclui os metadados que explicaram a falha anterior de preparação. O novo teste mantém contraprovas de numeric/string dangling ID, card explícito fora da localização automática, zero, actual/forecast e revogação final. Observação estática; não é resultado executado.

### WP11: fence da Request depois do último await de C08

Confrontei `case-port.ts` também com o blob PR40 final `206271d33bcfb7786ee80ef0dfad50eb80e4fee2`: os acréscimos próprios são as fences da Request retida. O movimento dos checks assíncronos para antes da observação final de C08 é preservado. Read valida o digest do caso inteiro e das referências, não apenas a versão. Draft conserva o digest do caso salvo; prepare-intent usa o caso final para critérios e compara também o payload admitido.

Depois do último `state.read` não há novo callback externo assíncrono: verificam-se os digests, `source.signal.aborted` e `requestFor(context) === source`. A mesma fence foi acrescentada ao current-choice-preview. No host real, requestFor consulta a admissão privada consumida e viva; UI verifica expiração/finish e o registry nativo verifica lease, geração, binding e finish. A identidade de Request tem portanto significado concreto nesta composição.

As novas contraprovas encerram/expiram a lease no último namespace authorize, mantendo Request não abortada e identidade empresarial compatível; a substituição cria outra admissão real. Os negativos de CAS exigem commit observado fora do callback que o port poderia capturar. Draft pode já ter persistido o novo caso antes da recusa no retorno; o teste conserva a contagem correspondente e não afirma rollback de um commit concluído.

### WP13: snapshot readonly, callbacks e escape de resultado

O helper captura persistence e suas funções, Request e funções do host, digest de kind/binding, digest do input e fingerprint de método/URL/headers. Setup e digests ficam dentro do try no caminho de host completo. Mudança observável durante callbacks resulta em recusa; o caminho não cria uma segunda operação de escrita ou cálculo financeiro.

No LocalStore efetivo (`eefc1ed550a455abc4952430ec3b57a5abd5c9ee`), a raiz carrega os três snapshots e os leitores aninhados recebem cópias. Tentativa de commit ou escrita de blob/segredo aninhada envenena a raiz. Capturar o erro no callback não limpa esse estado. Ao terminar, o store fecha o scope, confere abort/poison/readers e só retorna o valor após essas verificações; `commit:false` é revertido sem persistir. Uma capacidade usada após o fim do scope é rejeitada. O helper não adiciona await externo depois que a raiz foi aceita.

Em chamadas concorrentes independentes, AsyncLocalStorage não oferece a raiz de outra chamada; a admissão do LocalStore mantém o isolamento. Descendentes do mesmo helper só entram sob a raiz ativa compatível. Um leitor que permaneça ativo no LocalStore impede a raiz de retornar sucesso; um helper descendente que retome após o fechamento perde `inherited.open`. Nos três leitores envolvidos, os valores de sucesso são clones próprios ou booleanos. Não encontrei alias de snapshot que permita ao callback modificar posteriormente o objeto retornado. Essas conclusões são de inspeção de fluxo, não de uma matriz de concorrência executada nesta revisão.

O novo negativo de history-provenance tenta um CAS C08 real no último callback de revalidação e captura a recusa. Ele exige que o corpo de escrita tenha sido alcançado, que a escrita tenha sido rejeitada, que o resultado não contenha value, que estado/storageVersion permaneçam intactos e que uma chamada nova positiva funcione. Isso discrimina poison persistente de mera autorização negada. Permanece necessária sua execução em Actions.

Há limites deliberados: ports legados sem persistence/requestFor mantêm o contrato anterior de observações independentes; não recebem garantia de snapshot. A garantia local exige que os leitores reais compartilhem o mesmo LocalStore auditado; não torna provedores remotos ou ACLs externas atômicos. O helper retém a admissão de writer enquanto lê; não há prova de latência neste parecer. A pendência normativa acima continua aberta.

### Seam de tipo histórico de IA

A referência de tipo a um factory histórico ausente da origem Finance foi substituída pela assinatura estrutural exata do factory na fonte alheia examinada: pedido `outputRef/currentCase` e retorno `PortResult` com estado historical e `ContributionEnvelope`. O blob de referência é `61cd1cc78f78b3d02c5dba99c55d0a198f53b2a0`. As validações runtime de tipo de proposta, ready, domainApplied, caseRef, perfil e skill não mudaram. Isso corrige somente a dependência de tipo; não implementa nem comprova a ligação do produtor histórico de IA.

### Merges das fixtures e preservação dos oráculos

Os diffs contra Finance R1 e contra PR40 final mostram que as duas fixtures mantêm `createRenewalCaseOperationVerifier` de W33. A única mudança no caminho de choice-values troca a avaliação classificada por outra comparação monetária canônica e fresca com `criteria: []`. Esse callback consome somente `knownDifference`. O `recordChoice` real recebe `planner: withCriteria`, compara o pedido com seus critérios e preserva essa comparação no snapshot da escolha. Grants humanos e verificação agrupada não foram removidos.

O diff conserva as assertions antigas: `case-port.test.ts` mantém 102 ocorrências de expect; case-operation-access mantém 3; a fixture numérica WP03 mantém 27; source-scenario mantém 72 e o prazo de 180000 ms. As contagens são apenas confirmação auxiliar do diff, sem alegação de cobertura por quantidade. Source-scenario passa a envolver o cálculo canônico e o comparador explícito em raízes readonly novas; escritas/persistência ficam fora delas. Seu sucesso dentro do prazo precisa ser observado, e timeout não pode ser tratado como sucesso. Nenhuma assertion foi retirada para obter verde.

## Blobs candidatos examinados

Prefixo de todos os paths: `modules/sucafina/Sucafinav1/`. O JSON acompanha tamanho, SHA-256, base local e manifest de cada entrada.

| Path | Git blob SHA |
| --- | --- |
| `product/decisions/case-port.ts` | `d43849ba101000eb9eb2a6ddc9a04830b004ccc6` |
| `product/decisions/current-choice-preview.ts` | `c27e908140ba34ffea39078a78626f47943a8444` |
| `test/product/wp11/case-read-fence.test.ts` | `67b8b179a3fba332933d8ad00820df82b7ab258e` |
| `test/product/wp11/case-egress-fence.test.ts` | `40f814167314c329b30d15db3dadbeaad4cfcb55` |
| `test/product/wp11/criterion-rules.test.ts` | `403bccda901a88d713b4b6a5cdbd9f0c17a31144` |
| `test/product/wp11/renewal-choice-fixture.ts` | `0dc89d86866620a8109051c68bc2d2b4d92c508f` |
| `test/product/wp11/renewal-human-choice-fixture.ts` | `582c69e353bdfd96663c479713ffb9ff6d7585a5` |
| `test/product/wp11/current-choice-read-fence.test.ts` | `87e24342ee27b98e26b29a69a2f8de6b7bf7206c` |
| `test/product/wp11/case-lease-egress.test.ts` | `185d8f144c789550c0aa62baf557bed63c830320` |
| `test/product/wp11/case-port.test.ts` | `367dbd162ba977b6e2f018d6423f42de8904d008` |
| `test/product/wp11/case-operation-access.test.ts` | `3db0c244e28a64ebbab28dc93f56c5f42ab2edfe` |
| `product/portfolio/campaign-proposals.ts` | `3ad0b190ad5d50c33e99d3c622831b6f0cc6cdac` |
| `product/portfolio/history-provenance.ts` | `de5846f024f85ad8203fa12adf27212c23850d4f` |
| `product/portfolio/proof.ts` | `19ac96241c24fbcd2038c70b961fa5a8d25d4418` |
| `product/portfolio/read-snapshot.ts` | `095a0e5764e115fb874a5f5c0c16a9c73466c340` |
| `product/portfolio/reconciliation.ts` | `387e78deeb6a1e97a21a68bd84839c3f1e979254` |
| `test/product/wp13/history-provenance.test.ts` | `d1ae1a8bb747c1bb8779da133de4df22c81fa3b4` |
| `test/product/wp13/source-scenario.test.ts` | `01d7a1a299c61ebe824634c39e3d598cf2f59dc3` |
| `runtime/planner.ts` | `17c65e08c833dfd1fcad582ef4eaac78a1c5ea4b` |
| `product/planner/port.ts` | `13800a1ac7dbe1b9bc95ca0a10480708760b4936` |
| `test/product/wp03/rate-identity-qualification.test.ts` | `130c4940746088518376aa4c325bd68ade46aa87` |

## Limites e disposição

Não executei produto, testes, typecheck ou guards localmente, nem consultei/publicei remoto. Este parecer não atribui verde a qualquer run de GitHub Actions; o integrador deve ligar os runs e checks ao snapshot R2 exato e preservar as provas históricas em seus SHAs originais. Nenhuma revisão de infraestrutura/workflow CI foi incluída neste recorte.

Também não concede aceite de consumidor instalado, C17/Atlas, scanner, persistência após reinício, replay de campanha ou composição compartilhada. Esses pontos continuam com os owners e mapas de critérios já existentes. A seam de tipo histórico não fecha o produtor IA ausente. WP05 não teve delta de produto neste conjunto e não recebeu novo aceite por associação.

**Disposição:** os deltas listados podem ser apresentados a S0 para revisão com este parecer e suas provas hosted, mantendo **FIN-R2-REV-01 aberta**. O relatório não diz DONE, não dispensa gates e não autoriza merge. Qualquer alteração posterior de origem, dependência pertinente ou blob candidato exige reconciliação, sem substituir automaticamente este conjunto revisado.
