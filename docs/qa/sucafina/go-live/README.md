# Preparação do go-live — retomada coordenada

**Os cinco gates finais permanecem abertos: 0/5, NOT_READY.** A execução do restante do #613 foi reassociada a um único writer, **Astra / close_pr613**, em `sf613-astra-finish`. O caminho de fechamento é **#613 qualificado e integrado → composição única e qualificação #673 → mesmo SHA/árvore com ACKs originais de Migração e Release → G05/G06 → tar G07 → G08 → G10**. A virada de produção depende do aval explícito de Gustavo após a apresentação dos recibos e da janela.

Corte documental: **2026-11-25T00:53:53Z — 24/11/2026, 21:53:53 BRT**. Dev observado: **`490a1e1352081d28c0eb22afcd05fffea8b5323f` / árvore `8980cfaa6ab8f552b31f391fa4b30df1931a0569`**, merge #717. É uma referência integrada; C/T final, ACKs, tar final e reservas continuam sem confirmação.

Fontes correntes: [coordenação](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7148515584), [atribuição do writer #613](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7148499111), [recebimento dos cinco runs](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7148592871), [revisão de composição da Migração](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7148649687), [impacto da infraestrutura](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7148613773) e [handoff operacional](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7092768151). O [status estruturado](status.json) conserva os campos finais e as observações históricas; o [registro de execução](execution-2026-11-22.md) detalha os recebimentos.

## Estado recebido

| Frente | Evidência recebida | Trabalho restante |
| --- | --- | --- |
| Dev / visual | #715, #716, #713 e #717 estão integrados, depois de #710/#714. Árvores de merge e pais foram conferidos. | Preservar essas mudanças na composição efetiva; nenhum segundo merge de #710. #718 mantém autoria própria e não entra automaticamente como gate adicional. |
| #613 — técnico | Fallback `f1ad4140…`: run45274255184, 15/15 grupos; C17 original PASS em93.964ms, limite105.000ms; Bun1.3.14. | Esse snapshot antecede a composição220. Qualificar a composição e o runtime Release efetivos, sem transferir o PASS. |
| #613 — Analytics | Fallback: run45274263652, 1/2. O primeiro preview manteve timeout original60s; BI passou. | UI42 negativa nesse snapshot; UI43/UI44 não alcançadas. Preservar a verificação completa do estado e as autorizações na correção. |
| #613 — recebimento anterior Collaboration / Reviews | Fonte220: runs45277320358 e45277324015 terminaram1/2 e2/2. Ordering45277314045 passou7/7 grupos,7DOM e9model. | Os dois snapshots browser sobrepuseram quatro helpers históricos. O negativoUI56 de10s e os positivos conservam essa origem; qualificar com helpers correntes. ZIPs/imagens desses runs não foram recebidos por completo neste corte. |
| #613 — Collaboration corrente | [Run45518709860](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7148962539), snapshot com somente request sobre220 e helpers correntes: **2/2**, sem skip/retry/flaky; ZIP140membros e HTML interno2membros com CRC íntegros; seis PNGs originais revisados. | UI56 passou em9.902ms/10.000ms, margem98ms. Preservar o ERR_ABORTED original e a ausência de causalidade; esse positivo não qualifica UI42–UI44 ou uma fonte posterior. |
| Migração / #673 | Pai `b2f97817…` preservado. Comparação estática com dev490 encontrou8 caminhos sobrepostos,2 conflitos textuais, Operations com8 casos projetados e APP-SRC280 versus276 arquivos. | Depois de #613, compor uma vez; reconciliar seleções e baselines por evidência autêntica; executar20+1 e obter ACK no C/T efetivo. |
| G05/G06/G07/G08/G10 — componentes |13 subárvores, pins e componentes essenciais permaneceram idênticos entre dev27f e dev490. A revisão leu os deltas relevantes dos consumidores. | Não repetir isoladamente CI de componentes idênticos apenas por esses merges. Executar todos os gates finais sobre o candidato e os bytes efetivos. |
| G08 — preparação administrativa | Inventário atribuído ao operador em23/11 05:24UTC:126 workflows, nenhum runner, policy17045Disabled e environment retido. | Receber decisão efetiva de disparo/revisão/configuração, reserva QA, quatro contextos Microsoft/grants, ref/tar; observar a janela e admitir o runner. |
| G10 — operação | Operador guest único preservado; inventário e staging vazio históricos recebidos. | Complemento privado de raízes/R, canal utilizável, destino independente existente e reserva dos responsáveis antes do ensaio. |

**As12 áreas históricas do #613 permanecem preservadas.** A nova autoria começa na composição `22093149a9aa7abefa7ee1dbeab14eead9984ba2` / T `9a050a3f54938876c11233557001ff6162d5b2a6`. As refs anteriores `sf613-finish`, `sf613-resume`, `sf613-composed` e o head público `sf-design-next@0a1247db…` foram preservadas durante a preparação. Ausência de run ativo no inventário não foi usada para afirmar encerramento de outra sessão; a reassociação foi explícita sob o mandato renovado.

### Precisão do harness e dos recibos

O primeiro caso Collaboration também usa `forwardOnce` indiretamente por `captureOriginalImportPreview`. A revisão inicial baseada somente nas chamadas diretas foi corrigida no recibo público, com o intake original e um adendo separado preservados. O helper histórico removia a espera pela entrega antes de `unroute`; os eventos disponíveis não estabelecem a causa do timeout posteriorUI56. A retomada conserva os helpers correntes, todos os limites e a revalidação anterior à publicação da resposta.

O intake recebeu dez logs originais e conferiu seus hashes e os três blobs de composição/revisão/recibo. Os três ZIPs antigos foram apenas enumerados; esse recebimento não é inspeção visual. Os15 grupos do técnico fallback são separados dos testes internos e dos casos browser. O recibo técnico registra78guards,825paths,40avisos,zero erros e nenhuma exceção aprovada; não foi descrito como zero findings.

### Recorte de correção UI42 e sobreposição com #718

A [revisão do componente](https://github.com/gustavomhss/Orchestra-SF/pull/718#pullrequestreview-6049865166) identificou uma lacuna na admissão de intrínsecos quando o helper de digest é carregado depois do canônico. A [rota explícita](https://github.com/gustavomhss/Orchestra-SF/pull/718#issuecomment-7148964043) atribui o algoritmo e seus seis controles ao writer do #613, com correção da admissão anterior e prova adicional antes de integrar. #718 consumirá esses dois caminhos de dev; o restante do PR continua separado.

A adaptação preserva o tuple completo do Portfolio, todas as leituras, cópias, autorizações, awaits e fences. O seletor reduzido de preferences não representa esse contrato. A proposta não é qualificação do componente nem promessa de ganho de HTTP; sua correção e utilidade serão verificadas no caller real.

## Reconciliação exigida da Migração

Os dois conflitos textuais estão em `operations-support/documents.ts` e `imports.ts`. O upload deve ter um único observador dos bytes originais, preservando as verificações de request e entrega assinada. Imports deve conservar a navegação corrente, revisão/proveniência e logout no menu nativo, o waiter original de15s armado antes do clique e as negativas401/403.

Operations terá **oito casos na união projetada: dois ancestrais, três Procurement e três acrescentados em dev**. O verificador exige o hash exato de casos; a baseline histórica de cinco não qualifica oito. Em APP-SRC, os quatro novos arquivos e os dois históricos alterados foram enumerados por árvores completas, sem remoção. Os adicionais e seus hashes precisam de conciliação antes da execução; `PENDING` sozinho não admite novas folhas. São inventários estáticos, não resultados de testes.

O20+1 permanece como topologia de execução. Os testes CLI/Client do #713 e browser do #717 que ficam fora dessas seleções mantêm recibos próprios explícitos. Nenhum verificador, assertion, deadline ou condição de aprovação será reduzido para acomodar o inventário.

## Entradas operacionais ainda necessárias

1. **Integração / Migração / Release:** candidato efetivo, dois ACKs originais no mesmo SHA/árvore e tar Linux original verificado. O pacote será usado sem reconstrução entre G07, G08 e G10.
2. **Owner / coordenação G08:** identidade real de dispatch, responsável pela revisão e configuração de retenção admitida para a janela. O environment observado tem reviewer `gustavomhss`, prevenção de autoaprovação e bypass administrativo desabilitado; essa configuração permanece como observada até uma decisão admitida. O contrato não cria automaticamente a obrigação de cadastrar outro humano GitHub, e apps instalados não são atores independentes automaticamente admitidos.
3. **Entra / QA:** quatro contextos Microsoft e grants reais, responsáveis e reserva confirmada. A preparação administrativa não preenche essa reserva.
4. **Executor guest / recuperação:** reconciliar executable/cwd/current e R; confirmar canal privado, destino independente autorizado, responsáveis por execução/chaves/backup/observação e janela. O staging vazio não é backup ou restore.

O host `orchsf-vm` já está autorizado para a sequência instalada. A execução preserva o piloto e suas evidências, com G10 depois de G08. Claw, a outra VM e a rede compartilhada permanecem fora dessas mudanças; nenhuma nova VM é solicitada por esta retomada. G08/G10 seguem sem execução operacional admitida.

## Histórico preservado

A edição abaixo registra o corte anterior. Suas indicações de writer, head corrente e pendência refletem aquele momento; a retomada acima é a referência desta edição.

<details>
<summary>Edição integral anterior — corte2026-11-23T03:38:53Z</summary>

# Preparação do go-live — G05, G06, G07, G08 e G10

**#710 já está integrado em dev; a próxima composição é a do #613 existente. Os cinco gates finais permanecem abertos: 0/5, NOT_READY.** A rota corrente é **dev com #710 → composição e qualificação de #613 → #673 e qualificação integrada 20+1 → C/T e ACKs de Migração/Release → G05/G06 → G07 → G08 → G10**. A virada para produção continua dependendo do aval explícito de Gustavo, depois dos recibos finais e da janela proposta.

Corte desta edição: **2026-11-23T03:38:53Z (2026-11-23 00:38:53 BRT, America/Sao_Paulo)**. Base documental observada: **dev `65349c1c723a8c626135d5b8032b929f5c635193` / árvore `bd8c4a150de292a5cffbf394f33ebf70c2de7a75`**. Essa identidade documenta o merge recebido; **não é um candidato final admitido**.

O [registro estruturado](status.json) mantém o estado por gate. O [registro de execução](execution-2026-11-22.md) preserva os recibos e negativos de cada fonte. O [runbook instalado de G08](g08-installed-execution.md) continua sendo a rota executável. A [reconciliação corrente](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7090716635) substitui a sequência anterior #613 → #710 → #673; o conteúdo integral da edição anterior está conservado no histórico ao fim deste documento.

## Estado recebido neste corte

| Frente | Evidência recebida e seu alcance | Pendência correspondente |
| --- | --- | --- |
| Visual / #710 | [Merge recebido em dev65349c1c](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7090716635), árvore idêntica à fonte `7c2338ac8bb6569fa39ed99b665a61d067f8cd07`. Os recibos Finance7/Gate7/Matrix8 conservam suas fontes e limites; Gate8 e a [revisão documental dos 40 blobs / 32 cotejos](https://github.com/gustavomhss/Orchestra-SF/pull/710#issuecomment-7090771779) foram recebidos, sem novo finding documental. | #613 deve consumir esse dev e preservar WaveFive, regra `hidden`, autoridade, Core e o helper completo de instalação. Não reaplicar #710 por outro merge ou cherry-pick. |
| Design / #613 — técnico | [T6 45094264994](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7089501847), snapshot filho de C `9ea73455`: **14/15 grupos**, C17 original FAIL em **105.010,31 ms**, limite cooperativo de 105.000 ms preservado. | Outer completou 1.952/1.952 leituras, mas ancestralidade abortou; ciclo, recuperação e revogação não foram alcançados. O negativo continua aberto. |
| Design / #613 — jornadas | [A5/C5/R5](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7089198679), snapshots filhos de C `f8aa661a`: **5/6 casos** (1/2, 2/2, 2/2). | UI42 falha no primeiro preview de 60 s; UI43/UI44 não foram alcançadas. As 12 áreas históricas permanecem preservadas. Os positivos de colaboração e reviews não incluem Apply, publicação de relatório ou G08. |
| Runtime Release | [Rel2 45092308693](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7089198679), snapshot filho de C `e9ef6219`: **Bun 1.4.1 / 4661e494… observado**, cinco grupos PASS; C17 original PASS em **80.937,47 ms**, com ancestralidade, ciclo, recuperação e revogação completos. | É prova real desse snapshot/runtime. Não qualifica C9ea, o candidato final, o tar ou a campanha técnica completa; não apaga Rel1 nem T6 negativos. Os 13 controles de clone nativo não foram selecionados; os três controles Release verificaram o fallback declarado. |
| Diagnósticos de preview / BI | [P8 45094860681](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7089574685): **0/2**, UI42 timeout e BI ERR_ABORTED. [P9 45098241651](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7089925997): **1/2**, UI42 timeout e BI PASS diagnóstico. Ambos são filhos de C9ea. | UI43/UI44 continuam não alcançadas. P9 não explica retroativamente o abort de P8. Amostras JSC e durações inclusivas não são CPU, frequência total ou qualificação do produto sem instrumentação. |
| P10 | [45104292101](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45104292101), snapshot diagnóstico filho de C9ea: [intake completo](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7090892583), **1 FAIL + 1 PASS**. UI42 expira em 60.009 ms; BI PASS diagnóstico em 47.630 ms. | UI43/UI44 não foram alcançadas. Contadores de processo e volumes UTF-16 repetidos não identificam causa ou tempo de CPU; o resultado não qualifica C9ea nem dev653. |
| Migração / #673 | [Pai b2f congelado](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7090724075), sem nova composição desta frente. Históricos e negativos recebidos permanecem válidos apenas em seus escopos. | Após #613, revalidar as seis uniões e executar os 20 jobs A2 mais um suplemento de quatro invocações originais, incluindo Reports 11 e pool. SF, Decisions e APP-SRC ainda dependem de baselines autênticas do candidato. |
| Guest / recuperação | [Relato original do Codex local](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7089930087) e [recebimento da coordenação](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7090005587): censo guest e staging vazio `0700`, três instalações/raízes a reconciliar. | Sem backup, instalação, corte, restore ou reserva exclusiva. Canal privado e destino independente efetivo continuam pendentes. O host existente está autorizado; esta rota não exige comprar outra VM. |
| Admissão administrativa G08 | [Canário PASS → BLOCKED → PASS](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7090538457) corrobora path/evento. [Environment persistido](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7090652467), ID `28206052143`. | Policy 17045 permanece Disabled. Environment é retenção administrativa, não reserva ou aceite. Ref final, ator/revisor efetivos, policies, filas/reruns e runner aguardam admissão. |

**C/T de fonte, C/T de snapshot executado e C/T final são identidades distintas.** Os runs acima não executaram um candidato final literal. A prova real de Rel2 substitui a antiga pendência genérica de observar Bun 1.4.1; permanece a obrigação de qualificar o runtime, a composição e os bytes efetivos da entrega final. Nenhuma comparação de duração entre fontes/runners demonstra causa ou ganho estável.

No [checkpoint do writer](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7090828294), a união com dev653 e uma proposta de comparação de texto no SQLite ainda estavam em preparação, sem novo commit de produto. O owner descartou a tentativa de Stats. São decisões e inventários relatados pelo responsável; o delta SQL, sua preservação de SELECT fresco e a composição efetiva ainda precisam de revisão e prova. O [intake independente de P10/stat1–4](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7090892583) conserva os limites e todos os negativos.

## Caminho único de integração

A [rota canônica](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7090716635), o [handoff de #613](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7090723861) e o [handoff de #673](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7090724075) fixam esta sequência:

1. **Consumir o dev com #710 no #613 existente.** `sf613-finish` permanece o único writer de Design/performance/Core/workspace. Preservar as admissões WaveFive, a regra `hidden`, contratos, autoridade e instalação, conforme a [revisão de composição 6015669302](https://github.com/gustavomhss/Orchestra-SF/pull/710#pullrequestreview-6015669302). Os recibos visuais recebidos não substituem a prova dessa união. Gate8 técnico de #710 não é o gate instalado G08.
2. **Qualificar e integrar #613 por revisão independente e CI no head efetivo.** Fechar o C17 original e UI42–UI44, preservar os oráculos das áreas já qualificadas e vincular a prova ao checkout realmente executado. O prazo original de preview de 60 s e o de C17 de 105 s permanecem.
3. **Compor esse dev uma única vez no #673.** O pai `b2f97817a82dc55a66298428107c30d5e3d97354` / T `289fd8ac1792a103bfea3e57ce9c8c4283cc6b92` permanece congelado até essa etapa. Revalidar as seis uniões, os 20 jobs A2 e o suplemento original de quatro invocações, Reports 11 e pool, com baselines e ACKs vinculados ao candidato executado.

#713 continua um recorte separado e não é acrescentado automaticamente aos gates. Seus hunks compartilhados consomem #710 pelo dev. A campanha visual opt-in de 420 s não substitui os prazos canônicos de 210/180 s. Um novo baseline ou uma nova composição muda o candidato e exige a respectiva prova.

## Host autorizado, preparação recebida e reservas pendentes

**Codex local permanece o único executor guest; Astra coordena a integração, a admissão e o recebimento.** A inspeção original foi uma janela de coleta, não uma reserva exclusiva de QA ou recuperação. Executável ativo, diretório de trabalho e `current` representam três instalações distintas: o operador deve reconciliar privadamente as raízes reais do piloto, seus dados/configuração e o R retido antes de intervir.

O staging criado é vazio, root-owned `0700`, fora das raízes de estado/configuração e em dispositivo distinto do estado. Isso não é backup consistente, cópia independente, reserva de capacidade ou prova de restore. Os quatro hashes do censo/preparo são referências privadas relatadas pelo operador; o recebimento público não afirma rehash de bytes que não foram entregues nesse canal.

TCP/22 do Mac expirou; autenticação SSH/SFTP ficou NOT_RUN. A listagem de contêineres Blob funcionou, mas as leituras de objetos foram recusadas. Continuam pendentes um canal privado efetivamente utilizável, o destino independente autorizado e sua identidade/custódia/capacidade/isolamento observados. O adaptador atual `verify-clone` exige destino Azure distinto; a opção Linux local mencionada pelo operador ainda requer admissão e recibo próprios. **Não há nova solicitação de VM, cota ou orçamento.** Piloto, Claw e recursos fora do recorte permanecem preservados.

### Environment e janela G08

O [operador autenticado confirmou por releitura](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7090652467) o environment **g08-isolated-qa / 28206052143**, com reviewer proprietário `gustavomhss`, **Prevent self-review habilitado**, **bypass administrativo desabilitado** e **zero secrets/variables**. **Deployment branches and tags continua No restriction.** A antiga observação de environment 404 pertence ao censo anterior e não é a situação corrente.

Essa configuração retém a execução para revisão; não é reserva, autorização operacional ou prova de isolamento de todos os workflows. O par efetivo ator de disparo/revisor autorizado ainda precisa ser definido, pois o mesmo login não pode aprovar o próprio run sob a proteção escolhida. Nenhum runner foi registrado por essa preparação.

O [canário original](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7090426254) e o [intake independente](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7090538457) comprovam somente o recorte de path/evento; **policy 17045 está Disabled**. Após C/T, ACKs e G07, a janela deve receber o inventário administrativo completo, a desativação dos workflows não admitidos, o tratamento separado das filas/runs existentes e as restrições efetivas de ator/evento/ref antes de admitir o runner. Disabled impede novos disparos e reruns, mas não cancela runs já existentes. Labels, environment ou JIT não são presumidos como ACL de SHA/job. O plano ainda não foi aplicado.

## Donos e liberações concretas

| Recorte | Responsável e próxima entrega |
| --- | --- |
| Integração final, Release e gates | Astra: compor os PRs revisados, vincular C/T, receber os dois ACKs e os recibos do mesmo tar. |
| Design / #613 | Writer `sf613-finish`: união com dev653, C17 original, UI42–UI44 e preservação dos contratos/oráculos. |
| Migração / #673 | Writer existente de Migração: receber o dev após #613, qualificar 20+1/Reports/pool e confirmar C/T. |
| Guest, origem e recuperação | Codex local: reconciliar as três instalações e obter o canal/destino independente, com chave, responsável e observador vinculados à reserva. |
| Preparação administrativa G08 | Frente Preparação/publicação e Owner autorizado: readback de ref/policies/filas/runner e definição efetiva de ator/revisor da janela. |
| QA / Entra | Responsáveis a confirmar na reserva: identidades Microsoft reais, grants e contextos exigidos, incluindo readonly empresarial e admin sem Team nos seus usos próprios. |
| Produção | Gustavo: decisão explícita sobre go/no-go e janela, somente após os gates comprovados. |

Revisões técnicas e COMMENTs de assistentes na conta compartilhada não são aceites humanos presumidos. Os registros encerrados de #349/#588 e G09/#647 permanecem preservados. Compras 222 (2) conserva seu aceite 4/4 no QA original, sem transferência de candidato/tar; o backlink para vínculo adicional continua pendente.

## Gates finais e sequência de fechamento

| Gate | Estado | Evidência ainda necessária |
| --- | --- | --- |
| G05 | NOT_RUN no candidato final | HTTP e isolamento Teams completos no C/T confirmado. |
| G06 | NOT_RUN no candidato final | Importação privada Microsoft com ClamAV no mesmo candidato. |
| G07 | NOT_RUN para o tar final | Produção e verificação dos bytes Linux pela rota original, com artefato/manifesto/recibos e ACKs vinculados ao C/T final. Rel2 é prova de runtime, não esse tar. |
| G08 | NOT_RUN | Reserva exclusiva, contexto Microsoft real e 99 obrigações em 11 invocações, mais agregação e cleanup, usando exatamente o tar verificado em G07. |
| G10 | NOT_RUN | Após preservar G08, checkpoint lógico, backup original, corte ensaiado, restore independente, restart, retry e rollback, com R e os mesmos bytes de C admitidos. |

As 99 obrigações de G08 permanecem: Teams 9, U15 6, U39 22, U40 22, F04 3 e AZ02 37 (16/14/2/2/2/1). Inventário e controles de componente não equivalem à execução instalada.

Depois da integração de #613 e #673, confirmar **Migração e Release no mesmo SHA e árvore**, registrar os ACKs originais e executar G05/G06. Produzir e verificar G07 uma vez; usar os mesmos bytes em G08 e G10. G08 ocorre no host existente autorizado; sua evidência deve ser preservada antes de G10. Receber cada run, artefato, recibo e cleanup e, então, apresentar o go/no-go e a janela para decisão explícita de Gustavo.

**0/5 gates finais; NOT_READY.** C/T final, dois ACKs finais, tar final verificado, reservas confirmadas, aceites instalados, janela e decisão de produção permanecem ausentes/nulos. Esta atualização é documental: não instala runner, altera host, concede grants ou executa qualquer gate.

## Histórico preservado

A edição abaixo é mantida integralmente como documento do corte **2026-11-23T00:31:28Z**, anterior ao merge de #710 e aos recibos T6/Rel2/P8/P9/P10 e à criação do environment. Expressões como “rota corrente”, “pendente” e “neste corte” dentro desse bloco têm aquela referência temporal. Para o estado atual, prevalecem as seções acima; nenhum resultado anterior foi apagado.

<details>
<summary>Conteúdo integral da edição anterior — corte 2026-11-23T00:31:28Z</summary>

# Preparação do go-live — G05, G06, G07, G08 e G10

**#709 e #711 estão integrados como preparação de componentes; `orchsf-vm` existente está autorizado para os ensaios. Os cinco gates finais continuam abertos.** A rota é #613 → #710 → #673, seguida de C/T e ACKs, G05/G06/G07 em Actions, G08 na VM atual e G10 no mesmo host após preservar a evidência de G08. Faltam a qualificação do candidato efetivo, o tar verificado e os recibos instalados.

Observação desta edição: **2026-11-23T00:31:28Z (22/11/2026, 21:31:28 em America/Sao_Paulo)**. Último dev observado: `9d322c5d461942eba5948325ec8a73185ec8a432`, árvore `2ec90090b0b9cf0b7061e0029f1bc8fdc92536d8`. Os cortes anteriores de #704/#707 e todos os seus recibos permanecem no histórico. Essa identidade **não é o candidato final confirmado**.

O [registro estruturado](status.json) contém dono, SHA/árvore, artefato, recibo e bloqueio por gate. O [registro de execução](execution-2026-11-22.md) conserva os resultados anteriores, inclusive tentativas negativas, e separa cada prova por fonte. O [runbook instalado de G08](g08-installed-execution.md) descreve a rota concreta entregue pela #698.

## Estado recebido neste corte

| Frente | Resultado recebido | Consequência |
| --- | --- | --- |
| Azure / host existente | O [inventário ARM 45061014414](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45061014414) e a [orientação Owner posterior](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7088154702) têm escopos separados | Uso de `orchsf-vm` autorizado; reserva, runner e contextos Microsoft ainda precisam ser materializados. O registro ARM original continua sem observação guest. |
| Processo G08 | [#705](https://github.com/gustavomhss/Orchestra-SF/pull/705), merge `08e05d9`; [45066918996](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45066918996): 498/498, guards e spawn-imports PASS | Componente integrado, árvore idêntica à fonte revisada; não executou G08 instalado. #706 foi encerrado por sobreposição. |
| Perfis de infraestrutura #709 | [61/61 controles](https://github.com/gustavomhss/Orchestra-SF/pull/709#pullrequestreview-6015029109), merge `08c96c5d`; quatro avisos de harness preservados | Preparação integrada; os perfis opcionais não serão aplicados à rede compartilhada atual. Não houve apply Azure por esse CI. |
| Origem existente #711 | [23/23 controles e readback independente](https://github.com/gustavomhss/Orchestra-SF/pull/711#issuecomment-7088167078), merge `9d322c5d`, mesma árvore da fonte testada | `disposable:false` pode representar a origem existente; classe FILESYSTEM_COMPONENT_CONTROLS, sem restore do backup original nem qualificação instalada. |
| Design/#613 | [T4 em C6e: 14/15, C17 negativo](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7087939493); [A4 em C757: 5/6 instalado](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7087702050); P5/P6 são diagnósticos | UI42 ainda expira no primeiro preview; UI43/UI44 não foram alcançadas. Head público 0a/draft e 12 aceites históricos preservados. e1c4 recebeu aceite estático de BI, com runtime pendente. |
| Visual/#710 | Head revisado `744d24f2` e [finding UI41](https://github.com/gustavomhss/Orchestra-SF/pull/710#pullrequestreview-6015334664) | Conciliar sobre o Design aprovado, preservar o oráculo de estado vazio e os hunks da Migração; nenhuma qualificação combinada recebida. |
| Migração/#673 | Pai `b2f97817` / T `289fd8ac` congelado e revisado; sem CI isolado | SF, Decisions e APP-SRC exigem baselines reais. Os intakes negativos 45059200284 e 45062218008 foram recebidos integralmente, sem transferência de PASS. |

A [correção BI e1c4](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7088302107), árvore `e0c1c280`, recebeu revisão estática: conclusão/falha da mesma Request e precedência de erro em detach foram reparadas, sem novo GET ou mudança de tolerância/prazo. A execução com `original-request-completed` e os oráculos continua pendente. A prova real no runtime Release **Bun 1.4.1 / 4661e494f…** também falta; o Bun 1.3.14 dos focais não a substitui.

Os [diagnósticos P5](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7088008968) e [P6](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7088329867) executaram snapshots instrumentados filhos de C6e, com `qualification:false`. C17 completou nesses snapshots; UI42 permaneceu negativa no waiter original de 60 s. Amostragem periódica com overflow não mede CPU, frequência total ou tempo por caller. Nenhum PASS apaga T4 ou qualifica e1c4, Bun 1.4.1 ou o tar.

### Prova histórica do corte #707

O [intake independente de 44e](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7085714579) identifica cada snapshot realmente executado, os oito jobs/cleanups e os três ZIPs originais. C17 original concluiu em **104.187,50 ms / 105.000 ms**, com 812,5 ms de margem; isso não demonstra ganho estável nem qualifica a variante diferente da Migração. O [finding BI06](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7085742679) exige capturar os bytes do mesmo evento, mantendo a tolerância `1e-5`; os dois corpos e os instantes originais não foram preservados. A causa da diferença não foi atribuída ao clone ou ao arredondamento.

### Rota corrente de integração e execução

A [sequência vigente](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7088139499) é **#613 → #710 → #673**. O writer `sf613-finish` conserva Design/Core; o writer visual reconcilia #710 sobre o Design aprovado, incluindo o finding UI41, e Migração incorpora o dev resultante no próprio #673. Os [limites de composição](https://github.com/gustavomhss/Orchestra-SF/pull/710#issuecomment-7088132472) e o [handoff de Migração](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7088139755) preservam as seis uniões preparadas, os 20 jobs A2 e um job suplementar com quatro invocações originais. Os 11 Reports e o pool originais continuam obrigatórios; atualizar baselines muda o candidato e exige sua qualificação própria. A campanha visual opt-in de 420 s não substitui os prazos canônicos de 210/180 s.

**Uso do host autorizado; reservas operacionais ainda não confirmadas.** A [orientação vigente](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7088154702) retira as propostas de duas/três VMs extras, aumento de cota e orçamento de USD 300. Antes de substituir o piloto em `orchsf-vm`, preservar dados, configuração, instalação e evidências; Claw e a outra VM ficam fora das alterações. G08 requer reserva/IMDS/janela, runner/environment/private_root e quatro contextos Microsoft reais. G10 ocorre depois de preservar G08 e ainda depende de [inventário do canal privado e da capacidade de recuperação independente do backup original](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7088112697), além de chave, responsáveis, observador e R instalado/retido. Não se presume ausência de SSH/SFTP/Blob nem necessidade de outra VM.

No [checkpoint de acesso recebido](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7088172949), duas reconexões do browser não retornaram documentação/estado e foram interrompidas. Isso não revoga o login ou a autorização Azure anteriores. Esta edição não antecipa resultado de tentativas posteriores.

Nenhum tar novo, ACK final, reserva confirmada, aceite instalado ou decisão de produção foi criado neste corte. Os registros encerrados de #349/#588 e do escopo técnico G09/#647 permanecem preservados.

## Donos e mandato

| Recorte | Dono e responsabilidade |
| --- | --- |
| Integração e G05/G06/G07/G08/G10 | Astra go-live: preparação, integração revisada, coordenação e execução da frente |
| G01–G04 e pool | Writer `focal_migration`, [#673](https://github.com/gustavomhss/Orchestra-SF/pull/673), preservado sob a coordenação |
| Release e G07 | Astra go-live, mandato de coordenação/execução já registrado em [#657](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7080753498) e [#247](https://github.com/gustavomhss/Orchestra-SF/pull/247#issuecomment-7080852007); B vinculará C/T, ACKs e ator GitHub efetivo |
| UI42/UI43/UI44 e design | Frente existente [#613](https://github.com/gustavomhss/Orchestra-SF/pull/613), ainda 12/15 áreas qualificadas |
| QA/Entra/host | Astra coordena no host existente autorizado; reserva, runner e contextos Microsoft originais ainda precisam ser vinculados |
| Recuperação/backup/chave/observador | Astra conduz G10 depois de G08; canal privado/destino independente do backup original, reserva, chave e observador continuam pendentes |
| Compras 222 (2) | Aceite4/4 preservado no QA original, sem transferência para outro candidato ou tar |
| #349, G09 e #588 | Permanecem com os responsáveis de suas frentes, conforme o mandato original |

A revisão técnica por assistentes e os COMMENTs da conta compartilhada são identificados como tal. Não representam aceite humano presumido. O papel `recovery` continua pertencendo a G10. A produção exige aprovação específica da janela e decisão go/no-go.

## Integrações recebidas nesta etapa

| Entrega | Merge em dev | Evidência da fonte qualificada |
| --- | --- | --- |
| [#693](https://github.com/gustavomhss/Orchestra-SF/pull/693) — CAP03 reader/Client/factory | `70e3228cf2db` | [45051010616](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051010616): 67 Bun; controles de componente |
| [#691](https://github.com/gustavomhss/Orchestra-SF/pull/691) — CAP03 UI e View source | `7e3e5e2bfd24` | [45050299263](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45050299263): 79 Bun; controles de componente |
| [#694](https://github.com/gustavomhss/Orchestra-SF/pull/694) — 50 jornadas nativas e F04 | `9804ee308485` | [45051200489](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051200489): 40 Node + 25 Bun; controles de componente |
| [#697](https://github.com/gustavomhss/Orchestra-SF/pull/697) — Observador original de restart | `19fbe6542cdc` | [45052572893](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45052572893): 42 Node + 49 Python; controles de componente |
| [#700](https://github.com/gustavomhss/Orchestra-SF/pull/700) — Registro Microsoft e rota Edit | `327e95d552fa` | [45055263348](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055263348): 40 Node + 42 Bun + 21 DOM; controles de componente |
| [#701](https://github.com/gustavomhss/Orchestra-SF/pull/701) — Origem dos produtores e autorização | `5cf8419032b5` | [45055493019](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055493019): 128 Bun; controles de componente |
| [#699](https://github.com/gustavomhss/Orchestra-SF/pull/699) — Recusa JSON e lifecycle nativo | `47fa6b594ce9` | [45055028234](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055028234): 40 Node + 54 Bun; controles de componente |
| [#698](https://github.com/gustavomhss/Orchestra-SF/pull/698) — Coordenador e agregador completo | `b7776698e619` | [45055970646](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055970646): 254 Node + 5 Bun; controles de componente |

A #699 foi entregue e integrada por seu writer existente. O readback confirmou seus hunks de runtime completos junto ao `Pick<NativeManifest, "target">` da #700; os outros24 blobs da #700 e o manifesto histórico v2 foram preservados. O merge da #698 não altera esses paths.

As contagens acima não devem ser somadas como prova de um candidato final. #691 foi qualificada numa composição explícita com o Client da #693. #698 foi qualificada com #700/#701 já integradas e também fez o parser real de proveniência validar seu YAML real. Nenhum desses runs executou a homologação instalada.

As entregas anteriores #665/#677/#685/#688/#689/#690/#692/#695 e seus recibos permanecem no ledger. As fronteiras HTTP já corrigidas, a política persistente corrente, Imports privados, decoder/checkpoint e a rota de release não são pendências de implementação.

## Corte histórico após o #702 — 19:18:45 UTC

O [#703](https://github.com/gustavomhss/Orchestra-SF/pull/703) resolveu a admissão do próprio agregador G08. O merge `f5132fabfa265ba6bef17b0e0aa2ebe2c2beafdc` conserva exatamente a árvore `4462e8f53b3fca019d9c5f5fbbf71cb4c04f56b4` da fonte revisada. O [focal 45058460020](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45058460020) passou **490/490 controles** e os guards; ZIP, CRC, relatórios e fontes foram conferidos. A agregação continua retrospectiva: observa seu checkout e job atuais e relê as onze provas originais, sem exigir nova reserva ativa para essa leitura. Isso não executa nem fecha G08 instalado.

O [seletivo do #613](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7084208298) terminou **7/8**, na fonte separada `a7b4281`. O C17 original completou todas as fases em **101,270 s**, dentro dos 105 s; o controle de carregamento de módulo falhou porque o import com query reutilizou o export. A [revisão independente](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7084196985) encontrou ainda possível aceitação indevida sob um hook stateful anterior ao helper. A fonte permanece bloqueada para promoção. O head do #613 continua `0a1247d`, **12/15 áreas**, com UI42–UI44 pendentes na instalação.

A Migração mantém como último focal recebido o 9612, com Decisions **3/5**. As correções de tipos e do observador foram revisadas estaticamente no head `44334fe`; o [run diagnóstico 45059200284](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45059200284) foi iniciado sobre um snapshot separado, e seu resultado ainda não foi recebido nesta observação. Os cinco casos, os prazos originais e retries zero permanecem. Reports conserva os **11 oráculos originais** reutilizáveis, mas seus consumidores mudaram: os 11 casos precisam de replay no candidato efetivo após a composição, incluindo #613.

O primeiro head documental do #704 (`21d43e8`) recebeu revisão e [guards verdes](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45059194082), mas se sobrepôs ao #702 integrado. Esse resultado fica histórico. Esta composição preserva o #702 e exige revisão e CI próprios. C/T final, ACKs, tar, reservas e aceites continuam nulos; **0/5, NOT_READY**, sem decisão de produção.

## Estado por gate

| Gate | Dono | Entrega disponível | C/T, artefato e recibo finais | Bloqueio para fechamento |
| --- | --- | --- | --- | --- |
| [G05](g05-g06-controls.md) | Astra go-live | HTTP/SQLite reais, isolamento por Team, fronteiras Web e CAP03 readonly integrados; recibos de componente preservados | Nulos | Composição final e replay completo coverage/auth/effect/HTTP/isolamento no mesmo C/T |
| [G06](g05-g06-controls.md) | Astra go-live | ClamD real e16 casos selecionados no B4, Imports privados e política corrente integrados | Nulos | Reexecução completa no C/T final, com payloads, efeitos, armazenamento e cleanup observados |
| [G07](g07-linux-package.md) | Astra go-live | Verificador e rota #668 entregues: B distinto de C, dois ACKs antes do produtor, Q posterior | Nulos | C/T confirmado e ACKs; prova no Bun 1.4.1 real; gerar/verificar o tar original com proveniência e operador vinculados |
| [G08](g08-teams-qa.md) | Astra go-live | Executor completo:99 obrigações em11 invocações, registro/observador/proveniência/agregador; host existente autorizado | Nulos | Mesmo tar G07, reserva/IMDS/janela e runner admitidos, Microsoft real, produtores completos e recibo agregado |
| [G10](g10-cutover-rollback.md) | Astra go-live | Backup/clone, decoder, política corrente e #711 para a origem existente | Nulos | Depois de preservar G08: R retido/compatível, backup original em rota privada independente, chave, observador e ensaio de corte/restore/restart/retry/rollback |

G08 exige **Teams 9 + U15(6) + U39(22) + U40(22) + F04(3) + AZ02(37)**. AZ02 conserva32 IDs históricos e cinco adições, em fases 16/14/2/2/2/1; não é uma suíte Playwright. F04 é Bun/HappyDOM em processo separado após o registro. Todas as99 obrigações permanecem **NOT_RUN na instalação**.

## Migração e design: provas anteriores preservadas

As provas desta seção pertencem ao corte anterior do #702. O seletivo a7 e o diagnóstico posterior estão discriminados acima; nenhum resultado é transferido entre fontes.

A [#673](https://github.com/gustavomhss/Orchestra-SF/pull/673) compôs dev19fbe e teardown no head `9612e7db0319c41ea0161e3924f332d9d76b0f9b`, T `b1dc4bdc3b4a73667e9ee8011667616565d2f9bc`. O [run 45055109181](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055109181) terminou com Decisions 3/5 (dois timeouts originais de 180 s) e dois diagnósticos na inclusão E2E: resultado de page.route incompatível com Promise<void> e declaração original de Window.api fora do tsconfig SF. A recepção independente conferiu os quatro ZIPs e delimitou os reparos para o writer da Migração. Os guards preservam47/69 avisos nas duas bases. #699/#700 não corrigem esses dois paths. Nenhum resultado parcial é promovido a ACK final.

**Operations 5/5 já foi recebido** no [focal45051170458](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051170458), fonte bf1c680, conforme [recibo original](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7083227030). SF4 97/97, SF5 156/156 e SF8 140/140 do c9a9b0 continuam históricos. O pool 209/209 do diagnóstico não substitui o replay original sem overlay na composição final. Reports 11/11 continua restrito à fonte e aos consumidores em que foi produzido.

A [#613](https://github.com/gustavomhss/Orchestra-SF/pull/613) continua 12/15. O focal 255c35c6 recebeu 8/10; a correção exclusiva do driver de tipos passou 3/3 em [45054387720](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45054387720), enquanto C17 / 105 s permanece aberto. O diagnóstico CPU [45054997790](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45054997790) falhou, com cleanup SUCCESS, e publicou o artefato 14766639145. Sua metadata não qualifica o perfil ou o produto. A ausência de artefato registrada anteriormente pertence ao coletor cancelado 45045175421, preservado no histórico.

## Acesso operacional no corte anterior — histórico

O bloqueio descrito nesta seção pertence ao corte anterior. O inventário 45061014414 o resolveu; as pendências atuais de reserva e acesso estão no início deste documento.

A repetição somente leitura do [inventário 45036787201, tentativa 2](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45036787201/attempts/2), concluída às 15:49:43 em São Paulo, confirmou o bloqueio antes do login: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` e `AZURE_RESOURCE_GROUP` chegaram vazias no contexto `azure-mvp`. Login e comandos ARM ficaram SKIPPED. O artefato 14766939588 (876 bytes) foi adquirido e conferido; receipt `ee9d5d941754ae9da9804e2fa569ef89712a8aafa7ee7f64a4189b276dc02de5`. A tentativa 1 das 15:10UTC permanece histórica. A nova leitura de dispositivos também encontrou o Mac offline, visto pela última vez há110 h; não há acesso operacional estabelecido por esse canal.

| Entrada necessária | Responsabilidade pela disponibilização | Próxima ação da frente |
| --- | --- | --- |
| Configuração existente de Azure no contexto correto | Administrador do repositório/environment | Repetir inventário somente leitura e registrar os recursos realmente observados |
| Host/runner QA e contextos Microsoft | Operador do ambiente e responsável Entra | Registrar reserva e autorizações; executar os11 produtores originais de G08 |
| Host/clone de recuperação, backup/chave e observador | Responsáveis operacionais desses recursos | Executar G10 e medir RPO/RTO, mantendo o registro externo fora do restore |
| C/T e ACKs | Migração e Release, coordenadas por Astra | Admitir B e executar G05/G06/G07 na identidade final |
| Janela e decisão de produção | Gustavo | Decidir após receber os gates e seus recibos; a virada não foi autorizada |

O environment existir, uma label constar no workflow ou uma API de metadata retornar403/404 não prova reserva nem ausência de infraestrutura. Não houve mutação de host, concessão de grant ou instalação por esta frente.

## Sequência de fechamento

1. Concluir #613 com dev efetivo, UI42–UI44, matriz técnica original, runtime Release real, revisão independente e CI verde no head aprovado.
2. Conciliar e qualificar #710 sobre esse Design, preservando controles/oráculos e os hunks reservados da Migração.
3. Compor o dev resultante no #673, receber A2 completo/pool/Reports/suplementos, obter baselines autênticas e qualificar o candidato, incluindo a instalação impactada.
4. Confirmar o mesmo C/T com Migração e Release e registrar os dois ACKs originais; o operador efetivo fica vinculado em B.
5. Executar G05 e G06 completos nesse candidato.
6. Produzir o tar pela rota original e verificar G07, sem reconstrução entre gates.
7. Executar G08 no host existente autorizado; preservar sua evidência antes de G10 no mesmo host, com restauração independente do backup original e os controles operacionais exigidos.
8. Reunir os recibos finais e apresentar a decisão go/no-go e a janela proposta a Gustavo.

O estado permanece **0/5 gates finais; NOT_READY**. As implementações integradas e os recibos de preparação estão entregues. C/T final, tar, reservas confirmadas, provas instaladas e decisão de produção permanecem ausentes. O backlink de Compras 222 (2) continua pendente para qualquer vínculo além de seu QA original.

</details>


</details>
