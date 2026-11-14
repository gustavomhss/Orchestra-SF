# Finance resume performance — handoff final

## Estado de entrega

**Correção aplicada e validada no escopo cirúrgico; FIN-IND-005 permanece ABERTO. Não há aceite global.**

Repositório: gustavomhss/Orchestra-SF. Branch de produto: **finance-resume**. PR existente: [#42](https://github.com/gustavomhss/Orchestra-SF/pull/42), preservada aberta e draft. O head real inicial foi confirmado como **3ea9dc2efe0de8d283f9625774697e431f55a0d7**, tree **2d1ecef2ebc5aeca3fd312397bdf709f53d42582**.

O último commit de produto desta missão é **7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1 (W4)**, tree **2da074668b164b1aa5e051f8a70366969425906f**. S5 e S6 exercitaram exatamente esse código. O commit que publica este handoff acrescenta somente os recibos finais deste namespace; o head publicado e a comparação W4→head final são registrados na PR42. Nenhuma branch de produto ou PR adicional, reset, merge ou force push foi feito.

**Resultado principal:** foram eliminadas uma busca numérica completa repetida, observações iniciais duplicadas no emissor de unidades e envelopes C08 repetidos por resultado irmão. S5 passou **36 testes, 297 assertions, zero falhas**. A jornada longa S6 ainda esgotou a guarda original de 180000 ms antes da fronteira confirmada 15000/15001, do histórico posterior, replay e reabertura. A otimização local não é suficiente para fechar a jornada no orçamento observado.

## Fontes normativas e preservação do escopo

Foram consumidos AGENTS.md e review-fixes/COMMON.md no pin **30e2215749d5295f81fdeafccb9e69ba21d0cdb8**, CI.md no pin **a3d29d011ba3607a57914701300f09117a3e2de9** e o [handoff anterior](../finance-resume-20261114/HANDOFF-FINAL.md), blob **2623594eb8124b45e45ec6665764be61c34be70c**, no head inicial.

A fonte normativa permanece **dbf9547211d9b0fade619790de7c19c0869b7c7d**. O inventário anterior de **371 critérios, 18 tarefas e 87 checks Finance** não foi reduzido. O escopo maior da campanha, **15 WPs, 74 tarefas, 17 contratos e 1610 critérios**, também permanece intacto. Não foram alterados status normativos, dispensas ou definições de aceite.

[criteria-provenance.json](criteria-provenance.json) conserva os 29 objetos normativos diretamente relevantes, os contratos completos C08/C09/C10, o oráculo AI-RENEWAL-OMITTED-CATEGORY, o finding FIN-IND-005 original, os JSON Pointers e blobs. [criteria-provenance.md](criteria-provenance.md) apresenta o mapa de obrigações e limites. Esse recorte acrescenta rastreabilidade; não substitui o inventário completo anterior.

No código e no oráculo recuperados, 240000 é baselineResult.knownSubtotal, a base de comparação de custo/renovação. A jornada não demonstra um campo separado de receita. A aritmética exigida é preservada com essa semântica original.

## Delta de produto e causa demonstrada

Todos os seis arquivos ficam sob modules/sucafina/Sucafinav1/. Preimages, blobs de saída e referências consumidas estão em [scope-manifest.json](scope-manifest.json).

| Arquivo | Correção e verificação preservada |
| --- | --- |
| product/portfolio/planner-sensitivity.ts | Mantém a busca numérica inicial. A recertificação final valida o candidato encontrado com witnesses atuais aceito e imediatamente adjacente recusado, em vez de repetir a busca inteira. Conserva releituras de amostras, cobertura e revalidações finais. |
| product/portfolio/threshold-proof.ts | Admite prova estrutural reconstruída da fonte atual e exige a mesma identidade, base, cenário, metadados, engine, parâmetro, operação, bounds, unidade, período, referências e componentes em ambos os witnesses. |
| product/portfolio/verification.ts | Trata o número persistido como candidato; recria a prova estrutural e witnesses atuais, incluindo a saída final. Mantém recomposição integral do resultado Finance/evidências, as cinco recertificações de binding e o finalizador existente de scope/Request/lease/poison/publicação. |
| product/planner/sensitivity-units.ts | O helper privado issueObserved usa apenas os snapshots iniciais destacados que o mesmo resolve já leu. Conserva a segunda observação independente de caso/cenários/fontes, a releitura de regra e as verificações finais de autoridade. A assinatura pública de issue não mudou. |
| product/decisions/result-store.ts | Agrupa envelopes C08 por fase para resultados históricos irmãos do leitor canônico, mantendo por ocorrência as autorizações, verificações de fontes e revalidações explícitas. |
| product/planner/stored-scenarios.ts | Usa o agrupamento separadamente na leitura inicial e na releitura posterior dos resultados. Mantém as projeções e as duas leituras completas de caso, antes e depois. |

Os quatro primeiros arquivos foram publicados em **W2 95f474484fb49cedb563ed3d02a61e9638d6784d**. Os dois últimos, em **W4 7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1**. W1 e W3 acrescentaram somente contraprovas/recibos; a história anterior não foi reescrita.

Nenhum delta foi aplicado a apps/cli/src/sucafina-product/, product/host-binding/, product/integration/ ou ao namespace finance-journey. Não foi aplicada a proposta WP10 da PR59.

### Contraprovas que discriminam a causa

**S1, antes da primeira alteração de produto:** o teste curto atingiu as verificações financeiras e de revogação e falhou somente na expectativa de uma busca. Observou **2 buscas, 18 previews de busca e 4 emissões de unidades**. S2 e S5 executaram o mesmo teste com **1 busca, 9 previews e 2 emissões**, preservando **8 previews do consumidor, 4 revalidações e 2 escritas de amostra**.

A avaliação medida levou 42534 ms em S1, 38863 ms em S2 e 31223 ms em S5. São medições individuais. O teste inteiro, incluindo fixture e recusa da operação seguinte, levou 53317,80 ms em S1 e 53638,96 ms em S2; portanto, o primeiro delta não demonstrou aceleração do teste completo. Em S5, o teste inteiro levou 42712,04 ms.

**S4, antes do agrupamento C08:** dois resultados reais retornaram ok, com digests e referências corretos e duas leituras completas de caso. Falhou apenas a expectativa de dez envelopes: observou **16**. S5 observou **10**, preservando as duas leituras completas do mesmo caso, com 58,217551 ms na operação contra 70,542824 ms em S4. A redução **16→10** é a evidência causal mais forte; não há distribuição estatística ou promessa de latência.

A seleção com duplicata e referência ausente manteve ordem e estados **ok / unavailable / ok / ok**, **12 authorizeCase**, **12 verifySources**, **25 revalidações explícitas do host**, dez envelopes C08 e duas leituras completas do caso. A fachada que sobrescreve o leitor escalar continuou com 16 envelopes e quatro hooks escalares.

### Limites exatos do agrupamento e da autoridade

Cada lote conserva três snapshots C08 novos: inicial, posterior aos primeiros callbacks e final após os últimos callbacks. O fluxo de cenários inicia um novo lote para sua releitura posterior; as duas fases não compartilham observações. Por ocorrência bem-sucedida de cada lote permanecem duas autorizações de caso, duas verificações de fontes e quatro revalidações explícitas do host.

A contagem de admissões internas do namespace diminui junto com a quantidade de envelopes C08. Não se afirma que todos os callbacks de autoridade do sistema mantêm contagem idêntica: o namespace é autorizado em cada snapshot compartilhado, enquanto as verificações explícitas por resultado permanecem por ocorrência.

O WeakMap privado registra apenas proveniência de funções canônicas. Não conserva grants, resultados ou observações entre operações. Uma fachada que muda o leitor usa o caminho escalar; a substituição do leitor ou store durante uma fase resulta em recusa, sem fallback tardio. Request original, headers, binding, lease e métodos do host são retidos e conferidos.

O lote **não é um snapshot atômico de todas as fontes de domínio**. A observação final C08 compara integralmente caso e resultado persistido; o verificador real de operações na leitura completa final do caso continua necessário para a deriva da fonte Planner. S5 alterou a fonte real depois do último callback do irmão posterior e observou unavailable para ambos. A alteração isolada de um resultado persistido produziu denied para ele e ok para o irmão intacto, conforme o contrato de falhas parciais.

CAS, escrita, ancestry e leituras de cálculo histórico não foram alterados. Não houve cache de autorização entre operações, remoção de recertificação requerida, fonte fabricada, aumento de timeout, skip ou remoção de assertions.

## Execuções oficiais

[CI-LEDGER.json](CI-LEDGER.json) registra W/S completos, trees, solicitações, SHA-256 das seleções, comparação W→S, jobs, fases, contadores, duração, nonce Omni e hashes dos logs. Todos os testes de produto ocorreram exclusivamente no GitHub Actions pelo protocolo de snapshots de CI.md. Cada W→S acrescenta somente .ci-run.json. Houve uma seleção de produto em execução por vez; S3 e S6 repetiram a jornada longa somente após mudanças materiais, respectivamente W2 e W4.

| Seleção | Produto / snapshot | Run | Resultado |
| --- | --- | --- | --- |
| S1 | W1 ab38a14c / S 4afc641b | [43627723188](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627723188) | Contraprova vermelha esperada: 0 pass, 1 fail, 27 assertions; teste 53317,80 ms; busca duplicada 2→esperado1. |
| S2 | W2 95f47448 / S 4fce9171 | [43628402812](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628402812) | PASS: 15 testes, 159 assertions, 408,14 s; recertificação e negativos selecionados. |
| S3 | W2 95f47448 / S 10750da6 | [43629238602](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43629238602) | FAIL: 18 assertions, teste 180051 ms; guarda durante confirmed.exact→confirmed.preview, após ambos qualifiers e duas amostras. |
| S4 | W3 189cb742 / S ff04e4ff | [43629852422](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43629852422) | Contraprova vermelha esperada: 6 assertions; teste 433,55 ms; envelopes16→esperado10. |
| S5 | W4 7a9a43b3 / S 18e2a5dc | [43630462257](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43630462257) | PASS: 36 testes, 297 assertions, 368,57 s, dez arquivos da seleção afetada. |
| S6 | W4 7a9a43b3 / S 0e68fec2 | [43631582858](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43631582858) | FAIL: 18 assertions, teste 180025,69 ms, guarda180000 ms; recusa stale durante primeira qualificação confirmada. |

Não houve teste, typecheck ou engine de produto local, suite epic/full, CI duplicado ou reinício do Orchestra. Omni foi **not applicable** nas seleções: elas não provam execução de Omni. Os workflows de teste não publicaram artefatos; os recibos retêm eventos/excertos e hashes dos logs obtidos via MCP.

### S6: fase real e obrigação ainda não concluída

O fixture continua imprimindo o rótulo antigo prepare:transition-confirmed:complete. O trace da operação, preservado em [S6-result.json](S6-result.json), mostra a fase ativa na expiração:

**confirmed.evaluate → confirmed.coverage.qualify → confirmed.authority.is-still-valid → confirmed.units.revalidate**.

A guarda registrou deadline-exceeded em 180015 ms. A revalidação retornou false em 180017 ms; a qualificação e a avaliação retornaram **stale / coverage-authority-changed**. Não foi um PASS nem uma mudança de autoridade de negócio demonstrada independentemente da expiração da guarda.

| Fase S6 | Duração observada |
| --- | ---: |
| fixture.create | 12521 ms |
| omitted.evaluate | 35505 ms |
| choice.record | 11486 ms |
| training.confirm | 52749 ms |
| confirmed.coverage.issue | 33094 ms |
| primeira confirmed.coverage.qualify, terminou stale | 21630 ms |
| confirmed.evaluate, incluindo operações aninhadas | 67753 ms |

São durações inclusivas e aninhadas; não devem ser somadas. Na fase confirmada foram observadas cinco resoluções e cinco revalidações de unidades, quatro resoluções de autoridade, quatro is-still-valid, duas emissões de unidades e quatro previews. Não houve escrita de amostra confirmada nem busca exata confirmada após a qualificação recusada.

O total até a expiração foi 3017 leituras C08 de cases, 542 de preferences e 23319 revalidações do host. Os acumulados têm pontos terminais diferentes de S3; **3017 versus3996 não mede redução de uma jornada concluída**. A fase omitted.evaluate de S6 foi mais lenta que S3 (35505 versus28621 ms). Não há evidência de aceleração ponta a ponta.

### Mapa comportamental observado

| Obrigação | Prova obtida nesta missão | Estado restante |
| --- | --- | --- |
| Base240000, conhecido210000, treinamento omitido pending, sem zero fabricado | S1/S2/S5 e assertions da fase omitida S3/S6; teto conhecido próximo55000 permanece condicionado | Não equivale a cobertura completa nem ao aceite de todos os consumidores. |
| Mesma identidade e confirmação40000→250000/−10000 | S3 e S6 passaram as assertions de caso/encarnação, versão posterior, componente confirmado, cobertura e comparação | Jornada posterior ainda não concluída. |
| Mínimo20000 e teto15000/15001 | A busca/recertificação foi validada em seleção própria, mas a fronteira confirmada da jornada não foi alcançada em S3/S6 | **Não comprovado integralmente nesta missão.** |
| Escolha histórica preservada após reavaliação | A escolha condicionada foi persistida; o checkpoint confirmado reimprime seu digest inicial, sem reler a escolha após confirmação | As releituras e assertions finais de história não foram alcançadas. |
| Replay autorizado, persistência/reabertura real | S5 validou recertificação persistida e negativos de evidência, root e lease no provider real | O replay de escolha e o restart da jornada não foram alcançados. Replay de sensibilidade depois de restart também não foi estabelecido. |
| Consumidores UI/BI/crítica/portfólio e operação instalada/nativa | Preservados os critérios e pendências anteriores | Fora do aceite demonstrado pela seleção cirúrgica. |

O teste isolado de recertificação persistida usa resultados canônicos e C08 reais, com um envelope privado de binding montado pelo próprio teste. Ele não demonstra a publicação completa desse binding pelo host instalado nem replay de sensibilidade após reabertura.

Na cópia da jornada PR56, o replay de escolha antecede dispose/open do LocalStore. As assertions após restart tratam leitura do colaborador, outsider e revogação. Mesmo um PASS dessa jornada não provaria sozinho replay de sensibilidade persistida depois do restart, nem reinício do Orchestra instalado.

## Checks hospedados e bloqueios herdados

Foi reutilizado, sem edição, o workflow existente astra-finance-resume-check.yml na branch de check astra-check-fresume, apontada por atualização com expected_sha ao W4. [Run43630618176](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43630618176), job132556167840: **FAIL**.

[CHECK-W4-result.json](CHECK-W4-result.json) registra:

- **115 diagnósticos de tipo**, todos fora dos seis arquivos de produto e dos testes novos; zero novos/removidos por path/line/column/code em relação ao CHECK-R5 anterior.
- Duas diferenças no texto expandido de mensagens TypeScript. As listas não são byte a byte idênticas.
- **43 gates, 15 warnings, 78 regras e 1519 paths**, com os mesmos gates e warnings do recibo anterior e zero erros do engine de guardas.
- Artefato **14127863004**, nome finance-resume-checks-7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1-1, SHA-256 informado pela API **1b3f66b8c352749155baeeb2379b8a3fd69ec6d5f3546fb054a219dc59ca3bba**. Download confirmado por MCP; não se afirma extração local ou hash independente do ZIP.
- Base de guardas **a1d37698a7bb097c1578f827eba6a19b9917ef07**, merge-base **9e4f3d35833f9b2cea6abdf58f42331f3973d9bf**.

Os gates apontam recibos .log anteriores que o usuário exigiu preservar. Eles não foram apagados, renomeados ou ignorados. A skill guardrail-usage foi consultada; nenhuma dispensa ou autoaprovação foi criada. A disposição desses arquivos pertence a S0/Maestro. Os checks continuam reprovados; zero achados novos não os torna verdes.

## Diagnósticos consumidos e dependências exatas

### PR56 — finance-journey, preservada

Produto observado **1248dc6c5aaa83cb16c92697947fa5fea9699625**; head de recibos **0d2e59ffb14c31ebfb0b717d3d0078985ab2a3b7**. Run43625830145 expirou durante confirmed.coverage.qualify/authority.resolve/read-case; criação e confirmação já haviam retornado.

Somente quatro arquivos foram adaptados para finance-resume-performance. As mudanças foram título/prefixo de trace, com assertions, orçamento300000 e guarda180000 originais. [inputs-01.json](inputs-01.json) registra os blobs consumidos:

- journey-phase.test.ts: **5ca793fc4c7ae6d06f1af9cfb2f53faaa963c70b**;
- observed-coverage.ts: **0b6bdc6285b9a57c38939f5dea469bfdc060eb2f**;
- observed-ports.ts: **5e8740a9e3372e75624674617b63fadb5f81bfbc**;
- phase-trace.ts: **7123f5147720f643ef909b0a2d1ad1943afd3df5**.

A proposta de omitir isStillValid cedo em coverage.issue não foi aplicada. A equivalência de callbacks opacos e sua suficiência temporal não foram demonstradas.

### PR59 — proposta pertencente ao WP10

Pin: **e80fdc933dfd25956a50c22dea76bf077e79815b**. Prefixo modules/sucafina/Sucafinav1/docs/sf2h/receipts/diagnostics/calculation/.

- [OWNER_HANDOFF.md](https://github.com/gustavomhss/Orchestra-SF/blob/e80fdc933dfd25956a50c22dea76bf077e79815b/modules/sucafina/Sucafinav1/docs/sf2h/receipts/diagnostics/calculation/OWNER_HANDOFF.md), blob **6f7f5a7f9d12d09e8034eed94da6dcb86c08a95e**.
- [proposed/manifest.json](https://github.com/gustavomhss/Orchestra-SF/blob/e80fdc933dfd25956a50c22dea76bf077e79815b/modules/sucafina/Sucafinav1/docs/sf2h/receipts/diagnostics/calculation/proposed/manifest.json), blob **15a2048d7ec943a9fdfdbff191aef1d95fc0fe3b**.
- [proposed/0001-wp10-source-observation.patch.txt](https://github.com/gustavomhss/Orchestra-SF/blob/e80fdc933dfd25956a50c22dea76bf077e79815b/modules/sucafina/Sucafinav1/docs/sf2h/receipts/diagnostics/calculation/proposed/0001-wp10-source-observation.patch.txt).
- Preimage product/integration/source-lifecycle.ts: **65867a3e6aa9b5b85266bb637fb22cf1c6c6d539**.
- Preimage product/integration/planner-sources.ts: **6230f22e7dd66fec1103f28cc9a7937b2dca1449**.

Esses preimages eram de W26 **a1434e7ea7340aa1d1c8ce6bb48958b724218170**, observados iguais em W27 **ab8fb4f29d078d179742a77679ef85e5c549b114**. São referências históricas, não uma afirmação sobre o head atual da sessão WP10.

Estado na origem: **NOT_APPLIED / NOT_RUN**. A proposta pretende **4→2 envelopes**, mantendo **duas observações, seis autenticações e quatro revalidações**. O owner WP10 deve conferir seu head e preimages reais, compor sua implementação e validar a contraprova e a cauda completa. Nenhum segundo patch foi criado nesses paths. **Não há prova de que essa proposta, sozinha, fará FIN-IND-005 caber em180000 ms.**

Foram aproveitadas seletivamente as ideias de recertificação por candidato no código W26, com preservação do finalizador Finance. Os blobs de cada arquivo lido/adaptado/rejeitado estão em [inputs-02.json](inputs-02.json). Não houve importação integral de arquivos nem redução das cinco verificações de binding.

### PR55 — diagnóstico complementar consumido, sem repetição

Pin **0d7fb6f12ed053340391ff6e4f95b6f3c1276ea8**; README blob **5b37f2716187dca34a6e438d524a24da720cd856**; HANDOFF blob **ee0da487d3956bc8467841fc70e5d4a37abf3102**. A investigação não foi repetida e nenhum patch foi aplicado. As contagens de clone/classifier desse diagnóstico não foram convertidas em uma atribuição de CPU não medida.

### Pendências herdadas que continuam abertas

Permanecem os cinco failures longos da sessão anterior, a falha de campanha esperava unavailable/obteve ok e os sete deltas de consumidores registrados no handoff anterior. As fontes exatas em3ea9dc2e são:

- [remaining-gaps-final.json](../finance-resume-20261114/remaining-gaps-final.json), blob **3935412c87c380f2d6c8c5a855bbea17c629b412**;
- [consumer-reconciliation.json](../finance-resume-20261114/consumer-reconciliation.json), blob **c027491c3c6ce6970c7966d779c72ff1dd24e5ec**.

FIN-R2-REV-01 continua com WP10/S0: contrato de snapshot/INV.11. O seam readPortfolioSnapshot→cases.read→scenario-operation-access→readSourceFences→transactionAll foi observado incompatível com raiz readonly na referência PR32 **9048e0e65351a5bd80768458a79fed94a4993db7**. Esse recibo não atribui os timeouts das fixtures a esse seam.

O provider de campanha já existente na origem WP10, product/host-binding/state-provider.ts blob **2fd55c7304add0829d7434917c80664fe86356b9** no mesmo pin PR32, permanecia pendente de consumo naquela observação. Esta sessão não o reaplicou nem afirmou nova composição instalada.

Os gates de consumidores/UI/native AM01–AM06, C-G7, D-G8 e bundle S0 permanecem fora do aceite demonstrado aqui.

## Continuidade segura

A próxima ação depende de mudança material: composição de fontes/envelopes pelo owner WP10 ou outra redução cujo custo e equivalência possam ser demonstrados sem enfraquecer os contratos. Reutilizar o mesmo namespace de testes e os recibos; conferir o head real de finance-resume e da dependência antes de qualquer composição. Executar testes cirúrgicos pelo mesmo CI.md e só então repetir a jornada completa original.

Não repetir S6 sem alteração relevante, aumentar orçamento, omitir etapas, inventar fonte ou dispensar recertificação para obter verde. A revisão de fonte não encontrou outro delta pequeno e seguro demonstrado nos produtores Finance examinados; isso não prova impossibilidade de uma solução maior.

Os recibos finais se somam aos checkpoints01–03, inputs01–03 e S1–S4 já publicados. Toda autoria, implementação, prova e pendência anterior permanecem na história da mesma branch e PR.

