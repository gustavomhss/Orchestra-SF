# Handoff — sf-shard-c

**Estado: IN_PROGRESS.** O escopo histórico completo do shard 8 está verde, com **620 pass / 0 fail**. A entrega global mergeada e verde dos oito shards ainda está pendente; não há GO global.

| Referência | Valor |
| --- | --- |
| Código C documentado | `af89e5a35ebc6f304891ed2f38df7185f9ec1415` (inclui candidato IO2; C integral continua não qualificado) |
| Base original | `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` |
| Integração observada | `sf-join-four` em `24f77c13c61143165b008807680daa778276e8e4`, incluindo Executive e navegação #490/#489/#478/#486 |
| Data do checkpoint | 2026-11-20 |

Proveniência anterior de C: o merge `b9d897177245c1a58638507894588a3d069012b4` incorporou `c32e906a92193ae33d32b5106a82ee47b81c0ba4`; o pin pós-442 entrou em `5917a488021408261b59ba81106ad582dd167270` e o driver half-close em `e432400faff2cf84ac8bedb9590e14248db3653b`. C preserva a sentinela privada adicional e candidatos ainda não qualificados. Cada gate abaixo identifica sua própria fonte e snapshot.

Este documento atualiza o checkpoint documental `13394b27c67ef079d467580982da0ed55fad6c39`. PR principal: [#397](https://github.com/gustavomhss/Orchestra-SF/pull/397), draft de acompanhamento com candidatos e causas `UNBOUND`; não está qualificado para merge integral.

## Feito

Acesso exclusivamente pelo GitHub; execução somente por Actions. A enumeração original mediu shard 7 **518 pass / 12 fail** e shard 8 **618 pass / 2 fail**. Todas as falhas originais estão mapeadas, com suas linhas nos apêndices. A revalidação integral dos mesmos 115 arquivos históricos do shard 8 passou **620/0**; esse resultado vem de um novo log completo, sem subtração de gates focais. Correções de testes permanecem separadas dos PRs `shared:` de produção.

### Checkpoint: Executive e navegação mergeados; controles de IO em qualificação

**Executive #475/#479:** segundo gate [44682884013](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44682884013), **21 pass / 0 fail**, 103 expect() calls do Bun, 64.85s. Fonte `0e9414eebfe268748a9402703d34d4fb713d4400`; snapshot `072a53f1eaaac8583ae7fd73caf8ed24b172d144`; teste136110229357 e cleanup136111984579 success. São 12 controles existentes de projeção, cinco de People, um componente browser em cinco larguras e três typechecks canônicos (Schema, CLI, app-shell) com exit0/saída não truncada. Nenhum número é atribuído ao full shard3 nem à jornada original visual-layout.

Merges efetivos: #484 `6aaad6796e94e6f1f963321505755f00c10db3e4`, #485 `0df0e751d7b9f38cd2c8e4f61dbf5393f7691879`, #475 `2c6823a722e93163439b827d28d992a770472783`, #479 `37beac52b76278b1aad1226368e87f02892939c1`. O campo schema combinado integrado foi conferido byte a byte com a fonte qualificada (`cdb09915b945861ebba3b7337a5182e962e199a8`). Auxiliar de typecheck permanece apenas na fonte de prova. O primeiro18/3 segue registrado como histórico, após correções concretas.

**Navegação:** primeiro [44683335605](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44683335605), **1 pass / 2 fail**, 6 expect() calls, 76.00s. Browser falhou em `native-ui-contract/source-navigation-browser.test.ts:105:29`: CAP24 tinha título vazio. A origem é o dicionário existente `procurement/overview/copy.ts` não registrado; #490 `d64009523280e089e29e24c521d810ea85f538f8` registra EN/pt-BR sem alterar nenhum texto. O typecheck de modules/sucafina apontou `product/wp13/handoff-domain-integration.test.ts:311:9/:340:52/:341:50`: namespace esperado alargado para string; #489 `3e4f9056aaac7ed5bdb906b09452e61f5e595035` conserva somente o literal cases via as const. O typecheck app-shell passou. Jobs136111681665/136113063514 (cleanup success).

O segundo gate [44684418686](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44684418686) concluiu **3 pass / 0 fail**, 6 Bun expects, 97.62s. Fonte `430f74853b00afd9b6d1e83db1d7a2e3d29d14b1`, snapshot `d4bac7c9f3653a8c6b3d551f1d60fa4059f28113`, base37be; teste136115232393 e cleanup136116079214 success. Componente23818.96ms, typechecks canônicos modules/sucafina48974.35ms e app-shell23934.87ms (exit0, saída não truncada). Mantém os28nomes/hrefs, cinco larguras, deadlines, filtros, cliques cancelados/modificados e fences. Merges: #490 `bee95ee401e6968ea2b53908cbce074530bc6243`, #489 `df5431f94bfb7dbff553f20c42011c1c750d9996`, #478 `0d013f990b65e7465078ebee0ecf78895c3ab7ba`, #486 `24f77c13c61143165b008807680daa778276e8e4`. C incorporou essa integração em `a3d20350154c6a082a1659533b91700918214c55`. A prova de componente não substitui visual-layout instalado; helper de tipos somente na fonte de prova.

**Integrações externas verificadas:** #439 merge `d1bcd200a3e9f34cf054671d16263ac2407410e1`, fonte `80e2282cb605d204c0b2612cdb0b3da08d6dfe30`, é qualificado especificamente pelos dois originais import-analysis em44678987832; o combinado7/10 continua vermelho. #434 merge `db14b2a3a04689841b033312cb989741e5677a50` preserva identidade do produtor calculation; #468 merge `9d3a70179cc1ced293c58d4dfc032d5d2aa41bf6` provisiona Chromium pareado. Nada disso converte o shard B completo em verde.

**IO1 #474 permanece UNBOUND por diagnóstico insuficiente:** o run44679668214 observou ausência de resposta de contexto em10s, não provou ausência de request. Nenhum segundo gate foi lançado somente para logs. A migração IO2 e seus fixes concretos permanecem em revisão; foi exigido preservar o primeiro corpo original da integração na proposta isolada. Antes de CI, a revisão encontrou CAS inicial legítimo depois de Supplier.create, perda do owner em Import e Cancel/Revise durante digest sem fence da revisão; as correções e os controles negativos estão sendo preparados em commits próprios. #482/#483 continuam NOT_QUALIFIED.

### IO2, Settings e Imports: fontes exatas e resultado observado

- **Produção #477** `d739bff8cea58166ab48b2f364a31ef5d2f2a568`: anexos de Supplier autorizados, defaults originais e primeiro CAS Settings, Talent Import/Export. Revisão corrigiu CAS0 legítimo após Supplier.create, owner URL e Cancel/Revise durante digest, antes do gate. Nenhum grant, revision/author persistido ou baseline fabricado.
- **IO2 #494** `f79b5e397150934ae1ba50268d1d81b2101a16d7`: oito arquivos test/**, primeiro Planner original de main e helpers byte-exatos. C `af89e5a35ebc6f304891ed2f38df7185f9ec1415` conserva separadamente seu primeiro candidato nativo, com segundo corpo IO2 idêntico. Novos cinco controles não representam instalação; o caso original exige bootstrap, uploads/downloads reais, CSV, preview/Apply Members, SQLite/reload, bytes da exportação idênticos à resposta observada e cleanup físico. Prazo90s intacto.
- **#492** `9365e02e37ee909b6ab8645b3fc69ff5fb3def6d`: continuações Imports com owner exato e dois aria-label das chaves originais. **#493** `5ca6d247dc8461549b88087555c0c7c8e1fe0c09`: quatro controles de componente. **#482** `7c885f0ca4b178a7d56053d2466477aeb04d1b94`: fila single-flight Settings e cinco controles. Todos ainda NOT_QUALIFIED para merge integral.
- **Componente [44685675858](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44685675858): 3 pass / 6 fail**,229expects,9testes/2arquivos12.93s. Fonte `8dba4c2ac0a281cb2318f0a23b9dbc49644376c5`; snapshot `b6bbd5fb7279c157148c206818fd4a8c09738982`; teste136119299800 failure, cleanup136119866186 success. Settings5fail: RangeError na primeira fonte visível, helper `packages/app-shell/test-browser/sucafina-native/settings-refresh.test.ts:48:13`, chamadas174/232/248/282/310. Causa em investigação, sem atribuir a produção prematuramente. Imports3pass/1fail: `imports-owner.test.ts:278:60`, log temporal de owner foi mutado por alias da seleção reconciliada; esperados one/one/two preservados, fix concreto em preparação. Omni corretamente not applicable: nenhum subprocesso declarado neste recorte DOM.
- **IO2 [44685910576](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44685910576) em andamento**. Fonte `2c41816396adf8395a57b5c0f1fdfa2fe474c9d6`; snapshot `51bf856d95b6d4887e56969c123d4e8a2473c330`; base24f77. Filtra exatamente o segundo caso original + cinco controles + quatro comandos canônicos (Schema/CLI/modules/app-shell), helper de tipos só na fonte. Primeiro Planner não executado nem requalificado. Não há rerun de IO1 somente para diagnóstico.

### Atualização recebida de A/B: checkpoint0602

Nenhum novo full shard A/B. A permanece `ace8a3263cf3a8c3546824ddb339a93e351cfb33`. B observado `10af6abc1874d59b9ee751402685af2220646a96`, composição `d4039d45433c4abe21c3f497de15a743ab1cede8`, handoff blob`be411d1fbd50eb0a58884d4566f9093a65d1d39b`. Coordenação autorizada [#410/7031855207](https://github.com/gustavomhss/Orchestra-SF/pull/410#issuecomment-7031855207).

| Gate B | Resultado observado | Fonte / snapshot | Falhas e sequência |
| --- | --- | --- | --- |
| [44682182809](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44682182809) native | **1/7**,109expects,8testes4arquivos71.06s | `cecd55308fee7885cec1668ddd34ba42f4d29b76` / `e53710b20fa9045a97f462913d2c7c97904413d5` | monthly Apply `wp01/planner-monthly.test.ts:108:13`; logout `wp01/http.test.ts:197:36` 403esperado/401real; personalviews `:128:87` chamada`:152:66` corpoCDPperdido; quatroBI `wp10/integration/bi-lifecycle.test.ts:242:19` casos233/291/331/365. Jobs136107933163fail/136109156771cleanupsuccess. |
| [44682675803](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44682675803) ancestry | **0/4 +4errors**,320ms; nenhum corpo executou | `be7f708a7b4349cd8d8edf13815393f22277cf83` / `7a0929b2dfc12664ab5404c4f78856c6d04ef383` | Importação bloqueada por parêntese ausente em `planner-calculation-ancestry-scope.ts:219:129`. Fix `5b9ac06dc64707ca8357e56e9a2ce1b3800b877f`; segundo44683555039 observado ativo, sem resultado transferido. |
| [44680602254](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680602254) sensitivity | Em andamento no checkpoint | `dd0f2e58232f0266ac7793908754d8a4164ed805` / `c26cd88e0987a25c0b1a3d32fb9c414f5e5c49a0` | Nenhum footer confirmado; não somar como PASS. |

B é responsável pelos fixes HTTP `febcf57ecb9980333437c2e130c8b8573745764a` (401exato e envelope completo; CSRF403 preservado) e personalviews `e2f6b942ec8a3db3fd5bf848773842fe97ee7987` (clone do fetch original antes da navegação, sem replay/resposta sintética). Fila native `e5bb7153d9b2f5cb38604b3e7b7432ec3661a3f4` ainda sem run neste checkpoint. Descriptor público `45c2831c3f15e1d7899cf83926edf1c606dd6c11` ultrapassou seu ponto anterior, mas o arquivo HTTP continuou vermelho depois. BI C08 real `fbe6b8e0795213574ce3de655cf4f96fa7a02e27` é posterior e não qualificado pelo1/7.

Proposta pre-await foi adaptada à fase física #488, sem escrever emB: **shared#495** `dc2df943313e0a192942ba0b17e2cc8b673baad6`, business blob`63daf3e0144ba315a9fddae1a680131f823a2196`; **test#496** `df7758a83f452aa44b16fdbbbabea8deecc3d70a`, quatro controles/58linhas e sete corpos anteriores byte-exatos. Base compostaB d4039d45 contém dependências pendentes: não mergear sua ancestralidade inteira. Ambos NOT_QUALIFIED. Populado `92c9cbbf3013a2202fd30270273b6f37c9e48435` continua ausente/NOT_QUALIFIED; #464 a00b6bb não inclui os36calls.

### Situação atual para decisão

| Frente | Resultado / estado | Evidência e próximo limite |
| --- | --- | --- |
| Shard 8, inventário histórico completo | **620 pass / 0 fail; mergeado** | [44676183011](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676183011): 115 arquivos exatos, 30843 asserções, 881.49 s. Pin #463 integrado. Não equivale à partição LPT atual. |
| A3, concorrência C12 | **3/0; mergeado em #465** | [44677773333](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44677773333): 185 asserções, 82.72 s. O C12 original continua UNBOUND e fora desse PR. |
| A3, URLs nativas de BI | **2/0; mergeado em #467** | [44676988708](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676988708): 515 asserções, 217.40 s. São os dois casos completos, preservando os controles de seleção contextual. |
| Driver, EOF bidirecional | **3/0; mergeado em #462** | [44675815817](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44675815817): 157.07 ms, controles Node com socket real. Não qualifica startup Chrome. |
| Review, composição isolada #470 | **16/0; mergeado** | [44678230528](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44678230528): 490 asserções, 454.22 s, arquivo completo e cleanup success. |
| Semantic, transporte Node #469 | **3/0; mergeado** | [44678238009](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44678238009): três casos completos, 4.46 s e três fechamentos físicos limpos. |
| Rollback autenticado #473 | **18/0; mergeado** | [44678639563](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44678639563): 542 asserções, quatro arquivos completos, 1.90 s e cleanup success. |
| Planner XLSX nativo #474 | **0/1; UNBOUND por diagnóstico insuficiente** | [44679668214](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44679668214): 1 filtered, 39.42 s; wait de contexto em io-browser.test.ts:33:12 excede 10 s. Enrollment e fechamento físico passaram. |
| B: Portfolio / memória / cálculo | **Pendentes** | Terminais novos: native7/10 e1/7, Dashboard11/1, Mixed36/1, Planner19/3 e recovery33/1; novo ancestry0/4+4errors de sintaxe sem corpos. Cinco perfis AM01 e purchase pending passaram; ancestry105s e purchase complete360s falham. #441 sem fix pre-await; #464 populado NOT_QUALIFIED. |
| Static / guards | **15/16 comandos PASS; aprovação pendente** | Sete typechecks passaram. O gate de dois paths protegidos continua exigindo label real em #397. |

**Fontes das novas integrações e dos gates ativos**

- **#467:** fonte `f9f7b7e55adc0dfb586c42930a7027fb08fbd9fd`; snapshot `2101b766110667088a28f65f86f735d541d70b1d`; fix C `439fe059a9a4a19bf716452e859164c33897f90f`; merge `723833ed811117a12b9dca9098a3573ef758a64d`.
- **#433 / #470:** o produtor Review de #433 foi mergeado externamente em `3910a644c7fdab1a438c2b5b39d69afc19361709`, após o gate B 16/0 em 44675050868. A primeira proposta isolada #470 tinha fonte `7c93b5b3967a53e48d44c0cd19a50cfc40542e11`, sem gate. O gate concluído usa fonte composta `cbfe3217b57ee6c13a2993b06dfebe0433f33e2c`, snapshot `e64b053374949ff1b4979d7b2566c75973b2f663`. Ele verifica a composição atual sem transportar #414 ou fontes B não qualificadas. O verde anterior não foi atribuído automaticamente à composição nova.
- **#469:** proposta isolada `fd077febc1942f6e760a57013e2d32b2562a6dca`, fix C `8b3a61685a6cf1b0d04ef9823797a6539b487203`. O gate concluído usa fonte composta `e433d40f2f8b2a1406c73c189ab15ecd8926cbc4`, snapshot `ecd8098403f2c4b1839c5e29249c8dc8358de3ce`.
- As duas fontes qualificadas partem de `a8dab4400ba268402b65b872f3bcfff349176031`, com somente seus deltas de teste; o `results-store` integrado foi preservado. Coordenação: [#410, comentário 7030928330](https://github.com/gustavomhss/Orchestra-SF/issues/410#issuecomment-7030928330).

### Histórico de integrações qualificadas

Já mergeados:

- [#399](https://github.com/gustavomhss/Orchestra-SF/pull/399), fixture da instalação e scanner privado; source 1aee8d2dac6c92a6e509e76dca87525128dab4a9, merge a5b15b51b78469a054ba97b0e87fd1e36e31f73a. Typecheck canônico verde, sem alegar execução dos cenários privados EICAR/ClamD.
- [#398](https://github.com/gustavomhss/Orchestra-SF/pull/398), reobservação Atlas com novas provas consumíveis e fences originais; source 28df867d458fef842919f8b5e703df90209ff76a, merge 589adb7cae06c584e1e51eeac9db7cd24dc987ea. Quinze testes verdes incluem historical-memory C7, revocation-tail A2 e similarity217 B5.
- [#404](https://github.com/gustavomhss/Orchestra-SF/pull/404), identidade estável de ready dentro da mesma admissão, invalidada por geração/owner/reload/revogação; source 4d8c7866df5e7b8146b7b0ff2fedf4b293cd59a7, merge 5efe5a3ff3a2c382a18b28f0d575825eafab5ede. Três testes de componente verdes; não substituem instalação completa.
- [#401](https://github.com/gustavomhss/Orchestra-SF/pull/401), prova BI completa reaproveitada somente no escopo original, mantendo autoridade/fontes/dia UTC/imutabilidade; source 29021f31f9ea0a46807e60f25176a272a8c93096, merge 18a913220a6805bef1c62a58a26a310f991d6a0a. Nove testes verdes incluem ambos os renderings C7.
- [#402](https://github.com/gustavomhss/Orchestra-SF/pull/402), transporte verificável de aprovação real do PR fonte para guards; source cd7c1e082394ab105f507d38bf3d656953827f1b, merge 08854f14d83ab12d8665b0e3787881edbfaabd53. Cinquenta e nove testes de resolver/runner verdes. Não concede aprovação e não elimina os dois gates protegidos.


- [#400](https://github.com/gustavomhss/Orchestra-SF/pull/400), fonte Planner na resposta humana; source 50ce9319b03ae52ec3871043161c19b17c49a1b3, merge 392cecab68288d4b669828adc5d1aaa738693d80. Original C7 passou no primeiro gate; a nova fixture recebeu a linha real de acesso do destinatário e passou no segundo (1/0, 32 asserções).
- [#411](https://github.com/gustavomhss/Orchestra-SF/pull/411), prioridade e destinos nativos de Signals; source 492c06aa5d34e30db3859db3f411f948891d02a3, merge 7c42282e8b910cc0e10381980f040dee72cb2b19. Gate 44660432596: 12/0 em unidades mais 2/0 em browser de rota, 183 asserções. A lista elegível mantém as 21 identidades; CAP13 não se torna produtor.
- [#409](https://github.com/gustavomhss/Orchestra-SF/pull/409), estado de busca/filtro Portfolio admitido novamente por owner/geração; source b07ed52c5e3d96567f0051520b229313e5b4b04a, merge f4b62403fc2d9c74c6302d745bb4a057cfdd4439. Primeiro gate 4/3 revelou remount incorreto da fixture. O segundo, após keyed render-prop real, passou 4/0, 60 asserções, sem ampliar wait.
- [#415](https://github.com/gustavomhss/Orchestra-SF/pull/415), restauração de 14 blobs documentais históricos exatos; source fa25e59bbcadc41823cdad47b24e75fac3095d37, merge 1222022bd54282c8086b1da45b0be6ad2f6520ea. Gate 44661599225: 8/0, 401 asserções. Nenhum pin alterado; evidência de corpus/contratos, não execução dos journeys.

- [#417](https://github.com/gustavomhss/Orchestra-SF/pull/417), revisão11 do contrato com proveniência; source f86d423436380812e4ce0835d4dbe4efced1d825, merge 687759276c2c9121c2cfd20a5994b277ceb7ee4d. Gate 44662549289:5/0,913 asserções. Os merges posteriores407 e431 alteraram o produtor host pinado; revisão12 #426 foi emendada com as duas proveniências, passou5/0 e foi mergeada. O verde11 sozinho não qualificava a árvore posterior.
- [#407](https://github.com/gustavomhss/Orchestra-SF/pull/407), observação Reviews integrada por outra sessão; source 713f9829e896fee44a610dfbda16f893be2e5be5, merge d548a76a4e7838bccdb20e98c1ad16fdeca0b391. Gate 44657226869:4/0,27 asserções. Alteração real do host exige nova proveniência WP00.
- [#412](https://github.com/gustavomhss/Orchestra-SF/pull/412), recuperação OPEX/CAS; fix de fixture867fe10bf2aae28b244b65b5d17dc54c58ffd22e, merge d7fa94063e798207ed692026b557d27dfff1aef8. Segundo gate 44662953944:2/0,21 asserções,1.63s. Captura usa schema estrito e fronteira JSON real; não modifica espera/assertions.
- [#421](https://github.com/gustavomhss/Orchestra-SF/pull/421), leitura/configuração nativa de resumos; source 849f00b98ef315025acdfffd4f3705e49c39953f, merge d4ded81224e05f2d3b9789b3eec40b9de8a32fa1. Gate 44663777161:9/0 HTTP/schema +12/0 UI =21/0,7913 asserções. Admin, CSRF, CAS, idempotência, directory, auditoria, intenção e releitura reais; nenhum guard removido.
- [#422](https://github.com/gustavomhss/Orchestra-SF/pull/422), navegação de período CAP03 pela admissão F01 real; source f201956ef1491e699bee409c571ad16d82cea158, merge 23f851dbc6b86c0a571dd95f4b2bb2558b9dc1cd. Gate 44664293983:5/0,107 asserções,1.84 s; owner, geração, revogação, URL, recarga e draft preservados.
- [#430](https://github.com/gustavomhss/Orchestra-SF/pull/430), nove fatias B de teste qualificadas; source 9af676c5df10e363c8837562e4bfe6bcc66fd60e, merge 838572713fcceb2df96086f9729347fcda87d9e7. C02/C05/C06/C07+C08+C17(somente3 arquivos)/C12/C13/C14/C15/C16,12 blobs exatos dos snapshots verdes. C01/C03/C04/C09/S10 e demais unbounds excluídos; head B não usado como parent. Gates originais/limites completos no PR, sem alegação de shard integrado verde.

- [#406](https://github.com/gustavomhss/Orchestra-SF/pull/406), replay do draft somente com transação prévia durável e fences atuais; source 3190d29fa62e902f8ceefdffcf703eb367c9b2c9, merge 062506e92427f9ff41fcb952c0b1559e65076a4d. Gate 44663906249:9/0,181 asserções; nova intenção obsoleta403, colisão409 e revogação403 preservadas.
- [#432](https://github.com/gustavomhss/Orchestra-SF/pull/432), fatias A descriptor/Executive/download qualificadas nos gates completos A1/A2; source c7b4b1d7077ba908bb588e955f784215fd185d72, merge e41c3e18330397ce508a349f52cb3bee8cb07639. Dois arquivos; não transporta os demais unbounds de A.
- [#427](https://github.com/gustavomhss/Orchestra-SF/pull/427), conflito documental original preservado como stale/HTTP409; source 0fff3074641bf8f21845e4db59423cf89b3eef7a, merge be192011d5cfccc7524fd81d53674b3317005091. Gate 44667039756:2/0,54 asserções,2.67 s; sem exposição privada ou segunda escrita.
- [#428](https://github.com/gustavomhss/Orchestra-SF/pull/428), fence final da saída de análise distingue falha de render503 e autoridade revogada403; source c62c817df0208202ad3ee768433542d862f3921c, merge 573678d0acf9e91654efb7e67af7d30ebe45312b. Gate 44667507711:3/0,25 asserções,13 filtered; primeira preparação Workbench não incluída nesse gate.
- [#431](https://github.com/gustavomhss/Orchestra-SF/pull/431), disponibilidade de assets/import observada por outra sessão; merge 295c2bdca05c2373f821d50aab5d3ee3d3fb218b. Gate 44666552454:26/0,182 asserções,729 ms, fonte 6732ff508922b097e5c9c42b457e3dc8dc6c65ae. Novo host altera um pin WP00; não qualifica a suíte Operations inteira.
- [#437](https://github.com/gustavomhss/Orchestra-SF/pull/437), projeção Budget publica mapa vazio somente quando Domain.view admitido prova ausência canônica; source 54f0e9da5f5119967e268a32b48cb7c7824440c0, merge b180588c63e41eecd6d73d839d078755d68cad3d. Gate 44668705164:18/0,1386 asserções,1219ms. Nenhum CAS inventado; mapa malformado, revogação e corrida continuam recusados. Não é terceiro gate do Dashboard.

Outras fatias concretas: C `bcbc0a30c8d9f9dfb1ed78829ffe62939d07163e` compõe os helpers C04 de B; C `8e71e07e907b02be635d4f98aaf0638816f7b429` corrige o chooser BI com duas fontes reais e controles HTTP negativos; C `3e23044944a59c2544b3d09451960d22e3bec47f` migra o Dashboard completo ao host nativo. O chooser foi qualificado pelo run 44670030550 (1/0) e integrado em #447. O Dashboard nativo falhou duas vezes após 25 asserções: 44663298380 e 44666208536. Continua `UNBOUND`, sem terceira execução focada. Os cinco controles de #423 passaram; #437 corrige separadamente a omissão do mapa pelo produtor. A fixture conserva todos os controles originais e o limite de 60 s.

AM02, pin de produtor, recuperação Atlas, revogação de observação, import/report nativo e planner-origins também passaram nos gates focados abaixo. Não houve execução integrada dos oito shards após todos os fixes. O novo verde completo de C8 cobre somente seu inventário histórico exato; os demais recortes não alteram os totais das enumerações originais.


### Integrações qualificadas posteriores

| PR | Mudança | Head qualificado | Merge em sf-join-four | Evidência e limite |
| --- | --- | --- | --- | --- |
| [423](https://github.com/gustavomhss/Orchestra-SF/pull/423) | Cliente do primeiro desvio com mapa vazio canonicamente admitido | 4039640ef1acffd79b8e27c7186b3e231a5dddd9 | 9fb1514464e75646ec2f96d9ddaf940f1fe2062c | 5/0,58 asserções no44666208536; produtor43718/0 já integrado. Dashboard original0/1 no mesmo run permanece UNBOUND |
| [440](https://github.com/gustavomhss/Orchestra-SF/pull/440) | ParserCaseRef preserva IDs/tipagem reais; nega IDvazio/versão<1 | 602c5953f22d7b3de8319afa2f596c7cc347830e | 8eb020dd6cb776b18dc006a23403f8b3a5e4a0bf | 44669527682:17/0,327 asserções; 8.88 s; inclui16Workbench e1identidade |
| [426](https://github.com/gustavomhss/Orchestra-SF/pull/426) | WP00 revisão12 com proveniência real407+431 | 42926f460f6e1b5195aad2be39ecf200e4a5ef71 | 9391cd78afb37883964263f4a43b08aafead131b | 44669752250:5/0,913 asserções; 178 ms;38artefatos/ordem/proveniências anteriores/consumerAcceptanceBLOCKED preservados |
| [443](https://github.com/gustavomhss/Orchestra-SF/pull/443) | Dez causasC qualificadas,21 blobs de testes | b14a9caf25dcb8635d364ae4c77ba9bae98f4951 | 95d3ffdc5478edcfa0ce012ba7f367ef7ab39259 | pin/Atlas/source-observation/AM02/import/WP05/public-state/procurement/AM04/Workbench; o único diff procurement inicial são2linhasexpectSpawn; sentinela separada451 |
| [447](https://github.com/gustavomhss/Orchestra-SF/pull/447) | Histórico de Planner e chooserBI com autoridade atual | 310e03056d2eda701724dd40fe23c32f944db35c | cad07e37262ebc4888422b4cf549e06c37a9390d | 44669530310:3/0,168 asserções; 80.24 s;44670030550:1/0,73 asserções; 69.57 s; dois commits causais |
| [444](https://github.com/gustavomhss/Orchestra-SF/pull/444) | Recusa exata de revogação do escopo, sem value | 44ea482e56f8fd31fb861d3ca7e18583c3115c35 | 124d5b5c7fbc4a7a57edc0fe1420d38496402a48 | 44670481763:1/0,20 asserções,8filtered26.60 s;13 asserções internas mantidas; casos anuais105 s não incluídos |
| [438](https://github.com/gustavomhss/Orchestra-SF/pull/438) | Observação histórica bounded de analysis, fallback opaco paralelo e pin real | 43a2dcebfed2cabfa01934f8b9bee0987dc134ac | 676584ba114e34da0a5ec523caa230746716591e | 44670811024:21/0,148 asserções; 40.85 s; pin44671622213:2/0,40 asserções; 35.45 s; B6 excluído e continuaUNBOUND |
| [451](https://github.com/gustavomhss/Orchestra-SF/pull/451) | Sentinela específica do pedido privado, sem colisão com atributoHTML hidden | def79021902e903641f4c01cedddfa2ec87a0db3 | 82ead34aa68b942b1174f06f8e2c6a0a1f043db9 | CasoA3PASS1845.38 ms em44665621967, helperBun; composiçãohelperNode NOT_REVALIDATED.56expressõesexpect preservadas; C mantém superset de título adicional |

Também incorporados de outras sessões: #435 (AlternativeDraft persistido, merge 82d2041d80784e2d905f99dee3bca91c63ef8350, gate3/0) e #425 (CI, merge c74724c3e82f9a3fd3bdf2cd5492d966069caed8). #425 mede timings reais e liga seleção/source/pais; não representa um recibo completo1–8. Suas provas Core/Sucafina/spawn focado passaram, mas as execuções amplas tiveram falhas históricas de LFS/guards/setup, registradas no PR. Nenhuma aprovação foi fabricada.

### Integrações e verificações deste checkpoint

- **#456 — C03 browser.** Merge `aa751dd731ce91f126a00488dfce16022bb8cb2d`; run 44670314438: **1/0**, 28.47 s; código `831e174a17cae28888c46747e779028524e91ff2`. O teste completo retém a identidade real do enrollment, os controles de retirada/revogação e duas revisões duráveis. O helper acrescenta somente o consumidor `wp07-review`; a composição isolada não foi reexecutada.
- **#442 — rollback SQLite.** Integrado por B em `45514008d7ce275327003c5d92faaeeab2479739`: proveniência privada de rollback confirmado antes do COMMIT e journal de abort autenticado, sem inferir segurança a partir de ausência de recibo. Run 44673967393: **18/0**, quatro arquivos completos; fonte `32c97d3b4de5bb7960ca42f816b11ea37f594541`, snapshot `24f4bfc7c4671ff69b90961da988419b8f7c6cff`. Nenhuma edição de `runtime/application.ts`.
- **#457 — identidade de persistência do import-health.** Merge `a1fd4fb7a25814a82a690a6091f29d9041aa225f`; fonte `8557bbdb13243a188f01ecdf5b68c836cddb048a`. `Object.is` compara os mesmos objetos sem coerção de tipos.
- **#459 — cinco arquivos de teste tipados.** Merge `a88def25ae2a2347d62e2aeb930e0a50a5ef692c`; fonte `24566526e4f4d720c269fd0cdb67577c766d7ebf`. IDs de operação derivados das APIs, `AbsolutePath` do diretório real, anotação de registros AM02 e controle real de ausência do call UI; asserções preservadas.
- **#453 — prova estática isolada.** Workflow mergeado em `6a1cab15959d37d0df7bbc2982c0aaab0a59789e`; fonte `1885dd769e8100520b15e0596e76bf8525e23b28`. Não dispara `sf-ci` e não concede aprovação.
- **Static — resultado terminal.** O primeiro run 44672678428 revelou 13 erros TS. Após correções, 44674216763 / snapshot `4cc2864f91eaa96ab40e9010fbf89d4e3e7d23cb` executou **15/16 comandos com exit 0**: sete typechecks, generators, E2E, Web, spawn e guard da base PR. O agregado permanece `FAILURE`: o guard de `origin/dev` exige aprovação real para `godfile-waivers.json` e `script/spawn-allowlist.json`. Esses dois paths são idênticos à base; a regra em `script/guards/rules/protected-paths.toml:17–19` ainda exige o label real, ausente em #397. O snapshot antecede #442 e não prova a árvore posterior inteira. Não repetir o gate pelo mesmo bloqueio.
- **#460 e #395 — instalação e pacote.** Integrados por outra sessão, respectivamente em `a62ce06fd108d7ea274e80efb69bb18f7fd0728e` e `c32e906a92193ae33d32b5106a82ee47b81c0ba4`. Evidências declaradas nas PRs: 44674117714 = **3/0** para instalação original Reports/Planner; 44670544483 = **143/0** para retenção autêntica do pacote. Esses gates não constituem aceite completo de Reports/Decisions ou GO.
- **C12 original — permanece UNBOUND.** O segundo gate 44673405969 / snapshot `3f89348147e6f6480face7f129f3b8d8da2e0a38`, fonte `eab3b59d613ff9d32258f91bc50fcc931ecab21d`, terminou **0/2**, 31 asserções, 54.26 s. O fix corrigiu os dois routeRefs usando o codec F01 e validação real de UI39. O primeiro caso falhou no startup Chrome de 15 s com espera de IO; o segundo chegou ao COMMIT 200 perdido, recuperação 200 e um efeito financeiro, mas falhou no fechamento obrigatório do bridge (`:385:35`). O ponto repetiu; não haverá terceiro gate focal do original. `recovery-ui.test.ts` ficou fora de #465.
- **#462 — EOF do driver, qualificado e mergeado.** Candidato `9a499e3daf5488eaf40a8d56b661821d8473dffd`, C `e432400faff2cf84ac8bedb9590e14248db3653b`, fonte PR `7bae26dc4f6b9336f6f08ac703352108febe26b7`. Alteração restrita a `iterator({destroyOnReturn:false})` e três controles Node com socket Unix/WebSocket reais, sem mudar deadlines ou cleanup. [44675815817](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44675815817), snapshot `788adce5756c3a1fd259d388d670e51a560ec0e8`: **3/0**, 157.07 ms. Merge `7eeb29992852a48fccb72cc42c821a5eca3ba84d`. O recorte qualifica o EOF e seus negativos; Chrome/startup e o C12 original conservam seus próprios limites.
- **#465 — concorrência A3, qualificada e mergeada.** Candidato inicial `73a8c5aa8958b1d24e2472f3d4c60ff32d2c9f00`, aplicado em C `64777e691e98e9b3360a8d0d2bed3270e642f416`. Preserva efeito único, recibo/prova durável, edição concorrente independente, exact replay e recuperação; adiciona negativas de intenção, revogação, alvo físico, pós-COMMIT ambíguo e escolha material alterada. A API atual retorna 200 para edição não material com o mesmo recibo; Apply conserva 409 quando intenção/choice muda. Primeiro run [44676601298](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676601298), fonte `2830802dc330065155f205f235d7ff49ddc79c08`, snapshot `a1d4d9574413c5a70be062312dacdc5f8c2456ac`: **2/1**, 141 asserções, 71.96 s; browser 44.214 s e API 15.424 s passaram. O controle novo de re-Review em `c12-concurrency.test.ts:329` esperava 409 e recebeu 403. O fix exato segue o guard externo `withCase` no HTTP Procurement: **403 / denied / case-selection-unavailable**; conserva Apply **409 / prepared-case-changed**, recibos, efeitos, recovery e escolha material. Fix C `d471e44f0669af041ed6f94fe912452630dd8d31`, isolado `1cf1370b0970df584f006eb02f076b24421596bb`. Segundo run [44677773333](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44677773333), snapshot `be271fce08a3d76ad21eb51b11992c8393241c57`: **3/0**, 185 asserções, 82.72 s; casos 41.485 / 14.642 / 25.889 s, com os dois modos pós-COMMIT completos. [Job 136093615202](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44677773333/job/136093615202) e cleanup 136094386193 terminaram `success`. Merge `a8dab4400ba268402b65b872f3bcfff349176031`.
- **#463 — pin e escopo histórico completo de C8, qualificados e mergeados.** O `state-provider` pós-442 tem blob `dc0c55245b805f9290f3798100ba6a6fd5fa88ed`, 36432 bytes, SHA256 `bd90848a7e75e62d457901666d6dfc6409e9ce3578092958ee9e794bb210a141`. Proposta de pin `50d8dc20519e85b063ca05d3bcb176487688e9b7`; C `5917a488021408261b59ba81106ad582dd167270`. Outputs, workload e counters permanecem iguais. A request `e79320e4d032edb7749a73dee807334b720d9b55` preserva os 115 arquivos únicos da enumeração 8, com paths explícitos e sem reclassificação LPT. [44676183011](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676183011), fonte `7bed88e6977cdd6de674ad80352d0f7460311f2c`, snapshot `968d5cdd857ea6d4305df5a337bca9c8c6641ff9`: **620 pass / 0 fail**, 30843 asserções, 115 arquivos, 881.49 s. Inventário do log igual à request: 115 únicos, nenhuma falta ou extra. [Job 136088455724](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676183011/job/136088455724) e cleanup 136093953687 terminaram `success`. Merge `ad7bf8a6bea5dc8bcc436f39ebd861eeb935f7ee`. Esta é a qualificação integral do escopo histórico 8, não um recibo canônico da partição LPT atual.
- **B memória — resultado terminal.** [44670534535](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670534535): **28/2**, 508 asserções, 30 testes em quatro arquivos, 1604.24 s; fonte `91bcd283b6c4fbd9bc9575d232cbc62ddea9630b`. `planner-memory-read-scope` passou 5/0 e `planner-case-read-scope` 23/0. `product/integrated-proofs/am01/portfolio-recall-proof.test.ts:19/:148` excedeu 240 s; `recall-five-profiles.test.ts:24/:166` excedeu 900 s. Os catálogos observados estavam vazios, sem inferência. Os dois cenários AM01 continuam sem aprovação; o timeout repetido de portfolio-recall é `UNBOUND`.
- **B Portfolio — resultado terminal.** [44670599697](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670599697): **41/4 + 1 error**, 529 asserções, 45 testes em sete arquivos, 1921.93 s; mesma fonte `91bcd283b6c4fbd9bc9575d232cbc62ddea9630b`. Passaram 10 metric + 7 planner-observation + 10 persistence + 14 selection. Os dois purchase excederam 360 s e reevaluation 300 s; erro comum em `native-choice-preparation.ts:36:70`, `decision-authority-changed`. `Dependencies:60:21` usava a fixture antiga `4fe9d9c...`, sem o fix C `ba7200`; não refuta esse fix nem autoriza terceiro gate C. Cleanup de Portfolio e memória terminou `success`. O novo gate B de dependencies, com fixture corrigida, está detalhado na tabela de gates posteriores.
- **#441 e #464 — propostas pendentes de B.** #441 ainda exige a captura antes do primeiro `await`. O candidato isolado `660a8117b813a5ed5daddcc97511b911159ef618` captura request, identidade, owner, source e criteria antes do `await`, recusa drift e acrescenta quatro interposições reais, preservando sete casos. Foi enviado à sessão B no comentário 7030363396; B ainda não o incorporou. #464 permanece em `8d093ed277668438be1ffde9130c6d7a0f41da46`. A proposta de quatro testes populados `92c9cbbf3013a2202fd30270273b6f37c9e48435` recebeu revisão estática independente favorável, mas continua **NOT_QUALIFIED**, sem gate. Ela exercita C10 real, três promoções reais, 36 chamadas delegadas, paridade, menos raízes, imutabilidade e recusa após COMMIT; não resolve a janela de #441 por si só.

### Checkpoint posterior — Review, semantic, rollback e IO nativo

| Fatia | Run / resultado | Fonte e snapshot | Fix C / merge |
| --- | --- | --- | --- |
| Review completo #470 | [44678230528](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44678230528): **16/0**, 490 asserções, 454.22 s | fonte `cbfe3217b57ee6c13a2993b06dfebe0433f33e2c`; snapshot `e64b053374949ff1b4979d7b2566c75973b2f663` | C `9f9941a6e6cedc2432cd0e3d6b6aa02580d0c7d1`; merge `3e396b258ab5e10476e9a4e0c38e54a54fa0022b` |
| Semantic WP05 completo #469 | [44678238009](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44678238009): **3/0**, 4.46 s | fonte `e433d40f2f8b2a1406c73c189ab15ecd8926cbc4`; snapshot `ecd8098403f2c4b1839c5e29249c8dc8358de3ce` | C `8b3a61685a6cf1b0d04ef9823797a6539b487203`; merge `cf28ef09ffb4633854106b6f883a16cc56fb96a5` |
| Rollback completo #473 | [44678639563](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44678639563): **18/0**, 542 asserções, quatro arquivos, 1.90 s | fonte `b36d0632838e543f3c4a7c9a938c31f0865ef043`; snapshot `ebe5de4f72cd50c4efe2f59e48d9e385419121b6` | C `33ea0cc807c98d5797a3138ce4aed14859baddcd`; merge `e79c2609042d1f54358a222463566fc4e1ee6e8e` |
| Planner IO1 #474 | [44679668214](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44679668214): **0/1**, 1 filtered, 39.42 s | fonte `36a3de511df7a5bc683cd2bc7ad827d5cc5662ef`; snapshot `068213d64003aff10dcb7a5637f25087b66ae19c` | C `dbbc5832811202fecebb09c2adebf65ace0d6c05`; não mergeado |

Os jobs de Review `136095092794` / cleanup `136098340728`, semantic `136095117192` / cleanup `136095467345` e rollback `136096438044` / cleanup `136096775415` terminaram **success**. Os gates Review e semantic partiram de a8dab; o de rollback de cf28. A integração posterior de #466 não retroage a qualificação desses snapshots.

Review conserva os 16 casos, 123 linhas de asserção e prazos 105/120 s; HTTP 403 do handler real retira todo o workspace privado, e uma resposta 200 autorizada retida não restaura o conteúdo após revogação. O driver muda somente o literal de consumidor. Semantic conserva os três corpos, 33 linhas de asserção, keyboard/geometry, contexto/viewport original e 90 s por caso; três spawns reais, Node/Chrome exit 0, WebSocket 1000 clean e remoção dos sockets. Rollback transporta dois blobs exatos, sem produção adicional: sete controles privados de proveniência, um handoff, nove reconciliações e um indeterminate. Request admitido, comando draft, SQLite rollback, journal append-only, confirmação renovada e recusa de retries concorrentes permanecem obrigatórios.

IO1 migra somente “browser previews/applies Planner XLSX and exports persisted monthly values and totals”, preservando 90 s, workbook literal, doze valores 125, herança `inherited-budget`, fórmula `SUM(Jn:Un)` com resultado 1500, reload, download real do Chrome e erros vazios. Usa instalação/enrollment/identidade originais, host nativo e F01; o scanner INSTREAM/PING/EICAR herdado permanece simulador, sem alegar AV produtivo. A revisão estática corrigiu o observador para `files.import-reference` e o locator relativo antes do gate. Composição mantém Review no driver e remove somente o alias de tipo vedado por AGENTS. O segundo caso de I/O ficou byte-idêntico e não entra neste gate; investigação separada identificou lacunas reais de UI para Members e anexos Supplier. Visual-layout ainda exige equivalência dos 28 destinos e quatro indicadores; sem redução de asserts.

O primeiro gate IO1 terminou **0/1**, uma filtragem, 39.42 s; job `136099775322` failure, cleanup `136100473256` success. Chrome conectou em 13951 ms dentro do limite 15000, enrollment 303 e autenticação passaram. A espera `io-browser.test.ts:33:12` não observou GET `/sucafina/api/ui/context` em 10000 ms. O log não contém DOM/pageerror desse ponto; não atribuir uma causa especulativa. O fechamento Node terminou exit 0, o census Linux não encontrou membros vivos e o transporte desconectou. Não houve oráculo XLSX executado. Bootstrap, discovery e observer estão em auditoria antes de qualquer novo gate.

### Terminais B posteriores e integração externa #466

| Gate B | Resultado completo | Fonte / snapshot | Falhas e limites |
| --- | --- | --- | --- |
| Planner batch [44676186908](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676186908) | **19/3**, 568 asserções, 22 testes / quatro arquivos, 1429.16 s | `3e418a337751bc496d0d4c6cc0cfa38d6ee76faa` / `6590ec54e3a9ab1917ebd759e41c8cec538fee50` | `planner-case-read-batch.test.ts:317:20`: uma scope esperada / zero; `native-execution-reevaluation.test.ts:24/:152`: 300 s, observado 316414.19 ms; `am01/portfolio-recall-proof.test.ts:19/:148`: 240 s, observado 299558.24 ms. Cinco perfis completo PASS em 807555.68 ms, catálogo vazio explícito. |
| Recovery [44677071823](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44677071823) | **33/1**, 463 asserções, 34 testes / quatro arquivos, 1063.72 s | `a21c18957c075eeb913e7f97e627a0a23459e8aa` / `5090a9009489661b2d6a92f98725659b7e3cddbb` | `calculation-ancestry-composition.test.ts:39:7` → `composition-test-deadline.ts:5:29`: 105000 ms; uma falha, reportada novamente no resumo. `produce-outer` completou 470 leituras / 102089 ms e abortou. |

Batch job `136088469059` / cleanup `136097127989`; recovery job `136091319246` / cleanup `136097914133`: ambos cleanups success. Batch positivo faz 12 chamadas reais e reduz operações físicas 162→5 com estado protegido inalterado, mas ainda `alternatives: []`; não substitui quatro controles populados/36 chamadas de `92c9cbbf3013a2202fd30270273b6f37c9e48435`.

Recovery passou **planner-calculation 24/0**, **calculation-case-scope 5/0** e **similarity217 4/0**. #466 foi mergeado externamente em `152be1f2bb7f3f5218ea3de06b60c31f37d8093f`, fonte `50e35c7c03861043f73223e2e63470490f250584`, com os três blobs de produção iguais ao run: atlas-memory `c1dc05148ead425f01584fa8c57800664ba0b573`, atlas-recall-scope `8ee74e2cca1b3e1df128739e4fdb9097019d50fd`, business-context `2909b91cce3dcf595b6a24ce56d8cf07c769d45c`. O wrapper só trata replay já settled; ancestry falhou na produção inicial. A composição B contém ainda business-services `60612bdc02c5c692de82879b553a6a259cd876f5` e result-store `960ec20e78fb6a52e07cecebd2c6b12ce8c5393e`; o verde observado não qualifica automaticamente outras composições ou #414.

B corrente `aa58e28caa571b08da509668847300e38ccd0319` incorporou ajuste concreto do controle scope (`73ca14579c734500361794d944e2d170058fdbd9` / `a00b6bb9134d80a6d377d5fee8fb519a3b272fb1`, teste `75a850a89bc19f42a750c14903f42a18a780351d`): reemissão real autenticada cria nova incarnation, selector antigo continua recusado e estado protegido permanece imutável. Esse ajuste não é qualificado pelo run anterior 19/3. #441 head `8d148624eb52e828007756920905933c905ddfc5` e #464 head `8d093ed277668438be1ffde9130c6d7a0f41da46` ainda não incorporam as revisões C. No B atual, business-services `3df0195541debf6502393fcb65e13b7869ea8abb`, linhas 465–474, ainda captura após await selectedCase:469; o teste populado está ausente. Pedido de incorporação/resultados em [#410, comentário 7031127454](https://github.com/gustavomhss/Orchestra-SF/pull/410#issuecomment-7031127454).

A continua em `ace8a3263cf3a8c3546824ddb339a93e351cfb33` (código `a86e22c9654663a72bd55586059a4254f548c742`), sem nova enumeração. B tem ativos 44678987832 (native, fonte `24d6ff06dd796ebf237d8460e3ef3952b40d25a4`, snapshot `9af757257a9f734b7acea6a1217e46706361c192`) e 44679287587 (Dashboard batch, fonte `5b0cb657c467ac1e953e9530bfcd54efab44bf75`, snapshot `1b11a352f756ad379351905609c946016fff2863`); nenhum resultado antecipado.

### Adendo posterior — Mixed B e propostas nativas (2026-11-20)

Este adendo parte de C `d8fc0b84c0564b4908b265181bb5826355c5bc96`. A integração observada passou a `sf-join-four@9d3a70179cc1ced293c58d4dfc032d5d2aa41bf6`, incluindo #434 em `db14b2a3a04689841b033312cb989741e5677a50` e #468. As contagens das enumerações completas/parciais dos oito shards permanecem inalteradas.

#### Gate Mixed B: terminal real, sem transferência para corpus populado

[44680196613](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44680196613) terminou **36 pass / 1 fail**, **383 asserções**, **37 testes em três arquivos**, **725.03 s**. Fonte `aa58e28caa571b08da509668847300e38ccd0319`; snapshot `3ee28f22b01bd584967e8417e7e8e9ee782a5cec`, cujo único pai é essa fonte; request `.ci-run.json` blob `a5a279acb990aeb056a33af1d107bb40f0c222aa`. Job `136101471773` falhou e cleanup `136107403212` passou.

| Arquivo / recorte | Pass / fail | Evidência e limite |
| --- | --- | --- |
| `wp10/integration/planner-case-read-batch.test.ts` | **19 / 0** | Inclui o controle de scope não materializada corrigido por `73ca14579c734500361794d944e2d170058fdbd9` / `a00b6bb9134d80a6d377d5fee8fb519a3b272fb1`. O custo observado continua em **12 chamadas de fonte**, 162→5 operações físicas, uma raiz protegida, projeção integral igual e estado protegido inalterado. |
| `wp10/integration/mixed-case-read-batch.test.ts` | **16 / 0** | Retém os dois produtores: 12 chamadas Planner e seis Procurement; 261→6 operações físicas, duas raízes protegidas, projeção integral igual, segunda invocação nova e estado protegido inalterado. |
| `wp12/native-execution-purchase.test.ts`, variante `pending` | **1 / 0** | 343855.45 ms. A escolha humana foi reaberta, com caso inalterado. O recibo emitido declara `inputPrepared:false`, `inferenceExecuted:false`, `domainApplied:false`, `gnativeAccepted:false` e `outputRef:null`; não é execução positiva de missão nativa. |
| Mesmo arquivo, variante `complete` | **0 / 1** | Declaração em `:14`, prazo original em `:136`: timeout de **360000 ms**, observado **366873.46 ms**. O log não localiza o último await por stack. `decision-choose` completou em 250997 ms; `read-chosen-case` completou. O último boundary emitiu `request-projection-exposes-no-selectable-change-target`; não houve recibo de consumer reaberto para essa variante. |

O footer repete a mesma falha de `complete`; não são duas falhas. O snapshot contém o controle de batch não populado e **não contém** `planner-case-read-populated.test.ts` (404 confirmado). Logo, os quatro controles com 36 chamadas reais de `92c9cbbf3013a2202fd30270273b6f37c9e48435` continuam **NOT_QUALIFIED**. Este gate tampouco qualifica o reparo pre-await `660a8117b813a5ed5daddcc97511b911159ef618` nem o shard B completo.

#### Executive e navegação: resultados e fontes separados

| Causa / gate | Estado na consulta deste adendo | Fonte / snapshot / limites |
| --- | --- | --- |
| Executive, primeiro [44681543819](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44681543819) | **18 / 3**, 103 asserções, 21 testes / quatro arquivos, 70.94 s; cleanup success | Fonte `04f58283f47c7e9ed439a9740255eeb41c744dfd`; snapshot `1ef269b636ba844ffec41c14f9d3add79289521b`. Dois casos de typecheck falharam: Summary/schema em `test/sucafina-summary-settings.test.ts:22/:35/:36` e sete diagnósticos de receipt em `product/host-binding/atlas-memory.ts:384/:392/:393/:394/:436`. O browser falhou em `native-ui-contract/executive-people-browser.test.ts:131:53` no seletor Month; as verificações anteriores de cinco larguras passaram. |
| Executive, segundo [44682884013](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44682884013) | **21/0; 103 expect() calls, 64.85s; mergeados #484/#485/#475/#479** | Fonte `0e9414eebfe268748a9402703d34d4fb713d4400`; snapshot `072a53f1eaaac8583ae7fd73caf8ed24b172d144`. Composição após os fixes #475 `da38493bb8841fcaf8103f825f5e598ee40e9d2c`, #484 `bcecd8732fef8fe8dd36b23fda23aa5916a99fdf` e #485 `13b170e3508e4e62d970a5e253af1633fefde430`; testes #479 `43e284e2eecf6d8dd9fda4fb5b25a6323fac7d00` inalterados. |
| Navegação nativa [44683335605](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44683335605) | **1/2; 6 expect() calls, 76.00s; cleanup success** | Fonte `45c11fb769682d98f2b2b9c06b9ea4cd901a121e`; snapshot `9acef3622fb63e694b24901b35698e3beb2315af`. Produção #478 `fb60b6c1220d1748a0ebde44f402a76b10702ddf` inclui o guard de evento já cancelado; testes #486 `b12cce3747209d47fe11ab4e6bf5c394daa226f5`. O helper de typecheck de `modules/sucafina` e `packages/app-shell` pertence ao snapshot e fica fora do commit a integrar. |

A prova de navegação é de componente, F01 e navigation-state com entradas de contexto declaradas: verifica os 28 links, filtros, ownerKey, layout e feedback atrasado após unmount. Não substitui a jornada visual instalada dos 28 produtores. O controle de unmount preserva provider/owner/rota e libera uma recusa atrasada; prova supressão de feedback obsoleto, sem alegar cancelamento de uma transição autorizada.

#### Propostas CAP28 preparadas, ainda sem gate

- **Produção #482**, `sfc-settings-polling@f3bcdb97b3eb930d3f41d63080b5b6edd0c772da`, empilhada sobre #477/`2aa5a15889df2764c50e26b0b6d41ca7889c203e`: fila única de leituras, polling de 30 s, refresh manual coalescido e confirmação de save/reset pela leitura iniciada após o POST. Preserva os marcadores de inicialização e CAS de #477. Quatro testes renderizados cobrem dirty/blur/cancel, fila de confirmação, aba oculta, owner/revogação e 409 sem replay; nenhum resultado atribuído.
- **Migração #483**, `sfc-parity-polling-native@d795692ab13fafae9f557def76596fcf0027d2b9`, sobre `9d3a70179cc1ced293c58d4dfc032d5d2aa41bf6`: mantém nome e deadline de `parity-polling-browser.test.ts`, reset real, segunda sessão EUR, CHF após blur/poll, duas atualizações sem sobreposição e leitura enfileirada após save; acrescenta confirmação SQLite de CHF na versão 3. Depende de #477 + #482. A fixture nativa é copiada byte a byte de `fdbf7c790fb7838009243b323b6c72530679d92b`; o antigo Runtime 3/1 continua sem diagnóstico e não é convertido em verde por essa proposta.
- **Receipt #485**, `sfc-atlas-receipt-narrowing@13b170e3508e4e62d970a5e253af1633fefde430`: apenas move a captura do receipt para dentro do ramo `settled`, antes da closure async. Sem a declaração deslocada, o arquivo é byte-idêntico; fences, awaits e bytes retornados permanecem. Sua validação está na composição Executive acima.

Nenhum desses gates focados altera os pass/fail históricos da tabela agregada. Não há nova enumeração completa de A1–A3/B4–B6 nem GO global.


## Enumeração original por shard

Paths de testes C relativos a `modules/sucafina/Sucafinav1/test/`, salvo indicação explícita.

| Shard | Run id | N pass / M fail | Falhas (file:line) | SHAs dos fixes |
| --- | --- | --- | --- | --- |
| 7 | [44645952434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645952434) | **518 / 12**,530tests103 files | Mapa C7 completo abaixo | 36c7989,ccde747,e24aa85,4758184; shared28df867,29021f3,1aee8d2; demais pendentes |
| 8 | [44645956665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645956665) | **618 / 2**,620tests115 files | product/canonical-read-cost/diagnostic-cost.test.ts:13:26; product/wp05/planner-origins.test.ts:83:77 | 328960a664ed64c4db46e69bf30f24f9efb04c51;8392356be8a13c33eb4dec83e4e198f7b1806b37 |

Snapshots:7=0cc9380fdc452c2da328a787e207396c4040c5e1;8=13f88387091b7db295a73aca0d20fb3859a56ae7.

## Mapa C7/C8 atualizado

| Causa | Falhas originais (file:line) | Evidência atual / próximo passo |
| --- | --- | --- |
| C7.1 validade da autoridade durante preparo | product/wp12/native-execution-scenarios-review.test.ts:39:72 → :55:25 | Gates44658317657=11/1 e44662130965=23/1; mesmo scenario-or-authority-changed,719650.91ms/611255.76ms. 23 controles novos PASS, original não. **UNBOUND; dois gates no mesmo ponto, sem terceira execução focada. PR 403 draft/não mergeado.** |
| C7.2 período/campos + baseline observado | product/wp12/native-execution-dependencies.test.ts:60:21 | Fix ba7200ea39f7bc56a97c33301b2d8ccd06ad3d77 + helpers B dda42a61; checkpoints c044ba0 preservam37 asserções/prazo420s. Primeiro44658954003=0/1,139 asserções. Composição #414/#420/#424 no44666613719=20/1,272 asserções,613.77s:10metric+10persistence verdes, original timeout reportado549513.57ms. Última fase iniciada decision-choose, após units157.389 s e criteria17.897s. Segunda falha do original→UNBOUND, sem terceiro gate focado. |
| C7.3 resposta Planner | product/wp12/native-execution-questions.test.ts:340:73 | Original passou no 44656420362. Nova fixture corrigida em 50ce9319b03ae52ec3871043161c19b17c49a1b3 passou 1/0 no 44658520809; PR 400 mergeado |
| C7.4 custo BI09,2 casos | product/bi-cost-waterfall/rendering.test.ts:20:11;112:7 | Gate 44657153397:ambos PASS62.1s/57.6 s dentro dos105 s; PR 401 mergeado |
| C7.5 import/report legado | product/wp02/import-report-consumer.test.ts:100:25 | Migração nativa4758184b6ef9abc61bf57ec7b08481bb78d5c8c3; gate 44656058658:1/0,71 asserções; transportado e mergeado em443 |
| C7.5 Dashboard legado | product/wp02/dashboard-browser.test.ts:74:66 | Migração3e23044; 44663298380=0/1,25 asserções,60.40s. Segundo44666208536=0/1,25 asserções,55.64 s no Save:97:72; controles #423=5/0,58 asserções. Chrome conectou em ambos, não é falha de launch. UNBOUND. Causa adicional de produção: mapa deviations canonicamente ausente; #437 produtor mergeado após18/0 e #423 cliente mergeado com5/0. O original continua UNBOUND; sem terceiro gate focado. |
| C7.6 cache Atlas single-use | product/wp10/analysis-composition/historical-memory.test.ts:292:100 | PR 398 mergeado; gate 44654168008:15/0,1495 asserções em5 arquivos |
| C7.7 recuperação Atlas | product/wp10/atlas-business/atlas-recovery.test.ts:137:32 | Fix 36c7989ecf8b836af893de22a293092e4cbd09ba; gate 44650347644:1/0,37 asserções; mergeado443 |
| C7.8 estático | product/work-split/work-reuse/static-gates.test.ts:12;budget:28 | Run 44674216763: sete typechecks e15/16 comandos PASS; agregadoFAIL apenasguarddev/godfile-waivers.json e script/spawn-allowlist.json. Correções457/459 e workflow453 mergeados. Aprovação real ausente; UNBOUND para o mesmo gate, sem sf-ci |
| C7.9 admissão removida | product/diagnostics/calculation/source-observation.test.ts:86:29 | Fix ccde74734b19f78aab0aa64ac0f301e5a4d379c0; gate 44650428648:2/0,27 asserções; mergeado443 |
| C7.10 identidade + oracle AM02 | product/integrated-proofs/am02/performance-public-c16-reopen.test.ts:160:42;175:43 | Fixes9643737ac1b2a0c475af283dddc72db70d81a81c +e24aa85b0c8d88d0cd007b977ff84ff73eca8f30; gate 44653652279:1/0,194 asserções,revogação final alcançada; mergeado443 |
| C8.1 pin/proveniência | product/canonical-read-cost/diagnostic-cost.test.ts:13:26 | Fix 328960a664ed64c4db46e69bf30f24f9efb04c51; gate 44649157618:2/0,40 asserções, mergeado443. Após438, pin realC2b3584b9 atualizado e gate 44671622213:2/0,40 asserções,35.45 s; produtor+pin mergeados atomicamente438. Após #442, o pin C5917a488 / PR 463 passou no escopo histórico completo de 115 arquivos: 44676183011 = 620/0; merge ad7bf8a6bea5dc8bcc436f39ebd861eeb935f7ee |
| C8.2 driver original Node | product/wp05/planner-origins.test.ts:83:77 | Fix 8392356be8a13c33eb4dec83e4e198f7b1806b37; caso PASS3.669 s no44654104426; dois casos sensibilidadeA2 também PASS; helper e oito consumidores com expectSpawn mergeados em #443. Revalidação histórica completa 44676183011: 620/0, sem falta ou extra no inventário de 115 arquivos |

## Gates executados por causa

| Causa | Run | Pass / fail | Snapshot | Fonte / resultado |
| --- | --- | --- | --- | --- |
| Pin | [44649157618](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44649157618) | 2/0 | 96211198e61056d3ee17d1710d74ea4b0f16bcad | 328960a;40 asserções |
| Atlas recovery | [44650347644](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44650347644) | 1/0 | 0007a30900ff798c893cdf6d74362b688572fb48 | 36c7989;37 asserções |
| Source observation | [44650428648](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44650428648) | 2/0 | 011e889380002daf99536c75c829062a6e270389 | ccde747;27 asserções |
| AM02 identidade | [44650813269](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44650813269) | 0/1 | e805ecb442655cde05efc584b3f0937658754df6 | 9643737;novo ponto175:43,146 asserções |
| AM02 oracle completo | [44653652279](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44653652279) | 1/0 | 96b648684730b2b0e81a71370ce8adf80b77db25 | e24aa85;194 asserções |
| WP05 Node driver | [44654104426](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44654104426) | 12/1 | a29d447 (SHA completo no run) | 8392356;1057 asserções,113.27 s,8 files; único fail sentinel privado hidden colide com atributoHTML |
| Atlas completo | [44654168008](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44654168008) | 15/0 | 8b696e (SHA completo no run) | 28df867;1495 asserções,1127.47 s,30Omni spawns0 delegations |
| Private types | [44654714455](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44654714455) | 1/0 | 40a0506 (SHA completo no run) | 1aee8d2;typecheck exit0,30.4 s;1spawn0 delegations |
| Sentinel privado | [44655693464](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44655693464) | 0/1 | a26d54b83d29e88e72407a0fdae4bb2343b57f65 | 617815c3399db344bf951fa3569d41766a3eb268;57 asserções anteriores PASS;infraChrome launch14667 ms |
| Import nativo | [44656058658](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656058658) | 1/0 | e1a61cd4671e57b4b40674d8133f7e01fbb934af | 4758184;71 asserções,3.168 s,2spawn0 delegations |
| Planner answer inicial | [44656420362](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656420362) | 1/1 | 07f3eadb2488aed5a7078fbbf784504f6e91d376 | eaf906;97 asserções;originalPASS,newfixtureFAILrecipient absent |
| Owner-ready | [44657002119](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657002119) | 3/0 | 366a84276250b782ab46c4b1809dd1d77a43babf | 4d8c786;41 asserções,1.69 s |
| BI completo | [44657153397](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657153397) | 9/0 | 3d6bce8f3a4828ed2cd0fddd59118c76f6356eee | 29021f3;376 asserções,420.63 s;drilldownA2 não incluído no filtro |
| Contexto approval guards | [44658251806](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658251806) | 59/0 | b893ed5fb43e1bbcf66972f08634a7fd55578271 | cd7c1e0;361 asserções,215 ms;testes não são aprovação real |
| Cenários Planner inicial | [44658317657](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658317657) | 11/1 | 577f5d4c91bc144a41afbb40075ab0ae95438339 | b84fd723; 201 asserções; original :55 scenario-or-authority-changed |
| Planner recipient fixture | [44658520809](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658520809) | 1/0 | 103b0b4f8c23c49741a254f34fd24949e9c05bff | 50ce9319; 32 asserções, 14.42 s; original já passou |
| Dependencies C04 | [44658954003](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658954003) | 0/1 | 9f37bb3281b788a880b5b94ce9d0f524a106950d | bcbc0a30; 139 asserções; timeout após preparo completo, sem aumento |
| Portfolio inicial | [44660248357](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660248357) | 4/3 | a8bae72fe29c80a6282b94af14c6ccd921017e07 | 05e2d751; 31 asserções; fixture não remontava, não falha da admissão inicial |
| Signals | [44660432596](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660432596) | 14/0 | fff4d205916ad9896b6d93270358c4373df17b10 | 492c06aa; 183 asserções, duas invocações 12/0 + 2/0 |
| Result selection + B6 | [44660844009](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660844009) | 30/1 + 1 error | c88eebfd04eff94b1ba300fda409eb83198e5cb4 | debed39; 223 asserções; semantic-union-source-scenario.test.ts:50 portfolio-analysis-changed, 180007.25 ms; PR 414 continua draft |
| Portfolio remount real | [44661234622](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661234622) | 4/0 | 739472f5450cc0f590e3fe5c0eb4e88acd661966 | b07ed52; 60 asserções, 1.493 s |
| OPEX captura inicial | [44661576715](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661576715) | 0/2 | c7b7a1a455504ebfbd2d11f95e85227164f833c3 | cf961ffd; budget-conflict.test.ts:48/115; captura structuredClone do Proxy Solid diverge da serialização JSON real; corrigida em867fe10 e segundo gate verde abaixo |
| WP00 docs exatos | [44661599225](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661599225) | 8/0 | 6999937050aeeb5d6839f87027dc26d2c7ab094c | fa25e59; 401 asserções, 358 ms |
| Cenários, comparação pública | [44662130965](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662130965) | 23/1 | 96b53bb186df47815ce7189b77e8db7a2b45d754 | 0c15b8a;265 asserções; 615.08 s; original:55:25 scenario-or-authority-changed repetiu; UNBOUND, parar esta causa |
| WP00 contrato11 | [44662549289](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662549289) | 5/0 | d9284bc1079b580af9d6224c5d2b141ee02a0d6f | f86d423;913 asserções; 174 ms; merge417;38artefatos/aceitação BLOCKED preservados;407posterior invalidava somentepinhost; revisão12 #426 posteriormente5/0mergeada |
| OPEX captura JSON real | [44662953944](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662953944) | 2/0 | f3319eed26f2ec6160566c5fe2af098b1db16678 | 867fe10;21 asserções; 1.63 s; PR 412 mergeado |
| Dashboard nativo inicial | [44663298380](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663298380) | 0/1 | b0ba743540c727a63f3a579e718a9fb5cb041626 | b1a092b;25 asserções; 60.40 s,52 totais; driverNode/Chrome conectados, novo desvio não chegou à asserção final |
| Summary settings | [44663777161](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663777161) | 21/0 | bd5bdf42b0c23386501d48a5237fedab330708d7 | 849f00b;9/0+12/0,7913 asserções; PR 421 mergeado |
| C09 batch + selectors + B6 | [44663788472](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663788472) | 49/1 | 75f6a0dfc518e171d213f6ec2a3e0cae563b9316 | source9d370bc;405 asserções; 236.31 s; 49controlesPASS, original B6 timeout180011.22ms. Log novo não imprime :50/reason; mesmo teste após segundo gate, UNBOUND. PR 414/420 drafts |
| Budget period | [44664293983](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664293983) | 5/0 | f5fa0449c154ea355bdac91a61c53a6ae2d9783b | f201956;107 asserções; 1.84 s; PR 422 mergeado |
| Primeiro desvio + Dashboard | [44666208536](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44666208536) | 5/1 (original0/1 + controles5/0) | b108d7fa4d9385c33840944fb56ceb78de3ebc06 | source3216ee4;83 asserções; original Save:97:72 após25 asserções, segundo mesmo ponto→UNBOUND |
| C7 metric/persistence/dependencies | [44666613719](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44666613719) | 20/1 | 6b61ae5160d1cc2e3fac144f2d6f6840c5125d2f | source 6704378a414d787aa321305ab9d78ae6f96387d2;272 asserções;10metric+10persistencePASS,dependencies420sUNBOUND |
| Document conflict | [44667039756](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667039756) | 2/0 | 7fd2096159136d00803089b4d9b44aa0d7b8447e | #4270fff307;54 asserções; 2.67 s;mergebe192011 |
| Analysis egress | [44667507711](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667507711) | 3/0 | df5d7fe31e32d2737b51f4f26a0a814880e3c5ee | #428 c62c817;25 asserções; 13 filtered;merge573678d |
| Runtime native | [44668010002](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668010002) | 3/1 | 2030026bbd1c3329f4b492d7e3b3d642caec9e7c | source fdbf7c790fb7838009243b323b6c72530679d92b;26 asserções;browser45 s,hostready11.838 s,Chromeconnected11.925 s depois; UNBOUND diagnóstico insuficiente: bloqueio entre runtime-http:173–183 após goto172PASS; sem DOM/trace capaz de identificar o await, sem novo gate especulativo |
| Canonical deviation projection | [44668705164](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668705164) | 18/0 | 3f6c0e11f319770b91e98605e5025e9614b491b2 | #43754f0e9d;1386 asserções; 1219 ms;mergeb180588 |
| Native public-state | [44668708981](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668708981) | 3/0 | c5125ef206690b1f5464275aa82eb00d80d378f0 | C2a71e601a50d990f27381f649d705ff5f38b0b15;source084226;25 asserções; 3.91 s;timeoutoriginal30 s |
| Procurement explicit draft/refusals | [44669199777](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669199777) | 4/0,55 asserções; 12.76 s | 65db150c81c01b1ee3667fa9c34a310ab469c96b | C7e133b7+1cc82d5;source084226;intençãofalse explícita e recusa real de PO |
| AM04 receipt collision | [44669202348](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669202348) | 1/0,24 asserções; 7.77 s | 7b85405efc1d3a7767166733e1ca28304a936ac7 | C16a7026;source084226;mesma Request admitida e recibo/digest reais, sem leasefabricada |

O incidente Chrome do sentinel foi investigado: importsBun329ms/Node217 ms, ChromePID4178 em espera deIO(folio_wait_bit_common) por~11 s e depois futex, Browser.getVersion1sent0received; cleanup3.239 s confirmou ausência dos2PIDs. **unbound de infraestrutura**, não prova de bug de privacidade. Nenhum rerun idêntico nem aumento de prazo foi feito.

### Gates causais recentes

| Causa | Run | Pass/fail | Fonte | Snapshot / observação |
| --- | --- | --- | --- | --- |
| Workbench nativo + CaseRef440 | [44669527682](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669527682) | 17/0,327 asserções; 8.88 s | 124f767dc0542b3f0a3c25ff5d24f7c00919a495 | 2ad694730945c99a9c8ad98fa4e08f90ad5ef8ce;16Workbench+1CaseRef; fixCf2e13d29f9238a736dab23fc3b0ac26201790327 |
| HistóricoPlanner | [44669530310](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669530310) | 3/0,168 asserções; 80.24 s | be37121d52fe4522db79288a585e877612e9aec0 | 79dd251a1cd75d2d2cb48a27278f8f216539405b; Cfix 049ed587a22103b7e49aa6a5a0e066748689fe21 |
| Revisão12WP00 | [44669752250](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669752250) | 5/0,913 asserções; 178 ms | 42926f460f6e1b5195aad2be39ecf200e4a5ef71 | 690563b2ec4d9a3812f1ff7874fe7bcf0bbbc0ff |
| Analysis-observer inicial | [44670026731](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670026731) | 20/1,145 asserções; 40.50 s | a75cb770a51319639a7b3b8a10e8138f8d3e9925 | 3184dc29525f6dab67128b08ab63d483ad6d738f; novo teste189:8 esperava par de refusals errado; os4recovery e9scenario-batch passaram |
| BI chooser original | [44670030550](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670030550) | 1/0,73 asserções; 7filtered69.57 s | 0126d7330ebe36549a9c9b70ffb3ea95327d0219 | caad3ab06959818138ea7f7bb6ea298c1c84e2d6; Cfix 8e71e07e907b02be635d4f98aaf0638816f7b429 |
| Revogação escopo | [44670481763](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670481763) | 1/0,20 asserções; 8filtered26.60 s | 0126d7330ebe36549a9c9b70ffb3ea95327d0219 | 8dfb6c091e53b8a348fee83dae2670c933a32d25; resposta denied/case-selection-authority-changed evalueausente |
| Analysis-observer corrigido | [44670811024](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670811024) | 21/0,148 asserções; 40.85 s | 53df24e94fccd448d36e7512ff7bde250def9241 | 51475bf7f369c8abd097163023df376de6f43b2d; par ordenado unavailable/result-unavailable,denied/result-access-unavailable;3reads4cases4sources |
| Pin real após438 | [44671622213](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44671622213) | 2/0,40 asserções; 35.45 s | 43a2dcebfed2cabfa01934f8b9bee0987dc134ac | 3f5dac23c8c06b906cb536353cec6901cfbda930; SHA256result-store d35d43b872eee637c913397ec72157757fba9c4daa29d8a9dee499b030879722 |
| C12 native receipt recovery | [44672589617](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44672589617) | 0/2,10 asserções; 87.55 s | d0ccac815e8e688aab1b7e699f586cc0d4be0af6 | 0b15101cfe495422ffc72eab36bcf558171786a5;2casosoriginais120s/90 s; Review/Apply humanos, resposta perdida, same-key retry, CAS, reopenSQLite e Recover reais |
| Static Actions isolado453 | [44672678428](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44672678428) | FAILURE: 13 erros TS | d0ccac815e8e688aab1b7e699f586cc0d4be0af6 +1885dd769e8100520b15e0596e76bf8525e23b28 | b5d3371e6288ba445e2af5480f7b2e052e6f1b68; 16 comandos reais, um job de 22 min, guards estritos sem aprovação, não sf-ci; sucessor 44674216763: 15/16 comandos PASS, bloqueio de aprovação real persiste |

## Tabela agregada dos oito shards

Resultados pedidos aos branches `sf-shard-a` / `sf-shard-b` e conferidos nos handoffs, snapshots e logs. A tabela registra a última enumeração observada, completa ou explicitamente parcial. **Nenhum PASS focal foi subtraído dos FAIL históricos.** Somente C8 recebeu nova execução completa do mesmo inventário histórico: 620/0 em 115 arquivos. Sua enumeração inicial 618/2 permanece na seção original e no apêndice. Os índices abaixo pertencem à partição histórica de 883 arquivos; o plano LPT atual exige seleção própria a partir da árvore real.

| Shard | Branch | Run | Pass | Fail | Causas | Unbound / limite atual |
| --- | --- | --- | ---: | ---: | --- | --- |
| 1 | sf-shard-a | [44657265518](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657265518) | 576 | 29 | UI legada; C12; Portfolio; HTTP; histórico/revogação; documentos; deadlines anuais | Completo: 605 testes, 113 arquivos. Workbench, public-state, procurement, AM04, histórico e revogação têm gates verdes e merges 443/447/444. Runtime 3/1 e C12 original 0/2 em dois gates continuam UNBOUND. Driver 462: 3/0 e merge; não qualifica Chrome/C12. BI fallback sem equivalente nativo integral; dois casos anuais de 105 s permanecem. |
| 2 | sf-shard-a | [44661562191](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661562191) | 508 | 6 | Chrome; recall; chooser BI; Atlas | Completo: 515 testes, 107 arquivos, +1 skip e +1 error. Chooser 447: 1/0; Atlas 398: três casos PASS; WP05 Node 443: dois casos de sensibilidade PASS. Recall de 120 s aberto. Gates focais não tornam esta enumeração verde. |
| 3 | sf-shard-a | [44665621967](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44665621967) | 250 emitidos | 22 emitidos | Console legado; capacity/semantic WP05; WP13/BI deadlines; C12 oráculos; URLs BI legadas; corpus WP00 | CANCELADO, sem footer: 66/99 arquivos iniciados, 33 não iniciados; review-answer-confirmation interrompido sem FAIL do caso :99. Sentinela procurement PASS; corpus 415 qualificado fora desta fonte. Posteriores: BI URL 467 = 2/0 e concorrência 465 = 3/0, ambos mergeados; semantic 469 = 3/0 mergeado; capacity também passou no recorte Node 44654104426. IO1 474 teve0/1 no contexto:33:12, sem prova de negócio. Executive21/0 e navegação3/0 mergeados; não substituem visual-layout. IO2 44685910576 em andamento; Settings/Imports componente44685675858=3/6. Nenhuma nova enumeração completa de A3. |
| 4 | sf-shard-b | [44645900692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692) | 497 | 14 | AM01; C03 browser; native execution; recovery; S10 | Completo: 511 testes, 118 arquivos. Fatias 430/406 mergeadas. C03 44670314438 = 1/0, mergeado em 456. AM01 no recorte memória 28/2 foi sucedido por batch 19/3: cinco perfis PASS em 807555.68 ms, portfolio-recall ainda excede 240 s. S10 repetiu dois pontos no 44667978696 = 16/2: UNBOUND. Novo recorte 44680196613: purchase pending 1/0; complete excede 360 s. A enumeração histórica não muda. |
| 5 | sf-shard-b | [44645913808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808) | 576 emitidos | ≥21 observadas | Performance/sensibilidade; Atlas; links BI; coverage; freeze; UI/transporte; cálculo | CANCELADO, sem footer: 20 marcadores FAIL + uma asserção adicional sem marcador, +1 skip; 105/119 arquivos iniciados, 14 não iniciados. Atlas 398, freeze12 426 e fatias 430 qualificadas. Cálculo 44674214842 = 17/4 foi sucedido por 44677071823 = 33/1: planner-calculation 24/0, case-scope 5/0, similarity 4/0; ancestry ainda excede 105 s. Native44682182809=1/7; ancestry44682675803=0/4+4errors em importação, nenhum corpo executado; fix sintático seguido por44683555039 ainda ativo no checkpoint. |
| 6 | sf-shard-b | [44651628624](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651628624) | 409 | 23 | UI nativa; Portfolio; CAS; Planner/Forecast; baseline; locator; AlternativeDraft; chooser; host lifecycle | Completo: 434 testes, 109 arquivos, +2 skip. B6 semantic-union falhou em dois gates: UNBOUND. NativeSourcing 3/0 e 435 3/0 são recortes. Portfolio 44670599697 = 41/4 +1 error. #441 ainda captura após await; proposta660a foi adaptada em495/496 à composição com488, sem gate. Integração B pendente. Review B 16/0 qualificou fonte específica; produção 433 mergeada externamente e composição isolada 470 = 16/0 mergeada. #464 populado NOT_QUALIFIED. Recorte 44680196613: Planner batch 19/0 e mixed 16/0; não cobre o corpus populado de 36 chamadas. |
| 7 | sf-shard-c | [44645952434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645952434) | 518 | 12 | Cenários; dependencies; Planner; BI; import; Dashboard; Atlas; static; admissão; AM02 | Cenários, dependencies e Dashboard atingiram duas falhas: UNBOUND. Outras causas focadas qualificadas em 400/401/398/443; cliente 423 = 5/0 e produtor 437 = 18/0 mergeados. Static 44674216763: sete typechecks PASS, 15/16 comandos, dois paths protegidos sem aprovação. O novo B dependencies 44675888290 = 0/1 não altera o estado C. |
| 8 | sf-shard-c | [44676183011](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676183011) | **620** | **0** | Pin do produtor real; transporte Node | **Escopo histórico integral verde:** 620 testes, 115 arquivos, 30843 asserções, 881.49 s. Inventário log = request, sem falta ou extra. Fonte 7bed88e6977cdd6de674ad80352d0f7460311f2c; snapshot 968d5cdd857ea6d4305df5a337bca9c8c6641ff9; pin 463 mergeado. A enumeração original 44645956665 foi 618/2. Este resultado não representa a partição LPT atual nem oito shards verdes. |

Não há total global completo ou GO: as enumerações de 3 e 5 foram interrompidas, e os demais resultados históricos vermelhos não foram substituídos por execuções integrais verdes. Os arquivos/linhas originais e os inventários não iniciados permanecem nos apêndices. Os gates focais posteriores são descritos separadamente.

## Pendente

1. Diagnosticar o primeiro gate Planner IO1 #474 / 44679668214 (0/1), fonte `36a3de511df7a5bc683cd2bc7ad827d5cc5662ef`, snapshot `068213d64003aff10dcb7a5637f25087b66ae19c`. Somente o primeiro caso original é selecionado; o segundo e visual-layout têm gaps nativos investigados em fatias separadas. Review 470, semantic 469 e rollback 473 já terminaram verdes e foram mergeados.
2. Preservar os limites dos novos verdes: C8 qualifica os 115 arquivos de seu escopo histórico; #465 qualifica os três casos de `operations-fixes/c12-concurrency.test.ts`. O C12 original `recovery-ui.test.ts` não está em #465 e continua UNBOUND.
3. #403 cenários, #414/#420 B6, #424 dependencies, Dashboard e C12 originais atingiram duas falhas no mesmo ponto: **UNBOUND; sem terceiro gate focal**. Os controles adicionais verdes não substituem esses originais.
4. Runtime nativo 44668010002 = 3/1, 26 asserções: três HTTP PASS e `goto:172` PASS; espera em `:173–183` sem DOM/trace. UNBOUND por diagnóstico insuficiente, sem patch especulativo ou prazo maior. BI fallback antigo continua sem equivalente nativo integral demonstrado; preservar UNBOUND e o console descomissionado. Os dois casos anuais A1 de 105 s também permanecem pendentes.
5. B precisa incorporar/revisar `660a8117b813a5ed5daddcc97511b911159ef618` em #441 e `92c9cbbf3013a2202fd30270273b6f37c9e48435` em #464. A composição B `aa58e28caa571b08da509668847300e38ccd0319` ainda não contém nenhum: captura depois do await em business-services:465–474 e teste populado ausente. Batch 44676186908 terminou 19/3; o novo controle foi corrigido em 73ca1457/a00b6bb9 mas ainda não qualificado. Recovery 44677071823 terminou 33/1: settled-recovery qualificado e produção #466 mergeada, ancestry inicial ainda 0/1. #439 permanece sem qualificação final demonstrada. Preservar resolveMany/fallback sequencial de #424. Dependencies B 44675888290 = 0/1 não autoriza repetir a causa C.
6. O guard de `origin/dev` continua exigindo aprovação real para `godfile-waivers.json` e `script/spawn-allowlist.json`, embora ambos sejam idênticos à base. A regra `script/guards/rules/protected-paths.toml:17–19` exige label real e #397 não possui essa aprovação. #402 transporta aprovação verificada; #453 registra o FAIL estrito. Não fabricar label, aprovador ou token, nem repetir o gate pelo mesmo bloqueio.
7. Preservar os 33 arquivos A3 e 14 B5 não iniciados, os casos interrompidos e os totais históricos. A leitura dos oito shards ainda tem lacunas. Qualificar a seleção final a partir da árvore e do inventário reais, sem deduzir novos totais de recortes.
8. Integrar somente PRs isolados qualificados. #397 continua draft, com candidatos e causas UNBOUND. Publicar este handoff como fatia documental independente e atualizar os resultados ativos antes da publicação final.

## Decisões e justificativas

- Mantidos o console descomissionado e `runtime/application.ts` intactos. Nenhuma navegação à porta proibida. Fixtures novas usam o host nativo, porta 0, identidade criptografada original, comandos reais e SQLite.
- Asserções e controles preservados; nenhum baseline, coverage, digest ou GO inventado; nenhum prazo ampliado.
- O pin C8 tem cadeia de proveniência do produtor real. AM02 compara exatamente seis efeitos C08 idempotentes e mantém snapshot completo e última revogação. A nova execução de 115 arquivos fornece seu próprio footer e inventário.
- Memória Atlas cria uma observação nova após consumo, verificando novamente fonte/C08; não reclassifica token gasto. O cache BI mantém a prova completa no escopo real, sem conceder autoridade global.
- Aprovação de guards é uma decisão humana efetiva e verificável. Nenhum label de aprovação foi aplicado. O resolver valida snapshot único, blob da request original, PR/head/base/labels/permissões atuais, e repete a verificação antes de transmitir; falha fechado. As bases `origin/dev` e do PR real foram mantidas.
- Se o mesmo ponto falha duas vezes, parar a causa e registrar UNBOUND. Uma alteração posterior exige causa concreta distinta; não se repete um snapshot idêntico para tentar obter número melhor. Gates completos e focais mantêm âmbitos explícitos.

## Como retomar

Ler os HEADs de `sf-shard-c` / `sf-join-four`, este handoff e os comentários de #397 / #410 / #441. A coordenação dos dois gates ativos está em [#410, comentário 7030928330](https://github.com/gustavomhss/Orchestra-SF/issues/410#issuecomment-7030928330). Review 44678230528, semantic 44678238009 e rollback 44678639563 já estão verdes/mergeados. IO1 44679668214 terminou 0/1 antes dos oráculos de negócio; só outro gate após fix concreto. Colher os gates B 44678987832 / 44679287587, preservando fontes e snapshots. Para um gate futuro autorizado, criar snapshot filho alterando somente `.ci-run.json`; o runner Node aceita somente `*.node-smoke.mjs` e não usa args Bun. Static #453 usa prefixo `ci-static-sfc-*` e não dispara `test-ci` / `sf-ci`. Máximo de dois gates próprios simultâneos; nenhum rerun idêntico ou terceira execução focal de causa UNBOUND. Antes de cada merge, conferir diff/blob exato e CAS do head, preservando o código já integrado e os quatro branches proibidos.

## Comandos e resultados

Nenhum comando foi executado em shell. Requisições Actions usam `package: sucafina`, `directory: modules/sucafina`, `runner: bun`, `args: [--timeout, 30000, ...caminhos]` e `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=1`. A forma literal `SF_SUITE_ID` / `SF_SHARD_INDEX` / `SF_SHARD_COUNT` não é aceita pelo validador da base; a enumeração inicial derivou `suites.json` + SHA256(path) mod 8 e branches `ci-run-linux-*`. A seleção inicial tinha 883 arquivos, distribuídos em 113, 107, 99, 118, 119, 109, 103 e 115. Depois, #413 introduziu `script/sf-ci/shard-plan.mjs` com LPT determinístico e cobertura/disjunção completas do manifesto atual. Custos históricos parciais são heurística. A revalidação C8 usou os mesmos 115 paths históricos explícitos; a partição final atual deve ser derivada da árvore real. Não chamar `sf-ci`.

- `bun typecheck` canônico: exit 0 no 44654714455; antes havia 21 erros reais da fixture.
- `check:guards --base origin/dev`: resultado original 2 GATE, 194 WARN, 0 errors; #425 observou os mesmos dois protegidos sem novo gate. Não há PASS global real; a aprovação específica continua pendente.
- Testes de transporte de aprovação: 59/0 no 44658251806, sem efeitos de aprovação.
- `sf-ci`: nunca executado.
- Merges próprios registrados: 399/398/404/401/402/400/409/411/415/417/412/421/422/430/406/432/427/428/437/423/440/426/443/447/444/438/451/456/457/459/453, seguidos de 462/467/463/465/469/473/470 em `sf-join-four`; SHAs e limites acima. #451 tem PASS causal A3 e composição Node NOT_REVALIDATED. #433 foi mergeado externamente; sua composição isolada #470 passou 16/0 e foi mergeada. #466 também foi mergeado externamente, com limite ancestry explícito. Outros merges da sessão de integração estão no handoff `sf-continuation`.


## Atualização agregada — A3 terminal e gates B posteriores

### Shard 3: enumeração mais recente, cancelada

[Run 44665621967](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44665621967), [job 136054050430](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44665621967/job/136054050430), fonte `a86e22c9654663a72bd55586059a4254f548c742`, snapshot `3caf96c9115b30f8a1150532e08b4a1714345a4a`. O job foi cancelado; cleanup 136070755205 terminou `success`. Contagem direta: **250 PASS / 22 FAIL emitidos, sem footer Bun**, 66/99 arquivos iniciados e 33 não iniciados. Não são totais de uma execução completa.

A sentinela procurement passou em 1845.38 ms. As falhas de capacity e semantic-discriminants eram novas nesta enumeração, ainda com helper anterior sob Bun. A contagem de PASS também não alcança quatro casos finais. Não inferir regressão da composição Node #443 a partir dessa árvore anterior. A evolução posterior de semantic está no gate #469 em execução.

Caminhos abaixo relativos a `modules/sucafina/Sucafinav1/test/`. Linhas vêm do log, exceto a declaração de timeout indicada explicitamente.

| # | Falha file:line | Causa observada |
| ---: | --- | --- |
| 1 | `io-browser.test.ts:26:35` | Console retirado; conexão recusada na jornada Planner XLSX. |
| 2 | `io-browser.test.ts:114:16` | Console retirado; conexão recusada na jornada Documents/supplier CSV/Members XLSX. |
| 3 | `visual-layout.test.ts:37` | POST ao console retirado; ECONNREFUSED. |
| 4 | `product/wp05/capacity-numeric.test.ts:76:22` | Click aguardava marca visível/estável (10 s), seguido do timeout do caso de180 s; nova falha nesta enumeração. |
| 5 | `product/wp05/semantic-discriminants.test.ts:85` | Timeout de90 s do segundo caso; linha de declaração, sem await interno identificado. |
| 6 | `product/wp13/sensitivity-units-boundary.test.ts:54` | Timeout de30 s reportado76670.17 ms; replay-ready só em74764 ms. |
| 7 | `product/wp13/persistence-recovery.test.ts:21` | Lost-binding reply; timeout de30 s reportado31838 ms. |
| 8 | `product/operations-fixes/c12-concurrency.test.ts:34:44` | Na enumeração histórica: esperava 409, recebeu 200. Oráculo de receipt-first corrigido e três casos posteriormente qualificados em #465; o FAIL histórico permanece registrado. |
| 9 | `product/operations-fixes/c12-concurrency.test.ts:103:106` | Na enumeração histórica: esperava 409, recebeu 200; mesma família. Evolução qualificada em #465, sem alterar esta contagem parcial. |
| 10 | `product/installed-bi-closure/numerical-coverage.test.ts:20:11 (omitted training)` | Deadline165 s; último estágio advantage.persist. |
| 11 | `product/installed-bi-closure/numerical-coverage.test.ts:20:11 (confirmed training)` | Deadline165 s; último estágio advantage.persist. |
| 12 | `product/installed-bi-closure/numerical-coverage.test.ts:20:11 (zero training)` | Deadline165 s; último estágio advantage.persist. |
| 13 | `product/installed-bi-closure/numerical-coverage.test.ts:20:11 (null training)` | Deadline165 s; último estágio advantage.persist. |
| 14 | `product/wp12/native-execution-bi-kpi.test.ts:312:131` | HTTP 200, mas a URL esperada do BudgetOverview legado não apareceu. URL nativa posteriormente qualificada em #467. |
| 15 | `product/wp12/native-execution-bi-public-selection.test.ts:326:146` | HTTP 200, mesmo contrato de URL legado. URL nativa posteriormente qualificada em #467. |
| 16 | `product/bi-cost-waterfall/presentation.test.ts:17:20` | Promoções sequenciais/totais pendentes: deadline105 s. |
| 17 | `product/bi-cost-waterfall/presentation.test.ts:66:50` | Custos confirmados completos: deadline105 s. |
| 18 | `product/bi-cost-waterfall/presentation.test.ts:97:14` | Contribuições zero/opostas: deadline105 s. |
| 19 | `product/bi-cost-waterfall/presentation.test.ts:113:19` | Custos null/missing: deadline105 s. |
| 20 | `product/bi-cost-waterfall/presentation.test.ts:133:11` | Equivalência Portfolio persistida: deadline105 s. |
| 21 | `product/bi-cost-waterfall/presentation.test.ts:242:19` | Current source/BI10/BI11: deadline105 s. |
| 22 | `product/wp00/baseline-corpus-coverage.test.ts:60:231` | Metadados arquivais fixtureBindings/executionStatus ausentes nesta fonte; restauração415 já qualificada em outra árvore. |

Em `product/wp08/review-answer-confirmation.test.ts`, o primeiro caso `:14` passou em 81077.31 ms. O caso `:99` estava em execução no cancelamento, último marcador `edit-stale real-answer-edit` aos 45735 ms; **não emitiu FAIL**. Os casos `:127` / `:161` / `:188` / `:228` não começaram.

Os 33 arquivos não iniciados foram conferidos comparando os 99 argumentos do snapshot com 66 headers distintos do log. Caminhos relativos a `modules/sucafina/Sucafinav1/test/product/`:

```text
c12-receipt-recovery/normal-retry.test.ts
reports-draft-reconciliation/installed-read-integrity.test.ts
review-fixes/finance-resume-performance/journey-phase.test.ts
review-fixes/import-recovery/apply-restart.test.ts
ui-split/ui-source/static-checks.test.ts
ui-split/ui-work/static-gates.test.ts
wp02/backup-consumer.test.ts
wp02/keyed-update.test.ts
wp02/kpi-comparison.test.ts
wp02/prepared.test.ts
wp02/review-completion.test.ts
wp02/signals.test.ts
wp02/workbench-recovery.test.ts
wp06/documents/resolver.test.ts
wp06/imports/dashboard-backup-e2e.test.ts
wp06/imports/end-to-end.test.ts
wp06/imports/planner-roundtrip-runtime.test.ts
wp06/imports/roster-runtime.test.ts
wp06/imports/sqlite-planner.test.ts
wp08/answer-reuse.test.ts
wp08/case-selection-cas.test.ts
wp08/collaboration-journey.test.ts
wp08/confirmation-real-dependencies.test.ts
wp08/mutation-fence.test.ts
wp08/work-presentation.test.ts
wp10/integration/browser-bundle-literals.test.ts
wp10/integration/dashboard-preview.test.ts
wp10/integration/memory-services.test.ts
wp10/integration/portfolio-reconciliation.test.ts
wp10/integration/store-read-scope.test.ts
wp10/integration/ui-authority.test.ts
wp10/memory-integrity/identity.test.ts
wp10/native-host/execution-host-guard.test.ts
```

### Gates B verificados depois das enumerações

| Causa | Run | Resultado | Fonte | Snapshot | Falha/limite |
| --- | --- | --- | --- | --- | --- |
| C03 transporte | [44667407691](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667407691) | 0/1,10.37 s | 16fc1f1cf07a52f4cb6d02c3b509c29384cc97f9 | 6c529ac61e56d777dc0c42d12bb4540d2588079f | wp07/browser-ui.test.ts:257:11; navegação de enrollment interrompe goto autenticado com chrome-error://chromewebdata |
| C03 enrollment isolado | [44668069860](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668069860) | 0/1,17.68 s | c94011c7ad425389e3a91392d6d16203bc816241 | 08082b4996eeab03d7ba3f815b3339f00eadf9b3 | browser-ui.test.ts:233:29; launch15000 ms antes de enrollment; ponto diferente do run anterior |
| C03 corrigido | [44670314438](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670314438) | **1/0**, 28.47 s | 42209cab9081705f63133ca3fe8b4ef28ff660df | 82bbd5b7dfa0bd9de444c0a58cb3f419e3c08412 | Job 136069432415 e cleanup 136070089399 success; caso 28136.72 ms, driver exit 0 e cleanup físico. Fatia isolada #456 mergeada em aa751dd731ce91f126a00488dfce16022bb8cb2d. |
| S10 composição | [44667978696](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667978696) | **16/2,288 asserções; 1007.23s** | e325d5b2382267e1bc7a9df4f29453f4a365cec8 | eeffac552972d6c9b1e41f668127a358409bd732 | coverage-sensitivity-integration.test.ts:22,300 s e:141→renewal-choice-fixture.ts:65→fixture-trace.ts:15,180 s; repetem44657814166:UNBOUND |
| NativeSourcing | [44668567443](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668567443) | 3/0,27 asserções; 422 ms | c6dde2ba43db83445e2043d9064eaa41dbade9fb | 51eba3c3f73eb79112fdc065b80ec426e1dc3e5e | NativeHTTP503 quando runtimeausente e403origin/path; não prova execução real de modelo |
| shared435 | [44667463947](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667463947) | 3/0,30 asserções; 169 ms | 0a31f6c8fe5c5020165c6225212ad1b3a13c3548 | cb3103d440c34074a8669ab3ff19c0b87abd90d7 | AlternativeDraftnull/zero/stale; merge 82d2041d80784e2d905f99dee3bca91c63ef8350, não B6 |
| Portfolio441 composto | [44670599697](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670599697) | **41/4 + 1 error**, 529 asserções, 1921.93 s | 91bcd283b6c4fbd9bc9575d232cbc62ddea9630b | af31e465c7dc4a69c9cb4b2d0327350506b54c05 | 45 testes / sete arquivos; purchase pending e complete excederam 360 s, reevaluation 300 s; erro native-choice-preparation.ts:36:70; dependencies:60:21 ainda com fixture antiga. A regressão pre-await de #441 não está neste snapshot. Job 136070349396; cleanup 136082200909 success. |
| Memória436 composta | [44670534535](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670534535) | **28/2**, 508 asserções, 1604.24 s | 91bcd283b6c4fbd9bc9575d232cbc62ddea9630b | 032dcd4942b8992c2ed639233d0fbcd7700f40ee | 30 testes / quatro arquivos; portfolio-recall-proof.test.ts:19/:148 excedeu 240 s e recall-five-profiles.test.ts:24/:166 excedeu 900 s. Scope tests 5/0 + 23/0. Job 136070139366; cleanup 136080103134 success. |
| Review B completo | [44675050868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44675050868) | **16/0**, 490 asserções, 495.24 s | 50e2222b18cb44081df4a8ea9afea46204f12555 | a8b68069ec781c07ab073f3fa67daf3bce81121e | review-portfolio-http.test.ts completo: prova de invocação, Memory residente, revogação HTTP/case/session, histórico, purge privado e 200 tardio. Produtor #433 exato; fonte inclui #414. Job 136084789076; cleanup 136088092695 success. Não transfere qualificação para #470; o gate isolado atual está em execução. |
| Rollback SQLite | [44673967393](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44673967393) | **18/0**, 542 asserções, 2.60 s | 32c97d3b4de5bb7960ca42f816b11ea37f594541 | 24f4bfc7c4671ff69b90961da988419b8f7c6cff | Quatro arquivos: handoff-domain-integration, transaction-abort-provenance, application-indeterminate e execution-reconciliation. #442 integrado. Job 136081255780; cleanup 136081581758 success. |
| Cálculo #434 | [44674214842](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44674214842) | **17/4**, 304 asserções, 550.43 s | 32c97d3b4de5bb7960ca42f816b11ea37f594541 | 04c442a9584126630779f0aaf65ca72e34223a20 | planner-calculation.test.ts:430 → composition-test-deadline.ts:5: reopen-and-recall excedeu 105 s. Três controles clock/principal/lease em :796: applied esperado 1, recebido 0. Job 136082056424; cleanup 136085769892 success. |
| Native host | [44673683546](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44673683546) | **0/1**, quatro asserções; caso 24377.14 ms | 32c97d3b4de5bb7960ca42f816b11ea37f594541 | 5010ab9f8923b779e994e30382216c0d1af3bcf0 | planner-monthly falha em browser-driver-fixture.ts:385, após browser-connected: Node AbortError no EOF, pipeEnded true / WS sem fechamento limpo. Chrome conectou em 13.122 s. Job 136080339921; cleanup 136080883492 success. |
| Half-close B | [44674551510](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44674551510) | **1/1**, quatro asserções, 44.96 s | 50e2222b18cb44081df4a8ea9afea46204f12555 | 92bb4482b19ece9eedd6d96b774d8f8d66e647d3 | wp07/browser-ui PASS em 33234.68 ms. wp01/planner-monthly.test.ts:68: forecast ausente em 11306.17 ms, pageerror ServerConnection2.key is not a function. Fix B 7f3afaed6b767e2ddde4a1294f912dff94c37bc7; Job 136083160822, cleanup 136083804268 success. |
| Identidade canônica #461 | [44675653919](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44675653919) | **0/3**, três casos / dois arquivos, 24.20 s | e9f3ce75e387369686816cad758d24e3c72a1f9e | 33c8cfbbb0c845c21608c2f8f6745a529f4c7365 | planner-monthly.test.ts:24 → browser-driver-fixture.ts:288: launch ~15 s, Chrome em IO e Browser.getVersion pendente. wp01/http.test.ts:32: EISDIR fast-check; terceiro FAIL em test-omni-control.ts:75. Não qualifica funcionalmente a identidade. Job 136086719194; cleanup 136087320438 success. |
| Dependencies B, fixture corrigida | [44675888290](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44675888290) | **0/1**, 124 asserções, 551.87 s | e9f3ce75e387369686816cad758d24e3c72a1f9e | dfe256cf9aeeafc13afdc4d06f261e2364190786 | native-execution-dependencies.test.ts:43 (declaração), limite :180: 420000 ms; caso 550613.45 ms. Sem stack do await interno; emissores e preparação C09 real já concluídos. Fix B c58ca0b9d4f56d81867fa3e9406657117defe03b; blob c38fe5e3ca0ab3a4601d7bbde7c0610a15edc7a7. Job 136087500794; cleanup 136091191761 success. Evidência B posterior; C permanece UNBOUND. |

No S10, os 16 PASS são cinco negativas de integração, quatro `sensitivity-read-scope`, quatro `renewal-case-read-scope` e três `renewal-read-scope`. O primeiro caso continuou emitindo marcadores durante o bootstrap do segundo; não há prova de duas causas independentes de lentidão.

Auditoria WP05 na integração `124d`: 42 arquivos TypeScript, oito consumidores de `inspectWp05Browser`, todos com `expectSpawn`. `semantic-discriminants`, `consumer-dashboard` e `render-completion-browser` usavam `chromium.launch` direto e não foram alterados pela migração #443. #469 agora migra somente os discriminantes semânticos para o driver Node com declaração real; seu gate está em execução, sem resultado atribuído.

## Nota sobre os apêndices históricos

Os apêndices seguintes preservam integralmente as enumerações e diagnósticos disponíveis em cada checkpoint. Quando um status histórico diverge do estado atual — por exemplo, A3 anterior, chooser C8 ou pin — prevalecem as tabelas atuais e os novos runs identificados acima. A evidência antiga permanece para comparação. Gates focais e resultados parciais continuam separados de uma execução completa.

## Apêndice — última enumeração completa A1/A2

Prefixo: modules/sucafina/Sucafinav1/test/. A1 run44657265518:576pass29fail; cada linha abaixo é um caso, não contagem de marcadoresduplicados. Os apêndices seguintes conservam a enumeração inicial para auditoria.

| # | Shard | File:line | Causa / estado |
| --- | --- | --- | --- |
| 1 | 1 | runtime-http.test.ts:146 | browser45s; migração Cfdbf7c7 gate44668010002=3/1,26expects;Chromeconectou; investigação concreta pendente |
| 2 | 1 | parity-polling-browser.test.ts:10 | console retirado |
| 3 | 1 | business-browser.test.ts:22→49 | formulário retirado |
| 4 | 1 | business-browser.test.ts:210 | duas abas do console retirado |
| 5 | 1 | product/wp13/source-scenario.test.ts:32 | timeout180s |
| 6 | 1 | product/installed-bi-closure/temporal-contract.test.ts:12 | deadline165s |
| 7 | 1 | product/installed-bi-closure/temporal-contract.test.ts:69 | deadline165s; stack61 é cleanup |
| 8 | 1 | product/wp12/native-execution-portfolio.test.ts:14→native-portfolio-preparation.ts:150 | oraclebaselineC04 |
| 9 | 1 | product/wp12/native-execution-portfolio.test.ts:134→native-portfolio-preparation.ts:150 | oraclebaselineC04 |
| 10 | 1 | product/wp01/workbench-analysis.test.ts:144 | fixture nativa Cf2e13d29f9238a736dab23fc3b0ac26201790327 +parser440 prontos para gate |
| 11 | 1 | product/wp01/workbench-analysis.test.ts:380 | PR428mergeado;gate44667507711=3/0,25expects;fence403preservado |
| 12 | 1 | product/c12-receipt-recovery/recovery-ui.test.ts:72 | rótulo Retrysameapplication ausente,UIreativaApply |
| 13 | 1 | product/c12-receipt-recovery/recovery-ui.test.ts:197 | recoveryseletor/decision-recover após200perdido |
| 14 | 1 | product/wp02/host-workbench.test.ts:147 | HTMLretirado |
| 15 | 1 | product/wp02/host-workbench.test.ts:280 | conflictdraftlegado |
| 16 | 1 | product/wp02/host-workbench.test.ts:468 | revogaçãoconsolelegado |
| 17 | 1 | product/wp10/integration/bi-fallback-lifecycle.test.ts:49 | redirectBIlegado |
| 18 | 1 | product/wp10/integration/analysis-stale-calculation.test.ts:303 | unavailablevsactualhistorical |
| 19 | 1 | product/wp10/integration/analysis-stale-calculation.test.ts:346 | injeçãoprivatereadnãochamada |
| 20 | 1 | product/wp10/integration/analysis-stale-calculation.test.ts:410 | injeçãoadmissãoprivadanãochamada |
| 21 | 1 | product/wp10/integration/public-state.test.ts:49 | C2a71e601native;gate44668708981=3/0,25expects;privacidade e armazenamento intactos |
| 22 | 1 | product/wp10/analysis-composition/alternative-selection.test.ts:456 | guardexternodeniedapósrevogação,wrapperesperavaok |
| 23 | 1 | product/wp10/analysis-composition/alternative-selection.test.ts:573 | annualdeadline105s;draft:58571.161s |
| 24 | 1 | product/wp10/analysis-composition/alternative-selection.test.ts:606 | annualdeadline105s;draft:61849.286s |
| 25 | 1 | product/wp06/documents/ws3-rejection.test.ts:65 | PR427mergeado;gate44667039756=2/0,54expects;stale409real |
| 26 | 1 | product/review-fixes/procurement-apply/refusals.test.ts:29 | estágioindisponível403vsoracle400 |
| 27 | 1 | product/review-fixes/procurement-apply/refusals.test.ts:59 | seedLegacyChangemissingconfirmedfalse |
| 28 | 1 | product/review-fixes/procurement-apply/refusals.test.ts:96→preparationInput:122 | missingconfirmedfalseantesmixedmutation |
| 29 | 1 | product/integrated-proofs/am04/receipt-key-collision.test.ts:53 | probeC08novarequestsemlease;colisão55–60nãoalcançada |
| 1 | 2 | product/wp05/sensitivity-integration.test.ts:9→browser.ts:9 | Chrome180s+error; driverNodefocadoCverde,semqualificaçãodofull |
| 2 | 2 | product/wp12/native-execution-collaboration-recall.test.ts:143 | timeout120s |
| 3 | 2 | product/wp10/integration/bi-call-scope.test.ts:402 | chooserBI;C8e71e07aguardagate |
| 4 | 2 | product/wp10/memory-integrity/revocation-tail.test.ts:87 | Atlas398focadoverde;ausentenestesnapshot |
| 5 | 2 | product/wp10/memory-integrity/revocation-tail.test.ts:104 | Atlas398focadoverde;ausentenestesnapshot |
| 6 | 2 | product/wp10/memory-integrity/revocation-tail.test.ts:124 | Atlas398focadoverde;ausentenestesnapshot |

A2 latest44661562191:508pass6fail,1skip1error,9142expects1791.93s; o executivo passou após2ee5e961. O skiplocal-backups.test.ts:209 épreexistente. Nenhuma subtração de testes focados foi usada para essas contagens.

## Apêndice — evidência original detalhada de C7/C8

O trecho seguinte preserva o diagnóstico da enumeração inicial. Seus estados unbound e pendências são históricos; o mapa atualizado e os gates acima prevalecem.

### C7.1 — preparação / autoridade

O log vai de 00:35:49.585Z a 00:40:49.687Z, aproximadamente 300,10 s. `apps/cli/src/sucafina-product/analysis-http.ts:59–60` aguarda `runtime.inputs.prepare` e reautoriza o mesmo contexto; `product/integration/ui-authority.ts:45` aplica validade de cinco minutos, e `human-authority.ts:44–45` exige a autoridade atual. Há evidência forte de expiração durante a preparação, sem localização do custo interno. Não ampliar lease, manipular relógio ou fabricar aprovação. A investigação do produtor exige fatia `shared:` se houver alteração fora de test/**.

### C7.2 — seleção de período / campos

A fixture usa projetos correntes observados em 2026 como fontes de 2027 (`native-execution-dependencies.test.ts:53–56`). `product/dashboard/scope.ts:15` recusa esses snapshots fora do período observado; `product/dashboard/sources.ts:124–126` não transforma o array `milestones` em campo escalar. A projeção `milestoneDates` de 2027 perde `status` em `dashboard/scope.ts:30`, enquanto `apps/cli/src/sucafina-product/analysis-dependency-readers.ts:79–84` exige data, nome e estado confirmados. Uma troca isolada do ano ou dos campos não resolve a fixture. Retomar com projeto e marco coerentes com a observação, horizonte financeiro explícito e controles de homônimo, identidade, data e FTE preservados.

### C7.3 — integração da resposta Planner

O teste emite fonte Planner em `test/product/wp12/native-question-preparation.ts:50–59`, cria suporte/thread e lê resposta em `native-execution-questions.test.ts:281–289`. `product/collaboration/dispatch.ts:49–50` consulta `answerReuse.read`; `answer-reuse.ts:120–121` exige escopo válido mesmo antes de confirmar a resposta. `collaboration/host.ts:257–263` só tem fallback Dashboard quando `resolveAnswerScope` está ausente. A composição em `apps/cli/src/sucafina-product/business-services.ts:202–219` não fornece esse resolvedor, embora o observador de confirmação suporte Planner em `:192–198`. Diagnóstico estático forte; o erro observado omite o motivo interno. Retomar no produtor compartilhado mantendo manifest, fonte, dependências e fences de confirmação. Não trocar a fonte para Dashboard para obter verde.

### C7.4 — BI09, antes do browser

Nos dois casos, o timeout nasce em `test/product/wp10/integration/composition-test-deadline.ts:5:29`. No primeiro, `comparison.persist` leva 42.519 ms; `BI09.dispatch` inicia em 51.507 ms e retorna abortado em 105.032 ms. No segundo, comparação leva 41.373 ms; dispatch inicia em 48.600 ms e retorna abortado em 105.002 ms. Nenhum `browser.bundle` ou `browser.launch` foi alcançado. A fixture já usa horizonte de um mês e produtores reais; `apps/cli/src/sucafina-product/bi-services.ts:162–168` já usa `callScope.run`. Não há suboperação culpada comprovada; instrumentar a composição em fatia própria antes de corrigir, sem ampliar o prazo ou reduzir provas.

### C7.5 — consumidores do console morto

`runtime/application.ts:58–61` define o 404 `legacy console decommissioned — use /`; `:94–95` o aplica aos GETs HTML antigos. O teste de importação pede `page=IT+Risks` e exige 200; o teste de browser pede `page=OPEX+Detail&year=2026` e espera o formulário `save-entry`/botão Edit. O browser conecta e encerra normalmente neste caso. A falha não prova defeito dos produtores JSON/DOCX, pois esses passos não foram alcançados. Retomar migrando os consumidores para o host nativo com importação, conflito, rascunho, confirmação, foco e navegação preservados; não recriar o console nem editar o runtime proibido.

### C7.6 — cache / observação Atlas

`product/decision-memory/case-recall.ts:66` classifica e `:79` repete a classificação para confirmar o resultado. `product/host-binding/atlas-memory.ts:28–35` consome a marca privada de observação; `cloneSfAtlasRecallResult:41–45` só mantém a associação enquanto ela existe. `apps/cli/src/sucafina-product/memory-case-read-scope.ts:314–319` reutiliza o valor cacheado na segunda classificação. O log é consistente: uma leitura canônica Atlas concluída, `memory.prepare` em cerca de 12,952 s e `aborted:false`; o resultado observado é `analysis-source-unavailable`. Classificação estática forte, sem fix validado. Retomar renovando a observação canônica após consumo, mantendo o bloqueio de observações fabricadas/reutilizadas.

### C7.7, C7.9 e C7.10 — correções restritas a testes

- **Atlas:** o estado sem evidência passou a ser controle negativo explícito; restaurar o resolver real permite verificar o mesmo recibo durável com scanner offline. Nenhuma asserção anterior foi retirada. Gate 1/0, 37 asserções, 19,47 s; controle Omni real passou com 2 spawns e zero delegações.
- **Observação Planner:** a quarta revalidação da chamada anterior remove a admissão em `ui-authority.ts:32`; `requestFor:70–72` retorna undefined e `planner-sources.ts:45–46` recusa antes do próximo callback. O fix prova essa ausência, exige o motivo exato da negação e zero transações/autenticações/revalidações/leitura preparada, mantendo ABA, egress, abort e estado durável. Gate 2/0, 27 asserções, 529 ms.
- **AM02:** `source-lifecycle.ts:57–65` preserva incarnation/versão para fonte, escopo e digest intactos. `native-capabilities-fixture.ts:296–302` reabre o mesmo banco e troca host/geração, sem alterar a fonte. As referências devem continuar iguais; a autoridade se renova por novas sessões e recibos. As asserções de bindings antigos negados e novas sessões passaram no gate; a igualdade global posterior ainda falha conforme registrado acima.

### C7.8 — gate estático, evidência integral

O teste excedeu 120 s. O log contém, inclusive após o timeout do teste, os resultados dos comandos reais:

- `WORK_REUSE_TYPECHECK 2`: **21 diagnósticos** em `test/product/operations-installed-finish/private-admission.check.ts`. Raiz de API desatualizada: chamada sem await e parâmetros `principalRef/readOnly` em `:66–72`; a factory atual em `packages/app-shell/e2e/sucafina/operations-support/installation.ts:29–42` é assíncrona e exige `operators`/`isAuthenticated`; `:150–156` devolve contribuições/discovery/services/application, sem o antigo dispose. Corrigir só await não migra o lifecycle e os comandos legados.
- Diagnósticos: TS2353 `:67:47`; TS2339 `:72:44, :80:41, :121:39, :145:30, :147:12, :159:11, :161:80, :162:54, :175:12, :180:12, :180:131, :184:12, :185:54, :196:11, :199:49`; TS7006 `:159:55, :159:65, :180:58, :196:57, :196:67`.
- `WORK_REUSE_GUARD_BASE 0`: fetch de `origin/dev` concluído.
- `WORK_REUSE_GUARDS 1`: **78 regras, 6.183 paths alterados, 2 gate, 194 warn, 0 errors**. Gates em `godfile-waivers.json` e `script/spawn-allowlist.json`, protegidos e já diferentes de `origin/dev` na base de integração. Esses arquivos não foram alterados pela sessão C.
- Não foi fabricado `GUARDRAIL_APPROVED`, acrescentada label nem alterada regra protegida. O resultado “0 errors” não significa guard verde: há dois gates sem aprovação observada.


## Shard 8 — mapa por causa

### C8.1 — identidade do produtor desatualizada: corrigida e validada

- Falha: `test/product/canonical-read-cost/diagnostic-cost.test.ts:13:26`.
- Pin anterior de `product/host-binding/state-provider.ts`: `ba10043704bbb1a25eb0f4a8edddcdca814ec7610157bc7c4d9d88d2970467f5`.
- Bytes atuais na base: `bf0a5639bd41f903c67a89096b733269fbcd9eaf25392dde8c062fdcc13434c1`.
- Proveniência: [c00b150b48f576a79a7c8b33f15c4fb55d72dfd1](https://github.com/gustavomhss/Orchestra-SF/commit/c00b150b48f576a79a7c8b33f15c4fb55d72dfd1), cujo pai é `2682f82da2650314e3437ab48b5c65e52c5b3fe4`, acrescentou `preferences`/`receipts` à união de tipos e à admissão de `selectSfNamespaceHealth`, nas linhas 39–40. Recomputação SHA256 dos arquivos obtidos do GitHub confirmou ambos os hashes. Aplicar somente essas duas alterações ao arquivo do pai reproduz integralmente os bytes atuais.
- Fix restrito a `modules/sucafina/Sucafinav1/test/product/canonical-read-cost/diagnostic-expected.ts`: um pin e seu comentário de proveniência. Os demais pins, teste, probe, recibo histórico e revisão histórica permanecem intactos.
- Gate executou `diagnostic-cost.test.ts` e `native-ui-contract/namespace-health.test.ts`. Os controles de autoridade original, autoridade incorreta, revogação e ausência de conteúdo privado passaram.
- O diagnóstico mede trabalho real; ele não contém asserção de teto numérico de custo. Esse verde confirma a execução com a identidade correta e controles existentes, sem demonstrar melhoria de desempenho nem qualificar P03.

### C8.2 — clique no chooser e cleanup pendente: unbound

- Falha primária: `test/product/wp05/planner-origins.test.ts:83:77`, origem B do BI03. O locator encontrou o botão correto, visível, habilitado e estável; o clique travou em “scrolling into view if needed” e excedeu 10 s.
- Falha secundária de encerramento: `test/product/wp05/browser.ts:61` aguarda `fixture.dispose()`/`browser.close()` sem deadline depois de cancelar o timer. O log não registra fechamento/desconexão desse browser antes do timeout externo de 180 s.
- Linha do tempo do run atual: BI02 concluiu entre 00:37:33.498Z e 00:37:35.719Z; BI03 começou às 00:37:36.131Z; origem A passou por mouse, foco, teclado e tabela; origem B começou às 00:37:36.935Z; o erro de clique foi registrado às 00:37:46.976Z; timeout externo às 00:40:33.426Z.
- Contraprova histórica: [run 44590270877](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44590270877), job 135794077900, snapshot `f85c4ca344ee0a064d6f9a422f6d55d4c4b8dba2`, fix [b32a7a1fc9f9280aa54ca1708fe8764ef48c5ae6](https://github.com/gustavomhss/Orchestra-SF/commit/b32a7a1fc9f9280aa54ca1708fe8764ef48c5ae6) / PR #376: **1 pass / 0 fail**, 178 asserções, 23,37 s.
- Blobs idênticos entre esse snapshot e a base atual: `product/analytics/view.ts`, `product/analytics/source-navigation.ts`, `test/product/wp05/browser.ts`, `test/product/wp05/planner-origins.test.ts` e `test/product/wp03/planner-fixture.ts`.
- Runner image observada: verde histórico `ubuntu-24.04 / 20261116.376.1`; shard atual `ubuntu-24.04 / 20261111.370.1`. A diferença não estabelece causa. O verde histórico não é transferido ao shard atual.
- Nenhuma troca de mouse por teclado, clique forçado/JavaScript, ampliação de timeout ou alteração de foco foi realizada. Corrigir só o cleanup não demonstraria solução para o clique. Sem fix causal concreto, não foi gasto rerun idêntico.


## Apêndice — falhas originais A/B com file:line

Diagnóstico original; correções e estados atuais estão no agregado e nos handoffs dos responsáveis.

## Falhas A/B — evidência da primeira leitura

Os mapas abaixo registram o comportamento observado, com classificações preliminares. Não atribuem correção de causa raiz às sessões A/B. Linhas de declaração são identificadas quando um timeout não fornece stack da instrução bloqueada.

### Shard 1 — enumeração A interrompida

[Run 44646013868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646013868), snapshot `a4bbf6b042526a0ee3f544243cfa67158236f871`, job 135988658580: **cancelled, N/D pass /N/D fail finais**. O log interrompido mostra 557 eventos pass,21 fail e0 skip, com102 dos113 arquivos iniciados; não há resumo Bun nem erro não tratado entre testes observado. Esses eventos não são o resultado final do shard. Último arquivo ativo: `test/product/wp10/analysis-composition/alternative-selection.test.ts`. O log diz “The operation was canceled”, e a API encerrou o run às01:13:00Z. Não foi inferida autoria de cancelamento. Classificações abaixo são preliminares; paths relativos a `modules/sucafina/Sucafinav1/test/`.

| Falha (file:line) | Causa observada / unbound |
| --- | --- |
| `runtime-http.test.ts:169:55` | Add risk não encontrado em30s; seletor/fluxo legado |
| `business-browser.test.ts:22:26` | ERR_CONNECTION_REFUSED em localhost:4110 Settings; dependência legada de porta fixa |
| `business-browser.test.ts:210:16` | ERR_CONNECTION_REFUSED em localhost:4110 Suppliers |
| `parity-polling-browser.test.ts:10:16` | ERR_CONNECTION_REFUSED em localhost:4110 Settings |
| `product/installed-bi-closure/temporal-contract.test.ts:12:7` | Deadline165000 ms; BI10/BI09; custo interno unbound |
| `product/installed-bi-closure/temporal-contract.test.ts:61:151` | Deadline165000 ms; persistência Portfolio retorna abortada |
| `product/wp02/host-workbench.test.ts:147:16` | Falha HTTP em /sucafina/auth/local; status exato não impresso |
| `product/wp02/host-workbench.test.ts:280:16` | Falha HTTP em /sucafina/auth/local |
| `product/wp02/host-workbench.test.ts:468:16` | Falha HTTP em /sucafina/auth/local |
| `product/wp13/source-scenario.test.ts:32 (declaração)` | Timeout180000 ms; await interno não localizado |
| `product/c12-receipt-recovery/recovery-ui.test.ts:72:17` | Retry same application não visível em30s |
| `product/c12-receipt-recovery/recovery-ui.test.ts:197:57` | [data-recover-change]:enabled não visível em30s |
| `product/wp12/native-execution-portfolio.test.ts:14; product/wp12/native-portfolio-preparation.ts:150:26` | Total esperado null, recebido 240000; portfolio |
| `product/wp12/native-execution-portfolio.test.ts:134; product/wp12/native-portfolio-preparation.ts:150:26` | Total esperado null, recebido 240000; sensitivity |
| `product/wp01/workbench-analysis.test.ts:144:27` | Prepare HTTP200 esperado, recebido 400 |
| `product/wp01/workbench-analysis.test.ts:380:27` | Após alteração de acesso: HTTP403 esperado, recebido 200; preservar negativo |
| `product/wp10/integration/public-state.test.ts:49:28` | GET Dashboard legado esperado 200, recebido 404 |
| `product/wp10/integration/bi-fallback-lifecycle.test.ts:49:16` | Falha HTTP em /sucafina/auth/local |
| `product/wp10/integration/analysis-stale-calculation.test.ts:303:28` | scoped.state esperado unavailable, recebido historical |
| `product/wp10/integration/analysis-stale-calculation.test.ts:346:10` | Preflight esperado denied/analysis-stale-access-unavailable, recebido ok com sourceFence |
| `product/wp10/integration/analysis-stale-calculation.test.ts:410:23` | Flag de injeção fired esperada true, recebida false |

### Shard 2 — enumeração A

[Run 44646018333](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646018333), snapshot `dcb0c68d7e866b4df2153eadd26fda2eab45b266`, job 135988673159: **504 pass / 10 fail**, mais **1 skip e 1 error**, 515 testes em 107 arquivos, 2.278,24 s. O skip existente é `test/local-backups.test.ts` (root estrangeiro exige privilégios de fixture). O erro não tratado é o timeout tardio de Chromium; não constitui um décimo primeiro teste falho. Classificação preliminar pela evidência do log, sem fix A validado nesta leitura.

Paths desta tabela relativos a `modules/sucafina/Sucafinav1/test/product/`, salvo `runtime/local-store.ts`, relativo a `modules/sucafina/Sucafinav1/`.

| Falha (file:line) | Causa observada / unbound |
| --- | --- |
| `mixed-source-contracts/recorded-fallback.test.ts:11:7` | Deadline cooperativo165s; custo interno unbound |
| `wp08/thread-period-continuity.test.ts:17` | Hot Topic day excede30s; declaração parametrizada, await interno não localizado |
| `wp05/sensitivity-integration.test.ts:9; wp05/browser.ts:9:34` | Timeout180s; Chromium launch falha em fixture-setup, erro não tratado tardio; stack também teste:43:9 |
| `operations-fixes/document-search.test.ts:5; runtime/local-store.ts:55:16` | SQLITE_IOERR na abertura SQLite; storage/fixture/auth |
| `wp12/native-execution-collaboration-recall.test.ts:143` | Timeout120s, duração reportada286,487s; ponto interno unbound |
| `wp12/native-execution-executive.test.ts:213:31` | Esperava unavailable/analysis-source-unavailable; recebeu denied/case-selection-unavailable |
| `wp10/integration/bi-call-scope.test.ts:402:56` | BI retornou sem drilldown de registro Planner |
| `wp10/memory-integrity/revocation-tail.test.ts:87:22` | Positivo producer.prepare indisponível; possível família observação Atlas, não comprovada neste teste |
| `wp10/memory-integrity/revocation-tail.test.ts:104:29` | Positivo verifier.verify indisponível antes da revogação |
| `wp10/memory-integrity/revocation-tail.test.ts:124:29` | Positivo verifier.verify indisponível antes da aceitação/revogação |

### Shard 4 — enumeração B completa

[Run 44645900692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692), snapshot `dd45d888617943df40e02815d58b59f88d8a18f7`, job 135988262742, attempt 1: **497 pass /14 fail**,511 testes/118 arquivos,2.480,75s. O estado transitório queued foi o cleanup, não um rerun. Classificação preliminar sem fix B validado nesta leitura. Paths relativos a `modules/sucafina/Sucafinav1/test/product/`; o produtor `product/integration/product-authority.ts` é relativo à raiz Sucafinav1.

| Falha (file:line) | Causa observada / unbound |
| --- | --- |
| `wp13/handoff-persistence.test.ts:95:29` | Preparação: esperado ok, recebido stale; validade de escolha |
| `wp13/coverage-sensitivity-integration.test.ts:115:109` | Verificador aceitou objeto alterado após validação final: esperado false, recebido true; integridade de egress |
| `wp13/handoff-domain-integration.test.ts:392:39 (chamador :65:93)` | Canonical Procurement preparation unavailable |
| `wp13/handoff-c08-predispatch.test.ts:242:200` | Retomada: esperado ok, recebido conflict; idempotência |
| `wp13/handoff-canonical-integration.test.ts:176:200` | Retomada: esperado ok, recebido conflict; idempotência |
| `proof234/am04-c12-return.test.ts:78:18; c12-receipt-recovery/consumer.ts:81:43` | Authoritative receipt namespace unavailable |
| `wp12/native-execution-reevaluation.test.ts; wp12/native-portfolio-preparation.ts:150:26` | Total esperado null, recebido 240000; contrato de total/cobertura |
| `wp12/native-execution-purchase.test.ts (pending); wp12/native-procurement-preparation.ts:193:43` | Total esperado null, recebido 240000; contrato de total/cobertura |
| `wp12/native-execution-purchase.test.ts (complete); wp12/native-procurement-preparation.ts:193:43` | Total esperado null, recebido 240000; contrato de total/cobertura |
| `wp07/browser-ui.test.ts:45:41 (captura :500:21)` | Erro HTTP em /sucafina/auth/local; entrada legada |
| `ui-split/ui-source/draft-replay.test.ts:32:27` | Replay esperado 200, recebido 403; autorização |
| `ui-split/ui-work/guards.test.ts:23:18` | Guards exit 1, base0; arquivos protegidos |
| `integrated-proofs/am01/portfolio-recall-proof.test.ts:19 (declaração; budget :148)` | Timeout240000 ms sem stack do await interno |
| `integrated-proofs/am01/recall-five-profiles.test.ts:31:25; product/integration/product-authority.ts:77:15` | SF_PRODUCT_AUTHORITY_CONFIG_INVALID; configuração de autoridade |

### Shard 5 — enumeração B interrompida

[Run 44645913808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808), snapshot `f0bccdc48b42a9d000f3bda6565fa3d88286c845`, job 135988306632, attempt 1: **cancelled, N/D pass /N/D fail**. Não existe resumo Bun final. Foram observadas **20 falhas parciais**, listadas abaixo; esse número não substitui o total do shard. Job iniciou 00:26:45Z, Run tests cancelou 01:11:58Z, run encerrou 01:12:15Z. Intervalo compatível com timeout-minutes45 de `.github/workflows/test-ci.yml:25`, mas log só informa “The operation was canceled”; não há autoria de cancelamento exposta. Última fase: `planner-calculation.overlapping-revocation`, iniciando recall real do Atlas. Paths relativos a `modules/sucafina/Sucafinav1/test/product/`.

| Falha (file:line) | Causa observada / unbound |
| --- | --- |
| `installed-bi-closure/sensitivity-history.test.ts:19:11 (omitted)` | Deadline cooperativo165000 ms; custo de sensibilidade |
| `installed-bi-closure/sensitivity-history.test.ts:19:11 (confirmed)` | Deadline cooperativo165000 ms; custo de sensibilidade |
| `installed-bi-closure/sensitivity-history.test.ts:66:6` | Deadline165000 ms; histórico de escolha após treinamento |
| `similarity217/installed.test.ts:53:29 (AC01/02)` | ok→unavailable; recall/similaridade Atlas |
| `similarity217/installed.test.ts:99:29 (AC05)` | ok→unavailable; fonte histórica |
| `similarity217/installed.test.ts:137:28 (AC06/07)` | ok→unavailable; autoridade de atores |
| `wp12/native-execution-bi.test.ts:85:149 (sf_finance)` | Predicado true→false; evidência de BI |
| `wp12/native-execution-bi.test.ts:85:149 (sf_maestro)` | Predicado true→false; evidência de BI |
| `wp11/source-promotion-coverage.test.ts:182:67` | Igualdade da prova de cobertura diverge |
| `wp01/planner-monthly.test.ts:44:17` | Erro HTTP em /sucafina/auth/local; entrada legada |
| `wp00/contract-freeze.test.ts:19:72` | Digest de contrato versus freeze diverge; requer proveniência, sem re-pin especulativo |
| `wp10/integration/portfolio-promotion.test.ts:227:68 (fixture :43:14)` | Deadline cooperativo285000 ms; cobertura/autoridade |
| `wp10/integration/review-portfolio-http.test.ts:271:38` | Recusa esperada denied, recebida unavailable |
| `wp10/integration/review-portfolio-http.test.ts; wp10/integration/review-access-browser-fixture.ts:29:45` | WP10_REVIEW_BROWSER_TRANSPORT_DEADLINE10000 ms |
| `wp10/integration/bi-lifecycle.test.ts:202:33 (shell/refresh/sign-out)` | Erro HTTP de enrollment /sucafina/auth/local |
| `wp10/integration/bi-lifecycle.test.ts:202:33 (chamador :249:34)` | Erro HTTP de enrollment; resultado retido/revogação |
| `wp10/integration/bi-lifecycle.test.ts:202:33 (chamador :286:11)` | Erro HTTP de enrollment; limpar seleção |
| `wp10/integration/bi-lifecycle.test.ts:202:33 (chamador :315:29)` | Erro HTTP de enrollment; retorno da fonte |
| `wp10/integration/portfolio-exact-threshold.test.ts:43:19 (helper :213:41)` | denied/criterion-result-access-unavailable |
| `wp10/integration/planner-calculation.test.ts:615:58` | Recall Atlas esperado comprimento1, recebido 0 |


## Falhas observadas — shard 3

Prefixo: `modules/sucafina/Sucafinav1/test/`. Job136006716047 cancelled; cleanup136025186224 success. São255 marcadores PASS e21 FAIL; não há resumo final, marcador skip/todo nem Unhandled error. O grande HTML/diff pertence à falha procurement-integration:180, sem falha adicional oculta.

| File:line | Classe | Evidência / próximo passo |
| --- | --- | --- |
| `io-browser.test.ts:26` | unbound/UI legado | ERR_CONNECTION_REFUSED em :4110; primeira jornada. |
| `io-browser.test.ts:114` | unbound/UI legado | ERR_CONNECTION_REFUSED em :4110; segunda jornada. |
| `visual-layout.test.ts:37` | unbound/UI legado | POST ECONNREFUSED no serviço legado; caso declarado em :15. |
| `product/wp05/procurement-integration.test.ts:180` | falso positivo de fixture | O sentinel privado `hidden` colide com o atributo HTML legítimo `<fieldset hidden>`. A projeção e a seleção anteriores passaram. Próxima fatia: sentinel inequívoco no seed e em todos os checks, mantendo data privada e revogação. |
| `product/wp13/sensitivity-units-boundary.test.ts:54` | timeout/desempenho | Timeout Bun de 30000ms; duração observada de 74999ms, após replay-ready em ~73119ms. Await caro não isolado; manter orçamento. |
| `product/wp13/persistence-recovery.test.ts:21` | timeout/desempenho | Timeout Bun de 30000ms; duração de 31236ms na segunda variação portfolioRecovery(after). Await exato não isolado. |
| `product/operations-fixes/c12-concurrency.test.ts:34` | oracle C12 desatualizado | Esperado409, recebido200. A fixture altera só objective/version após receipt; apply.ts:125–162 reconcilia edits não relacionados e mantém fences de choice/change. Migrar a contraprova inteira, sem apenas trocar409 por200. |
| `product/operations-fixes/c12-concurrency.test.ts:103` | oracle C12 desatualizado | Mesma causa do caso anterior. O teste para antes de provar retry/reload; preservar controles de receipt e autorização. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso omitted: deadline de165000ms em advantage.persist, após comparison.persist custar ~112–125s. Não há falha numérica comprovada. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso confirmed: deadline de165000ms em advantage.persist, após comparison.persist custar ~112–125s. Não há falha numérica comprovada. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso zero: deadline de165000ms em advantage.persist, após comparison.persist custar ~112–125s. Não há falha numérica comprovada. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso null: deadline de165000ms em advantage.persist, após comparison.persist custar ~112–125s. Não há falha numérica comprovada. |
| `product/wp12/native-execution-bi-kpi.test.ts:312` | oracle de URL legado | HTTP200 e links autorizados; teste busca Budget+Overview/Budget%20Overview. apps/cli/src/sucafina-product/extended-source-links.ts:55–78 produz /orchestra/sf-dashboard/budget com year. Migrar URL/origin/ano mantendo proveniência, isolamento e reload. |
| `product/wp12/native-execution-bi-public-selection.test.ts:326` | oracle de URL legado | Mesma migração de rota Budget Overview para /orchestra/sf-dashboard/budget. Manter seleção pública, isolamento de caso e consumidores reais. |
| `product/bi-cost-waterfall/presentation.test.ts:17` | timeout/desempenho | Deadline cooperativo de105000ms em BI09.dispatch; não elevar orçamento nem atribuir a cleanup lento. |
| `product/bi-cost-waterfall/presentation.test.ts:66` | timeout/desempenho | Deadline cooperativo de105000ms em BI09.dispatch; não elevar orçamento nem atribuir a cleanup lento. |
| `product/bi-cost-waterfall/presentation.test.ts:97` | timeout/desempenho | Deadline cooperativo de105000ms em BI09.dispatch; não elevar orçamento nem atribuir a cleanup lento. |
| `product/bi-cost-waterfall/presentation.test.ts:113` | timeout/desempenho | Deadline cooperativo de105000ms em BI09.dispatch; não elevar orçamento nem atribuir a cleanup lento. |
| `product/bi-cost-waterfall/presentation.test.ts:133` | timeout/desempenho | Deadline de105000ms em portfolio.persist, após portfolio.select de ~49.5s. Custo de composição; não prova de erro numérico. |
| `product/bi-cost-waterfall/presentation.test.ts:242` | timeout/desempenho | Deadline de105000ms em BI10.dispatch; manter orçamento e asserções. |
| `product/wp00/baseline-corpus-coverage.test.ts:60` | unbound/inventário documental | docs/product-campaign/wp00/oracles/journeys-j01-j08.json não fornece fixtureBindings nem executionStatus nos8 registros. Não fabricar NOT_RUN/bindings. Eventual mudança documental exige evidência real e PR shared:. |

O último arquivo `product/wp08/review-answer-confirmation.test.ts` teve5 PASS e foi interrompido no sexto caso, `:228`, após `current-lease reply-denied-at-last-human-await`. Não contar essa interrupção como falha emitida.

### Arquivos não iniciados no shard 3

Caminhos relativos a `modules/sucafina/`:

- `Sucafinav1/test/product/c12-receipt-recovery/normal-retry.test.ts`
- `Sucafinav1/test/product/reports-draft-reconciliation/installed-read-integrity.test.ts`
- `Sucafinav1/test/product/review-fixes/finance-resume-performance/journey-phase.test.ts`
- `Sucafinav1/test/product/review-fixes/import-recovery/apply-restart.test.ts`
- `Sucafinav1/test/product/ui-split/ui-source/static-checks.test.ts`
- `Sucafinav1/test/product/ui-split/ui-work/static-gates.test.ts`
- `Sucafinav1/test/product/wp02/backup-consumer.test.ts`
- `Sucafinav1/test/product/wp02/keyed-update.test.ts`
- `Sucafinav1/test/product/wp02/kpi-comparison.test.ts`
- `Sucafinav1/test/product/wp02/prepared.test.ts`
- `Sucafinav1/test/product/wp02/review-completion.test.ts`
- `Sucafinav1/test/product/wp02/signals.test.ts`
- `Sucafinav1/test/product/wp02/workbench-recovery.test.ts`
- `Sucafinav1/test/product/wp06/documents/resolver.test.ts`
- `Sucafinav1/test/product/wp06/imports/dashboard-backup-e2e.test.ts`
- `Sucafinav1/test/product/wp06/imports/end-to-end.test.ts`
- `Sucafinav1/test/product/wp06/imports/planner-roundtrip-runtime.test.ts`
- `Sucafinav1/test/product/wp06/imports/roster-runtime.test.ts`
- `Sucafinav1/test/product/wp06/imports/sqlite-planner.test.ts`
- `Sucafinav1/test/product/wp08/answer-reuse.test.ts`
- `Sucafinav1/test/product/wp08/case-selection-cas.test.ts`
- `Sucafinav1/test/product/wp08/collaboration-journey.test.ts`
- `Sucafinav1/test/product/wp08/confirmation-real-dependencies.test.ts`
- `Sucafinav1/test/product/wp08/mutation-fence.test.ts`
- `Sucafinav1/test/product/wp08/work-presentation.test.ts`
- `Sucafinav1/test/product/wp10/integration/browser-bundle-literals.test.ts`
- `Sucafinav1/test/product/wp10/integration/dashboard-preview.test.ts`
- `Sucafinav1/test/product/wp10/integration/memory-services.test.ts`
- `Sucafinav1/test/product/wp10/integration/portfolio-reconciliation.test.ts`
- `Sucafinav1/test/product/wp10/integration/store-read-scope.test.ts`
- `Sucafinav1/test/product/wp10/integration/ui-authority.test.ts`
- `Sucafinav1/test/product/wp10/memory-integrity/identity.test.ts`
- `Sucafinav1/test/product/wp10/native-host/execution-host-guard.test.ts`


## Falhas do shard 6

Caminhos relativos a modules/sucafina/Sucafinav1/test/product/. Soma:23casos, sem contar novamente a lista repetida do sumário.

| File:line | Casos | Evidência | Classificação / encaminhamento |
| --- | ---: | --- | --- |
| dashboard-installed-closure/consumer-read.test.ts:64,179 | 2 | Inscrição antes de Hot Topics/summary | Migração de UI instalada; não restaurar console |
| wp13/semantic-union-source-scenario.test.ts:50 | 1 | stale/portfolio-selection-changed após180034ms; deadline180000 | unbound — desempenho,10404 leituras de cases/126564 revalidações |
| wp04/capabilities.test.ts:88 | 1 | unavailable/requisition-unavailable | C15 — CAS canônico requests:PR-1 ausente |
| wp04/ui-sourcing-analysis.test.ts:98 | 1 | 503 esperado, undefined recebido | Migração/integração; interface/http.ts:26,30 não admite workbench-sourcing-input |
| wp12/native-question-consumer.test.ts:149 | 1 | answer-reuse-unavailable; Planner17campos | Dependência shared existente #400; ainda sem gate deste teste nesse head |
| wp12/native-verifier-negatives.test.ts:147 | 1 | invalid-forecast-input após false-monthly-total | C14 — seleção HTTP com caseRef passada ao Forecast canônico |
| wp12/native-execution-documents-contract.test.ts:21 → native-procurement-preparation.ts:193 | 1 | null esperado,240000 recebido | C04 — fonte sem operações vs hipótese |
| wp01/http.test.ts:56 | 1 | workbench legado404, esperado200 | Migração de UI; não restaurar contrato retirado |
| wp01/import-receipt-browser.test.ts:26 | 1 | File encontra upload e checkbox | C13 — locator exato |
| wp01/alternative-contribution.test.ts:46 | 2 | Subtotal null/0; corpo de proposta ausente | Migração/apresentação; contribution-body.ts default vazio:53; payload/envelope passaram:37–42 |
| wp01/personal-views.test.ts:82 | 1 | Inscrição antes de ?page=OPEX | Migração de UI; :83–90 usa densidade e global legados |
| wp10/integration/calculation-ancestry-composition.test.ts:26 → composition-test-deadline.ts:5 | 1 | Deadline105000 em produce-outer | unbound — desempenho;573 leituras,102548ms na fase |
| wp10/integration/bi-case-access.test.ts:136 → bi-access-browser-fixture.ts:198 | 1 | Espera botão singular Abrir origem | C16 — opções reais de múltiplas origens; distinto de C06 |
| wp10/native-host/native-host-disposal.test.ts:38 | 7 | SessionSubagentModels ausente nos7modos | C12 — composição do host de teste |
| wp06/native/import-analysis.test.ts:156 → :326 | 1 | Contribuição persistida sem preview link renderizado | Migração do consumidor; persistência/importPreviewRef/mensagem passaram:148–155; não fabricarURL |

