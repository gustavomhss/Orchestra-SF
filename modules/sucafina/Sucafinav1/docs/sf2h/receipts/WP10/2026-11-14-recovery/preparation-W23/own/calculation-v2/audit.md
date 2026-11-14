# W23 — Planner/Atlas cálculo: candidato próprio, revisão 2

Base: `4bc9c7220f04f113609393aaba38934a7e69878b`, árvore `082b73607bea09a0a6252e2298c5a581c10cb645`. Os sete deltas próprios estão congelados neste pacote para revisão da raiz. Não houve execução local de produto, typecheck, build, publicação ou despacho CI pelo builder. Nenhum resultado W21 foi transferido para estes bytes.

## Evidência de partida

B/W21: produto `532da498e08fa36fadbd3c01e3e7da00d869dd47`, run `43605495862`, job `132479126824`: 49 passes, 30 falhas e1 erro adicional. O raw tem188901 bytes e SHA256 `37c9dad034c51ee8c0fc1ccf84639468f5d035df26f484c1272efecc7fdf14da`. Os tempos, nomes e linhas do recorte ficam em `baseline-evidence.json`.

O escopo deste builder contém11 falhas:7 no Planner cálculo,1 na ancestralidade,2 no histórico de operações e1 na seleção de caso. As duas falhas de histórico de operações permanecem pendentes de uma solução de performance segura; seus testes receberam somente fases diagnósticas.

## Correção de cálculo e seleção

`issue` antes fazia uma leitura completa de request apenas para descobrir o caso persistido. Isso entrava no result-store antes do guard próprio; a recusa de outro caso virava `scenario-request-unavailable`. A nova preseleção C08 autentica o ator e a participação no caso realmente persistido. O guard `withCalculationCase` passa a executar antes dos leitores canônicos. O teste continua exigindo `denied/calculation-case-scope-mismatch`, agora também exigindo zero leituras canônicas de resultado antes dessa recusa.

O adaptador observa os retornos reais dos dois loaders de request e dos dois loaders diretos de resultado do produtor. Os dois requests continuam contendo quatro leituras de resultado. Os dois replays financeiros canônicos continuam completos e independentes. A projeção usa clones desses retornos, sem executar novamente leitores que serviam somente para obter os mesmos dados.

A contagem estática de um resolve elegível muda de5 requests/14 results para2 requests/6 results. Uma emissão simples muda de3 requests/8 results para2 requests/6 results. Isso descreve chamadas no código; o ganho de tempo depende do CI hospedado. Não há cache de autorização, Promise, replay, falha ou resultado entre invocações.

A elegibilidade é UI e closure exclusivamente Planner record/ledger. O witness abre autorizações C08 separadas para cases e preferences, compara estado completo incluindo `__sfProductV1`, todas as fontes, principal Planner atual, dia semântico, directory e Request com todos os headers. A identidade da Request fica pinada desde antes do primeiro await, e não é repinada depois da seleção. O fence final ocorre depois do último await de `selectedCase`, ainda com o owner exato. Native e closures mistas conservam o produtor completo e as releituras finais anteriores.

## Equivalência do leitor histórico

O antigo `verifySources` do histórico chamava BCS para construir uma projeção financeira atual e então usava somente o estado fresh e a igualdade das referências. O caminho UI Planner-version agora recebe exatamente `freshRecordSources`, já empregado pelo adaptador de cálculo corrente. Seu corpo é byte igual ao W22, SHA256 `9f00ce378c07fa0af2e15498aa020e70df53c8082172642bcf8f2b51f0fe72ab`.

Esse guard chama o resolvedor real de source, que autentica o ator, observa o scope persistido e reconstrói a referência do projetor real. A comparação da referência inteira inclui a identidade da fonte, campos, período e digest da projeção. O guard também compara fences antes/depois e revalida Request/binding/autoridade. Não retorna um boolean inventado ou guardado. Os valores financeiros continuam sendo reconstruídos nos dois replays reais do produtor. Todas as leituras históricas de request/result, o original protegido, ledger, captura repetida e as duas observações de continuidade continuam presentes. Se o callback estiver ausente, o contexto for native ou os registros forem mistos, o BCS anterior permanece.

Por issue histórico record-only há6 leitores de resultado e12 verificações de fontes. Elas agora podem admitir os registros atuais diretamente, sem reconstruir12 projeções financeiras BCS usadas apenas como predicado. Essa é uma contagem estática, não uma medição W23. O histórico continua histórico e não autoriza execução fresh.

## Contraprovas e métricas

As cinco contraprovas com `applied=0` armavam o hook de `atlas.context.resolve` cedo demais. O próprio cálculo nested chamava esse método antes de concluir a prova; a assertion interna lançava antes de incrementar `applied`, e o caminho de recusa escondia a origem. O hook agora só é armado após o primeiro outbox.read canônico retornar, depois do cases.read financeiro. As assertions de uma mutação, uma prova concluída, ausência de registros e todos os fences finais permanecem. Exceções do hook são propagadas fora de recall.

O novo caso usa SQLite/C08/Planner/Atlas reais. Depois de seis leitores canônicos de resultado concluírem, ele altera os bytes persistidos de request/result/capture, um header com a sessão ainda ativa, ou termina a lease. Exige recusa sem projeção/currentRef, liberação de escopo e recuperação por nova invocação canônica. Os dados de restore vêm da leitura real do próprio fixture; nenhum positivo/capture é fabricado.

`SF_CALCULATION_RESOLUTION` e `SF_CALCULATION_ANCESTRY` contam invocações dos leitores canônicos, não commits físicos. As contagens de completude incluem chamadas que assentaram com falha. Os testes de overlap mantêm sua semântica; a métrica compartilhada do fixture não deve ser lida como perfil exclusivo de uma thread.

Todos os budgets existentes105/165 segundos cooperativos e120/180 segundos externos permanecem. Os quatro arquivos próprios completos devem continuar na seleção B. O caso novo está dentro de planner-calculation; nenhum arquivo novo de teste precisa ser acrescentado.

## Pendências explícitas

`W23-C17-RECORDED-HISTORY-PENDING-01`: o guard histórico de alternativas literais/referenciadas repete originais compartilhados, e cada BCS histórico faz a resolução mais duas provas de continuidade. Na configuração com um original no primeiro cenário e dois no segundo, o guard faz seis resoluções BCS; uma leitura completa do caso repete seus guards. O ganho da camada de cálculo não elimina esse caminho de record history. Nenhum outer readonly foi introduzido: falta demonstrar materialização prévia e elegibilidade de todas as fontes, preservar duas observações e provar corridas duráveis/autorização sob o novo lock. As fases adicionadas vão localizar o custo sem ampliar prazos ou relaxar assertions.

WP11 estrangeiro: persistência nested demorou227865,19ms contra180000ms, e sibling batch68882,38ms contra60000ms. Não houve edição de produtor/teste estrangeiro e nenhum aceite é derivado desses resultados. A raiz/S0 deve manter a pendência por owner e executar CI com a nova identidade publicada.

Typecheck e CI destes bytes ainda não foram executados. Metadados nativos continuam explicitamente não executados; não há aceite nativo/global. Este relatório é de builder e não substitui os três revisores independentes.


## Revisão 2 após leitura da raiz

O pacote `W23-calculation` original permanece byte exato; seus hashes estão registrados em `parentPackage`. `v1-to-v2.patch` contém apenas a correção de namespace, os pins históricos e sua contraprova.

A preseleção agora lê somente o resultado persistido no grant de `cases`. Depois abre um grant real de `preferences`, confere que o resultado permanece exatamente igual e que o caso, sua versão, a participação e o ator continuam válidos. Só então obtém o request. A leitura de cases deixa de servir como admissão implícita para preferences, inclusive antes do guard de escopo.

Cada resolve histórico pina a Request, o método, a URL e todos os headers antes do primeiro await. A source admission direta só executa dentro do mesmo frame histórico aberto, com verificação antes e depois do guard compartilhado, cujo corpo permanece byte igual ao W22. A contraprova adicional troca um header após uma captura protegida real e exige recusa enquanto a lease continua válida.

**Limite estático preexistente:** o `calculationProof` estrangeiro inicia duas observações históricas distintas. O novo frame próprio não cobre uma troca de header estritamente entre essas duas observações. As autorizações e comparações de binding existentes continuam; nenhuma observação foi suprimida. Não foi inventado um frame global para ligar as chamadas. Isso fica como revisão possível do owner/S0, sem alegação de breach executado ou aceite. Os limites externos próprios de `issueObserved` e `withMemoryObservation` continuam pinando seus respectivos escopos.
