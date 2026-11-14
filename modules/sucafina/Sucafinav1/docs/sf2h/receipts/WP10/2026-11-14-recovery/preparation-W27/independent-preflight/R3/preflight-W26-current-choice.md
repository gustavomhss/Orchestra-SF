# R3 — addendum preliminar: CurrentChoice e lease final no W26

**Resultado:** manter `W22-OWNER-CURRENT-CHOICE-FINAL-LEASE-01` como pendência estática do **delta PR35 retido**, com alcance explícito. A borda descrita não está instalada no W26. Não encontrei consumidor próprio de CurrentChoice nos namespaces de código completos examinados. Existe um caminho de composição próprio plausível para proteger um consumidor real de `read`, mas ele não está implementado nem provado e não fecha, por si, o contrato do produtor ou os commits de `prepare`.

Este documento é uma leitura independente focal, **PRELIMINAR / NÃO FINAL**, produzida por R3 sem autoria de produto. Não substitui uma das três revisões finais, não atribui falha a CI não executada e não concede aceite nativo ou global.

## Identidade e preservação

| Item | Identidade |
|---|---|
| Produto examinado | W26 `a1434e7ea7340aa1d1c8ce6bb48958b724218170` |
| Árvore do produto | `a9398de38c9e684d28c27b0188ab653e75bf3305` |
| Snapshot imutável usado | `publication/frozen-W26/repo` |
| Delta retido | PR35 `ec052c2c3bef96f492512f3d5f663919580f25c8` |
| Árvore da fonte retida | `ec517fa26571228bc1ce5e3698fcfc9c5d137ae3` |
| Finding original | `agents/c17/W22-owner-probe/current-choice-lease-finding.json` |
| SHA-256 do finding preservado | `4e915c18474a07eb46dd2ec62f262193c8e32fb2b5c74a8b8f553d706de16973` |

O root informou que a head da PR35 continuava nesse SHA às 17:34 UTC. Esta leitura verificou independentemente os bytes arquivados contra os blobs e SHA-256 do manifesto de obtenção da fonte imutável; não realizou nova consulta de head móvel. O working repo em evolução para W27 não foi usado para conclusões sobre W26.

Os quatro caminhos continuam separados do intake de renovação:

| Caminho relativo a `modules/sucafina/Sucafinav1/` | Blob PR35 retido | Estado no W26 |
|---|---|---|
| `product/decisions/current-choice-preview.ts` | `38f82f4b931682e255a18d52856e192f2ee43390` | Versão anterior, blob `d19f735539df9b9b4fa637367f58fa0c0b674562` |
| `test/product/wp11/current-choice-lifecycle.test.ts` | `d220c42a28e87b034ca3513aca088a0dd0db262b` | Ausente da árvore W26 |
| `test/product/wp11/current-choice-read-fence.test.ts` | `46b004a1b374229ad46077930134ba0469213087` | Ausente da árvore W26 |
| `test/product/wp11/renewal-human-choice-fixture.ts` | `3bbcabb4272ba2d083aa39b03142498178e95193` | Ausente da árvore W26 |

O arquivo `parameters.draft-W26-v2-final.json`, na seção que contém `W17-RENEWAL-TIMEOUT-AND-OMNI`, lista esses quatro paths como `held_paths`, preserva a classificação `STATIC_OWNER_OUTPUT_NOT_COMPOSED_NOT_EXECUTED_FAILURE` e associa o ID original. Seus cinco paths admitidos são `planner/port.ts`, `renewal-case-read-scope.test.ts`, `renewal-choice-fixture.ts`, `renewal-operation-verifier.ts` e `renewal-source-admission.test.ts`. O `proposal.json` e a análise de imports do probe tratam esse fechamento separado. Nenhuma seleção foi ampliada por esta revisão.

## 1. O finding aplica ao host atual W26?

**Não como borda instalada ou falha observada do W26. Sim como hipótese causal pertinente à futura composição do delta retido com a autoridade real do W26.** São afirmações diferentes e devem permanecer separadas no pacote de revisão.

Na versão W26 de `current-choice-preview.ts`, `read` está nas linhas 92–105. Depois das leituras de preferences/cases/result e de `authorizeCase`, o último `await` do caminho de sucesso é `input.host.revalidate(context)`. Em seguida o produtor retorna a cópia do binding. A versão anterior não contém o novo agrupamento final de caso, resultados e binding. Portanto, não se pode atribuir ao blob instalado o ordenamento específico questionado no delta. Tampouco se infere que a versão anterior esteja aprovada contra outras corridas de estado: esta revisão não promove o reader antigo a solução ou contraprova.

No blob PR35, a cadeia está visível em `current-choice-preview.ts`:

1. Linhas 103–114: captura o Request, revalida o host, lê binding/case/result, valida a provenance, consulta o resultado produtor, executa `verifySources` e `authorizeCase`, e revalida o host.
2. Linha 117: faz uma nova leitura de `preferences`, para reautorizar o namespace privado e conferir o binding após callbacks externos.
3. Linha 121: faz uma nova leitura C08 de `cases`, obtendo caso, os dois resultados e o binding no mesmo snapshot.
4. Linhas 122–123: compara os bytes/digests e `source.signal.aborted`, e retorna o binding. Não consulta novamente `host.requestFor(context)` nem a lease privada.

As novas cercas do produtor atendem a problemas reais de estado; a questão é que a última delas vem **depois** da última prova da lease. Não é suficiente acrescentar verificações sem preservar a relação entre autoridade e snapshot.

### Por que a autoridade C08 real não substitui a lease

Em `product/integration/ui-authority.ts`, `current()` consulta uma admissão privada no WeakMap e a invalida se houver abort ou expiração; `finish()` remove essa admissão. `requestFor()` só retorna o Request de uma admissão consumida ainda corrente. `revalidate()` confirma a identidade autorizada e volta a consultar `current()` depois de seu `await`. Encerrar essa lease não precisa alterar o objeto Request, seus headers, a autenticação geral ou os bytes persistidos.

Em `product/integration/product-authority.ts`, linhas 125–132, o autorizador passado ao C08 resolve o principal a partir do Request e do snapshot, confere namespace e, para escrita, capacidade de gravação. Ele não recebe o `TrustedDomainContext` e não consulta a admissão UI privada. O host, por sua vez, delega `requestFor` e `revalidate` à autoridade de domínio nas linhas 247–249.

Em `product/host-binding/state-provider.ts`, linhas 28–39, o C08 autoriza antes do callback, aguarda o callback, verifica abort e autoriza novamente. Essa reautorização protege principal/política/revisão de acesso do produto; não passa a consultar a lease específica da chamada por repetir o mesmo autorizador.

Assim, a condição causal do finding permanece bem fundamentada: **se a lease privada terminar durante a última leitura C08, mantendo-se válidos Request não abortado, principal e bytes persistidos, as comparações finais do blob PR35 não demonstram que essa lease sobreviveu ao último `await`.** Isso é uma observação estática com condição explícita. Não foi executado exploit, não há falha hospedada atribuída a essa condição e a revisão não afirma que ela aconteça em um consumidor W26 inexistente.

### Limite da fixture oferecida pelo produtor

`current-choice-read-fence.test.ts` usa UI admission e armazenamento reais, mas seu autorizador de `createSfProductState` inclui explicitamente `await ui.revalidate(context)` — uma composição diferente do autorizador real acima. Os dois casos de teste mudam membership ou permissão de leitura de preferences durante a autorização final, e afirmam que a lease UI continua válida. Essa fixture é relevante para as cercas que exercita; ela não prova a fronteira entre C08 e lease privada deste finding.

O teste de lifecycle fornece o novo `verifySources` obrigatório e inclui uma mudança de case durante essa verificação. Isso também não é uma contraprova de término da lease na leitura C08 final. A exigência nova de `verifySources` precisa de uma implementação real ao instanciar a factory; não deve ser satisfeita com callback permissivo para conseguir admitir o arquivo.

## 2. Existe consumidor WP10 que necessite desses quatro paths?

**Não foi encontrado consumidor nos namespaces próprios completos examinados.** A evidência é uma busca textual limitada por paths/símbolos, acompanhada de verificação dos blobs contra a árvore W26:

| Namespace | Blobs da árvore / materializados verificados | Cobertura de código |
|---|---:|---|
| `modules/sucafina/Sucafinav1/product/` | 488 / 485 | Todo o código; faltam apenas três arquivos Markdown |
| `modules/sucafina/Sucafinav1/runtime/` | 33 / 33 | Completa |
| `modules/sucafina/Sucafinav1/test/product/wp10/` | 87 / 87 | Completa |
| `apps/cli/src/sucafina-product/` | 143 / 143 | Completa |

Os 748 blobs materializados nesses grupos corresponderam à árvore. A verificação de identidade de todos esses arquivos não significa revisão comportamental integral de todos eles.

A busca por `createCurrentChoicePreview`, `verifyCurrentChoiceBinding`, `readCurrentChoiceBinding`, `createCurrentChoicePromotion`, `createCurrentPlannerChoice` e seus paths de import produziu cinco ocorrências: definições das factories/helper e o type import de promotion no preview. Não encontrou invocação/import de consumo no host próprio, módulos de produto, runtime ou testes WP10. O próprio preview, promotion e planner-current-choice continuam como produtores definidos. Os três arquivos novos de teste/fixture do cohort nem sequer existem na árvore W26.

Há 84 arquivos do CLI genérico fora de `sucafina-product` não materializados neste snapshot, e o conjunto completo de testes estrangeiros não foi hidratado para este addendum. Portanto, não se declara ausência universal de consumidores em todo o repositório. A conclusão é suficiente para distinguir o **cohort de produtor/testes independente** da composição própria e do fechamento de renovação admitido que motivou o probe.

Isso não dispensa a matriz de integração de saídas, os requisitos de jornadas completas ou os 171 critérios próprios. Se uma jornada futura exigir CurrentChoice, deverá haver um consumidor real, callbacks reais, compatibilidade da assinatura e prova do caminho que será publicado. Também não se pode promover testes do produtor a prova de consumo UI/native/MCP sem esse caminho.

## 3. Um wrapper próprio pode fechar a fronteira?

**Pode qualificar um consumidor real de leitura, em princípio. Não é necessário declarar que somente uma alteração estrangeira poderia proteger esse consumidor.** A API já disponível é suficiente para um desenho legítimo: `SfProductStatePort.read` aceita callback async; o `local-store` W26, linhas 163–198, suporta transações de leitura aninhadas no scope lexical do mesmo snapshot. A composição própria `alternative-call-scope.ts` também mostra por que manter os últimos awaits de autoridade dentro do C08, seguidos de uma checagem síncrona da chamada, é uma preocupação real no host.

Para `read`, um consumidor próprio poderia conservar o Request e contexto genuínos, executar o reader estrangeiro em um scope C08 real, realizar a revalidação final enquanto esse snapshot ainda está protegido, e verificar sincronicamente, **depois que o `state.read` inteiro resolver**, a identidade do Request/lease e todos os headers capturados, além do input/binding esperado. A última checagem precisa alcançar também a reautorização que o state-provider executa após o callback. A comparação dos headers não substitui a autenticação, a lease ou as cercas de dados; é mais uma condição de integridade da invocação.

Este é um caminho de composição, não um patch aprovado. Exige que os callbacks do reader sejam os produtores/leitores reais apropriados, sem writes indevidos no scope, sem reconstruir credenciais, sem substituir o C08 por estado fictício, sem cache entre chamadas e sem repetição/fallback de trabalho depois de uma invalidação. Não há hoje esse consumidor próprio para revisar, nem houve implementação, CI ou aceite desse desenho.

Há três limites concretos:

1. **Um `await host.revalidate` simplesmente adicionado depois da última leitura C08 não encerra toda a prova.** Ele pode corrigir a observação da lease enquanto abre nova janela para mudar o caso/binding durante esse await. A composição precisa preservar as cercas juntas.
2. **O wrapper de leitura não prova commits de `prepare`.** `prepare` chama cálculo/registro de cobertura, grava resultados e persiste binding antes do `read` de verificação. Refusar o retorno não demonstra, retroativamente, autoridade no commit. Envolver `prepare` inteiro na transação de leitura tampouco é válido: o `local-store` proíbe writes aninhados e marca o scope como inválido.
3. **Uma proteção do consumidor não altera o contrato do produtor nem protege callers sem wrapper.** Pode ser registrada como mitigação qualificada daquela rota; o finding do produtor deve conservar o alcance restante. Um wrapper sem consumidor só para satisfazer uma revisão não é evidência de integração.

A rota direta de fechamento do produtor continua sendo delta publicado pelo owner acompanhado de contraprova composta. A alternativa de composição própria é legítima para um consumidor real, desde que tenha prova suficiente e classificação explícita do que foi protegido. Em nenhuma das duas alternativas a análise estática atual substitui a contraprova.

## Contraprova necessária, sem executá-la neste addendum

O teste discriminante deve usar `createSfProductAuthority`, `createSfUiAuthority` e C08/local-store reais. Depois de um controle positivo com binding/resultados/fontes produzidos legitimamente, precisa controlar a última leitura C08 ou sua autorização real e encerrar a lease privada consumida durante esse await, mantendo a mesma sessão/ator geral, Request, headers, signal não abortado, revisão de acesso e bytes de caso/resultados/binding. Deve comprovar que não há valor protegido nem links na saída. A fixture não deve embutir `ui.revalidate` no autorizador C08 como substituição do host real.

Para um wrapper, incluir mudança de qualquer header no mesmo Request, término/expiração da lease, troca da identidade autorizada e mudanças de membership/bytes nas demais fronteiras async. Preservar os negativos de preferences, provenance e fontes; verificar isolamento por invocação, concorrência, abort e limpeza após exceção. Se a rota incluir `prepare`, a prova de commits e da projeção retornada precisa ser independente e explícita. Headers/outcomes dos arquivos completos selecionados, SHAs W/S, run/job IDs e artefatos devem acompanhar a execução hospedada do candidato exato. Este addendum não dispara CI nem transfere resultados de outro candidato.

## Alcance nos critérios e decisão recomendada

Esta análise informa `WP10.T01.QLT.01`, `WP10.T02.CHK.10`, `WP10.T02.QLT.10`, `WP10.T05.QLT.10`, `WP10.T06.CHK.04` e `WP10.SUC.10`, sem marcar qualquer critério como aceito. O pack continua contendo 171 entradas de prova e sete tasks. Permanecem as fronteiras de 128 inputs estrangeiros arquivados e 131 readonly; nenhum foi alterado.

**Disposição recomendada:** preservar o finding original e seus quatro paths retidos; explicitar que se trata de um hold de intake do produtor, não de uma falha executada de W26 nem de um requisito novo para fechar o cohort de renovação já admitido. Se CurrentChoice vier a integrar uma rota própria, escolher e provar a solução concreta no candidato publicado. Não retirar a pendência por ausência de consumidor, por wrapper hipotético, por teste que altera a autoridade de produção ou por inferência de aceite nativo/global.

## Evidências deste addendum

O arquivo `preflight-W26-current-choice.json` contém as três respostas, a cadeia causal, a disposição e os limites em formato estruturado. `preflight-W26-current-choice.sources.json` contém caminhos absolutos, blobs/SHA-256 dos arquivos lidos, os quatro arquivos do cohort, cobertura da busca, todas as ocorrências e o inventário de identidade dos 748 blobs. O finding original e os pareceres anteriores foram preservados.

Não houve edição de produto, fonte estrangeira ou intake; execução local de produto, teste/build/typecheck; mutação remota; CI; merge ou deploy. As únicas escritas são estes artefatos novos de revisão.
