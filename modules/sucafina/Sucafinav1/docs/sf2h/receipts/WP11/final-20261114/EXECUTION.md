# WP11 — execução e evidências finais

**Produto publicado e qualificado no escopo descrito:** `a3b57d475e7b564fa7b05932d3a81c5836e3e3c1` (W19), árvore `47e634b81b9a64fef462cb670373aa832b88b76b`. Branch `astra-wp11`, destino `sf2-stack`. O aceite integrado permanece **DRAFT/BLOCKED**; S0 revisa e integra. Este documento não autoriza merge em `dev` nem deploy.

O mapa preserva os **83 critérios literais**: **32 VERIFIED_SCOPED**, **23 PARTIAL**, **26 BLOCKED** e **2 NOT_ESTABLISHED**. As quatro tasks têm implementação e provas próprias, mas continuam PARTIAL onde o texto exige consumidor instalado, residência/native, aprovação formal ou resultado de uso humano ainda não observado. [CRITERIA.md](CRITERIA.md) identifica cada parcela; [CRITERIA.json](CRITERIA.json) conserva todas as asserções e suas referências.

## O que foi concluído e corrigido

### T01 — caso durável e versionado

Casos usam o provider real C08/SQLite com identidade e autorização do host, encarnação, versão esperada e histórico. A prova de concorrência admite dois comandos humanos distintos sobre a mesma versão: um commit e um conflito, com rascunho recuperável e receipt exato. O importador real rejeita namespace privado malicioso, conserva autoria/acesso/histórico e não torna válida uma referência antiga quando um ID reaparece com outra encarnação. E1 reexecutou o ciclo curto de segundo principal e concorrência; H7 fechou o ciclo financeiro completo com outro colaborador após desligar provider e UI originais. [43599284081](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599284081) · [43594957479](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43594957479) · [43597644083](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597644083)

Foram fechadas janelas de retorno após callbacks assíncronos em `case-port.read`, `draft` e `prepareIntentForCase`. Os negativos fazem CAS real durante o último callback, mantendo a concessão global ativa; o retorno deve recusar membership revogada, encarnação substituída ou conteúdo alterado sem incremento da versão de negócio. Não basta o callback lançar erro: o teste verifica fora do catch que o CAS aconteceu. E2 qualificou os sete negativos finais diretamente no W19. [43599613374](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599613374)

### T02 — cobertura e cálculo composto

O cálculo continua nos produtores canônicos WP03/WP05, sem fórmulas reproduzidas no WP11. Os cenários de renovação exercitam inventário completo, categorias compartilhadas sem dupla soma, inclusão duplicada recusada, ausência de FX, saída pending, desconto hipotético, zero confirmado, null, categoria omitida e N/A sem suporte. A cotação de implantação 70000 produz 235000 e economia 5000 no mesmo caso; o histórico anterior permanece íntegro. [43594957479](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43594957479) · [43598265482](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43598265482) · [43596513008](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43596513008)

Na história integral H7, training é inteiramente omitido, sem linha e sem pending pré-cadastrado. O validador deriva missing-category e conserva subtotal 210000, total indisponível e comparação condicionada. Uma nova fonte declara doze forecasts de treinamento: onze zeros confirmed e 40000 em novembro. A nova observação source-only chega a total completo 250000; a diferença de custo é +10000 e a vantagem é −10000. O critério mínimo de 20000 falha e o teto canônico de implantação passa de 55000 para 15000. A ChoiceRecord antiga conserva 210000, ressalva pending, razão, versões e digest. [43597644083](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597644083)

Essa distinção é deliberada: uma observação nova de fonte confirmada pode ter total completo; reexecutar as três operações hipotéticas originais pode produzir cobertura complete com total ainda indisponível. O PASS de current-choice não converte hipótese em compromisso. O certificado de intervalo usa prova estrutural canônica; a seleção de portfólio da fixture não demonstra o consumidor de portfólio integrado não vazio. [43597644083](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597644083)

A revisão aceita de critério foi qualificada em E1. Outra identidade operacional e expectedRuleVersion 1 criam a regra 2, alterando limite 150 para 50. A métrica controlada 100 muda de satisfied para failed; os dois registros históricos e a primeira avaliação conservam seus digests. Esse teste prova registry, versão, CAS e replay; sua métrica e grants controlados não são um novo cálculo financeiro Planner. [43599284081](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599284081)

### T03 — escolha humana e mudanças preparadas

B1B registra três escolhas com identidades operacionais e grants privados distintos: a inicial condicionada, outra após a nova cotação e a manutenção da escolha sob nova justificativa. Retry exato não cria quarta escolha; payload diferente sob a mesma identidade conflita. Os registros e receipts C08 anteriores permanecem exatos. Promover uma alternativa continua sendo uma operação diferente de registrar nova ChoiceRecord. [43598265482](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43598265482)

AR3 prova a sequência própria escolha → proposta revisável → aplicação Planner. O grant de leitura não escolhe; o de escolha não prepara; o de preparação não aplica. O review real apresenta a alteração 100 → 42 e apenas outra confirmação permite o commit e receipt. Rejeição separada de proposta não despachada conserva a escolha e sua razão. Março confirmado como premissa aparece ao lado do projeto oficial em maio; apenas um comando de domínio separado altera o oficial. [43591612696](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591612696) (attempt 2) · [43594721768](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43594721768)

Esses grants privados são chamados pelos testes. Não demonstram pessoa real na instalação, aprovação formal de PR/PO, nem geração humana da proposta Procurement: o teste entre domínios parte de propostas seed declaradas.

### T04 — receipts e retomada

Planner e Procurement executam comandos reais com receipts de domínio. Quando Planner aplica e Procurement conflita, o primeiro commit permanece; o caso e a ordem dos receipts sobrevivem ao restart, e retries não reaplicam o domínio já observado. Outro teste qualifica os dois comandos aplicados. Não existe promessa de rollback global. [43590675088](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43590675088)

Perda de resposta após commit é reconciliada pelo receipt autoritativo gravado atomicamente com a mutação. Se esse receipt fica ausente depois de uma tentativa durável, o estado é indeterminado/receipt-required: atores concorrentes e novo provider não podem fazer outro dispatch, review ou confirmação. Restaurar o receipt exato permite reconciliar sem efeito novo; receipt restrito não vaza no agregado. [43591930502](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591930502) · [43594721768](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43594721768)

O percurso approval-pending continua sem produtor real observado. Recusar um `submit_pr` não suportado não equivale a provar pendência de aprovação.

## Proveniência e replay

C17 usa requests e resultados persistidos, fontes atuais e replay canônico de cada ancestral. A prova nested produz 210000 no cálculo interno source-only e 211000 no externo com operação de implantação, preservando o resultado condicionado. Os readers históricos exigem referência exata no ledger, mesma encarnação e autoridade atual; não reclassificam resultado histórico como atual. Negativos de alteração na última verificação de fonte fecham as cercas próprias de result-store e scenario-request-store. [43590675088](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43590675088) · [43591612696](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591612696) (attempt 2)

O reopen nesses testes C17 é uma segunda conexão com writer/host original vivo. O desligamento completo seguido de nova UI e colaborador é a prova separada H7. O wiring C11/C17 publicado do owner foi lido e reconciliado, mas não houve testemunho de execução native com skill/session/provider instalados. [INTEGRATION.md](INTEGRATION.md) registra o que está presente e o que falta.

## Browser e limites da prova visual

B1B executou Chrome real, com preparação de instalação autenticada e cleanup. O consumidor de dados BI leu resultados reais do mesmo caso, mas o renderer foi importado por data URL em `about:blank` com a projeção observada. A tabela foi comparada aos componentes canônicos; rótulos de total/diferença, fonte de treinamento, click e Enter foram verificados. O callback registra a referência exata em dataset. Isso comprova renderização e interação do componente, não navegação autorizada até a fonte nem a cadeia de montagem do aplicativo instalado. [43598265482](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43598265482)

## Resultado do CI cirúrgico

Não foram executados testes de produto, typecheck, build, install ou suíte epic localmente. As verificações abaixo ocorreram no CI hospedado. A inspeção local se limitou a fonte, metadados, digests e logs. O índice integral contém **43 registros terminais: 24 tentativas de testes e 19 checks**. [CI-INDEX.json](CI-INDEX.json)

### Qualificação do candidato final

| Método | Nomes únicos | Interpretação |
|---|---:|---|
| Execução direta W19/E2 | 7 | Sete negativos de egress nos bytes finais do teste. |
| Grafo completo idêntico | 39 | Mesmo fecho relativo de fonte e configuração; execução conserva seu SHA original. |
| Símbolos revisados + regressão focada | 54 | Delta restrito de case-port, com revisão independente e H7/E1/E2. Não é igualdade de arquivo/grafo nem novo run desses nomes. |
| Total | 100 | 44 arquivos de teste; sem dupla contagem de reruns. |

Uma dessas qualificações restritas (BI) conserva uma referência import type estrangeira ausente e o diagnóstico TS2307 de baseline. Essa fronteira é declarada no audit e impede alegar grafo inteiramente resolvido ou typecheck verde. [candidate-audit.manifest.json](candidate-audit.manifest.json)

### Execuções de testes preservadas

| Seleção | Produto | Run / tentativa | Observado | Resultado agregado |
|---|---|---|---|---|
| W2 | `efa0e57e5486` | [43580722320](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580722320) / 1 | 48 PASS / 4 FAIL; sem resumo Bun final | cancelled |
| W5-A1 | `be50d42d6a2c` | [43584601515](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584601515) / 1 | 23 PASS / 1 FAIL; 2.28 s | failure |
| W6-H1 | `11261a57ebb5` | [43585795893](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43585795893) / 1 | 0 PASS / 1 FAIL; 180.16 s | failure |
| W6-AR1 | `11261a57ebb5` | [43586380221](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586380221) / 1 | 24 PASS / 2 FAIL; 182.38 s | failure |
| W6-C1 | `11261a57ebb5` | [43586946650](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586946650) / 1 | 58 PASS / 2 FAIL; 1210.74 s | failure |
| W8-H2 | `a12f29ce6401` | [43588796286](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43588796286) / 1 | 0 PASS / 1 FAIL; 180.25 s | failure |
| W9-H3 | `65509f0b8c43` | [43589978549](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43589978549) / 1 | 9 PASS / 1 FAIL; 139.61 s | failure |
| W9-AR2 | `65509f0b8c43` | [43590675088](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43590675088) / 1 | 4 PASS / 2 FAIL; 120.12 s | failure |
| W10-H4 | `14d0cef14256` | [43591146911](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591146911) / 1 | 0 PASS / 1 FAIL; 180.16 s | failure |
| W11-AR3-attempt1 | `c41d7277be59` | [43591612696](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591612696) / 1 | 0 PASS / 0 FAIL; sem resumo Bun final | failure |
| W11-AR3-attempt2 | `c41d7277be59` | [43591612696](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591612696) / 2 | 2 PASS / 0 FAIL; 5.81 s | success |
| W11-F1 | `c41d7277be59` | [43591930502](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591930502) / 1 | 37 PASS / 12 FAIL; 1.63 s | failure |
| W12-F2 | `1fa71a64faf2` | [43592791648](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43592791648) / 1 | 11 PASS / 1 FAIL; 10.11 s | failure |
| W12-H5 | `1fa71a64faf2` | [43593078090](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43593078090) / 1 | 0 PASS / 1 FAIL; 180.3 s | failure |
| W13-F3 | `d7775d6f1eb1` | [43593540746](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43593540746) / 1 | 6 PASS / 0 FAIL; 0.765 s | success |
| W13-C2 | `d7775d6f1eb1` | [43593961201](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43593961201) / 1 | 2 PASS / 0 FAIL; 301.98 s; 6 filtered out | success |
| W14-R1 | `dd9363dab38a` | [43594721768](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43594721768) / 1 | 7 PASS / 0 FAIL; 1.121 s | success |
| W14-B1A | `dd9363dab38a` | [43594957479](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43594957479) / 1 | 5 PASS / 1 FAIL; 274.36 s | failure |
| W15-H6 | `18d4c4dc502a` | [43595614889](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43595614889) / 1 | 7 PASS / 1 FAIL; 180.51 s | failure |
| W16-R2Q | `dc9d4327d07d` | [43596513008](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43596513008) / 1 | 7 PASS / 0 FAIL; 59.52 s | success |
| W17-H7 | `26bb96b22fbf` | [43597644083](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597644083) / 1 | 23 PASS / 0 FAIL; 260.67 s | success |
| W17-B1B | `26bb96b22fbf` | [43598265482](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43598265482) / 1 | 3 PASS / 0 FAIL; 329.72 s | success |
| W18-E1 | `1c262ba4548c` | [43599284081](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599284081) / 1 | 21 PASS / 0 FAIL; 0.611 s | success |
| W19-E2 | `a3b57d475e7b` | [43599613374](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599613374) / 1 | 7 PASS / 0 FAIL; 0.324 s | success |

O resumo de um run misto não foi promovido a success para reutilizar um teste que passou. Em C2, somente os dois nomes selecionados de treinamento foram observados; os seis filtrados não entram como novas provas. A primeira tentativa AR3 falhou na infraestrutura antes dos testes; a segunda passou e permanece identificada como attempt 2.

### Histórico de falhas e correções

W2 foi cancelado após 45 minutos. As histórias H1, H2, H4, H5 e H6 expiraram com o limite original; H3 falhou por forecasts de treinamento estimados. A fixture passou a declarar explicitamente os doze forecasts anuais, conservando o comportamento fail-closed correto do produto. O trabalho de desempenho retirou composição e classificação descartadas dos portos auxiliares, manteve observações canônicas e fences e consumiu o batch publicado do produtor; nenhuma fórmula, cache entre fences ou limite de 180000 foi alterado. H7 completou todas as asserções em **177754,86 ms**, com margem de aproximadamente **2,25 s**, sem prova de folga geral de desempenho.

C1 reteve dois timeouts de consumidores financeiros; os dois nomes específicos foram posteriormente qualificados em C2. AR2 teve duas falhas de fixture resolvidas em AR3 attempt 2. F1/F2 tiveram falhas de setup/seed preservadas; F2 qualificou promoção e F3 fechou HotTopic. B1A reteve a falha de current-choice; R2Q e H7 qualificaram o caminho corrigido. W18 E1 passou em runtime, mas o check tinha um erro próprio de optional-string no teste; W19 adicionou o guard explícito e reexecutou somente seus sete negativos. O índice conserva todos esses resultados.

### Check final W19

| Gate | Resultado real |
|---|---|
| Typecheck do pacote | **FAILURE: 0 diagnósticos próprios, 130 estrangeiros**, bytes iguais ao baseline estrangeiro observado em W17. |
| Guards | **SUCCESS:** 78 regras, 864 paths alterados, 12 avisos, 0 gates, 0 erros. |
| Run | [43599586885](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599586885) |

Zero diagnósticos próprios não torna o check global verde. Os avisos e paths estrangeiros não foram suprimidos. Os artefatos ZIP foram obtidos por URL assinada fornecida pelo MCP e verificados por SHA256 e source/tree. As seleções sem execução omni registram o verdict canônico `not applicable`; isso não é controle positivo de omni.

## Entrega para revisão

Os arquivos finais são [CRITERIA.json](CRITERIA.json), [CRITERIA.md](CRITERIA.md), este [EXECUTION.md](EXECUTION.md) e [INTEGRATION.md](INTEGRATION.md), acompanhados do índice de CI, audit de fontes, recibos e manifest de cópias exatas. O commit de evidências pode suceder o produto W19 sem mudar seu runtime. S0 deve revisar os limites e fechar as dependências externas antes de aceitar a composição. Nenhum estado READY, merge em dev ou deploy é declarado.
