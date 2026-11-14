# I-OPS-02 — reprodução do consumidor e proposta para os owners

## Fronteira da entrega

O produto desta branch conserva os hosts e o executor compartilhado. **I-OPS-02 foi reproduzido pelo consumidor real** no [run 43624678702](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43624678702): **2 PASS / 76 assertions**, 37,36 s. O teste estende H05 por renderer/script reais, retry, reload e reabertura do driver SQLite, da autoridade e dos serviços. Esse PASS prova o impasse e os controles delimitados; não é recuperação aceita.

Produto W2 `8caafd2455cc149064ad0d5fdb63f48009269de7`; snapshot S `9c173f573e88bf033e9180494114d33da9a4894f`. O run remoto confirma `head_sha == S` e conclusão `success`. O recibo principal fixa o request e a relação W→S. Omni positivo: `pass`, nonce `d37f1479f16ec5e354c22161bdbe17a2`.

A correção completa requer `product/procurement/decision-http.ts`, `product/procurement/decision-host.ts` e `product/decisions/apply.ts`, de owners externos. O usuário autorizou publicar proposta com preimages, e proibiu aplicar silenciosamente esses paths. Por isso as duas propostas abaixo estão **NOT_APPLIED / NOT_RUN**. O delta UI depende desse endpoint; não foi exposto um botão para uma rota ausente.

## Pins e reconciliação

- Produto Operations: `ba8a09e371ce8d93eb917eabb102caaee5affaf4`, tree `eb427121bcfd8c2511aac31d908f3c0d52c1915e`.
- Revisão: PR49, `6830fa159d30b60d001f91a47326ae88c6255282`.
- Plano normativo: `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
- `interface-resume`, observado em `2ee71fc90055814912654ae198f7a1dcf9583943`, e PR46 `ui-recovery` em `db1dd1709483478ca2c8db2f0a479b72aea59821`, mantêm `decision-apply.ts` no blob `2e6c081ad2a5282654707f7fc7278183e7dfb20d`. A PR46 corrige o consumidor Dashboard em outro arquivo. Não foi copiada ou alterada.
- `compose-resume`, observado em `ad7fcdef7739e1bc471e42fac082452799de751b`, mantém o gate anterior ao lookup no host Procurement, blob `23d9291b3dcedda36edc4aa4f38856024e3c58f4`.
- `astra-wp11`, observado em `e8949be0e31952d5be4987c099003cd0b46e2add`, tem executor `229e64c2d8109b413a7667bbe1b208ffa3ab0a73`; `finance-resume`, observado em `3ea9dc2efe0de8d283f9625774697e431f55a0d7`, tem executor `f8404c18abc040c49cf111eb4561ce4c2873a4c6`. Ambos já movem a igualdade de versão para o ramo sem recibo e conservam outros incrementos de execução. Essa parte da inferência inicial está superada nesses arquivos, sem afirmar que o consumidor Procurement no pin Operations esteja corrigido.

`c12-source-pins.json` fixa commits, trees, preimages Git, SHA-256 e digests das propostas. Reconsultar os heads antes de integrar: estes registros são observações, não leases de escrita nas branches alheias.

## Cadeia causal e superfície já disponível

H05 escreve domínio e recibo na mesma transação SQLite. A edição concorrente autorizada avança a versão do caso. No pin Operations, a reconciliação detecta essa mudança e retorna 409 sem apagar a edição. O `decision-apply.ts` retém body/key apenas na memória da página; o retry mantém a versão anterior. `readChange` no host recusa essa versão antes de abrir o contexto que autoriza `readReceipt`. O executor de Operations contém outro gate equivalente. O reload perde o digest/body/key; uma nova revisão encontra a origem já alterada pelo efeito financeiro.

Há `PreparedApplyPort.readReceipt` protegido, mas ele é privado ao contexto ativo do host. A UI não possui uma rota de lookup de recibo. `resolveReceipt` só encontra recibos já ligados à mudança/caso, justamente o vínculo ausente em H05. `decision-review` revalida a fonte da proposta e não substitui recuperação de recibo.

O controle API do teste conserva o digest original e usa uma nova versão corrente do caso para alcançar o recibo. Isso delimita o defeito no consumidor/admissão e demonstra os fences existentes; não é a recuperação UI solicitada. Não se implementou essa troca de versão na UI: sem um modo que só reconcilia recibos, a mesma rota também contém o ramo de aplicação financeira.

## Proposta concreta

`c12-receipt-recovery.NOT_APPLIED.patch` é o delta integral para os quatro preimages de Operations. Não é um transplante do executor antigo para os owners atuais.

1. Adicionar a rota privada `decision-recover`, com o mesmo parser fechado, origem, principal e admissão humana `decisions.apply`. O body e a chave continuam os originais; não se cria capability residente nem grant adicional.
2. Expor `recover` separado de `apply` no host. Somente `recover` admite a versão histórica para consultar o recibo; futuro, encarnação divergente, caso/choice/change inexistentes e acesso revogado continuam recusados.
3. Exigir lookup positivo do recibo antes de qualquer revisão de produtor ou dispatch financeiro. Ausência retorna `original-receipt-unavailable`; nunca se transforma em permissão para aplicar.
4. Conferir o binding durável do `reviewDigest`, command digest, principal, destino, encarnação, chave e bytes do recibo com os validadores existentes. Revalidar fonte física/ator/escopo atual; preservar classificação e evidência autoritativas.
5. Reconciliar sobre a versão atual do caso lida no início da recuperação, por CAS. A primeira tentativa conserva o 409 original. A recuperação preserva a edição concorrente; nova concorrência durante essa recuperação continua falhando pelo CAS.
6. No consumidor, persistir apenas body/key da intenção em `sessionStorage`, sob identidade exata de installation/project/principal, target.surface/type/id/incarnation, case.id/incarnation, choice/change, operationRef e chave do comando preparado. Essa identidade vem da projeção autorizada; não é fornecida por campo livre. Não persistir campos financeiros ou texto do caso. Gravar antes do primeiro POST e restaurar sem replay automático. Uma entrada corrompida ou storage indisponível bloqueia a ação. Oferecer a ação humana distinta “Recover recorded receipt”, conservando também o retry original. Revogação limpa a chave exata e DOM; sucesso só é exibido após recibo real válido.

**Limite de correlação:** `sessionStorage` permite reload e reabertura por navegação nova **na mesma aba**. Não promete recuperação em nova aba, nova sessão do browser ou depois de apagar a correlação. O recibo durável no servidor continua a única autoridade sobre o efeito; o dado do browser serve só para reencontrar a intenção. O v1 de `applicationAttempt` do owner armazena `reviewBinding`, um hash, e não permite reconstruir `reviewDigest`/chave originais. O suporte a reabertura sem sessão/chave preservada exige que WP11/WP10 publiquem persistência e resolver autorizado da correlação original. Esse contrato não foi ampliado aqui nem tratado como pronto.

Registro inválido/storage inacessível e registro ausente são condições diferentes. `raw === null` não prova que nunca houve tentativa: nesse caso a UI volta à revisão normal, e o bloqueio de redispatch indeterminado continua dependendo da reserva `applicationAttempt` e do lookup autoritativo do owner. Não atribuir à proposta de browser uma garantia durável que esses produtores ainda precisam qualificar.

`c12-current-executor.NOT_APPLIED.patch` é a variante **somente do executor** para o preimage Finance `f8404c18...`: acrescenta modo explícito e a recusa quando falta recibo, preservando as reservas de aplicação, retenção de recibos e reconciliação mais novas. Ao compor os owners atuais, usar essa variante no lugar do hunk antigo do executor, e reconciliar os demais hunks por preimage. Nunca aplicar ambos os hunks de executor nem substituir o arquivo atual inteiro pelo de Operations.

Os patches foram apenas comparados mecanicamente com os preimages: SHA Git recalculado e `git apply --check` aprovado em cópias isoladas. Nenhuma proposta foi aplicada ao produto, executada ou typechecked. Não é revisão independente de aceite nem autorização de merge.

## Prova executável publicada

Paths exclusivos novos: `test/product/operations-fixes/c12-fixture.ts`, `c12-consumer.ts` e `c12-concurrency.test.ts`.

- A fixture extrai o setup real H05 sem importar o arquivo que registraria H01–H09. `createApplication`, `createSfBusinessServices`, `createSfProductAuthority`, source lifecycle e SQLite são reais. Só a escolha prévia é semeada, como em H05; não se alega provar seu produtor público.
- O browser usa `launchBrowserDriver` existente de WP02 por `AppProcess`, com `expectSpawn`. Não usa o pool WP01 nem altera aquisição/deadlines. O consumer recebe o Request original do browser e renderer/script de produção; nenhuma resposta de aplicação é substituída.
- Primeiro teste observa 409 pós-commit, retry com body/key idênticos, novo 409, perda da intenção no reload, nova revisão recusada e mesmo impasse depois da reabertura de SQLite/autoridade/serviços. Mantém um efeito, um recibo, caso planejado e edição concorrente.
- Segundo teste delimita o controle API: digest alterado falha; versão corrente mais digest original reconcilia o mesmo recibo. Revogação é isolada antes de substituição física; há controle positivo após restauração administrativa de acesso na fixture. Só depois se testa a substituição. Essa ordem impede atribuir a revogação um 403 causado pela fonte já substituída.
- O processo Bun permanece vivo na reabertura. Não se alega reinício de processo, GNATIVE, aceite humano ou prova de UI pela segunda contraprova API.

Observado no run: `firstStatus=409`, `retryStatus=409`, `reopenExactStatus=409`, `sameBody=true`, `sameKey=true`, versão do caso `3→4`, um efeito financeiro, um recibo durável e zero recibos vinculados ao caso. O controle API retornou digest alterado 409, versão corrente mais prova original 200, revogação 403 e alvo substituído 403. O 200 do controle não foi creditado à UI.

Seleção cirúrgica: package `sucafina`, directory `modules/sucafina`, runner `bun`, arquivo `./Sucafinav1/test/product/operations-fixes/c12-concurrency.test.ts`. Não incluir o `host-integration.test.ts` original. Resultado de cada caso e Omni ficam no run real; não há teste local.

## Gate para o owner fechar o finding

Depois de reconciliar/integrar o endpoint, estender a prova UI para clicar na recuperação após H05, reload, **saída e nova navegação ao caso na mesma aba**, e reabertura de SQLite/serviços, conservando body/key/caseRef originais. Exigir um recibo idêntico, um efeito, edição concorrente intacta, confirmação humana inicial e reautorização atual. Falta de recibo não pode disparar domínio. Digest alterado, principal diferente, revogação, alvo substituído, correlação corrompida e outra edição concorrente durante a recuperação devem falhar sem apagar o estado válido. Repetir recovery após sucesso deve devolver o mesmo recibo. Registrar a composição exata, pois os executores correntes já possuem deltas além de Operations. Reabertura sem sessão/chave preservada permanece um gate separado do resolver durável dos owners.

Critérios afetados preservados: C03/C12; CAMP.INV.02/04/10, CAMP.QLT.03, CAMP.CMP.02; WP01.T03.DOD.01/INV.01/CMP.01/SUC.01, WP01.T05.INV.01/CMP.01; WP04.INV.01/02, WP04.QLT.10 e WP04.SUC.10. Esta entrega não concede aceite integral a esses WPs.
