# Rodada 3 — parecer independente de supervisão

**Candidato:** `10a99bf06c5578ec02dab590a680ab18766c7ff4`  
**Parent comparado:** `0aa2405bb3668314f60d6a674d2bd53fd5003091`  
**Veredicto:** **APPROVED_FOR_EXECUTION** — aprovação do delta documental, com um P2 de disposição não bloqueante.  
**Achados:** P0 = 0; P1 = 0; P2 = 1.  
**Produto e provas de produto:** **NOT_RUN**.  
**Data:** 2026-11-13 03:05:27 UTC.

## Escopo e conclusão

Revisei o delta da supervisão desde o lançamento até a liberação global: capacidade global e pools, missões fixas, ACK/admissão, comunicação, reservas, leases/epoch, retomada, rotação de reviewers e término. Acompanhei essas bordas na fonte canônica, em `WORKFLOW.md`, `execution-workflow.json`, `schedule.json`, ownership, prompts e partes pertinentes dos packs. Não refiz a investigação do código de produto inalterado nem li as conclusões dos outros revisores desta rodada.

Não identifiquei P0/P1. O plano conserva a distinção entre os vinte slots **desejados** e os quatro slots **globais observados**. O preset N4 continua não admitido. Esta aprovação não inicia a implementação e não transforma capacidade ausente em disponível: sua execução continua condicionada ao preflight e à admissão descritos no próprio plano.

O único achado é uma ambiguidade pequena entre a chave antiga no resumo da topologia e a chave específica do protocolo de eventos. A disposição é seguir `event_protocol.idempotency` e harmonizar o resumo na próxima regeneração.

## Achado R3-SUP-P2-01 — duas chaves de deduplicação

**Severidade:** P2. **Estado:** aberto com disposição não bloqueante.

**Requisito.** Eventos distintos precisam alcançar a supervisora; apenas um retry do mesmo evento pode ser descartado. A regra específica já diz para deduplicar `event_id` dentro de `execution_instance`, acompanhando sequência por ator/tentativa.

**Localização.** `campaign.json`, ponteiros `/execution_workflow/topology/event_idempotency_key` (linha 31744) e `/execution_workflow/event_protocol/idempotency` (linha 31999). No espelho, `execution-workflow.json` linhas 85–90 e 321–340.

**Contraexemplo concreto.** S3-R3 publica dois achados diferentes, F01 e F02, sobre WP10.T06, o mesmo C e o mesmo lease epoch 2. F01 recebe `event_id=r3-17`; F02 recebe `event_id=r3-18`. A tupla do resumo, `campaign_id/lane_or_output_id/epoch/sha`, é igual para ambos. A chave específica `execution_instance/event_id` é diferente, como deve ser.

**Consequência.** Um consumidor que siga o resumo pode descartar F02 como duplicata e atrasar sua correção. Não foi observado software fazendo isso: o problema está na divergência entre duas instruções do plano. O protocolo detalhado já contém a regra correta.

**Correção mínima.** Remover a chave ampla da topologia e apontar para o protocolo específico, ou substituí-la por `["execution_instance", "event_id"]` no canônico; regenerar os espelhos. Epoch, SHA e sequência continuam válidos para validar e ordenar eventos, sem substituir sua identidade.

**Disposição.** Não bloqueia a aprovação documental porque a regra operacional específica já está definida corretamente e não há consumidor executável novo demonstrado usando a chave ampla. Para a execução, prevalece `event_protocol.idempotency`; recomendo harmonizar a chave antes do lançamento. A aprovação não permite aplicar a tupla ampla como dedupe geral.

**Rechecagem proporcional.** Conferir a chave no canônico e no espelho; executar `render_plan.py --check`. Duas event IDs diferentes no mesmo C devem continuar sendo dois eventos; retry da mesma instância/event ID continua sendo um.

## Verificações realizadas

| Verificação | Resultado e significado |
| --- | --- |
| Escopo preservado | 15 WPs, 74 tasks, 17 contratos, 1.610 critérios; mesmos conjuntos de task IDs e criterion IDs do parent; todos os critérios `NOT_RUN`. |
| Geração | `PYTHONDONTWRITEBYTECODE=1 python tools/render_plan.py --check`: exit 0, 100 artefatos, `drift: []`. Scripts lidos antes da execução. |
| Capacidade documental | `validate_execution_plan.validate_execution`: 456 asserções, nenhum erro; 20 slots desejados, 23 identidades, 19 handoffs, 18 leases de skills e três reviewers novos. Não é prova de capacidade disponível. |
| Sincronização | `schedule.json == campaign.timebox`; `ownership.json == campaign.ownership`; `execution-workflow.json == campaign.execution_workflow`; as 23 alocações dos packs coincidem com a fonte. |
| Integridade | 47 arquivos pertinentes conferidos contra `sha256.json`; nenhuma divergência. |
| Produto | Nenhum teste de produto, CI, prova AM, guard C/D ou execução live foi realizado. |

## Bordas operacionais acompanhadas

### Lançamento, ACK e capacidade

A sequência está explícita: capacidades e payloads fixos → lançamento/reconhecimento de instâncias → ACKs reais → admissão do roster e dos leases. O preflight não exige ACK de uma sessão que ainda não existe. A transição para ACTIVE depende da capacidade observada; incapacidade de prover o preset leva a CAPACITY_HOLD.

As condições de admissão não inferem pools de IDs de sessão nem multiplicam a árvore de collaboration por nesting. O limite de quatro slots globais aparece no workflow, cronograma, COMMON e entradas. Modelos e runners são capacidades separadas. Outro N exige realocação completa validada antes da admissão.

Fontes: `execution-workflow.json:/topology`, `/mission`, `/startup_sequence`, `/state_transitions`; `schedule.json:/capacity`; `prompts/S0.md` e prompts S1–S4.

### Reservas e caminho crítico

T0 inclui arranque, preflight, ACK e setup; o relógio não reinicia. A composição nativa recebe AI-NATIVE, NATIVE-CASE, NATIVE-PLANNER e NATIVE-RUNTIME dentro da reserva de S0 T10–18, incluindo o encontro em T16–18. Não depende de esperar T25.

O delta reserva T55–60 para guia/roteiro/changelog e T60–75 para consumidores e ajustes antes de C. A cauda memória T68 → consumidores T75 continua marcada como risco concreto. Nenhum novo slot é criado para controle ou documentação. G2H exige durações e capacidade observadas, mantém UNKNOWN quando faltam dados e calcula a última data de freeze pela cauda crítica. T103 e T118–120 são reservas, não alegações de duração medida.

Fontes: `WORKFLOW.md` seções 3–4; `execution-workflow.json:/dispatch` e `/documentation_reservation`; `schedule.json:/actor_allocations` e `/feasibility_gate`.

### Transporte, ownership e retomada

A comunicação depende de capacidades realmente expostas. Git mantém o ledger e não cria nem desperta uma conversa. O fallback lê deltas de heads/recibos S1–S4 em lote enquanto S0 está disponível; o alvo de dois minutos não é tratado como garantia.

S0 mantém a única escrita de sf2-integrate e o estado transitório em sf2-control. O controle não é base CI nem é mergeado em C/D. Transferências exigem head recebido, lease anterior encerrado e aceite do próximo writer. Substituições exigem fencing/encerramento real, incremento de epoch, tentativa nova, workspace isolado e CAS do head aceito. Outputs revogados não entram na integração.

Silêncio, espera de ferramenta ou idade do checkpoint não equivalem a CLOSED. A retomada da mesma instância usa checkpoint e delta; autoridade incerta impede novo writer concorrente, mas permite continuar frentes disjuntas.

Fontes: `execution-workflow.json:/transport`, `/event_protocol`, `/coordination`, `/recovery`; `ownership.json:/coordination`, `/actor_boundaries` e `/shared_branch_policy`; `WORKFLOW.md` seção 7.

### Reviewers e liberação global

Os três reviewers novos só ocupam os slots liberados por S1-B/S2-B/S3-A depois de handoff aceito e liberação real. As coordenadoras assumem as correções e não julgam a própria autoria. Antecipação exige predecessores, slot livre e atualização da reserva.

READY_FOR_INTEGRATION não encerra a campanha. Coordenadoras mantêm obrigação de retomada até GLOBAL_RELEASE. T120 incompleto aciona continuidade com atraso, preservando escopo e gates. GLOBAL_RELEASE depende do aceite de C, provas/revisões, envelope/guard de D e publicação remota conferida; S0 resolve leases e notifica as sessões. Um bloqueio externo permite encerrar o turno apenas após exaurir o trabalho independente autorizado, preservando checkpoints e pendências.

Fontes: `execution-workflow.json:/dispatch/reviewer_early_start`, `/recovery/reviewer_rotation`, `/finish` e `/state_transitions`; `schedule.json:/slot_lifecycle`; prompts e `WORKFLOW.md` seções 6–7.

## Limites do parecer

- O preset N4 permanece **não admitido** no backend atual. A aprovação do plano não comprova cinco pools independentes, capacidade de vinte atores, launcher, wake ou fencing.
- O alvo de 120 minutos permanece **condicional e não medido**. Não se demonstrou redução de tempo, custo ou tokens.
- As verificações são documentais. Produto, CI, provas AM, guards C/D e integrações continuam **NOT_RUN**.
- A associação do snapshot ao SHA é a identificação imutável fornecida pelo integrador; os hashes locais pertinentes foram conferidos. Não fiz nova confirmação remota do head no GitHub.
- A seleção integral de contexto e a qualificação minuciosa das provas pertencem a escopos independentes; este parecer não presume seus resultados.
- Nenhum arquivo do candidato foi editado e nenhum comentário ou mensagem externa foi publicado.

## Hashes dos arquivos revisados ou conferidos

As modalidades de leitura — semântica focal, delta ou conferência mecânica de alocação — constam no JSON pareado. Os hashes abaixo identificam os bytes do candidato utilizados.

| Arquivo | SHA256 |
| --- | --- |
| `formal-review/round-3/PROTOCOL.md` | `8d2544bf45b48cdc3f42a0c138a9e693a4bfb0c10effd202b125beccf9135b57` |
| `WORKFLOW.md` | `5be6e8fe0928160762897fb58b760f95c5949c8be6f332fb1393abec3f299a4c` |
| `execution-workflow.json` | `a85ca197fc08b66acc75e56636932988ab9eb52732ea989722fec78d4afc6ef6` |
| `schedule.json` | `dfe70767e81524bd6212690357c10715eb3cc04f749f732377ff56daef0cdc7d` |
| `campaign.json` | `044c729f37c055bf81c1cf4832ad37ffcd96b77834e0c725b6a0da51c1a4421d` |
| `ownership.json` | `3129c0156a21e319d71e8a4c4b38c12bbc8507226457af26752c4a049d5a1d32` |
| `START.md` | `2fe153c2360feec3e937ecdc2a8a9460032303d5c0fad2d61ae97853f6e4aa49` |
| `README.md` | `234fbfbc52655b215e512d08da6c2c09b4a8bc4c03358958594feb8482169285` |
| `execution/COMMON.md` | `8e5a92df01791d602b3666533038d1bea6fe70e5ce84f2b8ffec4cd071658e86` |
| `execution/manifest.json` | `7065f3e0eb36a9118cf45c3067b6f0961752cbefdb0a95620356da32f0823065` |
| `specs/execution-reconciliation.md` | `2f259b023568cf0e0a66af60541a6ae3dc6dee5a73395dc3b12ae1c3c41dd55b` |
| `tools/render_plan.py` | `7df6394361619b374a2dcc3a91dd63585d6d4314cb3289e2e66d5d2606e37a42` |
| `tools/render_fast_context.py` | `151da2ea446177dfec7501cec5387415a21d12e59188575cfbaa6429a790df68` |
| `tools/validate_execution_plan.py` | `951c1fc4d6b110cf61f9983112ff0c212b29c018068f12a56864d4dc5a8b8842` |
| `prompts/S0.md` | `ce8c6f744c7bb49f8c0eff654561314dadb7d63acf7bfa51b5c1ad27e77ecd83` |
| `prompts/S1.md` | `10b40776f4f7d32784b45839a1477f9085c308b86ed3b539e4029660f5c9c5e7` |
| `prompts/S2.md` | `8622c0b542455e98e3173a321f4303d0580b631d95e02d80d7a443cc3979d406` |
| `prompts/S3.md` | `9086bef04de740bb88a71432ff5b7865c66d91f93dfe21708c9c39976f44c620` |
| `prompts/S4.md` | `fe18cc92d52f8ce6d381176241bae9d540bca8392cc05b3b0f8bb44cabe18975` |
| `execution/actors/S0.md` | `8013cbda6c9eee9668999d28e2be664896b675a986fc65974526a075118150c0` |
| `execution/actors/S1.md` | `096adbcd66af7aabf2eb83748ff836350952dab9ebb2a95d201a28c863acc04c` |
| `execution/actors/S0-C.md` | `33aca887d400ac81080c65d641990834ed4f278bd5b34eacc7fa039fd70bbb34` |
| `execution/actors/S1-B.md` | `eee0ef8f0d670082db98faa8a2cad287e703e743eb5d40daa69f248b9f2d577b` |
| `execution/actors/S1-R1.md` | `fe3b4a9c4cdc6b8b8b8b7a05e6c511f555f2a416288115d9d05a975e706c77c0` |
| `execution/actors/S0.json` | `2d759f9761217cf9c495f88cb8c66754f3c5e1c52d30061b989a3682d801eca8` |
| `execution/actors/S0-A.json` | `53c96a40171ac82e999bbef9c274e4e941585b97c7ac43058c80a200e490931e` |
| `execution/actors/S0-B.json` | `4441e156b5013d22ace7c5e876eabe6b094a9678fb16ab9612997f1b9fb49c0d` |
| `execution/actors/S0-C.json` | `d0d5088fc86d77a155528ecdb5d63bdf13e85228d9d42809ef415cd64975fcdf` |
| `execution/actors/S1.json` | `2b6791b48b22a0ccf84f61b5c077a7b47564153277002e764be24f193c9516da` |
| `execution/actors/S1-A.json` | `aaf90f8b2481869db177c188760c8ba027ecbcf1d2f5e2503c55da12d0afae05` |
| `execution/actors/S1-B.json` | `3f2dc699d545ffed7f642344c796562752082078aa5554e2da07efbbc6e0741f` |
| `execution/actors/S1-C.json` | `84d7f9cce9f0a663f395d72564a38d0e57a278e687e06086c23596b44b55690f` |
| `execution/actors/S1-R1.json` | `303e2c99dddb78bc422e77d80b9d68968fac88bb5eb6377f4f09514da992abf0` |
| `execution/actors/S2.json` | `e3951055ff3e1b7145f7c23d4b19a8b096d804b93f1704e6ed21d51e899283b7` |
| `execution/actors/S2-A.json` | `2f29384cf68357c24603ff85cf203c1244feeaa7c170e3a170a2c0b6ab0a1cc5` |
| `execution/actors/S2-B.json` | `ce32b3047e5ebc981befc6e8aa7a7262afdf8aa6ff0c260c89b025b21d9eebe2` |
| `execution/actors/S2-C.json` | `7ec77ec5440ac217d57f24857366b582c18b68cf8b21eae74da960a465c1500d` |
| `execution/actors/S2-R2.json` | `8d3b42d72ca791da45bd366a415328b43ddf065f82fc16403c7bbac7099dc41b` |
| `execution/actors/S3.json` | `95e93e2170ad99d384ffcd73fbc06dbbd22a270fa6786cbab84c9bc4d3c8998a` |
| `execution/actors/S3-A.json` | `819eebd60e5563a3437cf3db7c972216db970f66287ba06ce348c70d8c166bdb` |
| `execution/actors/S3-B.json` | `6ddf617f6d3fc6ff8e1b5830f594869cf0067c282483708f37c4e2c457d04187` |
| `execution/actors/S3-C.json` | `4ab7c1be90c2e9c9b7c16ad11b66ce1c264c98ec3e748821db65aa7321b73327` |
| `execution/actors/S3-R3.json` | `5c5edb170cc243dac99ca16fd798b85e519803404221b8deb4cc47408a9399da` |
| `execution/actors/S4.json` | `43b3f7f5e9e54f3cf9c177f8b9f4abdb642e7fbc33d2ce209a94e22d0bdce64f` |
| `execution/actors/S4-A.json` | `4348c707904f1a7379bc40805631474109f24e8c5311da03bd5b7a6016db4efe` |
| `execution/actors/S4-B.json` | `e2869a044af5fc5b5c9beead46773f258679820c34911c2fb8a3b406aceaae71` |
| `execution/actors/S4-C.json` | `e343808efb21fe4b2edeb716f43842d71d33ceb9c7db6ebdd5b95ae2b387fb35` |

### Instruções locais lidas

`/workspace/scratch/838a0195183d/sf2h-fixes/guards/materialization/candidate-0aa2405bb366/AGENTS.md`  
SHA256: `f87f3c732f8aafec8d02501a5f11f050c07d33d350890fb12f69d8b288b830f9`.

