# Evidência de C25 observada na nominal05

Run43662317407 confirmou GET Requests503 com `procurement-queue-unavailable`, formulário0; a jornada financeira original foi executada e falhou antes de qualquer criação/edição/aprovação financeira. O restante deste arquivo preserva a análise contratual feita antes dessa execução. A nominal06 em C27 ainda está pendente; não transferir esta falha como resultado da nova composição.

# Missão52 — atualização financeira em C25

## Estado e limite desta atualização

**C25 já contém a composição mista Planner/Procurement proposta por53, mas não contém a admissão Application de53 e não fecha M31/MI07.** A falta de composição mista diagnosticada nas versões anteriores deve ser mantida como achado histórico. Não é correto repeti-la como defeito atual comprovadamente não corrigido depois do intake C25.

Esta nota é uma revisão estática do candidato C25 `4b15af2d8f8a5b96cdd0a8117951939bde0b9d02`, tree `ad67f4c0101b341e08de075c2c8ba8e599c4b3a2`. Não executa produto nem transfere resultados. A futura nominal05 sobre sua composição exata pertence à raiz; nenhum resultado dela é presumido aqui.

## O que foi integrado e o que continua inerte

| Fronteira | Estado observado em C25 | Consequência para52 |
| --- | --- | --- |
| Produto próprio53 | Sete caminhos consumidos em C24 `bc51f4446f26cdc5f0f9b3da1c1e916f36221e34`: dois módulos Procurement e cinco testes/fixture | O ciclo permitido de preparação de save/submit/approve existe no produto. Os20PASS de origem não viram PASS instalado. |
| Composição mista | Nove caminhos ativados em C25 como candidato revisto | Planner2400/diferença1200 devem ser preservados; PR140 é hipótese condicionada com total null. O comportamento composto precisa de observação nova. |
| Admissão Application compartilhada | `HOLD_INERT` | Não há provider concreto montado de `existingUiContextFor/requestFor`; o harness de origem não substitui esse provider. |
| Aprovação de replacement ainda não gravado e Apply posterior com recibo | M31/MI07 `OPEN` | O ciclo canônico existente não produz essa autoridade. É decisão de contrato de S0/WP00 e implementação dos owners correspondentes. |

O manifest `increment-02.json`, blob `e578b7e8ec612e5215fd6ff3f73132c622ad5f59`, registra `ADMIT_REVIEWED_SHARED_COMPOSITE9_AS_CANDIDATE`; seus campos qualification preservam testes compartilhados/compostos NOT_RUN e M31/MI07 OPEN. O recibo `consumer-ack53.json`, blob `81a26f9dd69634057ea1406626e096205ac78184`, confirma separadamente owned, composite e admission. Ambos estão em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/closure-intake-57/` no C25 pinado.

## Runtime financeiro disponível: nominal04, anterior a C25

O caso mantém a identidade completa **CI-UI-DECISIONS — require a real Procurement proposal and approval before Apply and recover its unique receipt**. É o caso localizado em `decisions.spec.ts:21`, segundo na ordem do arquivo; continua sendo a jornada financeira obrigatória dentre as cinco.

No run43660121173, job132647334720, sobre a composição nominal04 anterior a C25, esse caso falhou em14724ms, retry0, orçamento180000ms. O GET humano para Requests retornou HTTP503, `application/json;charset=utf-8`. O primeiro passo não encontrou `form[data-command="create"][data-page="Requests"]`: esperado1, observado0, assertion de10000ms em `procurement-source.ts:7`.

A observação de rede tem `requests:[]`, `observations:[]` e `bodyCompleted:false`; não houve criação financeira observada. A evidência primária local está em:

- `/workspace/scratch/fec39c0682b3/m52-audit/nominal04-43660121173/observations-line-21.json`;
- `/workspace/scratch/fec39c0682b3/m52-audit/nominal04-43660121173/runtime-extracted.json`.

Esse503 continua sendo um resultado histórico verdadeiro, não uma execução de C25. Composição, aprovação formal e C12 não foram alcançados por esse run. Não há alegação de identidade de ator ausente: o erro observado é a resposta pública de queue indisponível; a atribuição interna abaixo é análise de código, não instrumentação do ramo executado.

## Pré-condição de configuração ainda presente no código C25

A leitura direta de C25 encontrou:

| Path | Blob C25 | Predicado relevante |
| --- | --- | --- |
| `apps/cli/src/sucafina-product/business-services.ts` | `0181267b67b74a8df338999ddb7745cfee42bb29` | Linhas96–112: contextFor lê formSettings.currency do domínio real; ausência retorna procurement-context-unavailable. |
| `product/procurement/sources.ts` | `615b908d59fb95cb16ce8359c83e0c7aaa8a7a5e` | Linhas179–183: createSelection propaga a falha de contextFor antes de emitir seleção. |
| `product/procurement/queue-page.ts` | `91784d3ea3358565e19b62922c8867f134af9ac4` | Linhas27–28 e46–50: Requests/My approvals exigem seleção válida; unavailable resulta no JSON público503. |
| `runtime/procurement.ts` | `20a3ec5a30ac0fce6b35f05750d1b3dced11c45b` | Mesmo parser de settings, formSettings e contrato de Settings/save previamente auditados. |
| `packages/app-shell/e2e/sucafina/wp03/installation-fixture.ts` | `8c015003e850561c5ee7fb430203fed4b06feaaf` | Instalação nova em diretório privado, setup técnico e factory real; sem correção financeira pela fixture. |
| `packages/app-shell/e2e/sucafina/wp03/installation-setup.ts` | `58f40c0f9908ad5cc8c1eebb74f4fd7a1e05283e` | Setup de configuração técnica local; não estabelece o contrato de aprovação financeira. |

Os paths abreviados de product/runtime têm prefixo `modules/sucafina/Sucafinav1/`. O novo business-services tem alterações de composição, mas preserva o predicado que exige moeda canônica. A queue continua distinguindo contexto indisponível de uma lista vazia válida.

Settings é alcançável pela UI, mas seu save é um formulário de configuração/política integral. Ele exige linhas de aprovação válidas; não há ação humana currency-only que grave apenas USD sem estabelecer/modificar esses campos. A ausência de moeda não autoriza52 a executar Settings/reset, preencher holders/thresholds, alterar política ou introduzir fallback monetário. Os detalhes de payload e recusa estática estão em `m52-procurement-queue-precondition.md` e `m52-currency-only-payload-static.json`. Nenhum desses payloads foi enviado.

Assim, há uma pré-condição de instalação ainda não satisfeita pelo código examinado. A nominal05 deve registrar seu próprio resultado; esta nota não antecipa HTTP503 como se já tivesse ocorrido em C25.

## Limite de53 e decisão semântica restante

O terminal53 `0ad96d0ffa97d309c90847211e943e59893040cc` liberou a implementação e encerrou sua lease. O HANDOFF53, blob `b1d0c5012f8c6687ecb15855207119984ca8a7e3`, e CONTRACT53, blob `e5b2899e409150dc7cb058b74ba8b318e7fb431b`, foram lidos integralmente no arquivo de origem preservado pelo intake57.

O caminho suportado é uma sequência de intenções humanas distintas: gravar a estimativa140 em draft/rejeitada, submeter140 já persistido, e o holder aprovar exatamente o snapshot140 congelado. A escolha C08 serve apenas de proveniência para preparar a edição e não concede aprovação. Approve não carrega um novo valor, submit não embute save, e a preparação C12 anterior continua recusando replacement sem contrato correspondente.

O nominal original mantém PR100 durante a escolha140, exige aprovação para a substituição futura e só depois exige outro efeito por Apply e recuperação do recibo único. Inserir save/submit para converter esse cenário em aprovação do valor já persistido mudaria seu significado. Também não basta chamar o novo core diretamente, usar os testes53 como prova instalada ou tratar CAS409 como recuperação C12.

O próprio intake57 confirma essa diferença: aprovar um snapshot persistido não aprova uma substituição ainda não gravada para Apply posterior. A proposta S0 de53 continua proposta, não autorização ou implementação. Não há patch completo honesto de52 que possa escolher esse novo contrato financeiro sem decisão do owner. Critério de resolução: contrato explícito da proposta futura, autoridade do holder/política sobre seu digest, consumo atômico no efeito real e recibo C12 recuperável, mantendo os predicados originais das cinco jornadas.

## Autoridade de handoff

O destinatário histórico solicitado continua47. Sua lease encerrou,55 sucedeu e também encerrou; o ACK57, blob `2572ec24161d5749987ae92d15405295add10ad6`, registra agora a sucessão limitada aceita e57 como único escritor da stack/PR65, epoch `S0-C-e11-browser57`. O handoff terminal de52 deve preservar essa cadeia e citar o integrador vivo reconciliado, sem52 aplicar os patches compartilhados. S0 mantém decisão de contrato/aceite;45 mantém checks. GLOBAL_RELEASE não é concedido por esta nota.
