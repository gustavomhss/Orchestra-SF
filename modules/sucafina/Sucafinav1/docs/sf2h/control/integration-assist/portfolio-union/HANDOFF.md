# HANDOFF terminal — missão21 / WP13-SEMANTIC-UNION

**Entrega documental publicada e completa para intake seletivo da sessão14. Aplicação de produto e validação funcional: pendentes. WP13 não está concluído; não há GLOBAL_RELEASE.**

## Publicação e commits

- Repositório: `gustavomhss/Orchestra-SF`.
- PR única: [#67](https://github.com/gustavomhss/Orchestra-SF/pull/67), `sf2-portfolio-union` → `sf2-control`.
- Parent da branch documental: [`10a7b3dbc8140d95eb9ded97dd1377bf05043321`](https://github.com/gustavomhss/Orchestra-SF/commit/10a7b3dbc8140d95eb9ded97dd1377bf05043321).
- Commit dos payloads completos: [`8978a24d972e8f57bc0ef3b2ec476a1960b1cbb4`](https://github.com/gustavomhss/Orchestra-SF/commit/8978a24d972e8f57bc0ef3b2ec476a1960b1cbb4).
- Árvore do payload: `9959312f370433d0c732492c6885df2d29be8ff8`.
- Commit terminal: o commit que contém este HANDOFF e publication.json, filho direto do commit de payload. Seu SHA exato é fixado no corpo da PR após a publicação; não existe autorreferência de hash dentro do próprio commit.
- Base sf2-control observada na criação da PR: `233e9acb7c048dda3d8174d87b76f1e8441f4917`. O avanço da base não mudou os pins de produto usados nos patches.
- Escrita exclusiva: `modules/sucafina/Sucafinav1/docs/sf2h/control/integration-assist/portfolio-union/`. Nenhum arquivo real de produto, branch de autor ou sf2-stack foi alterado.
- Remoto: somente GitHub MCP. Sem runners, CI, typecheck, guards, agentes, reinício do Orchestra ou alteração de infraestrutura.

O commit de payload contém 86 arquivos documentais. A comparação remota com o parent confirmou todos dentro do namespace autorizado, sem deletar arquivos. README, manifesto, P01 e os dois postimages de runtime foram relidos e seus blobs conferidos. Isso é evidência de publicação/consistência textual, **não PASS funcional**.

## Inputs e cobertura da leitura

Foram lidos AGENTS aplicáveis, missão completa, execution/COMMON.md, pack S4-C completo e seus dois anexos obrigatórios no planejamento imutável `dbf9547211d9b0fade619790de7c19c0869b7c7d`. Os 68 critérios foram transcritos integralmente e relacionados a consumidores/testes em [criteria-map.json](criteria-map.json).

O bundle de referência é `46cb4dd02f0a6d11b3fa7a0deac7f839e7b7af3c`; PR37 é `7defe5c9930774c6aa5a15a5f677b4406d08683c`; Intelligence PR36 é `48486a2186c0cc07a3a5558e34e2aa94c89ad5e9`. Finance W2 é `5a029e77bfd9d8ba19494966a95c908e3f05043d`, com handoff terminal observado em `d8d586e19c824f75a88494a9c3677faac617e81d`.

Os 31 held e o suplemento C08 foram reconferidos em sf2-stack@`d8ab1d3321a76870ed3092ba043fe1b5781a2c23`: todos conservaram o preimage do bundle original. Os dois destinos novos estavam ausentes. [input-manifest.json](input-manifest.json), [READING-RECORD.md](READING-RECORD.md) e [inputs/](inputs/) preservam os pins e recibos lidos.

## Disposição completa dos 31 arquivos retidos

**19 KEEP_CURRENT, 12 SEMANTIC_PATCH, zero TAKE_SOURCE.** A decisão foi por contrato, proteção e consumidor. Os pins completos de PR37, bundle, Finance, preimage/postimage e recheck estão em [disposition.json](disposition.json).

Todos os paths abaixo são relativos a `modules/sucafina/Sucafinav1/`. Toda disposição tem status funcional NOT_RUN. KEEP_CURRENT não elimina obrigações de prova.

| Arquivo retido | Disposição | Unidade | Justificativa | Critérios | Consumidores |
| --- | --- | --- | --- | --- | --- |
| `product/portfolio/README.md` | SEMANTIC_PATCH | P04 | Acrescenta o contrato das duas divulgações, reconstrução histórica estrita, seleção explícita de C08 e distinção reserva/dispatch. Mantém toda a documentação admitida, inclusive prova estrutural, cobertura qualificada e retries órfãos. | `WP13.T02.QLT.20`, `WP13.T03.QLT.01`, `WP13.T04.INV.01` | UI/mesa WP01; BI WP05; WP11; C17 |
| `product/portfolio/handoff.ts` | KEEP_CURRENT | — | Mantém snapshot do pedido/caso e clones de operações; expectedDigest é fixado antes de aguardar resolveCandidate e as referências são copiadas. | `WP13.T04.CHK.01`, `WP13.T04.INV.01`, `WP13.INV.10` | WP11 prepareChanges/addAlternative; HTTP; sf_portfolio_evaluate |
| `product/portfolio/planner-sensitivity.ts` | SEMANTIC_PATCH | P01 | Patch suplementar restrito ao finalizador: conserva recertificação da fronteira sem segunda busca e acrescenta known-components-threshold + known-subtotal-threshold. Reconstrói bundle-v1/pr37-v1/intelligence-v1/union-v1 sem reescrever resultados antigos. Restitui as observações originais de cenário/baseline de PR36 para resultados condicionados; a forma antiga de evidência é reproduzida apenas em replay autenticado. | `WP13.T03.CHK.01`, `WP13.T03.CHK.20`, `WP13.T03.QLT.01`, `WP13.INV.10` | C08 sensitivity; criterion binding WP11; verificador; UI/BI |
| `product/portfolio/port.ts` | KEEP_CURRENT | — | Mantém snapshots de entrada/saída da sensibilidade e rejeição de falha definitiva de critério, mesmo com cobertura incompleta. | `WP13.T02.CHK.03`, `WP13.T02.INV.20`, `WP13.T03.INV.18` | Portfolio HTTP/native; candidatos; BI |
| `product/portfolio/result-store.ts` | KEEP_CURRENT | — | Mantém análise corrente antes da última leitura de binding, que fecha a autoridade após os callbacks. Mantém recuperação C08/binding e histórico separado. | `WP13.T02.INV.18`, `WP13.T04.CHK.03`, `WP13.INV.10` | WP11 portfolio binding; C08; HTTP read/list; C17 |
| `product/portfolio/sensitivity-store.ts` | KEEP_CURRENT | — | Mantém caminho de retry já vinculado sem recalcular/amostrar, checagem do pedido/prova/resultado e snapshots de kind/binding/lease/identidade da operação. | `WP13.T03.CHK.18`, `WP13.T03.INV.18`, `WP13.INV.10` | C08; criterion binding; HTTP readSensitivity; C17 |
| `product/portfolio/sensitivity-v6.ts` | KEEP_CURRENT | — | Mantém recusa de exact se algum ponto é null, além de estados unavailable/incompatible e proteção contra mutação nos callbacks. | `WP13.T03.CHK.03`, `WP13.T03.QLT.01`, `WP13.T03.CMP.01` | C07 v6; finalizador; UI/BI |
| `product/portfolio/sensitivity.ts` | KEEP_CURRENT | — | Mantém exact apenas para componentes quantificados e, quando incompleto, certificado scope=known-subtotal. A explicação PR37 entra no finalizador canônico com compatibilidade de replay. | `WP13.T03.CHK.01`, `WP13.T03.CHK.03`, `WP13.T03.CHK.20` | Planner sensitivity; verificação; C07 |
| `product/portfolio/threshold-proof.ts` | KEEP_CURRENT | — | Mantém PlannerDirectIntervalProof, identidade/fixedComponentsDigest/componentIds, metadados e ambos os previews IEEE adjacentes atuais. | `WP13.T03.CHK.01`, `WP13.T03.CHK.03`, `WP13.T03.CHK.20`, `WP13.INV.10` | Planner exact threshold; read-only replay; coverage interval |
| `product/portfolio/verification.ts` | SEMANTIC_PATCH | P01 | Patch suplementar seleciona somente uma das serializações explícitas bundle, PR37, Intelligence e união para o finalizador; comparação integral de resultDigest continua obrigatória após provas novas. | `WP13.T03.CHK.18`, `WP13.T03.CHK.20`, `WP13.INV.10`, `WP13.T04.CHK.03` | WP11 criterion binding; C08 replay; C17; HTTP |
| `test/product/wp13/analysis-recovery.test.ts` | KEEP_CURRENT | — | Preserva recuperação órfã de comparação, portfólio e sensibilidade e os asserts de não duplicação. | `WP13.T02.DOD.01`, `WP13.T03.DOD.01`, `WP13.INV.10` | C08 + WP11 binding; dispatcher |
| `test/product/wp13/campaign.test.ts` | SEMANTIC_PATCH | P02 | Acrescenta histórico autenticado no mesmo owner N/N e mantém o teste admitido de fonte avançada/revogação. Usa um único Request no helper local, mantendo access.allowed no case reader. | `WP13.T01.CHK.01`, `WP13.T01.CHK.03`, `WP13.T04.CHK.03` | campaign current/historical/list; WP11; C17 |
| `test/product/wp13/coverage-preview.test.ts` | KEEP_CURRENT | — | Mantém todos os estados omitted/null/zero/confirmed e adversários de fonte/regra/acesso/objeto emprestado no orçamento agregado original. | `WP13.T02.CHK.20`, `WP13.T02.CMP.20`, `WP13.T03.CHK.20` | C10 coverage interval; Planner; dispatcher |
| `test/product/wp13/coverage-sensitivity-integration.test.ts` | SEMANTIC_PATCH | P01 | Preserva integralmente as três jornadas admitidas, asserts de contagem/egress/retry e budgets. Acrescenta scalar falso PR37 e três serializações históricas com persistência/vínculo real, replay sem recálculo, adulteração e revogação. | `WP13.T03.CHK.01`, `WP13.T03.CHK.03`, `WP13.T03.CHK.20`, `WP13.INV.10` | C07/C08/C10; WP11 binding; HTTP; dispatcher |
| `test/product/wp13/coverage.test.ts` | KEEP_CURRENT | — | Mantém unknown financeiro com cobertura parcial e failed definitivo independente da completude financeira. | `WP13.T02.CHK.03`, `WP13.T02.CHK.20`, `WP13.T02.INV.20` | Portfolio feasibility/coverage; dispatcher |
| `test/product/wp13/handoff-integration.test.ts` | SEMANTIC_PATCH | P02 | Mantém todas as expectativas do teste controlado original. Corrige Request estável e modela indisponibilidade do produtor antes da reserva, verificando zero applicationAttempts para a segunda mudança. | `WP13.T04.CHK.01`, `WP13.T04.CHK.02`, `WP13.T04.INV.01` | WP11 prepared execution; C12; dispatcher |
| `test/product/wp13/handoff.test.ts` | SEMANTIC_PATCH | P02 | Acrescenta o assert PR37 de zero novo prepare após choiceId errado; conserva todos os testes admitidos de mutação e digest de observação. | `WP13.T04.CHK.01`, `WP13.T04.CMP.01`, `WP13.T04.INV.01` | preparePortfolioChoice/promotePortfolioAlternative; dispatcher |
| `test/product/wp13/history-provenance.test.ts` | SEMANTIC_PATCH | P02 | Mantém snapshots contra objeto compartilhado e escolha com C08 equivalente/ledger exato. Acrescenta contagem zero de binding quando owner é futuro e o contraexemplo Finance de CAS na última callback. | `WP13.T04.CHK.03`, `WP13.INV.10`, `WP13.QLT.10` | candidate history; campaign history; C13; C17 |
| `test/product/wp13/persistence-recovery.test.ts` | KEEP_CURRENT | — | Mantém os asserts de quantidade de avaliações antes/depois de retry e perda de resposta de binding. | `WP13.T03.CHK.18`, `WP13.INV.10` | PersistentSensitivityPort; C08; WP11 binding |
| `test/product/wp13/persistent-store.test.ts` | KEEP_CURRENT | — | Mantém o teste de fechamento da amostragem com bound reader e revogação durante releituras. | `WP13.T03.CHK.18`, `WP13.T03.INV.18` | sensitivity read; C08/WP11; C17 |
| `test/product/wp13/planner-sensitivity-boundary.test.ts` | KEEP_CURRENT | — | Mantém os dois adversários: mutação do request emprestado e reuso mutável da fonte. | `WP13.T03.INV.01`, `WP13.INV.10` | PlannerSensitivity; dispatcher |
| `test/product/wp13/portfolio.test.ts` | SEMANTIC_PATCH | P03 | Preserva todo o conjunto admitido, inclusive egress positivo/negativo. Acrescenta o cenário PR37 cuja cobertura completa vem de assessCostCoverage canônico. | `WP13.T02.CHK.01`, `WP13.T02.CHK.03`, `WP13.T02.CHK.20` | C10 classification; PortfolioPort; dispatcher |
| `test/product/wp13/reconciliation.test.ts` | SEMANTIC_PATCH | P03 | Mantém todos os asserts e readHistoricalCalculation exigido. Transplanta só o helper HTTP local Finance com LocalStore real e Request estável, que fecha o read-snapshot do produto. | `WP13.T04.CHK.03`, `WP13.T04.CMP.01`, `WP13.INV.10` | HTTP reconcile; C13 historical/current source; dispatcher |
| `test/product/wp13/sensitivity-fixture.ts` | KEEP_CURRENT | — | Mantém integralmente a fixture compartilhada admitida e as variantes Analysis/Runtime completas. | `WP13.T02.CHK.02`, `WP13.T03.CHK.01`, `WP13.INV.10` | Todos os consumidores wp13 das fixtures; dispatcher |
| `test/product/wp13/sensitivity-read-scope-fixture.ts` | KEEP_CURRENT | — | Mesmo blob entre PR37 e bundle; preservado byte a byte. | `WP13.T03.CHK.18`, `WP13.INV.10` | Read-scope callback/lease/Request adversaries; C17 |
| `test/product/wp13/sensitivity-read-scope.test.ts` | KEEP_CURRENT | — | Mesmo blob entre PR37 e bundle, com todos os negativos de leitura. Mantém testes; documentação explicita recriação de serviços versus reabertura real. | `WP13.T03.CHK.18`, `WP13.INV.10` | Read-scope/callback/authority; C17 |
| `test/product/wp13/sensitivity-units-boundary.test.ts` | KEEP_CURRENT | — | Mantém a jornada única EUR→USD sem FX, consumidores HTTP, bindings/replay, duplicidade cross-case e fonte/regra/autoridade stale. | `WP13.T03.CHK.03`, `WP13.T03.QLT.01`, `WP13.T02.CHK.18` | Planner units; Portfolio HTTP; C08; WP11; dispatcher |
| `test/product/wp13/sensitivity-v6.test.ts` | SEMANTIC_PATCH | P01 | Acrescenta conservação exata de unresolvedConditions/thresholdEvidence, recusa unavailable e evidenceRefs vazias. Preserva o assert de amostra null e adversários de callback. | `WP13.T03.CHK.03`, `WP13.T03.QLT.01`, `WP13.T03.CMP.01` | C07 v6; UI/BI; dispatcher |
| `test/product/wp13/sensitivity.test.ts` | SEMANTIC_PATCH | P01 | Mantém todos os testes existentes e acrescenta o discriminante scope ausente versus known-subtotal certificado, sempre condicionado e sem tratar training como zero. | `WP13.T03.CHK.01`, `WP13.T03.CHK.03`, `WP13.T03.CHK.20` | Generic evaluator; Planner finalizer; dispatcher |
| `test/product/wp13/source-scenario.test.ts` | KEEP_CURRENT | — | Mantém a jornada admitida com baselineMutation reutilizado e unicidade C08. A variante PR37/Finance entra no novo semantic-union-source-scenario.test.ts, sem substituir a fixture especializada. | `WP13.T02.CHK.02`, `WP13.T02.CHK.20`, `WP13.T04.CHK.03` | C08 source-only selection; C10; WP11 choice; UI/BI |
| `test/product/wp13/term-defer-boundary.test.ts` | KEEP_CURRENT | — | Mesmo blob entre PR37 e bundle; conserva prova de defer mensal sem economia fictícia. | `WP13.T03.CHK.02`, `WP13.T03.INV.01` | Planner canonical defer; sensitivity; dispatcher |

## Série pronta e imagens completas

São quatro patches, **15 destinos propostos**, **34 postimages completos**, **32 preimages completos** e duas declarações de ausência. Os 19 KEEP_CURRENT têm postimage igual ao preimage e não geram escrita de produto. Os bytes em imagens `.txt` são o arquivo integral, sem Markdown. Os hashes são Git blobs, emitidos pelo GitHub.

| Ordem | Patch | Destinos | Blob do patch | Dependência | Regra |
| --- | --- | --- | --- | --- | --- |
| 1 | [P01](patches/0001-sensitivity-disclosure-and-replay.patch) | 6 | `dd6251009abbf2c773b1a02111c5908bd8a8f959` | Preimages + dependências admitidas | Atômico: finalizador, verificador e regressões juntos |
| 2 | [P02](patches/0002-human-choice-history-and-reservations.patch) | 5 | `62f20cdd30eadc516d40802d2f821155fc2069bb` | P01 | Hunks nos destinos listados |
| 3 | [P03](patches/0003-coverage-and-source-consumers.patch) | 3 | `b3469f044db1029d69db853e89a18ae840d1a5ed` | P01, P02 | Hunks nos destinos listados |
| 4 | [P04](patches/0004-portfolio-contract-notes.patch) | 1 | `002672c53c25033e08846eaa110fe72b9db211cd` | P01, P02, P03 | Hunks nos destinos listados |

### Preimages e postimages dos destinos efetivamente alterados

| Patch | Destino relativo a Sucafinav1 | Preimage Git blob | Postimage Git blob | Conteúdo integral |
| --- | --- | --- | --- | --- |
| P01 | `product/portfolio/planner-sensitivity.ts` | `fe4ab56201fd1898905ac7bc810f0495a64f8602` | `9d29046dd40adffc88985be5e1b1603b64491129` | [preimage](preimages/product/portfolio/planner-sensitivity.ts.txt) / [postimage](postimages/product/portfolio/planner-sensitivity.ts.txt) |
| P01 | `product/portfolio/verification.ts` | `46a04597df74205add4531465f35d8a55ca1f8dd` | `254e22ea35f5b422b59c8f0549c8f12d1d4fb492` | [preimage](preimages/product/portfolio/verification.ts.txt) / [postimage](postimages/product/portfolio/verification.ts.txt) |
| P01 | `test/product/wp13/sensitivity-disclosure.test.ts` | AUSENTE | `ca583dd473bdfb13299dfe470e301a6a113c0b73` | [preimage](preimages/test/product/wp13/sensitivity-disclosure.test.ts.absent.json) / [postimage](postimages/test/product/wp13/sensitivity-disclosure.test.ts.txt) |
| P01 | `test/product/wp13/sensitivity.test.ts` | `76ea3fa6902105c7be42956dae99ea4e4f9a4c3b` | `0444570a0a961c979f75388fb0708812f98497e5` | [preimage](preimages/test/product/wp13/sensitivity.test.ts.txt) / [postimage](postimages/test/product/wp13/sensitivity.test.ts.txt) |
| P01 | `test/product/wp13/sensitivity-v6.test.ts` | `a3b1cd5326dc4dfbbaa4a16cb0134c9d0fe15a4c` | `a22b4625c8375d7c88037e1c66c1a0fee17e5c83` | [preimage](preimages/test/product/wp13/sensitivity-v6.test.ts.txt) / [postimage](postimages/test/product/wp13/sensitivity-v6.test.ts.txt) |
| P01 | `test/product/wp13/coverage-sensitivity-integration.test.ts` | `1a0dc5a9bc71923aafd3ec5eaf476f7a3f780bdc` | `7025de0601768ccc0bec76d8e0675882dee7cda9` | [preimage](preimages/test/product/wp13/coverage-sensitivity-integration.test.ts.txt) / [postimage](postimages/test/product/wp13/coverage-sensitivity-integration.test.ts.txt) |
| P02 | `test/product/wp13/campaign.test.ts` | `60693fea1a9fa238ecf57c43c73d8d113911b74a` | `3002c859033795cac7db65261a1ff44c44a61d43` | [preimage](preimages/test/product/wp13/campaign.test.ts.txt) / [postimage](postimages/test/product/wp13/campaign.test.ts.txt) |
| P02 | `test/product/wp13/history-provenance.test.ts` | `9af706b6a1ab27229fb8514e117550036a13b249` | `8ae8e056f426e128ecec38a26d646896b7c28d81` | [preimage](preimages/test/product/wp13/history-provenance.test.ts.txt) / [postimage](postimages/test/product/wp13/history-provenance.test.ts.txt) |
| P02 | `test/product/wp13/handoff.test.ts` | `f289bde6c2b97278a9b3a7cfe1462b41b0f1ab7a` | `dc7e73e53c3fc7c67e4340597dab6afa726b52cc` | [preimage](preimages/test/product/wp13/handoff.test.ts.txt) / [postimage](postimages/test/product/wp13/handoff.test.ts.txt) |
| P02 | `test/product/wp13/handoff-integration.test.ts` | `9fefc7bc347bfa123fc718fa9b0000d82dfc8a80` | `07f7478f2b8072d9c4a5bb1dd4a831ac537efec8` | [preimage](preimages/test/product/wp13/handoff-integration.test.ts.txt) / [postimage](postimages/test/product/wp13/handoff-integration.test.ts.txt) |
| P02 | `test/product/wp13/handoff-c08-integration.test.ts` | `d5327a70410a6c52c64b534056939cbfc9eb9483` | `bff4abba2f156cd2418d39f053b4d6a05bde4944` | [preimage](preimages/test/product/wp13/handoff-c08-integration.test.ts.txt) / [postimage](postimages/test/product/wp13/handoff-c08-integration.test.ts.txt) |
| P03 | `test/product/wp13/portfolio.test.ts` | `2e103fe41fd5ba5a740247bb65a4ac13d262e7da` | `01584c151cde11035a0f5154ed1ecb77b8c0b7d8` | [preimage](preimages/test/product/wp13/portfolio.test.ts.txt) / [postimage](postimages/test/product/wp13/portfolio.test.ts.txt) |
| P03 | `test/product/wp13/reconciliation.test.ts` | `6b2a318f73aa8adb67840958add758f151f0bade` | `599464bcbcfd1c885fd76098e3bbc061ce80d107` | [preimage](preimages/test/product/wp13/reconciliation.test.ts.txt) / [postimage](postimages/test/product/wp13/reconciliation.test.ts.txt) |
| P03 | `test/product/wp13/semantic-union-source-scenario.test.ts` | AUSENTE | `47b5358c8dda3179045499388ce98871576a2aa9` | [preimage](preimages/test/product/wp13/semantic-union-source-scenario.test.ts.absent.json) / [postimage](postimages/test/product/wp13/semantic-union-source-scenario.test.ts.txt) |
| P04 | `product/portfolio/README.md` | `4bdad097bb82f3dc96a74090bacc567835295680` | `4816c7b8d5512ca34941f3f329ac7116a0412baf` | [preimage](preimages/product/portfolio/README.md.txt) / [postimage](postimages/product/portfolio/README.md.txt) |

Os três suplementos ao held são o teste C08 já admitido `handoff-c08-integration.test.ts` e os dois testes novos `semantic-union-source-scenario.test.ts` e `sensitivity-disclosure.test.ts`. Nenhum outro destino de produto está proposto.

## Decisões semânticas e critérios tratados

P01 mantém a certificação de `scope: known-subtotal`, a rejeição de pontos null e a recertificação Finance sem segunda busca. A união restaura `known-subtotal-threshold`, conserva `known-components-threshold` e restitui as observações originais de cenário/baseline presentes em Intelligence. Nenhum custo omitido vira zero.

O verificador reconstitui explicitamente `bundle-v1`, `pr37-v1`, `intelligence-v1` e `union-v1` depois de autoridade e prova canônica atuais. Requer igualdade do digest integral e conserva a captura final. Não reescreve resultados históricos, não aceita um scalar armazenado como prova e não remove condições para fazer o digest coincidir. [COMPATIBILITY.md](COMPATIBILITY.md) registra a ordem de condições/evidências e as fronteiras de cada forma.

Os stores admitidos mantêm clone/snapshot, checks de Request/header/lease, autoridade final, identidade do reader/store/binding e retry vinculado sem recálculo. Escolha humana, ledger, reservas e contratos C12 continuam sob seus produtores. O teste de baseline único permanece intacto; a história adicional de C08 equivalente exige seleção explícita autenticada.

Os critérios diretamente relacionados à união estão discriminados por arquivo acima. O mapa completo cobre também as obrigações primárias, de suporte/correção e os consumidores dos 68 critérios. Essa cobertura é de payload/planejamento: todos continuam **NOT_RUN** até prova observada em C. Em particular, a parte contratual de WP13.T03.CHK.02, as jornadas C17 instaladas e os gates globais não são encerrados por manter testes de componente.

## Regressões propostas — nenhuma executada

As dez alterações em testes existentes preservam as 432 linhas de assertions originais e seus budgets. Fixtures compartilhadas, oráculos, configurações e workflows não recebem patch.

- Seis testes unitários novos do finalizador distinguem união, formatos anteriores, cobertura completa, falta/divergência de prova, observações originais e ordem de evidência.
- Três variantes históricas reais (bundle, PR37 e Intelligence) persistem C08/binding, recriam serviços, conservam ID/digest, verificam ausência de nova busca numérica, rejeitam condição adulterada mesmo com digest recalculado e recusam fonte revogada.
- O negativo PR37 de scalar falso exige evidência original. A prova canônica/escopo não é substituída por um número equivalente.
- Histórico N/N é acrescentado sem perder N/N+1, mudança material e revogação. A callback final é submetida a tentativa real de CAS e precisa impedir divulgação/mutação.
- C10 conserva o critério failed definitivo apesar de custo pendente. C08 único e múltiplos envelopes equivalentes têm regressões distintas.
- Handoff distingue indisponibilidade antes de dispatch, sem applicationAttempts, de falha após reserva; o consumidor C12 real permanece selecionado.
- Reabertura real continua nas seleções existentes. Recriar serviços com LocalStore aberto não prova restart.

[dispatcher/selection.json](dispatcher/selection.json) lista os paths exatos e a identidade de dedupe; não há request de execução criado por esta sessão.

| Seleção | Etapa | Arquivos | Objetivo | Estado |
| --- | --- | --- | --- | --- |
| U01 | 1 | 6 | Contraprovas curtas de divulgação, escopo certificado, precisão e critério definitivo | PROPOSED_NOT_RUN |
| U02 | 2 | 7 | Egress/Request/lease, retry vinculado sem recálculo, órfãos e read scope novo | PROPOSED_NOT_RUN |
| U03 | 3 | 3 | C10/certificado real e compatibilidade das quatro serializações; preservar os testes agregados e seus budgets | PROPOSED_NOT_RUN |
| U04 | 3 | 6 | Escolha/histórico, C08 único e C08 equivalente autenticado, fonte atual e HTTP | PROPOSED_NOT_RUN |
| U05 | 3 | 4 | Preparação, retomada antes de dispatch, reserva após dispatch e recibos C12 reais | PROPOSED_NOT_RUN |
| U06 | 4 | 2 | Limiares 55000/55001 e 15000/15001, restart real e ausência de economia por mero defer | PROPOSED_NOT_RUN |
| U07 | 5 | 8 | Consumidores WP05, WP10 e WP12; não substituem AM/C17 instalado | NOT_RUN |

Os três testes curtos de Finance W2 só entram pelo intake próprio de Finance e se seus inputs forem afetados. O FAIL de S3 na guarda 180000 requer delta causal material do owner antes de nova execução longa. Não herdar o PASS curto da fonte como prova da composição.

## Finance e reconferência obrigatória

Finance continua com writer próprio. Antes da aplicação, reconferir no head Finance atual **e** no candidato da sessão14:

| Arquivo portfolio | Blob observado | Ação desta proposta |
| --- | --- | --- |
| planner-sensitivity.ts | `fe4ab56201fd1898905ac7bc810f0495a64f8602` | P01 suplementar; recheck antes de qualquer hunk |
| verification.ts | `46a04597df74205add4531465f35d8a55ca1f8dd` | P01 suplementar e inseparável do finalizador |
| threshold-proof.ts | `ce7d267d126992bc1a0796e2b64e5dc1c87bb12b` | KEEP_CURRENT; dependência de prova a reconferir |

Finance W2 altera separadamente `product/planner/sensitivity-units.ts` e `product/decisions/result-store.ts`, além de seus três testes. Seus preimages/postimages e intake constam do [patch-manifest.json](patch-manifest.json). Não copiar a branch Finance inteira: ela também carrega snapshots herdados que perderiam proteções já admitidas. A sessão14 decide esse intake e registra a composição efetiva.

O handoff Finance observado permanece OPEN_IMPLEMENTED_NOT_CLOSED para FIN-IND-005; S3 falhou antes de completar 15000/15001, releitura posterior, replay e reabertura. Nenhuma dessas etapas foi executada ou declarada encerrada aqui.

## Pendências preservadas

[open-findings.json](open-findings.json) conserva os dez achados originais, os doze do refresh e as obrigações desta proposta. A publicação muda a disponibilidade dos payloads de WP13; não muda o finding para DONE.

| Finding | Owner | Estado observado | Próxima obrigação do owner/integrador |
| --- | --- | --- | --- |
| `MEMORY-INTEGRITY` | session13 / WP10 + WP14 | PRODUCER_FIX_NOT_CONSUMED | Consume a closed producer SHA with original failure and authority/reopen negatives; no integrator rewrite of integrity semantics. |
| `FIN-IND-005` | Finance performance / PR42 | SOURCE_FAIL_RECHECK_REQUIRED | Owner completes the 15000/15001, historical read, replay/reopen journey without assertion or budget relaxation; qualify exact composed candidate. |
| `WP13-SEMANTIC-UNION` | WP13 / Intelligence + Finance | HELD_FOR_OWNER | Reconcile the held per-file alternatives against admitted PR36+PR42 closure; three exclusive verification inputs are preserved; no producer algorithm invented. |
| `C05-INSTALLED-CLOSURE` | Collaboration / WP10 composition | INSTALLED_PROOF_PENDING | Owner mounts the remaining real authority callbacks and proves distinct recipient, exact source pin, revocation, replay and C06 attachment in installed host. |
| `C12-RECOVERY` | prepared-change/host + first-save producer | OPEN_SOURCE_FINDINGS | Reconcile producer receipts/current executor and exact uncertainty recovery; use original test oracles. |
| `E2E-OPERATIONS` | Operations E2E + config/installed-host owner | NOMINAL_SPEC_PRESENT_NOT_RUN | Complete owner fixture/config composition for nominal Operations; retain 5 functional cases and explicit C06 material gap. |
| `E2E-DECISIONS` | Decisions E2E / WP11 | NOMINAL_SPEC_PRESENT_INCOMPLETE | Qualify bootstrap on composed C and complete missing nominal journey with actual UI and exact result contracts. |
| `E2E-REPORTS` | Reports E2E / WP07 + WP10 | NOMINAL_SPEC_PRESENT_NOT_RUN | Reconcile installed report/review flow and run exact nominal selection on C; do not substitute component proof. |
| `TYPECHECK-GUARDS` | S0 final gates + each owning producer | NOT_RUN_ON_COMPOSED_TREE | Run canonical generated checks, five typechecks, spawn imports, guard and E2E graph coverage in authorized hosted lane. |
| `NATIVE-AM-REVIEW` | S0 and existing assigned verifiers | NOT_RUN_ON_COMPOSED_TREE | AM01–AM06, 39 operations/8 packs, 18 skills/5 profiles, Atlas real scanner/restart/consumers, and three independent final reviews on same C. |
| `C17-BETWEEN-OBSERVATIONS` | WP00/WP10 source authority | SOURCE_STATIC_FINDING_RECHECK_REQUIRED | Reconcile Memory/current observation owner output and prove Request/header/lease identity across independent observations; do not infer closure from C09 or intraobservation negatives. |
| `CURRENT-CHOICE-COHORT` | Finance/WP11 and WP10 composition | HELD_PUBLISHED_ALTERNATIVE | Reconcile the CurrentChoice cohort against admitted Finance and host contracts; do not silently substitute its inherited snapshot. |

Além deles, permanecem UNION-RUNTIME-VALIDATION, UNION-CANCELLATION-RULE e UNION-C17-INSTALLED. C17 entre observações, CurrentChoice, Memory e installed-host não são cobertos por uma alegação implícita de êxito desta união.

## Instrução exata de integração para a sessão14

1. Consumir o commit de payload `8978a24d972e8f57bc0ef3b2ec476a1960b1cbb4` e conferir [patch-manifest.json](patch-manifest.json). Não mesclar nem cherry-pickar esta branch documental inteira em sf2-stack.
2. Fixar commit/tree atual do candidato como C0 e o lease exclusivo da sessão14. Ler os intakes terminais atuais dos owners, especialmente Finance.
3. Comparar cada preimage e cada dependência com C0. Revalidar a ausência dos dois arquivos novos. Reconferir os três arquivos portfolio sobrepostos com Finance; divergência exige união dos hunks com o owner. Não sobrescrever um snapshot divergente pelo postimage.
4. Aplicar P01 integralmente; depois P02, P03 e P04. Os paths dos patches são relativos à raiz do repositório. Em preimage exato, exigir o postimage Git blob do manifesto. Se já for exatamente o postimage, registrar aplicação idempotente. Não escrever nos 19 KEEP_CURRENT.
5. Admitir o intake Finance apenas conforme seu manifesto próprio; registrar os deltas e a ordem efetivamente usada. Preservar todas as dependências/contratos do manifesto e reconferir P01 se algum deles mudou.
6. Registrar o commit/tree final **C** depois de todos os owners, os blobs efetivos, a reconciliação extra e o input digest. O commit documental desta PR nunca é o W de produto.
7. Entregar ao dispatcher as seleções U01–U07 sobre C: U01 antes das caras; dedupe por C, seleção, configuração, fixtures e dependências. Conservar budgets, expectSpawn e runner canônico. Registrar FAIL/NOT_RUN sem relaxar assertion, timeout ou oracle.
8. Anexar recibos com commit/tree C, request/hash, job/run, seleção, assertions observadas, falhas/timeouts e limite de prova. Comparar o resultado aos 68 critérios e consumidores, inclusive reabertura real e C17. Manter os findings pendentes até evidência própria.
9. Registrar a disposição final de cada path e qualquer hunk não aplicado. A presente entrega autoriza somente o intake dos payloads descritos; não autoriza fechamento de WP13 nem GLOBAL_RELEASE.

O detalhamento operacional também está em [INTEGRATION.md](INTEGRATION.md). Este é o encerramento da sessão de **preparação/publicação**; a integração e a prova funcional permanecem com a sessão14 e os owners.
