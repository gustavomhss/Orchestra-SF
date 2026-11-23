# Fechamento de produto — auditoria adversarial Orchestra SF

## Resultado e escopo

**Esta parcela de produto está implementada e qualificada dentro dos limites registrados abaixo.** Os quinze commits de implementação/teste foram integrados pelo agente raiz; esta publicação acrescenta somente o relatório e seu manifesto. A integração final e o merge pertencem ao agente raiz.

A implementação começou na branch `dev`, commit `e115b667d845822a1df5f523bbfd828ab57ca978`. Os achados originais estão em [product](../reviewers/product.md) e [product-supplement](../reviewers/product-supplement.md), preservados no commit `b705c7b0f2f7cc43a96d2aaa04fa32431c5f40d7`.

O escopo inclui **B1, B6–B13**, a extensão **B6-S1** em CAP14, o trecho compartilhado de **BA05/BA06**, **ROOT-N1/ROOT-N2** e o refinamento confirmado de **UI34/UI36**. B6-S1 continua sendo extensão de B6, sem contar como defeito independente.

O [manifesto JSON](./product.json) contém os cinquenta paths, quinze commits, fontes/snapshots completos, IDs de artefato, SHA-256, durações, revisores e limites. As provas são cumulativas em fontes pinadas; não se afirma que uma suíte completa tenha sido executada em um SHA posterior de merge.

## Correções e qualificação

| Item | Superfície | Alteração | Prova principal |
| --- | --- | --- | --- |
| B1 | CAP03 | Snapshot de revisão representa valores conhecidos de configuração/coleção e sua versão real sem exigir ou inventar recordId. Original, fonte atual e proposta permanecem distintos. | waveTwo5: CAP03 EN/PT before-after |
| B6 | CAP10 | Moeda ausente é declarada na lista/detalhe/editor/revisão. A lista usa uma nota única com aria-describedby nos montantes; escalares mantêm maximumSignificantDigits:21. | product4: complete Portfolio; people5: exact project/milestone writes |
| B6-S1 | CAP14 | Currency original aparece em modo de leitura no detalhe/editor/revisão; ausência fica explícita. Fixture primária fornece USD autorizado, outras permanecem sem moeda. | finance5: CAP05/CAP14 |
| B7 | CAP10 | Milestone existente usa snapshot separado do original via structuredClone(unwrap(record)); revisão mostra antes/proposto. Primeiro avanço é Review changes e a confirmação final é Save milestone. | product4: complete Portfolio; people5: exact project/milestone writes |
| B8 | CAP08 | Classificação, outlook e notas abrem a tarefa de avaliação; identidade/vínculo ficam em contexto recolhível. Título/ação refletem avaliação; criação mantém campos obrigatórios. | people5: Portuguese assessment views; people5: source-bound structure/talent |
| B9 | CAP07, CAP08 | Retorno usa rota de coleção semântica com owner completo, ano/mês e situação aplicável em vez de navigate(-1). | people5: semantic returns preserve owner and filters; people paths semantic tests |
| B10 | CAP04 | Campo readonly de período usa largura própria min(100%,28ch), independente dos 112px do seletor de ano. | opex6 |
| B11 | CAP02, CAP04, CAP07, CAP10 | People/Projects mantêm 760px e alinham edição ao início do conteúdo e ao título, como CAP02/CAP04. | people5; product4: complete Portfolio; waveTwo5 |
| B12 | CAP16 | Revisão comum não exibe consentimento e envia confirmed: false. Somente o 422 específico do produtor revela caixa desmarcada e alocações originais. Consentimento vinculado a owner/geração/CAS/operação/proposta é limpo ao revisar/cancelar/mudar contexto. | product4: normal performance; weights7 |
| B13 | CAP11, CAP12, CAP13, CAP14, CAP15, CAP16 | Mudanças, mudanças remotas e diferenças indeterminadas vêm primeiro; inalterados ficam em disclosure pluralizado. Fontes e payload de Effects são detalhes recolhíveis; consequência/estado continuam visíveis. Motivos iguais por key+params são deduplicados preservando ordem. | product4: risks/relationships/normal performance; finance5; people5; shared compare semantic tests |
| ROOT-N1 | UI39 | Ausência de conteúdo derivado não acrescenta card redundante contendo somente um título. | decisions4; root independent UI39 visual review |
| ROOT-N2 | UI36, UI37 | Categorias/códigos conhecidos recebem rótulos legíveis; prosa autoral e refs exatas permanecem. Resultado de preparação de pergunta só oferece navegação quando há outputRef real; ausência é explicada. Record question/Registrar pergunta descreve a operação. | decisions4: native interactions/Portuguese retained question; decision presentation semantic tests |
| UI34-refinement | UI34, UI36 | Constraints/cobertura usam catálogo explícito de códigos próprios. Apenas razões textualmente idênticas e categorias reconhecidas compartilham grupo visual, com escopo e raw values preservados em detalhes. | decisions4; 8 decision presentation semantic tests; root independent UI34-320/UI36-desktop visual review |

### Antes/depois e contexto financeiro

Em **CAP03**, a revisão de mês agora mostra **junho de 2026 → julho de 2026**, e os equivalentes ingleses, com Original/Fonte atual/Proposta verdadeiros. A revisão da receita conserva **2.400.000 → 2.600.000** e a condição real de moeda ausente. Revisar, cancelar e descartar mantêm o rascunho ou restauram a fonte conforme a ação; o caso verifica zero writes. Não foi fabricado um recordId para satisfazer o renderer.

Em **CAP10**, a projeção original não informa moeda. Essa ausência está presente na lista, detalhe, edição e revisão; a lista utiliza uma nota única, acessivelmente associada aos montantes. Os valores mantêm precisão, sem transformar vazio em zero. A prova confirma uma escrita de **190.000** e a releitura em EN/PT no mesmo registro.

Em **CAP14**, moeda conhecida é contexto somente leitura. O cenário canônico fornece **USD** em um contrato e mantém outros sem moeda. A prova verifica ambos os estados no detalhe/editor/revisão, nenhum input/select/textarea de currency, o payload nativo sem esse campo e a persistência do USD original após o save. Não se presume moeda por idioma, localidade ou fornecedor.

### Tarefa, comparação e composição

O milestone usa snapshot separado do original, com `unwrap` antes de `structuredClone`, evitando copiar um Proxy Solid diretamente. O teste clica realmente em Review changes, compara Notes antes/proposto, revisa, salva e relê o mesmo milestone. Fonte, versão, CAS e intenção de operação permanecem originais; criação e edição são distintas.

A avaliação de talento põe classificação, outlook e notas primeiro. Identidade e vínculo ficam em contexto recolhível e acessível, enquanto criação mantém os campos obrigatórios. **Editar avaliação** e **Salvar avaliação** descrevem a tarefa em português. Nenhum nome foi inventado para IDs de líder e nenhum campo autorizado foi removido do comando.

Os retornos de equipe/talentos usam a coleção anunciada e preservam server/project/installation, ano/mês e situação aplicável. Três abas diretas, sem histórico útil, provam o destino correto e a identidade preservada.

Os formulários People/Projects mantêm **760 px** e passam a seguir o eixo inicial do título/conteúdo, coerente com CAP02/CAP04. As fontes, o vidro, as cores e os tokens existentes foram preservados. Em OPEX, o período readonly tem largura própria, independente dos 112 px do seletor de ano. Janeiro, setembro e dezembro, em EN/PT e 1440/320 px, passam em **doze combinações**, inclusive a medição de overflow interno. O caso mantém a escrita **14.200 → 14.600** e sua releitura PT na mesma instalação.

### Consentimento real de pesos

Uma revisão comum em CAP16 envia `confirmed: false` sem sugerir uma exceção inexistente. Somente a resposta 422 específica do produtor revela a caixa desmarcada e o contexto original de alocação. O consentimento é vinculado ao owner, geração, CAS/versão, operação e proposta atuais; revisar/cancelar/mudar contexto limpa sua validade.

| Recibo original | Observado |
| --- | --- |
| Respostas recusadas | 422, 422 |
| Resposta aceita | 200 |
| Valores enviados em `confirmed` | false, false, true |
| Chaves de idempotência distintas | 3 |
| Versão inalterada após recusas | Sim |
| Readback CAP16 após aceitação | Original e obrigatório |
| Page errors | Nenhum |

O caso final levou **58,433 s**, com **51,484 s** medidos desde a entrada. O limite de 300 s desse caso novo existe desde sua criação; nenhum prazo anterior foi aumentado. Não houve cálculo paralelo de excesso, consentimento automático ou replay de comando.

### Revisão compacta sem perda de informação

B13 mantém mudanças, mudanças remotas e diferenças indeterminadas primeiro. Campos inalterados ficam em disclosure pluralizado; fonte/versão e payload de Effects permanecem em detalhes. Consequências/estado continuam visíveis. Razões iguais por chave e parâmetros são deduplicadas em ordem, enquanto razões diferentes permanecem.

Os valores vazios, ausências, unidades, paths repetidos e diferenças remotas continuam inspecionáveis. Os casos completos de riscos, relacionamentos e performance, além de contratos/People/Projects, qualificam o renderer. CAP11/CAP12 usam esse componente, mas esta seleção final não realizou novas escritas específicas desses dois módulos.

### Decisões legíveis e resultados fiéis

UI39 comunica a ausência sem um card extra contendo apenas um título. UI34/UI36 usam catálogo explícito para códigos e categorias próprios do produto. Razões de cobertura só se agrupam quando textualmente idênticas e com categorias reconhecidas; autoria, caixa/espaços, extensões desconhecidas, ordem e referências raw são preservadas.

UI37 descreve a operação por Record question/Registrar pergunta e só oferece navegação quando existe um outputRef real. Ausência não é disfarçada com destino inventado. As três jornadas de decisões passaram, e a revisão independente de UI34 320, UI36 desktop e UI39 desktop não encontrou novo bloqueio visual nos recortes.

## Execuções qualificadoras

Todos os testes de produto rodaram no **GitHub Actions test-ci**, runner de produção mantido, com fixtures canônicas isoladas e retries 0. Localmente houve apenas download, hash, extração e leitura de JSON/PNG dos artefatos. Nenhum build, teste, typecheck ou servidor de produto foi executado localmente.

| Execução | Resultado registrado | Durações qualificadas, na ordem do manifesto | Artefato |
| --- | --- | --- | --- |
| [waveTwo5 · 45230251834](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230251834) | 3 pass / 2 fail | 100.184 s; 136.233 s; 142.030 s | 14847633368 |
| [product4 · 45227008271](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45227008271) | 4 pass / 3 fail | 119.597 s; 113.773 s; 90.782 s; 282.897 s | 14847602384 |
| [people5 · 45230257909](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230257909) | 5/5 pass | 266.602 s; 157.626 s; 169.724 s; 161.102 s; 235.630 s | 14848876195 |
| [weights7 · 45232580119](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45232580119) | 1/1 pass | 58.433 s | 14847609187 |
| [decisions4 · 45227015499](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45227015499) | 3/3 pass | 620.191 s; 501.124 s; 516.610 s | 14845904415 |
| [finance5 · 45228241086](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45228241086) | 2/2 pass | 243.375 s; 203.491 s | 14845742210 |
| [topics6 · 45237060264](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45237060264) | 2/2 pass | 167.176 s; 65.875 s | 14849412826 |
| [opex6 · 45237067947](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45237067947) | 1/1 pass | 137.726 s | 14850771461 |

People5 passou **5/5**, Weights7 **1/1**, Decisions4 **3/3**, Finance5 **2/2**, Topics6 **2/2** e Opex6 **1/1**. Os três casos independentes já verdes de WaveTwo5 continuam byte-idênticos após a extração. Product4 fornece três casos completos de Operations e prova adicional completa de Portfolio. As falhas dos outros casos desses runs parciais estão registradas, sem apresentá-las como passes.

Os casos finais registram zero retries, skips e flaky. Isso descreve execuções finitas, não uma garantia universal de ausência de flakiness.

### Fontes e integridade

- **waveTwo5**: fonte [7d319bd5](https://github.com/gustavomhss/Orchestra-SF/commit/7d319bd5bba639e79adb2e1c396f02072c641d42); snapshot [c9869453](https://github.com/gustavomhss/Orchestra-SF/commit/c9869453f05876fb892e878411e69c311c7542c4); SHA-256 do ZIP `f0e1b9e775af36f893f57edfff0775aa11a5c1c3906b9750b66b769e176282bf`.
- **product4**: fonte [c6256d1e](https://github.com/gustavomhss/Orchestra-SF/commit/c6256d1e2e5b0082a0181f555d002f1e476783c5); snapshot [b855eeb2](https://github.com/gustavomhss/Orchestra-SF/commit/b855eeb25f97cc9425bb2731b15c370d0db4e4cb); SHA-256 do ZIP `d20c80038b5980356265d67e7fa2121ede1eba1ce7d588b7beaf3c26bc40498c`.
- **people5**: fonte [7d319bd5](https://github.com/gustavomhss/Orchestra-SF/commit/7d319bd5bba639e79adb2e1c396f02072c641d42); snapshot [f1a69ff2](https://github.com/gustavomhss/Orchestra-SF/commit/f1a69ff29fe08931642f1438728bae59d0e8fc58); SHA-256 do ZIP `c0c06e83c248b8bf29243a80d6ed3b26580f5ba29aa35f2d008db540b9b7a596`.
- **weights7**: fonte [674cf577](https://github.com/gustavomhss/Orchestra-SF/commit/674cf57767413adfebad773c23beb83e8c712346); snapshot [0ef6da26](https://github.com/gustavomhss/Orchestra-SF/commit/0ef6da2633c65545b931e99ab336ab529e252645); SHA-256 do ZIP `705a5f7c29f21151d4277381d36db012466173e0c67a3580266d580b297dd089`.
- **decisions4**: fonte [c6256d1e](https://github.com/gustavomhss/Orchestra-SF/commit/c6256d1e2e5b0082a0181f555d002f1e476783c5); snapshot [07d708bc](https://github.com/gustavomhss/Orchestra-SF/commit/07d708bcea78dfe97448498c5ed8d54e38294d39); SHA-256 do ZIP `43280200a5d10a4db1ad5b216ca901ea95d2ade6c34638998ac63186f143ee88`.
- **finance5**: fonte [ce678c81](https://github.com/gustavomhss/Orchestra-SF/commit/ce678c810f13edc957b7ea9ed061f9313a39fe1f); snapshot [15d97db5](https://github.com/gustavomhss/Orchestra-SF/commit/15d97db59579ff01eae3ede391c1c99412967761); SHA-256 do ZIP `012879f0d46620b01de58a606fd0a2da5261d0c0cc26ac82eeb622fc90f02cbc`.
- **topics6**: fonte [c9cfe4d8](https://github.com/gustavomhss/Orchestra-SF/commit/c9cfe4d8c670a4fd3537add7a554d82cc08dd99b); snapshot [c0ef1fc3](https://github.com/gustavomhss/Orchestra-SF/commit/c0ef1fc3ad8b49921a3d575f12d809bfbc713714); SHA-256 do ZIP `60537bb583f1b59896381ebeae90f4d93c2ca2c2c858d8123bbb28b60ab2a0ce`.
- **opex6**: fonte [c9cfe4d8](https://github.com/gustavomhss/Orchestra-SF/commit/c9cfe4d8c670a4fd3537add7a554d82cc08dd99b); snapshot [6d492534](https://github.com/gustavomhss/Orchestra-SF/commit/6d492534a792fa3a648c281bae8d608967d59923); SHA-256 do ZIP `88e5a81afded770f524c3d31d7292d67bfc38eeebd7867f5e4a51aa48b8eeece`.

O gate composto [Gates9 · 45237283693](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45237283693) terminou success sobre `56d383c9ff6025ef7ce99b2581419275b4f76700`, snapshot `4dcf53f7674fb3afd465dfecb1581e6df81e334e`. O agente raiz confirmou todos os quinze commits integrados em `d522399b7542bb3fc2a12c516213be7f76098678`. O gate final [Gates10 · 45261780999](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45261780999) também terminou success sobre o código d522399, com 28 casos semânticos, 132 casos DOM, seis gates, 78 regras e sete paletas. A sanitização posterior de diagnósticos preserva produto, transporte, retries e oráculos desta parcela.

## Determinismo e preservação dos oráculos

As primeiras rodadas expuseram leituras originais mais longas que a primeira asserção de DOM, espera redundante de `Response.finished` depois de a aplicação consumir o corpo, remoção precoce de handler `times: 1` em leituras concorrentes e indisponibilidade do corpo CDP após resposta de comando.

As correções compartilhadas mantêm requisição, bytes e status originais. O teste observa a resposta exata e depois exige estado/identidade visíveis. O handler permanece registrado até terminar sua entrega. Os três comandos de consentimento usam a APIResponse original, sem retry/replay.

OPEX estava legitimamente em Loading após New line. Quatro navegações agora armam o CAP04 original antes do clique e mantêm todos os oráculos seguintes. O seletor de referências de tópicos espera os catálogos CAP13/CAP15 admitidos por F01 e exige o risco canônico, habilitação, foco e viewport.

O validador original rejeitou `--grep` antes de executar testes. O cenário passou a usar arquivo nomeado; o validador e o runner não foram flexibilizados.

| Família | Casos antes → depois | Prazo por caso | Fixture |
| --- | ---: | ---: | ---: |
| Wave-two | 1 → 5 → 6 | 240.000 ms | 190.000 ms |
| People/Portfolio | 2 → 5 | 300.000 ms | 190.000 ms |
| Decisions | 1 → 3 | 780.000 ms | 190.000 ms |
| Consentimento | Mesmo caso, arquivo próprio | 300.000 ms desde a criação | 190.000 ms |

Cada caso independente recebe instalação, contexto e enrollment próprios. As duas escritas de tópico e todos os readbacks do mesmo registro permanecem juntos; o bloco independente de referência apenas passa a outro caso com a fonte canônica intacta. As escritas de projeto/milestone e o readback PT de 190.000 também permanecem juntos.

A divisão aumenta o possível tempo agregado. Nenhum prazo individual aumentou. Os três casos já verdes de WaveTwo5 e sete helpers permaneceram byte-idênticos, confirmado pelo agente raiz. A última extração conserva **123 → 124** linhas literais com `expect(`, zero removidas; incluindo `expect.poll`, **125 → 126**. A única adição é o heading exato do tópico canônico no caso de referências. Não há sleep, networkidle, ação forçada, dados fabricados ou retirada de oráculo para aceitar falha.

Os mapas completos estão em [product-test-map.md](./product-test-map.md), [product-test-map.json](./product-test-map.json) e [decision-test-map.md](./decision-test-map.md).

## Revisão visual efetiva

Somente as dezoito imagens abaixo contam como efetivamente abertas. O revisor é explícito; anexar uma imagem pelo runner não conta automaticamente como inspeção visual. Os PNGs originais não foram alterados.

| Run | PNG | Revisor | Conclusão do recorte |
| --- | --- | --- | --- |
| 45230251834 | `CAP03-dark-320-review-test-data.png` | fix_product | Junho/Julho completos, comparação empilhada e três ações sem corte. |
| 45230251834 | `CAP03-pt-BR-dark-desktop-review-test-data.png` | fix_product | Antes/atual/proposta identificáveis, localização correta e eixos coerentes. |
| 45230257909 | `CAP10-dark-desktop-milestone-review-test-data.png` | fix_product | Notes originais/propostas, 3 inalterados recolhidos, fontes e ações no eixo esquerdo 760. |
| 45232580119 | `CAP16-weight-exception-consent-dark-320-test-data.png` | fix_product | Painel, checkbox e ações contidos; imagem após consentimento explícito, sem substituir prova do estado inicialmente desmarcado. |
| 45230257909 | `CAP08-dark-320-focused-assessment-editor-test-data.png` | root | Avaliação antes do contexto, controles e eixos legíveis. |
| 45230257909 | `CAP08-pt-BR-dark-desktop-assessment-editor-test-data.png` | root | Hierarquia avaliação→contexto e composição aprovadas. |
| 45227015499 | `UI34-dark-320-readable-constraints-test-data.png` | root | Categorias/espaçamento limpos, sem corte ou quebra intrapalavra. |
| 45227015499 | `UI36-dark-desktop-test-data.png` | root | Categorias legíveis, divisor e eixos coerentes. |
| 45227015499 | `UI39-dark-desktop-test-data.png` | root | Ausência sem card redundante. |
| 45227008271 | `CAP10-pt-BR-dark-desktop-project-editor-test-data.png` | fix_product | Largura 760 e eixo inicial coerentes; ausência de moeda legível. |
| 45227008271 | `CAP10-pt-BR-dark-320-project-review-actions-test-data.png` | fix_product | Antes/proposta e ações inteiras no viewport estreito. |
| 45227008271 | `CAP08-dark-320-focused-assessment-editor-test-data.png` | fix_product | Classificação/outlook/notas primeiro e identidade em contexto fechado. |
| 45228241086 | `CAP14-dark-desktop-contract-detail-test-data.png` | fix_behavior | USD original visível com hierarquia/alinhamento corretos. |
| 45228241086 | `CAP14-dark-320-editor-test-data.png` | fix_behavior | Campos contidos no editor estreito. |
| 45228241086 | `CAP14-dark-320-review-actions-test-data.png` | fix_behavior | 14 inalterados recolhidos e três ações completas. |
| 45237067947 | `CAP04-pt-BR-dark-1440-complete-period-test-data.png` | fix_product | Setembro de 2026 completo, período separado do seletor de ano. |
| 45237067947 | `CAP04-pt-BR-dark-320-complete-period-test-data.png` | fix_product | Período completo sem corte ou scroll interno em 320. |
| 45237060264 | `CAP02-dark-320-related-test-data.png` | fix_product | Seletor nativo habilitado/focado e contido; referência original inspecionável. |

## Falhas históricas preservadas

| Execução | Causa observada e tratamento |
| --- | --- |
| [Product1 · 45209229751](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45209229751) | Leitura original excedeu primeira asserção de DOM de 10 s; passou-se a observar a resposta exata antes do estado visível. |
| [Decisions control · 45212077562](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45212077562) | Mesmo atraso da leitura nativa sem o delta de host do root. |
| [Decisions2 · 45216596111](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45216596111) | UI ready e respostas 200/ok; espera redundante de Response.finished bloqueou. e92a323 remove somente esses awaits posteriores. |
| [Product2 · 45216873247](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45216873247) | 1 pass/6 fail: mesma espera finished mais catálogos secundários do tópico ainda Loading. |
| [Decisions3 · 45221845895](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45221845895) | Concorrência UI35 expôs remoção precoce do handler times:1; 76ca340 mantém handler registrado até entrega/close. |
| [Product3 · 45221345638](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45221345638) | 3 Operations completas verdes; outros casos atingiram prazo agregado, catálogos pendentes ou locator de checkbox ambíguo. |
| [Weights5 · 45230267164](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230267164) | Validador rejeitou --grep antes de executar: 0 testes. Adotada seleção original por arquivo nomeado. |
| [Weights6 · 45230759990](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45230759990) | 422 original recebido, mas corpo CDP indisponível. forwardOnce conserva APIResponse original de cada comando, sem replay. |

WaveTwo5 e Product4 também têm falhas, explicitadas acima e no manifesto. Novas seleções qualificaram somente os cenários afetados. Leituras originais demoradas são observações do ambiente de CI; não se infere um SLA de backend.

## Revisão cruzada e limites

A revisão fria dos fixes raiz B2–B5/ROOT01–03 encontrou dois riscos concretos: lookup herdado de protótipo nos catálogos, corrigido em `77f3104662e5ce4a7181403761a3b7e51c138704`, e estado de rota pendente/retorno para Today sem a condição operacional original, corrigido em `3307ee25e607fc3924158c894e0a5c84511fcb52`. O delta de loading, owner fence, cancelamento e erro inline foi relido sem novo achado. Behavior revisou os recibos de consentimento e confirmou sequência, entrega original e cleanup após callback.

A prova cobre Chromium de produção, inglês/português, desktop 1440 e mobile 320; decisões têm também 390. Tema nativo e reduced motion seguem o fixture. As verificações de teclado/foco são as registradas nos casos. Não houve auditoria de leitor de tela, medição real de zoom ou aumento independente de fonte, nem varredura de todas as alturas/idiomas/estados transitórios.

A ausência de bloqueio nos recortes vistos não equivale a afirmar inspeção de todos os pixels de todos os artefatos. Cada limite está junto de sua prova para permitir repetição do caso exato.

## Referências

- [Manifesto completo desta parcela](./product.json).
- [Mapa de testes de produto](./product-test-map.md) e [mapa de decisões](./decision-test-map.md).
- Guias oficiais seguidos: [Best Practices](https://playwright.dev/docs/best-practices), [Auto-waiting](https://playwright.dev/docs/actionability), [Assertions](https://playwright.dev/docs/test-assertions), [Locators](https://playwright.dev/docs/locators), [Network](https://playwright.dev/docs/network) e [Isolation](https://playwright.dev/docs/browser-contexts).
