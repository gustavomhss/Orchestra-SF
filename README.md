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
