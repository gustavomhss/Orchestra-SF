# Missão71 — C45 composto e handoff terminal

**C45 material: 5585e57f90d7b8d45e0577a8f0f4aa7884d3b58d**  
**Tree: 5bb9151ba20f606c42b8a073f246365e49d6e116**  
Branch `sf2-stack`, mesma PR65 draft para `dev`. **GLOBAL_RELEASE=false.**

A71 sucedeu a60 explicitamente encerrada em `faa30fddb7e7b61696b66fd069f51cf18c51125f`, publicou ACK71 `99d404ef15e12161b9043b3ac020bbb814d710dc` antes de produto e foi a única writer do stack. A lease `S0-C-e13-browser71` encerra com o CAS documental que contém este handoff. O SHA/tree desse terminal é publicado na PR65 após readback; ele é distinto de C45 e não constitui o envelope D/G8 de S0.

## Composição entregue

São **17 incrementos C29–C45**, todos por GitHub MCP/CAS expected-head, force:false e commits com skip-ci. Entraram unidades explicitamente liberadas de59,63,64,61,65,66,68,69,73,72,62,75,67,80,76,74 e86, nessa ordem. Cada incremento teve seus postimages completos, ancestralidade e delta relidos. O catálogo [candidates-final.json](candidates-final.json) fornece todos os pins e manifests.

O agregado desde terminal60 contém **168 caminhos únicos:48 modificados e120 novos,174 aplicações seriais,6 caminhos sobrepostos e302 hunks**. O patch integral tem1.454.681 bytes, Git blob `88d5bc3b0e0f1ec5e75c67c9990ebcda4fc128ac` e SHA256 `a98ee4bc1d3e510bfb9b1c1190019ed76a46f3c5efa6ad8601d6b02fbfe28fe7`. Reconstrução textual exata de todos os preimages/contextos/postimages, hashes e modos; zero fuzz/offset. Isso é verificação de material, não execução do produto.

- [Patch completo](complete-material-C45.patch), [manifesto pre/post](material-manifest-final.json) e [verificação textual](material-verification-final.json).
- [Inventário atual](validation-inputs-final.json):1.095 caminhos examinados,1.093 presentes,168 materiais exatos e apenas2 exclusões52 esperadas;0 dependência requerida ausente. Os345 inputs60 e os23 recursos residentes foram reconciliados. O inventário estático não substitui o programa TypeScript real.
- [Closure](dependency-closure-final.json), [ACKs](consumer-acks-final.json), [censo finito](source-census-final.json) e [arquivo documental](documentary-archive-map.json).

## Decisões em interfaces compartilhadas

59→72 foi composto serialmente no LocalStore, preservando a raiz readonly e a qualificação de manutenção/auth. A64 entrou com o host-context mínimo inerte: nenhuma origem, policy, continuidadePermission, Task executante ou Schedule foi inventado. A62 incluiu os17 paths próprios e três consumidores externos completos aceitos pela writer71; a proposta de fixture permissiva não entrou. A67 usou os preimages corrigidos, não a tentativa com LF extra, e preservou as propostas não qualificadas52/first-save.

A75 foi inicialmente consumida como W4 material explicitamente congelado, ainda com lease de qualificação ativa. Seu terminal posterior foi recebido sem reintroduzir os nove arquivos. A74 entrou atomicamente com10 paths liberados e novo mapa Microsoft+fixture derivados da composição72: entry `04fa7d53b8f2a4d4f7375c0f069a6ae38523e877`, installation `8a62babdccaa4bcecbfc64e385b728315208a7c1`, serve `1356a4c3099d10c62e470142209ced0f8033a6e1`, mapa `764b7223c3842855764c6832826708ba9eccc2b0`, fixture `6517ff7b77fcb48bd0c471352d3906ddd43157f0`. Source49 e mapas55/72 permanecem intactos.

A86 acrescentou a reautorização da saída de bytes no application `a0deff8a3b272019f472aa2f93499d1940a78370` e três testes/helpers. A unidade completa tinha cinco paths; o oracle legado `5c25f109c4df835761e8aba8351686174ac6d7aa` já estava em C37 e não foi reaplicado. A expectativa403 do repro66 continua intacta. Não foram copiados branches inteiros, snapshots em andamento, overlays diagnósticos ou policy25MiB.

## Evidência recebida e seu limite

**C45 não executado.** Nenhum teste, compiler, typecheck, build, guard, preflight, CI, AM ou movimento de ref de workflow foi realizado por71. Os resultados seguintes são de autores/fontes ou candidatos anteriores, nunca crédito global paraC45:

| Entrega | Evidência efetiva | Limite conservado |
|---|---|---|
|59 /64|130 testes fonte59;158 componentes64|P03 não resolvido; componentes64 não provam host nativo instalado|
|75 terminal|R3 realClamD7PASS/150expects; R4 cinco originais OperationsPASS emC40|R4/S901dc9… pertence aC40;251critérios preservados, nenhum encerrado integralmente|
|85 documental|R3 120PASS/1075expects em13arquivos noC38 real; dois readonly59agora têm prova C38|BroadR1 124PASS/1FAIL e C37B0 4PASS/1FAIL mantidos; novo mapa74 eapplication86 não estão nessa prova|
|86|50PASS/1077expects/6arquivos, incluindo17legados,1repro66,5novos e27regressões73|Prova da fonte; recheck84 e validaçãoC45 pendentes|
|80|R1 2/6;R2 21/2;R3 9/0.23witnesses distintos documentados|R2 continua workflow falho;R4 contrafactual0/2 fica histórico e não é rollback liberado|
|76|B2/R1 58PASS/580expects; observações finais e isolamento preservados|P03 original0PASS/1FAIL/1error/24expects,72assertions e180000ms permaneceFAIL|
|74|Node3PASS;Bun15PASS/341expects|Componente; H74-25MIB, Procurementcaps e transporte/instalação completos continuam abertos|
|79 documental|11PASS/333expects emV2 instrumentado; hipótese do POST discriminada|Propõe abort8a62→34d74d; adoção de produção74 ainda não entregue, fixtures/overlays não aplicados|
|84 documental|Delta estático independente atéC39|Não é recheckC45, nem uma das três revisõesFINAL|

Os FAILs de61/62/63/66/67/68/69 e todas as tentativas originais permanecem nos arquivos das fontes e no catálogo. Não houve aumento de timeout, remoção de asserções ou conversão de prova de componente em produto instalado.

## Findings e owners

Os três findings70 foram encaminhados a72/73/74 e suas correções estão compostas. O estado corrente é **FIX_COMPOSED_RECHECK_PENDING**, com aceite aberto. EA66egress foi corrigido por86 e compostoC45; recheck atual ainda requerido.

[Pendências](pending-owners-final.json) e [findings](finding-routing-final.json) preservam integralmente os56 IDs/records/digests e38 findings herdados60 mais3Auth70. Atualizações71 são aditivas; zero encerramento global. Dois adendos de owner permanecem separados desse histórico:

- **H79ABORT:** o handoff79 exige adoção por74 antes de intake.74 encerrou; S0 deve reconciliar reabertura ou designar sucessor. O delta installation tem preimage atual8a62 e post proposto34d74d; rederivar mapa atual764b mantendoentry72. Não copiar mapa antigo6586 ou instrumentação.
- **H85-ROUTE-MISMATCH:** `microsoft-routes.test.ts:162` espera403 e recebe404 noC37/BroadR1.86 corrigiu outro arquivo legado, não esse. Continuação autorizada de73/86 precisa revisar contrato hidden/missing, visibleCAS e controles409 não alcançados antes de qualquer alteração de oracle.

ReportsC28, criaçãoHotTopics/admissão, P03, M31, MI07original100→150/exatamente1comando/budgets225000/240000, C12/captura atual, fontes autoritativas, Microsoft/B2B real, privacidade, native/Permission/Schedule e paridade de consumidores mantêm seus gates.75lease agoraENDED;52/87/88/89/90 não tiveram suas autoridades assumidas.81não apresentou release. As fontes ativas ficam para um futuro intake explicitamente autorizado, sem polling vazio.

## Fila concreta e próxima autoridade

[gate-queue-final.json](gate-queue-final.json) vincula a fila aoSHA/treeC45; [source-request-catalog-final.json](source-request-catalog-final.json) conserva60envelopes executados e8propostas, com payloads, seleções, budgets e resultados-fonte completos.22envelopes e1proposta têm projeções para admissão, com gates específicos e dedup; **NOT_RUN**. Os4envelopes85 e o diagnóstico79 ficam documentados separadamente. Nenhum arquivo foi colocado como `.ci-run.json` do root ou em ref de disparo.

A45 conserva15comandos/diretórios exatos de geração, typechecks, programaE2E, bundle, admissão, spawn eguards. Deve resolver dev/merge-base reais e devolver programa/config/versãoBun/run/job/exitlogs; o inventário não é certificado de compilador. Refprodutor `astra-compose@d317873c18bf224c4c1f4d3425179d12ad53e81b` é distinta da refcheck histórica. O guard do terminal documental deve usar oSHAterminal publicado externamente, sem declarar esse terminal comoD/G8.

S0 mantém oito seleções finais, AM01–06, três revisõesFINAL independentes, C/G7, D/G8 e aceite. O próximo writer precisa receber autoridade deS0, reconciliarHEAD/controle/releases e publicarACK antes de qualquer novoCAS. Esta missão entregou o candidato e encerrou sua lease; não exige finalPASS como pré-condição para esse handoff.

