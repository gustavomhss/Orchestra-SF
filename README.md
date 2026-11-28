# Evidências do Orchestra-SF — arquivo do #613

Este sexto incremento documental preserva o R5 publicado e acrescenta C19, seu focal fechado, o Analytics original negativo, o pacote D28 estático e os recibos operacionais no alcance registrado. A proposta contém somente este README, `index.json` e blobs em `objects/`. A raiz ainda precisa revisar e publicar a árvore documental. Não há candidato final C613, nova qualificação de área, aceite de Release ou autorização de produção.

## Conteúdo e preservação

O [index.json](index.json) relaciona **607 blobs reais**, **63.318.211 B** em `objects/<git-sha>`, **683 memberships**, **40 grupos** e **54 streams**, com **199 referências a partes**. O incremento acrescenta **72 objetos / 6.666.802 B**, **99 memberships**, **cinco grupos** e **seis streams / 22 referências a partes**. Os **535 objetos, 584 memberships, 35 grupos e 48 streams** do R5 permanecem na ordem original; seus metadados e os prefixos de memberships são literais.

O [catálogo R6](objects/5a51ed2d66b8f442559ef973a07ffa54064d31fc) enumera **92 blobs distintos / 7.280.964 B** e **98 memberships**. Desses, **71 blobs / 6.582.528 B** são novos para o arquivo; **21 blobs** já estavam no R5 e recebem apenas memberships adicionais. Os 71 corpos novos e quatro corpos reutilizados foram rehashados neste incremento. Os outros 17 reutilizados conservam a autenticação do R5, cujo índice foi cotejado com todos os 535 objetos da árvore publicada. Não se alega nova aquisição dos 535 corpos históricos. O catálogo acrescenta seus próprios **84.274 B** como objeto real no grupo de controle do arquivo, sem listar a si mesmo em seu conteúdo.

| Grupo acrescentado | Blobs distintos no grupo / memberships |
| --- | ---: |
| C19-source | 12 |
| C19-focal | 35 |
| D28-final-qualification | 14 |
| C19-analytics | 31 |
| R5-archive-control | 7 |

Um mesmo blob pode pertencer a mais de um grupo; os totais globais deduplicam pelo SHA Git. O grupo `R5-archive-control` conserva o [índice R5](objects/2f80c037c70071b8bb756f44439047b1e5ac50d0), o [README R5](objects/8e76aea8b7c6881d648ce8df6e64455c6bc692bd), o [manifesto R5](objects/c408b4f69264f9816d44d921f855263e0c816b7b), o [review da raiz](objects/1c8c5052ee74efd0678211a7b7cde33126f3e173), o [recibo de publicação](objects/a6e5f0b6f22d93079b85a667fdb6e0611faa8456), o catálogo de entrada anterior já arquivado e o catálogo atual de R6. O README R5 inteiro também está preservado no bloco histórico ao final. Os rótulos históricos R5/R6/R7 de documentos de go-live não são renomeados por esta revisão do arquivo.

## Resultado C19 e limite de qualificação

A fonte limpa C19 é `7393cd010086f4a12d61ae9bb5db13534bd18aa0`, árvore `31954cfe7df07455d8b137f6f4f1e4d94a316fc3`, pai único S18 `455c02a7a05a6dd3262ae15b184419897366fde4`. Seu [manifesto de fonte](objects/1fe5ee9573055f405d10dc27450b3783e2275f29) e [review](objects/f3c4154ddc93d049770b8669d68a9a53fada8653) registram duas modificações: os três opt-ins ao contrato existente de leitura do grafo cases em Portfolio selection e o controle de consumidor correspondente. O contrato é um read-set explícito; não promete equivalência de efeitos exclusivos de namespaces não alcançados. As chamadas e verificações preservadas permanecem documentadas no pacote.

| Evidência | Resultado recebido | Alcance |
| --- | --- | --- |
| Focal 46093171031/1 | **15 casos / 2.103 assertions**; sete grupos externos / 34 assertions; 13 comandos, 26 flags de truncamento falsas, 15 pins e seis reports | FOCAL_PASS_ONLY, com 36 cotejos da raiz e 53 independentes. |
| Analytics original 46094695101/1 | **Um caso falhou e um passou**, duração reportada de 9,3 min; primeiro preview com timeout original de **60.000 ms**, spec **72:32** | UI42 teve seis capturas parciais; UI43/UI44 não foram alcançadas. BI passou apenas nesse snapshot. |
| D28 | Revisão estática, quatro bindings finais **UNBOUND** | Nenhuma execução ou qualificação de composição final. |
| Áreas e produção | **12/15 áreas históricas**, **zero novas** | Nenhum ganho de desempenho demonstrado, C613 final, tar verificado, Release, Migração ou go-live estabelecido. |

O [recibo focal](objects/c5a95b9191392d8da949adadd44aedf8cf3f9ce1) preserva as populações **7/843** do contrato cases, **5/757** da projeção C08 e **3/503** do consumidor Portfolio. O novo report `SF_C19_PORTFOLIO_CASES` recebeu **6/9/6/3/1** nos cinco contadores documentados. A fixture do consumidor usa autorização opaca: seu resultado não mede materialização física estreita nem benefício temporal. As matrizes genéricas e controles antigos permanecem separados.

O [recibo Analytics final](objects/86a38860ee558c6c21d2356a9f7770209d5b986a) e o [parecer independente](objects/08328f984a266a8ebe356b4220ea7c82694bdff2) fecharam **28 + 41 cotejos de integridade**, com resultado negativo de produto. O único POST `decision-portfolio-preview` de sequência 3 está registrado às `2026-11-28T01:52:13.6911930Z`, com vínculo `exact`, sem resposta correspondente nos marcadores recebidos.

A história anterior de results é preservada como observada: sequência 1 inclui `native-request-failed` e HTTP 200 com `response-body-unavailable`; sequência 2 termina em HTTP 200/`ok`/`array`. Esses registros não são a requisição de preview. Não estabelecem a causa do timeout. BI recebeu **40 capturas** — sete UI45 e 33 UI46 — e as leituras originais concluíram no snapshot atual. Esse resultado não transfere aceite para outra composição.

O Analytics executou `ac5274a52bed83db4c86c1cf2ea53d36b96aa84b`, árvore `5c7de31ad8a10c4b41e5e0a839417eb43198fd0c`, filho único de S19 com apenas o request original de **295 B sem LF**. Spec, seed, duas jornadas, um worker, retry zero, repeat um, preview de 60 s e sensibilidade de 120 s foram mantidos. Não houve overlay E13, profiler ou novo observador nesse source.

## D28 permanece paramétrico

O [manifesto D28 vigente](objects/b980dfc157b4b5fbe8c70cf7e324beca63f7a281) conserva **26 grupos, 32 sites sintáticos, 37 comandos efetivos e 74 flags de truncamento**, além dos seis filhos de prova separados. Os quatro bindings de source, tree e identidades do wrapper permanecem `UNBOUND`; os totais funcionais e de reports da futura seleção completa permanecem `null`.

G23 usa o título sem número fixo para casos e preferências, com o controle `68ae48f9a039180824f5471a1de27c0ca34be088`: **três declarações**, deadlines Bun de **15/15/20 s**, nominal de 50 s, processo de 120 s e pai de 180 s. Envelope, finalizer, workflow, argv e gates continuam literais. O [review da raiz](objects/27f39a06e070ac81100c511a9326de6048fd2d85) contém 37 cotejos e o [review independente](objects/3f9da09feb817f8e5f3b713f2f86cc8d66a28e44), 75.

O [manifesto anterior](objects/094468973ff9ff14121c424d6c7d60e01e4d6e26), com locator de receipt ainda nulo, permanece histórico. A [derivação de campo](objects/6b10fc47e5df6376889be69cd93ed2297bfccace) liga somente o recibo focal fechado. Nenhum número do focal foi copiado para resultados futuros de D28, e S19 não é declarado candidato final.

## Streams reais e exclusões

| Stream C19 acrescentado | Partes reais | Bytes |
| --- | ---: | ---: |
| Focal main | 1 | 105.958 |
| Focal cleanup | 1 | 2.281 |
| Focal reports | 1 | 9.251 |
| Analytics main | 17 | 4.866.399 |
| Analytics cleanup | 1 | 2.281 |
| Analytics markers | 1 | 34.316 |

As seis composições foram autenticadas a partir dos blobs Git efetivos, com ordem, LF e BOM preservados. A [união focal](objects/6b59ebdc105a00b9053854139dadfd10ba4e0551) contém seis reports. A [união Analytics](objects/fa71c102ec320dfe7baf497af583db07bd7344ac) contém **97 linhas: 45 SOURCE, 46 CAPTURE, cinco DIAGNOSTICS e um SCOPE**. A extração das uniões remove somente o transporte de timestamp/ANSI; os payloads não são reserializados. Os originais permanecem intactos.

O [manifesto do main Analytics](objects/d48e9674a25b694c17db6c770c0116ec8c2ff1bb) lista as 17 partes reais. O inteiro recomposto tem SHA256 `23bb1910d623ebbdc27ba01ff0faf3d055fff01b6b90fc8a89364345ed109c2a`, 1.976 LF e BOM nos offsets **0, 2.104.899 e 4.224.262**. Seu Git SHA `d5dacd1ea8b65419de9a47eef69134ab32c8471f` é **somente calculado**; não foi adquirido ou criado e não está em `objects/`.

O artefato **15242603880**, 45.814.109 B, SHA256 `bccc5ec8ff3eb6c7c57f34211fa59bbf691d072af0faf115f5f1ed3857b47392`, é **metadata only**, com **zero aquisições ZIP**. Este incremento não contém runtime JSON, PNG, trace, membros do ZIP ou prova de CRC desses membros. O request UI6 de 390 B permanece texto/identidade calculada dentro do checkpoint; não é objeto de request nem execução final.

## Cortes operacionais e checkpoints

O [checkpoint anterior](objects/45304b589465dfdaa584f9783aeef13d1dd6ae47) conserva o corte em progresso. O [checkpoint posterior](objects/8863b12b4c3b52d26ea43844986c7857faa19b95) registra todos os originais até C19 fechados, incluindo os dois GETs emitidos e os manifestos/recibo atuais; o receiver de aquisição encerrado foi omitido. Helpers textuais nesses checkpoints são dados históricos e não autorizam reexecução ou nova aquisição.

A [observação operacional final](objects/8283eabd80da4413a0e3fc720ae3c8e1be281e4d) tem corte de acesso em **01:49:46 UTC**. Ela preserva a autorização prévia do host e o caminho do operador Codex local; registra falta de confirmações/rota disponível nesse corte e reservas G08/G10 pendentes. Não declara outage global. O campo de zero GETs é restrito à observação de acesso; os **dois originais Analytics** foram recebidos separadamente e fechados às **01:58:34 UTC**. O draft operacional `0e1e265…` não foi incluído.

E14 é posterior e fica fora do corpus deste incremento. Sua menção nos recibos/checkpoints registra apenas autoria futura; não adiciona fonte, controle, execução ou autorização ao arquivo R6.

## Retenção e publicação proposta

A árvore documental tem apenas `README.md`, `index.json` e `objects/<sha>`, todos os arquivos em modo `100644`. Os pais planejados, nesta ordem, são:

1. R5 publicado: `7685a790349b7a3b9c3e68cfe56b96fd4963b762`, árvore `4cee3a5483cbeb8911d242e16b86c418a7bc0a4c`.
2. Focal C19 executado: `86e365fe047f86597751c7e8222011dca4b0a0af`, árvore `e8bd146e3fa65de60e1b4f93ddd41950fc4c59a2`.
3. Analytics C19 executado: `ac5274a52bed83db4c86c1cf2ea53d36b96aa84b`, árvore `5c7de31ad8a10c4b41e5e0a839417eb43198fd0c`.

Os dois últimos são filhos distintos de S19; a cadeia já retém S18 e as fontes anteriores. Commits e árvores são identidades de retenção, não entradas de blob. A raiz deve revalidar a ref esperada R5 antes de atualizar `sf613-evidence` sem force. Este autor cria somente catálogo, índice, README e manifesto propostos; não cria árvore, commit, ref, workflow, run, alteração de produto, aquisição original ou ZIP. As refs de produto e o ledger histórico permanecem separados.

<details>
<summary>README R5 publicado — histórico literal</summary>

# Evidências do Orchestra-SF — arquivo do #613

Este quinto incremento documental preserva R4 e acrescenta o corpus E13 fechado e enumerado: fonte diagnóstica e sua revisão, controles, focal aprovado, Analytics original negativo, logs completos preservados em Git, uniões derivadas e os recibos finais de recepção. A proposta contém somente este README, o índice e os blobs em `objects/`. A raiz ainda precisa revisar e publicar os objetos Git do arquivo. Não há autorização de nova execução, alteração de produto, candidato final ou produção.

## Conteúdo e preservação

O [index.json](index.json) relaciona **535 blobs reais**, **56.651.409 B** em `objects/<git-sha>`, **584 memberships**, **35 grupos** e **48 streams**, com **177 referências de partes**. O incremento acrescenta **93 objetos**, **93 memberships**, **seis grupos** e **sete streams / 24 referências de partes**. Os 442 objetos, 491 memberships, 29 grupos e 41 streams de R4 permanecem literais e na mesma ordem.

Os **92 objetos distintos / 7.526.020 B** do [catálogo final E13](objects/3aa1b45e76cc1341095d65beb1b25c6e295da1b6) foram autenticados por SHA-1 Git, SHA256, tamanho, LF e terminação. Não há sobreposição desses 92 objetos com R4. O próprio catálogo acrescenta 48.822 B como objeto real no grupo `E13-control-plane`, papel `actual-input-catalog`. O catálogo preparatório e as revisões anteriores do helper/controle continuam identificados como históricos; o catálogo final é o único input que governa esta proposta.

Os sete streams novos foram recompostos a partir das 24 referências reais, sem separadores ou normalização de BOM/LF. Os 41 streams anteriores e suas 153 referências de partes conservam seus metadados literais e os recibos de autenticação históricos. Não se alega nova aquisição de todo o corpus anterior.

| Grupo acrescentado | Objetos e memberships |
| --- | ---: |
| E13-source | 28 |
| E13-control | 9 |
| E13-focal | 18 |
| E13-analytics | 30 |
| E13-control-plane | 3 |
| R4-archive-control | 5 |

O grupo `R4-archive-control` preserva o [índice](objects/f4e3dfedb78c119d03a2acd4d8406a1175e7ab71), o [README](objects/05c3f2ddd758d1f6e122324620081e4594af65e2), o [pacote](objects/f0cc6f2712fa7298f6a4b8a385c5204e9989362c), a [revisão da raiz](objects/69712ea10c7c9cf5d24c8667a95023a46b65c2f9) e o [recibo de publicação](objects/3658ae015be3c1dc96535e61d444122057d4f3a6) de R4 como objetos reais. O README R4 inteiro também está preservado no bloco histórico ao final. O rótulo documental antigo `R5` existente no índice não designa esta quinta revisão do arquivo.

## Resultado E13 e alcance

| Evidência | Resultado recebido | Limite |
| --- | --- | --- |
| Focal 46085008328/1 | **40 casos / 1.470 assertions**, oito grupos externos / 45 assertions; 14 comandos, 28 flags de truncamento falsas, 24 pins e dez reports | Qualifica somente a seleção focal diagnóstica recebida. |
| Analytics original 46086157237/1 | **Um caso falhou e um passou**; primeiro preview sem resposta correspondente no waiter original de 60.000 ms, spec 72:32; BI passou | UI42 teve seis capturas parciais. UI43 e UI44 não foram alcançadas. |
| Observação causal E13 | **510 eventos**, último evento de overflow em **42,1839 s**, sem terminal do Request | Prefixo truncado pela quota; não identifica a operação em execução aos 60 s. |
| Produto e pacote final | **12/15 áreas históricas**, zero novas; D27 com quatro bindings finais **UNBOUND** | Nenhum C613 final, aceite de Migração, execução D27, Release ou go-live é estabelecido. |

O [recibo focal final](objects/d7c88e186e3469cb57f7673b227b4fba4cadb55c) e seu [ACK independente](objects/c6ad98dd23ddc9f906c0bfa66d60ccbb86689812) estão fechados. O teste E13 exercitou sete modos isolados e 23 rótulos. Os **19 filhos nomeados** são a soma de 11 loading, um lazy e sete E13; esse número não representa todos os subprocessos do job. Os nove reports herdados conservaram os respectivos contratos, com o PID do controle C18 observado neste run. Esses controles sintéticos não demonstram conclusão do preview instalado.

O [recibo Analytics final](objects/ad7d413e7e8dfff50d6c0a2fd2477baffd0c5b26) e o [ACK independente](objects/1541b7542574ed9a522a82c864ba1c58f53e9637) preservam as duas respostas anteriores de results, ambas 200/ok, e o POST `decision-portfolio-preview` de sequência 3, sem resposta correspondente entre os marcadores recebidos. O caso BI recebeu 40 capturas, sete de UI45 e 33 de UI46, e passou somente nesta composição diagnóstica. Nenhuma causalidade ou melhora de desempenho é inferida da aprovação do BI.

A fonte diagnóstica é `dffc62a08bdba74f1a9322d49cde095e81535f55`, árvore `0da48e0d15de780d981a5bce3e49e382a6e61849`, com pai único na fonte limpa S18 `455c02a7a05a6dd3262ae15b184419897366fde4`. O focal usa o snapshot `43f73297c2082ed4ea3a016bb1fd7bd970a53201`; o Analytics original executou diretamente a fonte diagnóstica. Essa fonte não constitui uma correção de produto para merge.

## Prefixo causal e relógios

A [união dos eventos E13](objects/88c30a2f090ce2aeae07883eb6cf44d26e271ac0) contém 510 linhas / 250.708 B e SHA256 `726e64fc6a5a7c681267d2a203894be1d9db317bdeb79f4289427cdfc3b79dd7`. O vínculo recebido é Request 1, PID 3778, parent PID 3733, nonce `sf613-e13-event-qmQKRg`, run 46086157237/1. Os campos source/sourceTree designam a base limpa S18; snapshot designa a fonte diagnóstica E13. São papéis distintos no protocolo.

O [parecer causal preservado](objects/3f236afc6ff2d30c03816314dd3f20ec3734b6ff) e o recibo final mostram um port e 26 unidades de comparação no prefixo: dez comparadores diretos, dos quais nove retornaram, e 16 comparadores aninhados, todos retornados. A fase `combination-evaluate` não tem fechamento emitido no prefixo. O evento 510 é overflow; não houve terminal. Entradas sem fechamento descrevem a parte recebida, não o estado posterior ao evento descartado ou no instante do timeout.

Os intervalos usam somente o relógio monotônico do servidor instrumentado, em décimos de milissegundo. Os intervalos aninhados já estão contidos nos diretos e não são somados como custo adicional. O resíduo canônico no recibo final é **182.136 décimos de ms**; o texto histórico do parecer conserva a representação IEEE `18213.600000000002 ms`. Nenhuma dessas medidas representa CPU exclusiva, espera exclusiva, custo não instrumentado ou uma causa demonstrada. Os relógios Actions, servidor e Playwright não são conciliados por inferência.

## Bytes reais, inteiros calculados e artefato

| Stream E13 | Partes reais | Bytes | Observação |
| --- | ---: | ---: | --- |
| Focal main | 1 | 122.802 | Blob inteiro real, recebido e fechado. |
| Focal cleanup | 1 | 2.281 | Blob inteiro real, recebido e fechado. |
| Focal reports | 1 | 19.660 | União derivada real de dez reports. |
| Analytics main | 18 | 5.148.177 | Inteiro recomposto e autenticado; somente as 18 partes são objetos reais. |
| Analytics cleanup | 1 | 2.283 | Blob inteiro real, recebido e fechado. |
| Analytics markers | 1 | 34.163 | União derivada real de 96 linhas. |
| Analytics events | 1 | 250.708 | União derivada real de 510 eventos, prefixo sem terminal. |

O main Analytics tem SHA256 `89d650f98b82fa753696eb78b6b0ed270443b3652f839b926aeb605d6fc75381`, 2.986 LF e BOM nos offsets de bytes 0, 2.104.519 e 4.205.627. O SHA-1 Git `1eb15113536676c909a6de4a6294d18688d66bbf` é **calculado somente**: não foi adquirido nem inserido em `objects/`. A recomposição usa as 18 partes manifestadas, em ordem literal. A [união Analytics](objects/d6c235ba488c6f8121845bc184588937972c0b64) permanece separada do stream de eventos.

O artefato **15239671856**, 45.860.595 B, digest `sha256:a4894ff8d28a7c6977b739af2449513d6ac89d75a63d7c98d9ab755cd1ddcbc7`, é **metadata only**. Houve **zero aquisições de ZIP**. Não foram recebidos por este incremento arquivo físico de eventos, runtime JSON, PNG, trace ou membros do artefato. A existência da união de stdout não substitui esses arquivos nem prova um terminal ausente do prefixo.

## Publicação proposta

A raiz deve revisar uma árvore própria com apenas `README.md`, `index.json` e `objects/<sha>`, todos os arquivos em modo `100644`. Os dois pais planejados, nesta ordem, são:

1. R4 publicado: `f0e031d8667f6b80dc417dbaddd39c3123b2ae52`, árvore `aaaac991b98c22035ef4d6b2749a5c8acfc96bce`.
2. Focal E13 executado: `43f73297c2082ed4ea3a016bb1fd7bd970a53201`, árvore `6508c42f4957adefcd2de55fb9b51ceef6fe318f`.

O segundo pai já alcança a fonte diagnóstica usada pelo Analytics; S18 permanece ancestral. Não há parent adicional de produto ou importação do layout executável para esta árvore. A ref esperada antes de eventual atualização nonforce é R4. Este autor produziu apenas os três blobs da proposta, sem árvore, commit, ref, workflow, run, comentário externo, GET original ou ZIP. A publicação e a auditoria final pertencem à raiz.

<details>
<summary>README R4 publicado — histórico literal</summary>

# Evidências do Orchestra-SF — arquivo do #613

Este quarto incremento documental preserva R3 e acrescenta o corpus C18 enumerado: fonte e controles, focal aprovado, Analytics original negativo, proposta estática D27, recepção e fundamento da próxima pergunta diagnóstica. A árvore de `sf613-evidence` contém apenas este README, o índice e blobs em `objects/`. O conteúdo não constitui candidato final de Release, instalação QA, aceite de Migração ou autorização de produção.

## Conteúdo e preservação

O [index.json](index.json) relaciona **442 blobs reais**, **49.076.567 B** de conteúdo em `objects/<git-sha>`, **491 memberships**, **29 grupos** e **41 streams**, com **153 referências de partes**. São **63 objetos novos** e **71 memberships novos** em relação a R3. Os metadados dos 379 objetos anteriores, os prefixos dos 420 memberships, os 23 grupos e os 35 streams de R3 permanecem literais.

Os 70 objetos reais do [catálogo C18](objects/d44e77a41e70fd6c20de23f963249a5e4121a227) foram autenticados individualmente. O catálogo compartilha oito blobs com R3: o driver focal C17, os dois requests e cinco arquivos do pacote final D26/D27. Cada objeto compartilhado conserva seus metadados e recebe somente o novo membership. Os outros 62 objetos e o próprio catálogo completam as 63 adições. O catálogo pertence ao grupo `C18-reception-and-next-question`, papel `actual-input-catalog`.

Os seis streams acrescentados foram recompostos a partir de 22 referências de partes reais, sem separadores ou normalização de BOM e LF. Os quatro streams de logs originais representam main e cleanup de focal e Analytics; os outros dois são as uniões derivadas dos reports focais e dos marcadores Analytics. Os 35 streams herdados mantêm o recibo de auditoria de R3; este incremento não alega uma nova aquisição de seus originais.

Os cinco controles documentais de R3 também são objetos deste incremento: [índice](objects/5cb3f23d64dcc7c8b3dfb4d718955d33d8fec2b0), [README](objects/d99de8ea7152a68b51a4f6c66eb8d50ef0514931), [manifesto](objects/db8864acbf3f0e6d736138a00e8494af1b33f137), [revisão da raiz](objects/41fd42fc295bc963ab63469850b77df5cc35c2c7) e [recibo de publicação](objects/52de10c866adf1cb00aba9daa7381109d2dc1e0d). O README publicado em R3 está reproduzido integral e literalmente na seção histórica ao final. Seus estados, totais e pais descrevem aquele corte.

## C18: fonte, focal e jornada original

| Conjunto | Resultado preservado | Alcance |
|---|---|---|
| Fonte C18 | S18 `455c02a7a05a6dd3262ae15b184419897366fde4`, árvore `ae1c0977057e45853f3dc240140e5f221057f49d`, pai único S17 | Fonte limpa com helper R2 revisado; sem overlay diagnóstico E12 |
| Focal `46074917314/1` | **39 controles, 1.432 assertions e nove reports**; sete testes externos com 35 assertions; 13 comandos e 26 flags de truncamento falsas | Focal aprovado na composição e limites executados |
| Analytics `46075966101/1` | **Um caso reprovado e um aprovado** | Primeiro preview UI42 excedeu o waiter original de 60.000 ms em `design-wave-five-analytics.spec.ts:72:32`; UI43/UI44 não foram alcançadas; BI passou nesta fonte |
| D27 | Revisão estática aceita; quatro bindings finais `UNBOUND` | Proposta final ainda não executada; mantém 26 grupos, 32 sites, 37 comandos efetivos, 74 flags e seis filhos de proof |
| Próxima pergunta diagnóstica | Fundamento de fonte e evidência preservado | Não é resultado de execução E13 nem prova de uma causa interna |

O [recibo focal](objects/08e8d47abb38d6e1dc96e497e54b8dd8e160b37e) conserva o controle `SF_C18_CAPTURE_LAZY` e seus oito oráculos. Esse controle usa bootstrap sintético. Seus onze filhos históricos de loading e um novo filho lazy são populações distintas dos nove reports observados. O resultado não mede benefício de desempenho na jornada UI. O helper R1 permanece arquivado como proposta **supersedida e não executada**; a fonte testada usa R2.

O [recibo Analytics](objects/bba2ff1e6015b6ec877240d4a4f4e524b630bc39) conserva as duas respostas anteriores de `decision-portfolio-results`, ambas **HTTP 200 / status ok** neste run. Depois delas, a requisição nativa `decision-portfolio-preview` da sequência 3 foi observada, mas sua resposta não foi recebida dentro do waiter. Não se transfere a falha de aquisição de corpo observada no corte histórico E12 para C18.

As seis capturas parciais UI42 correspondem a lista e configuração. O caso BI aprovado contém sete capturas UI45 e 33 UI46, incluindo as verificações originais registradas no recibo. Isso não prova sensibilidade UI44 concluída nem qualifica o primeiro caso reprovado. Timeout sem resposta não estabelece causa de CPU, lock, transporte ou fase interna; os dados não demonstram uma economia quantitativa de C18.

O estado histórico continua **12 de 15 áreas**, com **zero novas áreas aceitas** e **produção não autorizada**. As propostas e cortes negativos anteriores ficam preservados. O [review D27](objects/02e39f88126bef9ed7f70f3a09eb7ee2005b752a) não cria um grupo 27: G2 já seleciona o arquivo capture inteiro, agora com 48 casos na referência S18. A contagem funcional da futura composição permanece indeterminada até os bindings e a execução reais.

## Logs, uniões e exclusões

| Stream novo | Partes reais | Bytes | Identidade / limite |
|---|---:|---:|---|
| C18 focal main | 1 | 112.385 | Blob real `5caff1d5520ef621278457cdbce32b4a1b20123d` |
| C18 focal cleanup | 1 | 2.281 | Blob real `f94480c34318a510206e89a7b02f2e1da00389b5` |
| C18 focal reports | 1 | 11.979 | Nove linhas; blob real `89d79a30e13f46df8cb481536a9e41862eda07e5` |
| C18 Analytics main | 17 | 4.867.325 | Inteiro `4060971fa1492f50be0fae5089d0ca58eda518f6` **somente calculado**, excluído de `objects` |
| C18 Analytics cleanup | 1 | 2.281 | Blob real `2dbdf9d6af6921ccc407b0e9e8837f87dae56034` |
| C18 Analytics marcadores | 1 | 34.166 | 96 linhas; blob real `85954ebc570a1c068be1f046c47ca76d9ab6ec04` |

O main Analytics concatenado tem SHA256 `c27f0f52bc3bdff4b250d558a1fcfba075123e44426e0692ebabed3e3c0c0d91`. A união dos marcadores tem SHA256 `7f40497ecc99180abe34a125f1fb7d395d36123f34c536315d4be6131e85aa6e`; a união focal tem SHA256 `dd54073cf792519f6c13c9775103feb0b751449110873aac300af1896f9f09c8`. Os hashes inteiros calculados servem à verificação das partes; não criam objetos Git.

Os originais C18 foram adquiridos uma vez cada pela raiz, preservados e relidos antes do parse. Esta autoria usa exclusivamente essas cópias Git e não readquire Actions ou ZIP. O artefato **15235941403**, **45.839.284 B**, digest `sha256:bf45432ad9c72fc8fd754b71fd01ac081817667ce13a1ea4e591cdcaa331ce46`, permanece **metadata-only, zero ZIP GET**. Nenhum conteúdo interno, trace, screenshot ou perfil desse artefato é afirmado como recebido. A ausência de uma aquisição de ZIP não prova ausência desses arquivos em seu conteúdo.

As identidades de caso, stream e PID e os relógios dos cortes anteriores mantêm seus próprios limites. Este arquivo não concatena relógios para atribuir causalidade e não transforma amostragem histórica E11/E12 em custo atual de C18. O [fundamento da próxima pergunta](objects/5723337efebc6761d256ad80f5202d6509947dbd) permanece uma proposta de discriminação causal.

## Publicação proposta

A ordem de pais proposta é:

1. R3 publicado: `e35ef28919b7be00d1fd6e37bf547ad649c07bf0`.
2. Focal C18: `54e99dbebb37030c94c9054a2195baa186e621a9`.
3. Analytics original C18: `9124afd5a28cd93bc6568973d8bda5bb5afb2ccf`.

Focal e Analytics têm S18 como pai único; a fonte permanece ancestral, sem copiar seu layout executável para a árvore documental. A raiz deve verificar novamente a ref esperada R3 e publicar por atualização nonforce. Neste corte foram autorizados somente os três blobs de proposta; árvore, commit e ref R4 ainda são responsabilidades da raiz.

A árvore própria deve conter exatamente `README.md`, `index.json` e `objects/<sha>`, todos os arquivos em modo `100644`. Não inclui `.github`, `.ci-run.json`, `apps`, `modules` ou `packages` na raiz. O manifesto deste pacote fica separado para revisão; index, README e manifesto atuais não se incluem recursivamente em `objects`. Nenhuma ref de produto, execução ou autorização de produção é criada por este documento.

## README R3 completo — corte histórico preservado

<details>
<summary>Texto publicado em R3; totais e estados abaixo pertencem ao corte anterior</summary>

# Evidências do Orchestra-SF — arquivo do #613

Este terceiro incremento documental preserva R2 e acrescenta o corpus E12 enumerado: fonte e controle diagnósticos, focal, Analytics original, reader, sete exports completos e análise descritiva do perfil. A ref `sf613-evidence` mantém árvore própria. Seu conteúdo não constitui candidato de Release, instalação QA, aprovação de Migração ou autorização de produção.

## Conteúdo e preservação

O [index.json](index.json) relaciona **379 blobs reais**, **42.875.582 B** de conteúdo em `objects/<git-sha>`, **420 memberships** e **35 streams**. São **108 objetos novos** em relação aos 271 de R2. Os metadados dos 271 objetos e os prefixos dos 310 memberships anteriores permanecem literais; os únicos objetos compartilhados entre o catálogo E12 e R2 são os dois requests originais.

Os 106 objetos do [catálogo E12](objects/dfc7d22a350ad8f99151f840994f2ece71750c58) foram autenticados individualmente. Seus 14 streams foram recompostos a partir de 47 referências de partes reais, sem separadores e sem normalização de BOM ou LF. Com os 21 streams e 84 referências anteriores, o índice contém **131 referências de partes**, preservando sua ordem. Inteiros apenas calculados permanecem metadados e não são apresentados como blobs existentes.

O [índice R2](objects/4fcb157a6da2f7ca0b78cfbf30fcb9a5beda8e4c), o [README R2](objects/3c7a84c85e23aca17e520f411ffa1e08a82f548e), seu [manifesto](objects/3e297a73cee1b65a4ddfb5953c4b86cf681b4d88) e o [recibo de publicação](objects/29ceb9ceb103bcaea66103d38fee93b4a90e441c) estão incluídos como objetos. O README R2 completo está reproduzido literalmente na seção histórica ao final. Seus estados, pais planejados e pendências descrevem aquele corte; não são instruções de publicação deste incremento.

## E12: resultados distintos

| Conjunto | Resultado recebido | Alcance |
|---|---|---|
| Fonte E12 | Overlay diagnóstico `c061693ae9833819cd3afd2ae1b03805de6c82f9`, sobre S17 | Observação temporária; não integra a linhagem final de produto |
| Focal `46061092039/1` | 13 controles aprovados, 1.136 assertions e nove reports; sete grupos, 13 comandos, 26 flags de truncamento falsas | Qualifica os controles e a composição diagnóstica no recorte executado |
| Analytics `46063135555/1` | Um caso reprovado e um aprovado | Primeiro preview UI42 excedeu o waiter original de 60.000 ms em `design-wave-five-analytics.spec.ts:72:32`; UI43/UI44 não foram alcançadas; BI passou nesta fonte diagnóstica |
| Reader `46066111400/1` | Sete séries completas, quatro paridades verdadeiras, `captureComplete=true`, zero pendências e zero falhas de recepção | Confirma transporte e captura no alcance dos originais recebidos; não altera o resultado negativo de Analytics |
| Perfil E12 | Grafo de 9.269 nodes e 9.687 samples recebido e analisado como dados | Amostragem do processo nativo/PID; não fornece custo exclusivo da requisição ou causalidade do timeout |

O [recibo focal v2](objects/d8b2fa28d316464793095bf0b03c2327e86a847e) distingue o Session, relógio e entradas sintéticos do controle da versão e revisão de Bun lidas do runtime real. O focal não é prova de captura CPU da jornada original. O [recibo da Analytics](objects/053034631c7d8fab74fd2dbc031b23cec93759a2) conserva também a falha de aquisição do corpo de `portfolio-results` na sequência 1, seguida da resposta HTTP 200; não a converte em causa provada do timeout.

A fonte limpa continua S17 `7cbf68a88a5ee18127e0ca254ef78f2347a33598`. O estado histórico permanece **12 de 15 áreas**, sem novas áreas aceitas. R7, D26 e todos os cortes negativos anteriores permanecem com seus próprios limites documentais. Este incremento não executa D26 nem fecha seus quatro bindings finais UNBOUND.

## Transporte e captura recebidos

O [recibo do reader](objects/e915589dca6fe5434b2924814617592fdd270f0a) e o [ACK independente de 81 verificações](objects/79ac6e4b5a9894dd68870c965d80a031788273cb) preservam o fechamento:

- Sete exports em **132 chunks**, totalizando **2.341.911 B de payload**.
- **3.158.748 B de emissão do core**, mais **2.065 B do terminal**, total de **3.160.813 B incluindo o terminal**. O main original de Actions tem **3.270.463 B**, medida distinta que inclui seu envelope.
- Inventário de **153 entradas e 153 CRCs**, em dois arquivos, com **57.674.703 B expandidos**.
- Paridades Analytics, CPU, progresso e união conferidas contra a sequência original. A união contém 97 records Analytics, três CPU e três de progresso.
- Perfil original de **2.120.673 B**, preservado integralmente em oito partes reais; collection, launcher, marcadores, resumo, inventário e receipt completam os sete exports.

A captura selecionada está vinculada a case 1/result 1/stdout, PID 3729, parent 3684 e nonce `sf613-e12-cpu-sV3cAs`. O protocolo registra amostragem de 5 ms, alvo de 50 s, janela de aceite de 55 s e estado `completed-on-time`. Os arquivos reais e os registros posteriores de fechamento sustentam `captureComplete`; o sucesso do job, isoladamente, não seria suficiente.

As populações Source, native e loop permanecem distintas. Os contadores native descrevem apenas cópias child solicitadas como `case-identities` que terminaram sua construção e validação; não incluem materializações top-level, outras classes ou cópias que falharam. Não são contagens de Requests ou casos únicos, nem permitem calcular taxa de fallback ou economia de CPU. A análise do perfil permanece descritiva, sem converter samples em duração por multiplicação pelo intervalo configurado.

Os relógios do Playwright e do sampler nativo estão preservados separadamente. Seus campos não permitem afirmar que a janela CPU coincide exclusivamente com a espera do preview. O launcher adicional `sf613-e12-cpu-9X8SQP` comprova somente preparação; seu diretório não continha profile ou collection.

## Aquisição e exclusões

A recepção revisada fez uma única aquisição do ZIP original de produtor **15229333864**, de **46.003.924 B**, com SHA256 `6c0f77340fcd26380ba32a1b9cdf7a47fb4403d4b5ba17628685cb8609f90aff`. Essa aquisição ocorreu dentro do reader e está encerrada. Este incremento utilizou somente cópias Git preservadas e metadados; não readquiriu logs originais ou ZIPs.

O artefato de auditoria **15231435395** permaneceu somente em metadados e não foi baixado. ZIPs, runtime bruto, seleção bruta, o launcher adicional e demais entradas apenas inventariadas não se tornam payloads do arquivo por serem mencionados nos recibos. O fechamento cobre o corpus enumerado e os sete exports, não o artefato inteiro. Commits, árvores e hashes de inteiros calculados não são entradas em `objects`.

## Publicação planejada deste incremento

Os três pais ordenados são:

1. Arquivo R2 publicado: `6f8690ed690b3271f312e8954c1229ac5ec07176`.
2. Focal E12 executado: `73677353c81e17ac1b80a98b066ff4c505430cde`.
3. Reader E12 executado: `428c850ffe85c2c454d43910fa9f8e7637c9bcfa`.

A fonte diagnóstica/Analytics `c061693a…` fica alcançável pelo pai do focal, e S17 permanece ancestral. A árvore própria contém somente `README.md`, `index.json` e `objects/<sha>`, com arquivos `100644`; não contém workflow nem layout executável do repositório. A raiz revisa os objetos, confere a ref atual e decide a publicação. Esta autoria produziu somente os três blobs documentais do pacote.

A cadeia anterior deve ser preservada enquanto suas evidências forem necessárias. O ledger histórico, as refs de produto e o PR #613 continuam separados. A integração em `dev` segue pelo PR revisado; produção continua dependente do aval explícito do usuário.

## README R2 completo — corte histórico preservado

<details>
<summary>Texto publicado em R2 6f8690ed; seus pais e pendências pertencem àquele corte</summary>

# Evidências do Orchestra-SF — arquivo do #613

Este segundo incremento é documental. Ele preserva os objetos do primeiro corte e acrescenta o corpus E11 enumerado, o fechamento C17 e os documentos de coordenação R7. A ref `sf613-evidence` tem árvore própria; ela não é fonte de produto, candidato de Release, instalação QA ou autorização de produção.

## Como conferir os bytes

O arquivo [index.json](index.json) enumera os blobs em `objects/<git-sha>`, com bytes, SHA256 e memberships. Para streams divididos, o índice dá a ordem das partes reais: a recomposição concatena os bytes UTF-8 sem separadores e sem normalizar BOM ou LF. Hashes de inteiros apenas calculados não são apresentados como blobs existentes.

As 83 entradas do primeiro índice permanecem com seus metadados e memberships anteriores. Novos memberships são acrescentados sem substituir os anteriores. O índice e README anteriores e o recibo de sua publicação são objetos desta proposta; o texto inicial do README está reproduzido literalmente na seção histórica ao final.

## Alcance deste incremento

| Conjunto | Evidência preservada | Limite |
|---|---|---|
| E11 | Fonte diagnóstica, focal, Analytics, leitor, sete exports completos e perfil em sete partes reais | Captura histórica da VM/PID; não demonstra custo exclusivo da requisição ou comportamento do C17 |
| C17 | Fonte e controle revisados, focal aprovado, main/cleanup atuais da Analytics e uniões reais dos marcadores e reports | O focal aprovado não qualifica o primeiro preview original |
| D26 C17 | Manifesto, bounds, derivação e revisão documental | Quatro bindings finais UNBOUND; bateria final ainda não executada |
| R7 | Status, README, execução e seus vínculos de revisão | Corte documental de 2026-11-27 às 19:08:31 UTC; não incorpora consultas externas posteriores |

O focal C17 passou 12 controles, com 1.052 assertions e oito reports. A Analytics original C17 terminou com um caso reprovado e um aprovado: o primeiro preview UI42 excedeu o waiter original de 60.000 ms em `design-wave-five-analytics.spec.ts:72:32`; UI43/UI44 não foram alcançadas. O caso BI passou no candidato C17. Esses resultados não estabelecem a causa do timeout nem uma economia causal das mudanças.

R7 mantém 12 de 15 áreas históricas e zero de cinco gates finais qualificados, em `NOT_READY`. O candidato final, seus aceites de Migração/Release, as reservas QA/G10 e a decisão de produção continuam pendentes nos respectivos campos. Cortes históricos negativos e posteriores aprovações limitadas permanecem identificados no índice e nos documentos originais.

## E11: transporte, captura e populações

O reader E11 exportou sete séries completas em 118 chunks: 2.097.711 B de payload. A emissão do core tem **2.829.285 B**; o terminal separado tem **2.065 B**, totalizando **2.831.350 B incluindo o terminal**. Esses valores não incluem os timestamps ou o envelope de logs de Actions.

As quatro paridades Analytics/CPU/progresso/união estão preservadas. A captura completa pertence à Analytics E11 `46028127606/1`: case 1/result 1/stdout, PID 3713, parent 3668, nonce `sf613-e11-cpu-RIlIZr`. O helper declara a base limpa `069a56a6…`; snapshot e run identificam a fonte instrumentada `ace9cecb…`. Essas identidades têm papéis diferentes.

O perfil é da VM/PID durante a janela recebida. Os contadores de solicitações Source e de pares de cópias nativas têm populações distintas; não devem ser pareados, subtraídos ou convertidos em taxa de fallback. Sequências CPU e progresso, streams e domínios de relógio permanecem separados. O launcher adicional demonstra somente preparação. Os hashes/CRCs documentados pelo reader não são uma nova aquisição ou inspeção do ZIP feita pelo arquivo.

Os sete payloads exportados estão completos no alcance declarado. Isso não equivale a publicar o ZIP inteiro, o runtime bruto, todos os PNGs ou todas as entradas do artefato. As exclusões e os arquivos presentes apenas no inventário estão explícitos no índice. Nenhum ZIP de auditoria foi baixado.

## Cadeia documental e execução

A publicação planejada tem cinco pais ordenados:

1. Arquivo publicado anterior `df0bd54bd624779b9d28836a8a4464dcf0a58ba3`.
2. Focal C17 `276fe1688727c5859a20cf393adc698c5c544d7d`.
3. Analytics C17 `7603f10c7d10a76f901425f659ee40448ee6cdfd`.
4. Focal E11 `3131f1766768473ed1e5cb69e97416b55a04aae4`.
5. Reader E11 `e63cffcea872aa538bc7ee1d6ed2768ecad80862`.

S17 e a fonte E11 ficam retidos pelas cadeias desses snapshots. Commits e árvores não são entradas de blob. A raiz revisa e cria a árvore documental, o commit e a atualização de ref; esta autoria produziu somente blobs. A árvore contém apenas `README.md`, `index.json` e `objects/<sha>`, com arquivos de modo `100644`, sem workflow ou layout executável do repositório.

A ref deverá ser mantida enquanto as evidências forem necessárias. Avanços preservam a cadeia anterior; não reescrevem sua história. O ledger histórico, o PR #613 e as refs de produto permanecem separados. A integração em `dev` segue pelo PR revisado e qualquer virada de produção exige o aval explícito do usuário.

## Texto do primeiro corte, preservado como histórico

<details>
<summary>README inicial publicado no commit df0bd54 — alcance e pendências daquele corte</summary>

# Evidências do Orchestra-SF — arquivo do #613

Este arquivo preserva os bytes já recebidos durante o trabalho do #613. A ref `sf613-evidence` é documental e tem árvore própria. Ela não é uma fonte de produto, candidato de Release, instalação QA ou autorização de produção.

O índice `index.json` relaciona cada objeto em `objects/<git-sha>`, seus papéis, bytes e SHA256, e a ordem das partes quando o original foi preservado em partes. Os arquivos usam os blobs originais; o arquivo não repete aquisições de Actions nem downloads de ZIP. Um hash de inteiro apenas calculado não é apresentado como blob existente.

## Alcance inicial

O primeiro corte cobre os pacotes e recibos C16, a revisão documental R5 e a rota técnica D26 incluídos no índice. O focal C16 passou em seu recorte funcional. A Analytics original C16 encerrou com uma falha no primeiro preview de portfólio e um caso de BI aprovado. O #613 continua com 12 de 15 áreas históricas; UI42–UI44 e a composição final permanecem pendentes. D26 está apenas preparado e revisado estaticamente, com bindings finais UNBOUND.

O índice distingue referências históricas de evidências efetivamente incluídas. A preservação completa de E11 será um incremento separado; a presença de um documento de análise não significa que todos os seus logs, exports ou partes do perfil já estejam nesta árvore. Os ZIPs conhecidos somente por metadados continuam sem download.

## Identidades preservadas

A fonte limpa C16 é `0860b3404ca54235997c4cdaee63bbe0659d5a7a`, árvore `194690fc63c26ac7feb690e44d0fea70742da88c`. Os snapshots executados são o focal `30890fcdcfd4e255185f443d128fe85ba21299ff` e a Analytics `dfa5cca0f7e20b92c23ea45897301c2327dc60ea`. A publicação do arquivo manterá esses commits como pais da cadeia documental, além dos blobs como entradas reais de árvore.

Esta ref deverá ser mantida enquanto as evidências forem necessárias. Atualizações avançam a mesma cadeia sem reescrever a história. O ledger histórico `sf613-ledger`, o PR #613 e as refs de produto permanecem separados. A integração em `dev` segue pelo PR revisado; qualquer virada de produção continua exigindo o aval explícito do usuário.

</details>

</details>

</details>

</details>

</details>
