# Missão32 — justificativa contratual dos oráculos C12

O ajuste posterior de revogação no HTTP composto está em [ORACLES-EGRESS.md](ORACLES-EGRESS.md): a recusa interna de retenção permanece exata, e a fronteira externa exige sua própria recusa de autoridade. Os resultados executados estão nos recibos `validation-02/` e `validation-03/`.

## Decisão e limite desta nota

A compatibilidade com o executor Finance integrado exige distinguir três fatos: a mutação e o recibo do domínio já podem ter sido gravados; o vínculo do recibo ao caso pode ainda estar pendente; uma nova execução de Apply continua sujeita à revisão humana, à versão esperada e à autorização atual. A reconciliação de um recibo original pode preservar uma edição irrelevante do caso, mas não pode aceitar uma choice materialmente diferente, identidade ambígua, payload divergente ou autoridade revogada.

Esta nota justifica as mudanças de cenário e oráculo; não atribui PASS ao próximo candidato ou run. Os testes foram desenhados para o bundle real com Finance, C08, SQLite e HTTP/UI. A prova de uma origem anterior continua separada da prova de composição. Os resultados executados e as identidades finais W/S pertencem ao recibo de execução da missão32.

## Base normativa fixa

Todas as referências ao pack abaixo apontam para [S4-A.json no planejamento `dbf9547211d9b0fade619790de7c19c0869b7c7d`](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/execution/actors/S4-A.json). Os índices são zero-based.

| Pointer JSON exato | Obrigação aplicada nesta missão |
| --- | --- |
| `/contracts/11/content/0` | PreparedChange conserva identificação do caso, versão, alvo, expectedVersion, operação, preview, autoridade requerida e chave idempotente. |
| `/contracts/11/content/1` | Confirmação humana contextual e aplicação por domínio; revalidação no destino. |
| `/contracts/11/content/3` | Escolha de gestão não equivale às aprovações PR/sourcing/PO; não há transação global. |
| `/contracts/11/content/4` | Conteúdo, ator, alvo e encarnação compõem a identidade. Recibo e mutação são gravados no mesmo commit de domínio. Retry idêntico revalida acesso e retorna o recibo; chave idêntica com conteúdo divergente conflita. O caso central pode ser reconciliado depois. Resposta perdida não autoriza repetir o efeito. |
| `/contracts/11/proof` | A prova deve interromper depois do commit do domínio e antes da atualização do caso, recuperar o recibo autorizado e mostrar apenas um efeito financeiro. |
| `/contracts/2/content/0`, `/contracts/2/proof` | Apply mantém intenção explícita, expectedVersion, validação e recusa/conflito; revisão antiga não sobrescreve e entrada local é conservada. |
| `/contracts/2/content/1` | Reitera o vínculo entre idempotência, recibo do domínio e reconciliação posterior do caso. |
| `/contracts/8/content/2` | Choices são append-only. |
| `/contracts/8/content/3`, `/contracts/8/content/4` | Acesso é reavaliado na leitura; ChoiceRecord conserva a base, a cobertura e as condições históricas. Resolver uma omissão produz nova revisão, preservando a escolha original. |
| `/contracts/7/content/15`, `/contracts/7/content/22` | O domínio revalida actor e CAS; autenticação usa o Request real e autoridade corrente. Expiração, restart e principal divergente exigem nova ligação. |
| `/contracts/15/content/8`, `/contracts/15/content/9`, `/contracts/15/content/10` | Destino mantém autorização final/CAS/locks; revogação invalida a lease e o retorno é revalidado antes da divulgação. Reinício não reidrata credencial/grant. |
| `/resident/integrated_proofs/3/positive_checks/0` | AM04 conserva versão, preview, necessidade de aprovação e referências do PreparedChangeSet. |
| `/resident/integrated_proofs/3/positive_checks/1` | Recuperação após perda da resposta devolve recibo autoritativo sem novo efeito e mantém estado parcial verdadeiro. |
| `/resident/integrated_proofs/3/negative_checks/0` | Escolha não aprova PR/PO, não aplica orçamento e não envia mensagem automaticamente. |
| `/resident/integrated_proofs/3/negative_checks/1` | Payload divergente com a mesma chave conflita; versão, encarnação e autoridade antigas não autorizam mutação. |

O [anexo `specs/product-acceptance.md`](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/product-acceptance.md), blob `ded082688fce327def0b48968fa3b89a5831029c`, seção **1. Confirmação humana: base observada e validade atual**, distingue o registro histórico e a validade atual. Mudança material invalida; acesso revogado impede divulgação; CAS que falha exige releitura e revalidação. Essa seção especifica C06: ela não transfere sua exceção de escopo para Apply normal. A autorização da reconciliação C12 vem das cláusulas C12 acima.

O [anexo `specs/resident-runtime.md`](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/resident-runtime.md), blob `033737b1051b23443e633df7874c550629bf55a1`, seção **1.1 A identidade percorre uma ponte privada por chamada**, passos6–7, exige autenticação no destino, CAS/locks, revalidação do retorno e nova ligação depois de revogação/reinício. Sua tabela de provas integradas, linha AM04, preserva a necessidade de aprovação. A seção **6. Critério de fechamento da correção** considera refutações perder escrita concorrente, duplicar evento após retry e falhar na leitura após reinício.

A especialização da [missão32](https://github.com/gustavomhss/Orchestra-SF/blob/86dfe5cd709a4d1701a21b877c2feb92924b08c8/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/validation-wave/c12-composed-compatibility.json), `/acceptance/1`, `/acceptance/2` e `/acceptance/3`, exige igualdade da intenção original, preservação de edição alheia, recusa material/revogação, recibo ausente sem redispatch e pares positivos/negativos para cada oráculo alterado.

## Testemunho de runtime antes de corrigir

A observação estática da missão23 foi reproduzida pela interface Actions existente, com:

| Identidade | Valor |
| --- | --- |
| Base composta | `402a091485e11d60dff433049c7dedd7fcead687` |
| W0 de reprodução | `7fd76f647a57e9b9bc1415a4d516791e13b719b4` |
| S0 do pedido executado | `ca03f3f48e19b16acdea15e2b46976180208c139` |
| Run/attempt | [43642218184](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43642218184), attempt1 |
| Job | [132592073292](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43642218184/job/132592073292), `test (ubuntu-24.04)` |
| Seleção | `normal-retry.test.ts` e `material-race.test.ts` |
| Resultado observado | 0 pass, 3 fail, 30 assertions; 3 testes em 2 arquivos |

Os metadados, o parentesco S0→W0 e o log do job foram lidos via GitHub MCP. As duas falhas de `normal-retry.test.ts` ocorreram na primeira resposta: esperava-se409, recebeu-se200 após a edição concorrente. Como as assertions seguintes não foram alcançadas nesses dois testes, esse resultado isolado não prova preservação completa do caso, retry nem recuperação.

O terceiro teste colocou as assertions de efeito e histórico antes da recusa esperada. Seu diagnóstico registrou200, `effects:1`, `authoritativeReceipts:1`, `linkedReceipts:1`, versão do caso3→5 e `materialChoicePreserved:true`. Portanto, o executor havia gravado o efeito original150, mas também conciliado o recibo apesar da substituição da choice para900. Esse é o defeito de produto demonstrado, distinto da antiga expectativa estática409 após uma edição irrelevante. A correção material conserva a expectativa409 desse teste.

O próprio log informa que essa seleção não abriu Omni nem delegou uma abertura; W0 não constitui prova de browser/Omni. A nova execução completa da seleção cirúrgica deve provar os cenários de UI e suas contraprovas, sem transferir PASS de outra origem.

## Helper: produzir a interrupção canônica real

`consumer.ts` acrescenta `interruptC12AfterCommit`. O hook existente aguarda o commit verdadeiro da transação que contém mutação e recibo, realiza uma edição autorizada do case usando C08 e então lança no caminho de retorno. Nenhum recibo, status ou resultado de domínio é fabricado. Isso cria exatamente o intervalo exigido por `/contracts/11/proof`: efeito durável existente, recibo autoritativo existente e case ainda sem vínculo.

O helper anterior, `interleaveC12CaseEdit`, apenas editava o case depois do commit e retornava normalmente. No executor Finance fresco isso deixa a execução prosseguir e conciliar legitimamente o recibo. Ele é conservado no positivo `fresh-reconciliation.test.ts`; a interrupção explícita é usada nos cenários que precisam provar recuperação de recibo genuinamente não vinculado.

O primeiro retorno agora esperado é503 com `{ status: "unavailable", reason: "domain-application-unavailable" }`, porque o caminho entre o commit do domínio e a reconciliação foi interrompido. O teste continua obrigado a provar que indisponibilidade da resposta não desfez o efeito nem autoriza duplicá-lo.

## Justificativa de cada alteração nos três testes anteriores

### `normal-retry.test.ts`: primeiro Apply e retry comum

O primeiro teste troca o setup que apenas intercalava uma edição pelo helper de interrupção póscommit. Por isso, a primeira resposta passa de409 para503 e ganha a assertion do corpo exato. As assertions de um recibo autoritativo, domínio150 e case sem vínculo permanecem.

O retry da mesma intenção por Apply normal **continua409** `prepared-case-changed`. Ele usa a revisão histórica diante do case editado e não pode ser promovido a novo dispatch. A observação integral posterior deve ser idêntica e o contador de commits permanece1. Esse negativo aplica C03 (`/contracts/2/content/0`, `/contracts/2/proof`) ao lado do positivo C12 de recuperação explícita (`/contracts/11/content/4`, `/contracts/11/proof`).

### `normal-retry.test.ts`: segundo editor durante recuperação

O segundo teste também usa a interrupção inicial503 para obter um recibo durável não vinculado. Na recuperação, o hook de edição passa da segunda para a quarta leitura autoritativa de recibo. Na composição observada, a sequência é: preflight do host, lookup do executor, classificação e confirmação depois da captura fresca do case. A quarta leitura posiciona a edição concorrente **após** essa captura, antes da transação de vínculo. O teste exige que o hook realmente ocorra uma única vez.

Com essa disputa, o CAS do vínculo perde a revisão e o resultado esperado passa de409 `case-changed-after-application` para503 `case-reconciliation-pending`. O estado indisponível descreve um recibo existente cuja reconciliação ficou pendente. A segunda edição, sua versão, o domínio e o recibo devem permanecer intactos; uma nova recuperação deve200, vincular o mesmo recibo e manter um único efeito. Assim se prova a obrigação de releitura/revalidação, em vez de aceitar sobrescrita. Cláusulas: `/contracts/11/content/4`, `/contracts/11/proof`, `/contracts/2/proof` e `product-acceptance.md` §1, com a distinção C06/C12 já explicitada.

### `recovery-http.test.ts`: preparação da matriz de identidade

A primeira chamada do teste de identidade passa a usar a interrupção póscommit e esperar503 com corpo exato. Essa alteração preserva o propósito de testar um recibo verdadeiro ainda não vinculado e recuperável apenas pela intenção original.

Permanecem as recusas para review digest alterado; payload extra; principal, case, choice e change divergentes; versão futura; comando/digest/alvo/encarnação/chave preparados alterados. Cada recusa continua sem valor de recibo e sem mudança durável. A restauração exata do PreparedChange deve recuperar200 com o mesmo recibo, domínio e edição concorrente, mantendo um commit. Cláusulas: `/contracts/11/content/4`, `/contracts/8/content/4`, `/resident/integrated_proofs/3/negative_checks/1`.

Os demais testes HTTP permanecem: recuperação sem recibo não escreve, mesmo com review verdadeiro; intenção durável sem recibo não autoriza redispatch; revogação após lookup e na retenção final impede divulgação; reautorização válida permite recuperar; alvo fisicamente substituído é recusado; execução parcial preserva a mudança pendente de outro domínio sem fabricar seu efeito ou aprovação.

### `recovery-ui.test.ts`: perda de resposta, reabertura e admissão nova

O primeiro fluxo UI usa o novo helper para interromper o retorno depois do commit real. A rota do browser ainda deixa a requisição alcançar HTTP/C08/SQLite e só descarta a resposta HTTP concluída. As expectativas internas409/`case-changed-after-application` passam a503/`domain-application-unavailable` porque o ponto de falha agora é explícito.

Continuam exigidos: valor150; versão de domínio1; histórico com um Saved de Alice; recibo único com principal/alvo/encarnação/chave/digest originais; objetivo concorrente e choices preservados; PreparedChange ainda planned; case sem recibo vinculado; retry com o mesmo corpo e a mesma chave retornando409 sem alteração.

O teste fecha o contexto anterior, reconstrói os serviços, reabre SQLite, inicia um novo contexto com sessionStorage/localStorage vazios e recupera por uma nova admissão. O payload de recuperação é conferido e a chave de transporte deve diferir da original. A resposta200 precisa referir o mesmo recibo; o case avança somente para vincular esse recibo, mantendo domínio, histórico, choice e edição concorrente. Nova recuperação depois do sucesso é observacional. O teste não alega reinício de processo: registra `processRestarted:false`.

O segundo cenário UI, que perde uma resposta200 depois de a reconciliação já ter ocorrido, permanece. Desse modo os dois estados duráveis são cobertos: recibo ainda não vinculado e recibo já vinculado. Cláusulas: `/contracts/11/proof`, `/contracts/7/content/22`, `/contracts/15/content/9`, `/resident/integrated_proofs/3/positive_checks/1` e `resident-runtime.md` §1.1/§6.

## Pares que impedem um simples 409→200

| Positivo exigido | Negativo correspondente |
| --- | --- |
| Edição irrelevante após commit pode produzir reconciliação fresca200 com um único recibo/efeito e preservação integral da escolha e edição. | Choice150→900 póscommit retorna409 antes do vínculo; repetição não aceita a intenção materialmente alterada. |
| Recuperação com intenção durável original e autoridade atual devolve o recibo existente. | Edição material entre admissão e captura do executor retorna403 sem revelar recibo; admissão posterior detecta409 por incompatibilidade da intenção. |
| Recuperação após reabertura e nova admissão usa o recibo original. | Principal/proof/payload/alvo/encarnação/chave divergentes, revogação e identidade duplicada recusam sem novo efeito. |
| Review verdadeiro e versão corrente permitem o primeiro Apply. | Review fabricado ou versão antiga antes do primeiro dispatch recusam; recovery sem recibo não executa. |
| Após perder o CAS de reconciliação, uma nova leitura válida pode vincular o recibo. | A primeira tentativa não sobrepõe a segunda edição e não repete a mutação do domínio. |
| Replay após sucesso é observacional. | Intenção reservada sem recibo continua indisponível, inclusive no retry normal; ausência de recibo nunca concede redispatch. |

Os diffs dos três testes mantêm as assertions de auditoria, versões, valores, histórico, escolhas e efeitos. As alterações removem somente as expectativas de status/corpo correspondentes ao interleaving antigo e ajustam comentários/setup. Não há aumento de timeout ou budget.

## Correções de produto relacionadas

Os deltas permitidos em `product/decisions/apply.ts` e `product/procurement/decision-host.ts` conservam o executor Finance retido na composição. Capturam a choice da admissão e do executor, recusam sua alteração antes da reconciliação e exigem identidade única de choice e PreparedChange antes de admitir/conciliar. O guard durante a admissão fecha a janela entre a validação da intenção durável e a primeira captura do executor. A unicidade evita que `.find` reconheça apenas a primeira entrada e ignore uma duplicata materialmente divergente; o guard fresco impede que `.map` vincule o mesmo recibo a dois PreparedChanges de mesmo ID.

Os negativos adicionais de duplicação devem conservar a entrada original primeiro, acrescentar uma entrada divergente de mesmo ID por C08 antes da recuperação, exigir recusa e provar conservação dos bytes concorrentes, do único recibo e do efeito original. A revisão estática dos deltas finais constatou os guards na admissão, captura, autorização ativa e reconciliação fresca. Ela não substitui o resultado Actions desses testes.

## Limites de aceite e evidência

W0 é uma reprodução vermelha de três casos, não prova completa da recuperação. O candidato W1 `05b9486f7c96f3aa793f030d5157c17b7b340ac1` tinha um fechamento `}` ausente no helper; o defeito foi identificado e corrigido antes do próximo candidato. Seu resultado não deve ser atribuído ao código corrigido nem ocultado. A próxima execução deve usar os arquivos corrigidos e sua identidade registrada; esta nota não antecipa seu PASS.

O Apply da origem `363640a1844c09050a3bee76b4f01396f010314f` e o Apply do bundle têm blobs distintos porque a composição retém o executor Finance integrado. Um resultado da origem não demonstra a reconciliação fresca do bundle. O handoff deve preservar essa distinção, os resultados anteriores, os patches completos e os W/S efetivamente executados.

Esta missão não concede aceite global AM04, prova nativa integral, aceite de outra sessão, merge ou deploy. Os IDs sintéticos do harness identificam os principais de teste e não são apresentados como contas empresariais reais. O objetivo desta nota é tornar revisável por que cada expectativa mudou e quais contraprovas continuam impedindo sucesso indevido.
