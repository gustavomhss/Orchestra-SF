# MemoryA27 — causa, fronteira e correção

## Resultado e escopo do candidato

A implementação de runtime W35 `ab511e9ab2dcb0f64b34bea944533cdbf7ed98e7` instala a validação canônica da captura no preflight/commit Memory. A mudança de produto está limitada a `analysis-stale-commit.ts` e ao reader necessário em `business-context.ts`. O candidato final W36 `f29f9f7acdc860590581d76e1d276139da7af1e3` acrescenta somente a prova focal dos três entrypoints de revogação e recibos, com runtime idêntico. Os resultados executados e seu estado terminal estão nos recibos de cada tentativa e no HANDOFF; este documento explica o mecanismo.

## Causa comprovada

A27 (`43624030665`) corrompeu `atlas.originals[original.refDigest].projection` sem recomputar o digest. Atlas recall retornou `unavailable`, mas staleAccess.preflight retornou `ok` em `historical-memory.test.ts:580`. A falha era uma assertion de integridade.

O wrapper consultava apenas `BusinessContext.context`. O reader Procurement instalado pode comprovar continuidade histórica C12 e acesso atual à fonte independentemente da captura Atlas. Essa prova de fonte não valida os bytes persistidos da captura. O reader canônico Atlas já rejeitava esses bytes.

A contraprova MI01 reproduziu exatamente essa divergência no runtime entregue, com Atlas/C08/SQLite/BCS e wrapper reais. O teste chegou ao expected `denied` / received `ok`, depois dos positivos íntegro/histórico e da recusa do Atlas. O run permanece FAIL, mesmo tendo cumprido seu papel de contraprova.

## Fronteira instalada

O wrapper retém o Request original, clona start/proof e decodifica o DecisionRecallInput original. Confere currentCase e query. A resolução real de fontes continua obrigatória sob C08; fingerprint antigo é identidade do run, nunca grant.

A composição Atlas real associa uma rota privada ao array exato devolvido pelo context. O helper exige a mesma call e consome a associação uma única vez. O WeakMap guarda a rota do reader, não uma autorização ou resultado anterior. Uma lista copiada/fabricada não recebe essa rota; cada preflight e commit faz novas leituras protegidas. O contrato frozen BusinessContextService e o proxy business-services permanecem intactos.

Para um evento e um envelope, o helper usa o fold canônico, verifica a topologia e os source maps e chama `memory.readOriginalCapture` para cada referência expandida. Esse reader instalado valida o journal, refDigest, owner, vínculo ao caso/envelope, captureDigests e projectionDigest e revalida sua autoridade. Referências ainda não resolvidas passam pelo context real; a continuidade é comprovada pelo router real. A igualdade da projeção é exigida para historical como no leitor canônico, sem acrescentar uma igualdade indevida a fresh.

Partições vazias, múltiplas, ambíguas ou fora da forma admitida continuam usando o recall canônico completo. O resultado vazio não comprova referências exigidas. Uma captura íntegra não pode mascarar a corrupção de outra entrada selecionada. Não há parser alternativo de captura, reparo silencioso ou recálculo de digest para encobrir corrupção.

O helper conserva a autorização integral do case por `cases.read`, incluindo fontes e operações fora do envelope. Após todas as capturas/continuidades da rota curta, abre os cases novamente e compara seu conteúdo. Essa segunda leitura foi mantida para recusar revogação tardia de uma referência cuja ACL externa não participa do digest de C08.

Request, headers, binding, seleção original/cópia, resoluções recebidas, capturas devolvidas e snapshots permanecem fixados até a revalidação final. O wrapper ainda executa human.authorize e host.revalidate após o helper, além das comparações síncronas. A preparação de commit permanece vinculada aos headers e source fences.

## Refinamento causal e provas intermediárias

W32 primeiro ligou o recall completo ao wrapper. MI02 executou 12 casos: 11 PASS e uma falha de injeção de teste, que tentou uma escrita aninhada proibida pelo C08. A assertion de recusa desse caso não foi alcançada. W33 corrigiu somente a injeção para alterar o snapshot real do callback de uma transação externa, com commit:false; MI03 passou esse caso isolado. Nenhuma assertion foi relaxada.

MI04 executou o histórico original sem mudanças. O novo recall completo fez stale.preserve durar 23334ms; o cenário atingiu seu deadline original de 225000ms antes da cauda. Essa tentativa permanece FAIL e não prova as três revogações finais. Não se repetiu A27 inteiro nem se alteraram os budgets 225000/240000.

W34 reduz somente o trabalho duplicado introduzido por aquela chamada: utiliza o reader de captura já instalado junto das observações atuais e remove resoluções/continuidades globais redundantes e o context posterior ao recall. Mantém ambas as leituras autorizadas do caso. MI05 executou o refinamento: 12 PASS e 1 FAIL. Os resultados anteriores não são apresentados como execução neste candidato.

Os três faults próprios foram ligados ao readOriginalCapture real, depois do context real retornar, sem substituir respostas por callbacks permissivos. A revogação calibra a última leitura real; headers calibra a última revalidação real. O teste adicional cria um segundo evento C09 sintético, produz suas entradas Atlas/scanner reais, comprova o positivo de múltiplos envelopes e corrompe somente a segunda captura.

MI05 preservou os positivos íntegro/histórico, stale.preserve, os negativos de identidade/autoridade e o fallback de dois envelopes. O caso de alteração da fonte durante await revelou uma ordenação incorreta: após o reader devolver, o helper chegava à continuidade antes de verificar a mudança no snapshot. Esse reader tentava refresh e o C08 encerrava com nested write. W35 acrescenta uma única verificação stable() depois de fixar o digest da captura retornada e antes do próximo await. A assertion permanece denied; o fault e os demais testes não mudam. MI06 passou o caso afetado (1 PASS, 5 expects). MI07 reexecutou o histórico intacto e terminou FAIL225000 ainda em memory.fence-final-request-headers, antes do caminho stale modificado; as assertions580/583–585 não foram alcançadas. Esse resultado não autoriza culpar o novo reader nem declarar o histórico green. Não houve rerun inalterado, diagnóstico adicional de desempenho ou alteração de X29. MI08 provou separadamente os três entrypoints finais: 3 PASS/0 FAIL,51assertions,95.22s; cada positivo concluiu recall canônico real (2/2/4 leituras) antes da mesma chamada retornar unavailable por revogação. A captura permaneceu íntegra. Essa prova não substitui o resultado histórico. O check do candidato final fica em recibo próprio.

## Limites de crédito

As fixtures declaram metadados sintéticos de caso/choice/lifecycle. Source issuance, C12, C08/SQLite, BCS, Atlas, scanner e wrapper são reais. Nenhuma Session/modelo nativo é executado ou creditado. As revisões técnicas contribuíram para o desenho e não contam como três pareceres FINAL independentes da campanha.

Esta correção não fecha C17 entre observações, X29, restart→recall→UI, provas AM/GNATIVE, UI/ACK/exports de outras sessões ou qualificação global. Os handoffs e resultados anteriores permanecem preservados.
