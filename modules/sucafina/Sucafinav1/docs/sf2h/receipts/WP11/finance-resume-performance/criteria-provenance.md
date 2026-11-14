# FIN-IND-005 — critérios, proveniência e limites finais

**Estado final:** correções aplicadas e testes cirúrgicos aprovados; S6 falhou. **FIN-IND-005 OPEN. Sem aceite global.**

Repo `gustavomhss/Orchestra-SF`, branch `finance-resume`, PR42. W2 (primeiro delta de quatro arquivos): `95f474484fb49cedb563ed3d02a61e9638d6784d`. W4 (mais dois arquivos de produto): `7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1`, tree `2da074668b164b1aa5e051f8a70366969425906f`. Fonte normativa fixa: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; WP11 consumido pelo pack imutável `a3d29d011ba3607a57914701300f09117a3e2de9`.

O JSON acompanhante preserva os objetos normativos completos, JSON Pointers, blobs, cláusulas integrais C08/C09/C10, oráculo completo AI-RENEWAL-OMITTED-CATEGORY e finding FIN-IND-005 original. Os status normativos NOT_RUN não foram alterados. Este recorte de suporte não reduz o inventário anterior de 371 critérios, 18 tarefas e 87 checks.

## Estado conhecido de CI

Resultados e identificadores abaixo foram reportados pelo root a partir dos recibos/logs observados. Os logs integrais permanecem com o root e não são duplicados aqui.

| Seleção | W / S | Run / job | Resultado e escopo |
| --- | --- | --- | --- |
| S1 | W `ab38a14c09d2292553670033b8c1eaea1d26f31f` / S `4afc641b8f9e71be3e13ea7f3bdcff69ae29bb67` | 43627723188 / 132547252223 | **Expected red:** 2 buscas vs 1; 0 pass / 1 fail / 27 expects. Operação 42534 ms; teste 53317.8 ms. Contadores: buscas 2, previews da busca 18, units 4; verificações financeiras e de autoridade precedem a falha. |
| S2 | W `95f474484fb49cedb563ed3d02a61e9638d6784d` / S `4fce91718b8ea90f6d05ba0c30729f030b58451b` | 43628402812 / 132549346211 | **PASS 15 / 0 / 159 expects.** Operação de sensibilidade 38863 ms; busca 1, previews da busca 9, units 2; consumer previews 8, revalidações 4 e writes 2. Recertificação persistida: 16.351 s, 0 buscas, 4 units, 10 previews, 2 scope checks; negativos passaram. |
| S3 | W `95f474484fb49cedb563ed3d02a61e9638d6784d` / S `10750da63ec539002a014b598a8e40afb817ec22` | 43629238602 / 132551927313 | **FAIL:** 18 expects, 180051 ms, guard 180000 ms preservado. Ambos qualify e sample writes concluíram; fase ativa `confirmed.exact → preview`. Threshold final 15000/15001, história posterior e reabertura não alcançados. |
| S4 | W `189cb74252b3b6aa160038da4410b1c7cdcaa31b` / S `ff04e4ff973f3369fb71b0fe5c058f4b98249996` | 43629852422 / 132553814068 | **Expected red:** 16 vs 10 envelopes C08, 6 expects; dois resultados reais ok e duas observações completas de caso. Operação 70.542824 ms; teste 433.55 ms. |
| S5 | W `7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1` / S `18e2a5dcf69b039dcd86e91f8fbf85db613acf6c` | 43630462257 / 132555694380 | **PASS 36 / 0 / 297 expects**, 10 arquivos, 368.57 s. Dois siblings: 10 envelopes C08 e 2 observações completas de caso; operação 58.217551 ms. Controles negativos e fallback preservados. |
| S6 | W `7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1` / S `0e68fec2e33e6c4c2103f368fed1d00dc832cb0c` | 43631582858 / 132559159277; cleanup 132560430979 | **FAIL: 0 pass / 1 fail / 18 expects.** Teste 180025.69 ms; Bun 180.22 s. Guard original expirou; evaluate retornou `stale / coverage-authority-changed` durante o primeiro qualify confirmado. Sem writes confirmados, exact, threshold final, história posterior, replay ou restart. |

Tempos reportados de S3: omitted.evaluate 28621 ms (PR56: 44978 ms), marco anterior à sensibilidade confirmada 92782 ms, coverage.issue 26942 ms e qualifiers 17464/18478 ms. O avanço de fase e os ganhos medidos permanecem separados da conclusão da jornada.

### Contraprovas e contadores de S5

| Prova | Resultado observado |
| --- | --- |
| Dois siblings | 10 leituras C08 vs 16 em S4; 2 leituras completas de caso preservadas; 58.217551 ms vs 70.542824 ms. |
| Fallback por facade escalar | 16 leituras C08 e 4 hooks preservados. |
| Duplicatas e referência ausente | 12 authorizeCase, 12 verifySources, 25 revalidate, 2 full-case e 10 C08; estados `ok / unavailable / ok / ok`. |
| Fonte real alterada | Recusa usando o operation verifier de produção. |
| Alterações tardias | Controles de caso, resultado, request, lease, reader e store passaram. |
| Sensibilidade | Operação 31223 ms, comparada a S1 42534 ms e S2 38863 ms; busca 1 / previews da busca 9 / units 2 vs baseline 2 / 18 / 4. Mantidos 8 consumer previews, 4 revalidações e 2 writes. |
| Recertificação persistida positiva | 11710.293867 ms; 0 buscas, 4 units, 10 previews e 2 scope checks. |
| Evidência forjada, root contaminado e revogação | Todos retornam false; não publicam fence válido. |

As durações acima são medições das fases indicadas em runs distintos; não são p95, previsão de duração da jornada inteira nem aceite de consumidor instalado.

### Resultado final da jornada S6

Snapshot `0e68fec2e33e6c4c2103f368fed1d00dc832cb0c`, tree `9339889db0210f25ba46ee9a3ab7553e146bef1d`, branch `ci-run-linux-finance-performance-7a9a43b3-3801b178-s6`. O guard original de 180000 ms expirou com elapsed 180015 ms. A pilha ativa era `confirmed.evaluate → confirmed.coverage.qualify → confirmed.authority.is-still-valid → confirmed.units.revalidate`; a revalidação retornou false em 180017 ms, qualify retornou stale e evaluate retornou `stale / coverage-authority-changed`. **Não foi um timeout sem tratamento: após a expiração da guarda, a revalidação retornou false e a operação recusou o resultado. Não foi demonstrada uma revogação de negócio independente dessa expiração.**

A fase omitida alcançou suas assertions em 48027 ms: subtotal 210000, training pending e teto condicionado 55000. A escolha foi persistida com digest `077b2824dc68f8dbcb82604bb00bd0e402754c94715917dd56e45b1418b9929d`. Em 112263 ms, as assertions atuais confirmaram caso `case`, encarnação `case-incarnation`, versão 6, training 40000, total 250000 e diferença −10000. A conservação final da escolha histórica após confirmação não foi alcançada; o digest acima é a observação na persistência da escolha.

| Fase S6 | Duração reportada |
| --- | ---: |
| Fixture | 12521 ms |
| Omitted evaluate | 35505 ms |
| Escolha | 11486 ms |
| Confirmação do treinamento | 52749 ms |
| Confirmed evaluate | 67753 ms |
| Coverage issue confirmado | 33094 ms |
| Primeiro qualify confirmado, terminal stale | 21630 ms |

| Contador confirmado | Chamadas | Tempo inclusivo |
| --- | ---: | ---: |
| units.resolve | 5 | 21210 ms |
| units.revalidate | 5 | 21205 ms |
| authority.resolve | 4 | 17440 ms |
| authority.isStillValid | 4 | 17321 ms |
| units.issue | 2 | 7424 ms |
| preview | 4 | 16554 ms |
| authority.read-case | 8 | 341 ms |

No run completo: C08 cases 3017 chamadas / 79876 ms; host.revalidate 23319 chamadas; C08 preferences 542 / 13333 ms; classified coverage 261 / 28009 ms. Os tempos são inclusivos e sobrepostos. S3 terminou dentro de exact; S6 terminou antes dos writes confirmados e de exact, portanto seus totais não são comparáveis como a mesma carga concluída. Omitted evaluate foi 35505 ms em S6, contra 28621 ms em S3. **Não se afirma ganho ponta a ponta.**

Logs S6: SHA-256 `4f1cc81593c46dbcaae3fb03954aa42ce6fafa44ccd4e7b2d483d62bb42dd666`, 109301 bytes; nonce `2bed61ed883bb1bad0cfab235dce8b1f`; Omni N/A; artifacts `[]`. Preservar S3 e S6 como falhas distintas. Não repetir a jornada longa sem nova mudança material pertinente e contraprova curta discriminante.

### CHECK compartilhado do W4

Run `43630618176`: **FAIL**, com 115 diagnósticos de tipo. A comparação reportada preserva os mesmos path/line/column/code anteriores, com duas diferenças no texto das mensagens e zero diagnósticos localizados em arquivos alterados. Isso não torna o check aprovado nem dispensa os diagnósticos.

Gates: **43**, warnings: **15**, rules: **78**, paths: **1519**, mesmos totais anteriores; **0 engine errors**. Artefato `14127863004`, SHA-256 informado pela API: `1b3f66b8c352749155baeeb2379b8a3fd69ec6d5f3546fb054a219dc59ca3bba`. Nenhum waiver ou aceite global foi concedido.

## Mapa de obrigações

| Obrigação | Critérios | Estado observado | Prova exigida e limite |
| --- | --- | --- | --- |
| OMITTED_TRAINING | WP11.T02.CHK.20, WP13.T02.CHK.20, WP13.T03.CHK.20, C10 | LOCAL_OMITTED_PHASE_VERIFIED_IN_S2_S3_S5_S6; GLOBAL_CONSUMERS_NOT_ACCEPTED | Fonte real da variante exclui treinamento do preço de implantação; validador deriva a falta sem zero ou pending pré-fabricado. Mostrar mesma identidade e ressalva em toda a sequência. **Limite:** O primeiro teste curto prova apenas a fase omitida e a amplificação do produtor; não alcança confirmação, escolha histórica nem restart. |
| CONFIRM_40000 | WP11.T02.CHK.21, WP13.T02.CHK.20, C10 | SAME_CASE_CONFIRMED_250000_MINUS10000_REACHED_IN_S3_S6; FULL_JOURNEY_OPEN | Mesmo caso/encarnação, versão posterior e componente training confirmado por fonte real; comparison canônico inverte vantagem, sem escolher pelo usuário. **Limite:** S3/S6 reached the current total/advantage assertions, but the final boundary/history/reopen chain did not complete. Portfolio eligible-complete and UI/BI/critique sharing the same revision remain broader WP13.T02.CHK.20 obligations. |
| EXACT_THRESHOLD_15000_15001 | WP13.T03.CHK.20, WP11.T02.CHK.21, C10 | NOT_REACHED_IN_S3_S6; FIN-IND-005_OPEN | Calcular e conferir 15000/15001 na mesma base confirmada, mais witnesses IEEE adjacentes da fronteira exata do engine. Preservar unidade/moeda/período e fontes. **Limite:** 55000 condicionado e a recertificação de um candidato omitido não demonstram por si só a fronteira integrada 15000/15001. Tolerância numérica nominal não elimina os witnesses IEEE. |
| HISTORICAL_CHOICE | WP11.T03.CHK.20, WP11.T02.CHK.21, C09, C10, CAMP.INV.06 | INITIAL_CONDITIONED_CHOICE_PERSISTED; POST_CONFIRMATION_HISTORY_ASSERTIONS_NOT_REACHED_IN_S3_S6 | Escolha anterior à resolução conserva razão, fontes, versões, subtotal e ressalva; nova análise usa versão atual e não reescreve nem autoaltera a escolha. **Limite:** S6 records the original conditioned choice digest at persistence; neither S3 nor S6 reached the final post-confirmation historical-choice assertions. |
| REAL_PROVIDER_REOPEN | WP11.DOD.01, WP11.T01.CHK.01, WP11.T01.CMP.01, C08, C09, CAMP.CMP.02 | NOT_REACHED_IN_S3_S6; NOT_ESTABLISHED_BY_THIS_CORRECTION | Fechar efetivamente o provider/store antes de reabrir, reconstruir os serviços e obter nova autoridade; recuperar mesmo caso/escolha/versões em outra identidade autorizada e recusar outsider/revogação. **Limite:** Neither S3 nor S6 reached dispose/open. The PR56-derived test defines replay before close/reopen and authorized reads/revocation after reopening; its execution has not established those later phases in this correction. It also does not define a persisted sensitivity-envelope replay after restart. |
| AUTHORIZED_PERSISTED_REPLAY | C08, C09, CAMP.INV.04, CAMP.CMP.02, CAMP.QLT.06 | S2_S5_SAME_STORE_RECERTIFICATION_PASS; JOURNEY_REPLAY_AND_POST_REOPEN_REPLAY_NOT_ESTABLISHED | Reprodução autorizada recertifica fontes atuais e o candidato salvo, conserva CAS/fences/proofs/ancestry aplicáveis e nega alteração de fonte, escrita aninhada ou revogação tardia. Manter separada a demonstração de replay posterior a reabertura. **Limite:** S2/S5 prove real C08 stored-candidate recertification and private binding/root/lease counterexamples inside the same LocalStore. They do not prove actual restart, journey replay after confirmation, post-reopen sensitivity replay, or installed UI/native/MCP integration. |
| DISCRIMINATING_PERFORMANCE_PROOF | CAMP.QLT.06 | SEARCH_AND_C08_COUNTER_REDUCTIONS_PASS_IN_S5; LONG_JOURNEYS_S3_S6_FAILED; NO_END_TO_END_SPEEDUP_CLAIM | Registrar W/S, seleção, fase, contadores, duração e resultado; baseline deve falhar pela busca repetida após atingir as assertions financeiras e de autoridade. Executar novamente só após mudança material. **Limite:** Reduced search/C08 counts and short-test phase timings do not close FIN-IND-005. S6 has a slower omitted phase than S3 and stops earlier; no end-to-end speedup is claimed. |
| REAL_CONSUMERS_AND_GLOBAL_ACCEPTANCE | WP11.DOD.20, WP11.T02.DOD.20, WP13.T02.CHK.20, CAMP.CMP.04, CAMP.DOD.02, CAMP.DOD.20, C10 | NOT_ESTABLISHED_BY_THIS_PATCH; SHARED_CHECK_FAILED; GLOBAL_ACCEPTANCE_FALSE | Consumidores reais usam as mesmas versões, condições e referências; contribuição precisa estar ligada nos entrypoints e empacotamento reais. **Limite:** Esta missão de desempenho e sua seleção cirúrgica não concedem aceite dos consumidores, da composição WP10, dos native packs ou da campanha. Preservar todas as pendências anteriores. |

## Cláusulas normativas integrais

Os textos seguintes foram copiados literalmente das fontes recuperadas. Os ponteiros referem-se ao documento indicado, não a uma reformulação do critério.

### WP11.T02.CHK.20

AI-RENEWAL-OMITTED-CATEGORY remove training da entrada, sem linha, sem pending pré-cadastrado e com implementação explicitamente sem treinamento: validador deriva missing-category e knownSubtotal 210000; completeDifference/total coberto ficam indisponíveis e a comparação é conditioned em todos os consumidores.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/canonical_work_package/tasks/1/checks/3`. Status canônico preservado: `NOT_RUN`.

### WP11.T02.CHK.21

Na mesma variante, confirmar novo componente training=40000 com fonte torna cobertura completa, total 250000, diferença -10000 e teto de implantação15000. A comparação de custo se inverte, condição mínima 20000 falha e a escolha original mantém subtotal 210000/ressalva pending/versões.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/canonical_work_package/tasks/1/checks/4`. Status canônico preservado: `NOT_RUN`.

### WP11.T03.CHK.20

Registrar escolha condicionada na variante de treinamento omitido; confirmar treinamento 40000 depois conserva a escolha/subtotal/ressalva originais e apresenta nova alternativa250000/diferença -10000 sem reescrever a razão histórica ou autoalterar a escolha.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/canonical_work_package/tasks/2/checks/3`. Status canônico preservado: `NOT_RUN`.

### WP13.T02.CHK.20

Combinação contendo a alternativa training omitida tem subtotal 210000 e não passa como eligible-complete; após training = 40000, total 250000 rompe teto240000 e vantagem mínima 20000. UI/BI/critique usam a mesma versão, sem ranking com categoria oculta.

Fonte: `WP13.json`, blob `1c268bae1d894ee1a2a350bd1a2cc5da7a3433dd`, JSON Pointer `/tasks/1/checks/3`. Status canônico preservado: `NOT_RUN`.

### WP13.T03.CHK.20

Com training omitido, teto 55000 vale apenas para componentes conhecidos e permanece condicionado. Após training = 40000 confirmado, outros custos205000 produzem teto 15000;15000 atende mínimo 20000 e15001 falha, com a mesma base confirmada.

Fonte: `WP13.json`, blob `1c268bae1d894ee1a2a350bd1a2cc5da7a3433dd`, JSON Pointer `/tasks/2/checks/3`. Status canônico preservado: `NOT_RUN`.

### WP11.DOD.01

Caso e escolhas sobrevivem a reinício e são compartilhados conforme autorização.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/canonical_work_package/axioms/dod/0`. Status canônico preservado: `NOT_RUN`.

### WP11.T01.CHK.01

Criar caso em uma sessão, reiniciar provider real e ler em outra identidade autorizada conserva conteúdo/versão/autoria; ator sem acesso recebe projeção reduzida ou recusa.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/canonical_work_package/tasks/0/checks/0`. Status canônico preservado: `NOT_RUN`.

### WP11.T01.CMP.01

Cobrir rascunho, objetivo corrigido, referência revogada/substituída, concorrência e reinício.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/canonical_work_package/tasks/0/axioms/completeness_criteria/0`. Status canônico preservado: `NOT_RUN`.

### WP11.T01.INV.01

Ator e autorização vêm do host; versão e histórico não são escolhidos pelo modelo nem importados como confiança.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/canonical_work_package/tasks/0/axioms/invariants/0`. Status canônico preservado: `NOT_RUN`.

### WP11.T01.SUC.01

André e um colaborador autorizado retomam a mesma pergunta e seus dados sem reconstruir contexto.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/canonical_work_package/tasks/0/axioms/success_criteria/0`. Status canônico preservado: `NOT_RUN`.

### WP11.DOD.20

Alternativas persistem inventário, avaliação de categorias e comparação C10 consumidos por UI, BI, crítica e portfólio.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/canonical_work_package/axioms/dod/2`. Status canônico preservado: `NOT_RUN`.

### WP11.T02.DOD.20

Alternativa persistida entrega cálculo WP03 e cobertura C10 reais a todos os consumidores nomeados.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/canonical_work_package/tasks/1/axioms/dod/1`. Status canônico preservado: `NOT_RUN`.

### WP11.T02.CMP.20

Cobrir inventário ausente, categoria omitida, not-applicable sem suporte, zero confirmado, fonte revogada, inclusão compartilhada e custo posterior inversor.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/canonical_work_package/tasks/1/axioms/completeness_criteria/1`. Status canônico preservado: `NOT_RUN`.

### WP13.T03.CHK.18

Executar sf_sensitivity_evaluate pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino.

Fonte: `WP13.json`, blob `1c268bae1d894ee1a2a350bd1a2cc5da7a3433dd`, JSON Pointer `/tasks/2/checks/4`. Status canônico preservado: `NOT_RUN`.

### WP13.T03.INV.18

Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo.

Fonte: `WP13.json`, blob `1c268bae1d894ee1a2a350bd1a2cc5da7a3433dd`, JSON Pointer `/tasks/2/axioms/invariants/1`. Status canônico preservado: `NOT_RUN`.

### WP13.T03.QLT.01

Unidades, precisão, intervalo e fonte são explícitos; interação determinística não depende de latência de IA.

Fonte: `WP13.json`, blob `1c268bae1d894ee1a2a350bd1a2cc5da7a3433dd`, JSON Pointer `/tasks/2/axioms/quality_standards/0`. Status canônico preservado: `NOT_RUN`.

### CAMP.QLT.06

Critérios e evidências são discriminantes: descrevem qual erro real seria detectado. Testar novamente apenas o que mudou ou o que um gate obrigatório exige.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/quality_standards/5`. Status canônico preservado: `NOT_RUN`.

### CAMP.CMP.04

As contribuições novas são acessíveis pelos entrypoints reais, com estado compatível e assets/receitas incluídos na entrega do módulo; documentos ou receitas que só existem no repositório não contam como funcionalidade.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/completeness_criteria/3`. Status canônico preservado: `NOT_RUN`.

### CAMP.CMP.02

Cobrir leituras e escritas autorizadas/recusadas, dados completos/parciais/ausentes, concorrência, reenvio, referência removida, perda de acesso e retomada depois de falha.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/completeness_criteria/1`. Status canônico preservado: `NOT_RUN`.

### CAMP.INV.01

Domínios continuam como fontes de verdade. UI, BI, relatórios, importação e IA consomem os mesmos contratos; não mantêm cálculos financeiros ou estados de compra paralelos.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/invariants/0`. Status canônico preservado: `NOT_RUN`.

### CAMP.INV.02

Papéis, escopo de dados, holders, locks, versões esperadas e transições legais são preservados. Tornar uma ação fácil de encontrar não amplia autoridade.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/invariants/1`. Status canônico preservado: `NOT_RUN`.

### CAMP.INV.03

Ausência, zero observado, valor herdado, estimativa, valor aprovado e emissão interna mantêm significados distintos; período, versão e moeda não mudam silenciosamente.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/invariants/2`. Status canônico preservado: `NOT_RUN`.

### CAMP.INV.04

Nenhum conteúdo restrito reaparece em busca, contagem, comparação, gráfico, comentário, snapshot, exportação, prompt ou resultado de rotina. Ler ou aplicar revalida acesso atual.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/invariants/3`. Status canônico preservado: `NOT_RUN`.

### CAMP.INV.06

Revisão preservada permanece estável. Atualizar a origem não reescreve a reunião passada; acesso revogado não permite recuperar conteúdo privado por histórico.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/invariants/5`. Status canônico preservado: `NOT_RUN`.

### CAMP.INV.20

Versão observada não equivale a validade global; soma correta não equivale a custo completo. Nova categoria relevante, revogação e substituição preservam auditoria e exigem estado correto.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/invariants/11`. Status canônico preservado: `NOT_RUN`.

### CAMP.DOD.02

As jornadas J01–J13 funcionam nos entrypoints reais, com persistência, autorização, produtores e consumidores reais, incluindo IA, Relay, documentos, portfólio e memória.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/dod/1`. Status canônico preservado: `NOT_RUN`.

### CAMP.DOD.20

C06 resolve confirmação por escopo e C10 resolve cobertura de custos; produtores e consumidores reais demonstram as contraprovas CONFIRM-SCOPE e AI-RENEWAL-OMITTED-CATEGORY.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/dod/6`. Status canônico preservado: `NOT_RUN`.

### CAMP.CMP.20

Cobrir material/irrelevante/revogado/substituído, categoria incluída/inaplicável/pendente/omitida/zero e consumo WP06→WP09 da extração obrigatória.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/completeness_criteria/6`. Status canônico preservado: `NOT_RUN`.

### CAMP.SUC.20

A pessoa evita cobrança irrelevante, identifica a informação que condiciona a comparação e reavalia custo posterior sem perder a escolha original.

Fonte: `WP11.pack.json`, blob `b593782368d19e557358d64dcecaefccd10ac991`, JSON Pointer `/global_campaign_axioms/success_criteria/9`. Status canônico preservado: `NOT_RUN`.

## Interpretação do oráculo e identidade

No oráculo normativo, USD240000 é o custo da renovação/base, identificado por `renewal` e `SYN-RENEWAL-QUOTE-V1`; não há prova separada de receita. A redação original do usuário/mission permanece preservada no JSON.

A entrada omitida não contém linha nem entry de training. A cotação da implantação45000 exclui treinamento; a lacuna é derivada pelo validador. O resultado é knownSubtotal210000, totalnull, diferença conhecida30000, completeDifferencenull e comparação condicionada. O teto55000 aplica-se somente aos componentes conhecidos.

Confirmar training40000 com fonte produz250000 e vantagem−10000; outros custos205000 deixam teto nominal15000 para vantagem mínima20000. A mesma base deve mostrar15000 atendendo e15001 falhando, com witnesses IEEE adjacentes preservados para o certificado exato. A escolha histórica conserva seu digest, alternativeVersion, basisVersion, fontes e ressalva pending.

## Revisão fria do delta

Conclusão: nenhum bloqueio concreto encontrado por leitura. Não foi executado teste de produto local nem alterado arquivo de produto pelo revisor.

| Arquivo | Blob preimage em 3ea9dc2 | Conclusão de revisão |
| --- | --- | --- |
| `product/portfolio/planner-sensitivity.ts` | `3dec070ca5f56f7bd03a09b4b19468c950d82214` | A busca exata inicial permanece. A recertificação final usa o candidato já encontrado e novos previews do valor aceito e do vizinho IEEE rejeitado. Resolve/revalidate, releituras de cenário/amostras, cobertura e revalidação final de autoridade permanecem. |
| `product/portfolio/threshold-proof.ts` | `056a857364cf8a6c2a2bc97bf107276612edf55d` | O candidato persistido pode ser vinculado a prova estrutural canônica recém-produzida: cenário, operação, metadata, engine, limites, unidade, período, ordem/IDs dos componentes, digest dos componentes fixos e conjunto integral de evidências. Os dois witnesses adjacentes continuam novos. |
| `product/portfolio/verification.ts` | `912df8ecd8552b245e124b93c46644c92a32f3ac` | Replay trata o número salvo como candidato. Reconstitui domínio e evidências atuais, recertifica o par adjacente e exige digest integral do resultado final igual ao salvo. O root readonly próprio, staging de fence, attempt identity, poison por escrita aninhada e publicação somente após aceitação do root não foram alterados. |
| `product/planner/sensitivity-units.ts` | `1673c86995cf71b61e288d91492ae7b691934171` | Resolve reutiliza somente suas primeiras observações destacadas do resultado selecionado e caso. As releituras independentes de caso, cenários, evidências e resultados continuam. A identidade de Request/host/binding/lease/headers é retida, não o sucesso de autorização; operações seguintes resolvem novamente. |

A revisão considera a recertificação numérica segura para o domínio canônico direto em USD: a prova atual fixa cenário/operação, engine, ordem/IDs dos componentes e digest dos componentes fixos; novos previews do valor aceito e vizinho rejeitado reproduzem a fronteira monotônica. O finalizer recompõe a união completa de evidências e o replay exige igualdade do digest integral. As observações iniciais de units ficam limitadas à invocação e continuam comparadas às observações independentes posteriores. O fence privado continua staged até o root readonly aceitar.

## Delta adicional W4

W4 acrescenta dois arquivos de produto ao delta anterior, com estes preimages informados pelo root:

| Arquivo | Preimage |
| --- | --- |
| `product/decisions/result-store.ts` | `d6b1d58e658a784aafe0ea978c46692cd8c5f59a` |
| `product/planner/stored-scenarios.ts` | `fca509789efd2bf1b7d9453d09a3a460ee778feb` |

O batching compartilha envelopes de leitura C08 de siblings dentro da mesma fase, preservando verificações de fonte/autoridade por resultado e observações completas de caso separadas. S4 demonstra o discriminante anterior 16→10; S5 passou 36 testes / 297 assertions, com 10 leituras C08 para siblings e os controles por resultado preservados. A revisão fria dos quatro arquivos acima não deve ser automaticamente atribuída a estes dois arquivos adicionais.

## Blobs consumidos seletivamente

| Origem | Blob | Uso |
| --- | --- | --- |
| `modules/sucafina/Sucafinav1/test/product/review-fixes/finance-journey/journey-phase.test.ts` | `5ca793fc4c7ae6d06f1af9cfb2f53faaa963c70b` | SELECTIVE_REUSE_IN_OWN_NAMESPACE |
| `modules/sucafina/Sucafinav1/test/product/review-fixes/finance-journey/observed-coverage.ts` | `0b6bdc6285b9a57c38939f5dea469bfdc060eb2f` | SELECTIVE_REUSE_IN_OWN_NAMESPACE |
| `modules/sucafina/Sucafinav1/test/product/review-fixes/finance-journey/observed-ports.ts` | `5e8740a9e3372e75624674617b63fadb5f81bfbc` | SELECTIVE_REUSE_IN_OWN_NAMESPACE |
| `modules/sucafina/Sucafinav1/test/product/review-fixes/finance-journey/phase-trace.ts` | `7123f5147720f643ef909b0a2d1ad1943afd3df5` | SELECTIVE_REUSE_IN_OWN_NAMESPACE |
| `modules/sucafina/Sucafinav1/test/product/wp11/renewal-choice-fixture.ts` | `0dc89d86866620a8109051c68bc2d2b4d92c508f` | UNCHANGED_REAL_SHARED_FIXTURE |
| `modules/sucafina/Sucafinav1/test/product/wp13/coverage-sensitivity-integration.test.ts` | `192653d276d45efc073df2aea5f8c2170564bd7c` | PRIOR_INTEGRATED_ORACLE |
| `modules/sucafina/Sucafinav1/test/product/wp13/sensitivity-read-scope-fixture.ts` | `d337b1cd730c3ecd4efb40329551a27e8d932e08` | REAL_PERSISTED_SERVICES_HELPER_VERIFIED_BY_MCP |
| `modules/sucafina/Sucafinav1/test/product/wp13/sensitivity-read-scope.test.ts` | `a25539d00f8a43f2e7e3be02a16c29ba1c0272f2` | PRIVATE_BINDING_AND_READ_SCOPE_COUNTEREXAMPLES_CITED_IN_NEW_TEST |
| `W26 threshold-recertification.test.ts` | `42ddb74c93873d0dec1e9d255ba90a2ae71cab7d` | INTERVAL_WITNESS_ORACLE_CITED_IN_NEW_TEST |

PR56 permanece preservada. Seus quatro arquivos foram consumidos no namespace próprio `finance-resume-performance`. Blobs de origem e de destino ficam separados no JSON; não se afirma identidade byte a byte entre arquivos após adaptação de namespace/título de teste.

## Persistência, reabertura e replay: escopos separados

- O código da jornada derivada de PR56 prevê replay antes de `dispose → openLocalStore` e leituras do caso/escolha sob colaborador, outsider e revogação depois da reabertura. S3 e S6 não alcançaram essas fases. Mesmo uma futura passagem desse código não representaria replay do envelope de sensibilidade persistida depois do restart.
- `persisted-recertification.test.ts` usa resultado C08 real e envelope privado reconstruído para verificar candidato, evidências, root e lease no mesmo LocalStore. Isso não é restart nem prova instalada UI/native/MCP.
- Reabrir conexão SQLite mantendo a conexão produtora aberta é distinto de descartar/reabrir o provider. Reconstruir apenas serviços no mesmo store também é distinto.
- Restart do provider LocalStore no teste é prova de componente e não reinício do Orchestra. Nenhum aceite instalado ou externo é concedido por este registro.

## Trabalho restante: derivação do código

A análise somente de leitura após S3 não identificou outra redução pequena segura que preserve callbacks opacos de autoridade, recertificações necessárias e witnesses novos. O batching C08 então selecionado foi aplicado em W4 e validado em S5; S6 ainda não completou a jornada longa.

Para o caminho completo bem-sucedido de cobertura de dois samples, a contagem estrutural é:

| Fase | resolveAuthority | isStillValid | Provas estruturais | Previews |
| --- | ---: | ---: | ---: | ---: |
| issue | 2 | 2 | 1 | 2 |
| two initial qualify calls | 4 | 4 | 0 | 2 |
| producer final revalidate | 2 | 2 | 1 | 2 |
| two qualification verify calls | 8 | 8 | 2 | 8 |
| **Total** | **16** | **16** | **4** | **14** |

Cada prova estrutural chama units.issue duas vezes: 8 chamadas nesse recorte. **São contagens derivadas do controle de fluxo, não duração medida, perfil observado nem previsão de sucesso.** Falhas precoces executam menos chamadas. S3 chegou aos dois qualifiers iniciais, mas não às recertificações finais dessa tabela. S6 terminou no primeiro qualifier, antes dos writes confirmados e de exact.

Os atalhos examinados têm limites concretos:

- `authorityDigest` omite `checkedAt`; igualdade desse digest não substitui a validação de timestamp/fresh/accessRevision feita por `createCoverageIntervalCertificate`.
- Remover qualify dentro de verify também remove current/resolveAuthority/isStillValid em torno de awaits; isso não elimina somente recomputação determinística.
- O intervalo estrutural salvo não contém a baseline numérica absoluta nem o par atual aceito/rejeitado, e precede awaits/gravações posteriores.
- Derivar baseline ou threshold com subtrações reassociadas altera arredondamento IEEE/plateaus. Busca puramente numérica exigiria base canônica explícita e prova adicional de paridade.
- Indexar digests/referências durante validações síncronas pode ser seguro, mas não foi demonstrado como causa dos 17–18 s dos qualifiers; não justifica ampliar o delta.

Fontes adicionais lidas no W2: `coverage-interval.ts`, blob `351aa6cf8702c759da3c35cbf531f355d04ba742`; `coverage-classification.ts`, blob `4280c9a249627893eb798eb421711d9e58e50a8f`.

## Dependências e obrigações globais mantidas

- PR59 `diagnose-calculation@e80fdc933dfd25956a50c22dea76bf077e79815b`: consolidação de envelopes pertence ao WP10. Proposta pinada: `modules/sucafina/Sucafinav1/docs/sf2h/receipts/diagnostics/calculation/proposed/0001-wp10-source-observation.patch.txt`. No pin, permanece **NOT_APPLIED / NOT_RUN**; o alvo 4→2 envelopes preserva 2 observações, 6 autenticações e 4 revalidações. Não é ganho de tempo medido, prova de FIN-IND-005 ou prova de suficiência.
- Proveniência PR59: `OWNER_HANDOFF.md` blob `6f7f5a7f9d12d09e8034eed94da6dcb86c08a95e`; `proposed/manifest.json` blob `15a2048d7ec943a9fdfdbff191aef1d95fc0fe3b`; `README.md` blob `aa9d7d1142e8279eaee8a4eb0cbcb675ff6e9bd4`, no mesmo prefix/pin. O blob do próprio patch não foi fornecido; a referência por path/commit é explícita, sem inventar hash.
- Preimages WP10: `product/integration/source-lifecycle.ts` = `65867a3e6aa9b5b85266bb637fb22cf1c6c6d539`; `product/integration/planner-sources.ts` = `6230f22e7dd66fec1103f28cc9a7937b2dca1449`. Base W26 `a1434e7ea7340aa1d1c8ce6bb48958b724218170`, iguais no W27 observado `ab8fb4f29d078d179742a77679ef85e5c549b114`. O owner deve conferir seu novo head/preimages antes de consumir; Finance não aplica implementação duplicada.
- A hipótese PR59 de redução de envelopes é separada das lacunas instaladas de contrato de snapshot (`FIN-R2-REV-01`) e grant privado de campanha preservadas no handoff anterior. O pin de CI desta missão continua `a3d29d011ba3607a57914701300f09117a3e2de9`, conforme o usuário.
- PR55 `diagnose-memory@0d7fb6f12ed053340391ff6e4f95b6f3c1276ea8`: diagnóstico complementar preservado, sem repetir investigação.
- PR56 run43625830145 terminou no guard180000ms durante `confirmed.coverage.qualify / confirmed.authority.resolve / read-case`; a criação da fixture e a confirmação de treinamento já haviam retornado. O rótulo antigo não identificava a fase ativa.
- WP13.T02.CHK.20 também exige portfólio/eligible-complete e UI/BI/critique na mesma revisão. Sensibilidade financeira isolada não fecha esses consumidores.
- CAMP.CMP.04 exige entrypoints reais e empacotamento; presença de código, docs ou receipts no repositório não satisfaz funcionalidade instalada.
- Preservar pendências, resultados anteriores, autoria, CAS, fences, provas, ancestry, revogação e duas observações independentes. Medição melhor não é aceite global.

## Recibos das lacunas herdadas

No pin original `3ea9dc2efe0de8d283f9625774697e431f55a0d7`, prefix `modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP11/finance-resume-20261114/`:

- `remaining-gaps-final.json`: blob `3935412c87c380f2d6c8c5a855bbea17c629b412`.
- `consumer-reconciliation.json`: blob `c027491c3c6ce6970c7966d779c72ff1dd24e5ec`; `/normativeOpen` conserva FIN-R2-REV-01, WP10/S0, INV.11; `/deltas/0` trata a seam readonly transactionAll; `/deltas/3` conserva o provider de campanha implementado e ainda não consumido na composição examinada.

A fonte histórica PR32 é `9048e0e65351a5bd80768458a79fed94a4993db7`. O recibo referencia `product/host-binding/state-provider.ts` blob `2fd55c7304add0829d7434917c80664fe86356b9`, `business-services.ts` blob `b3595989d0c08159c96484d96bd40a149a9721e6`, `scenario-operation-access.ts` blob `aa1be4cfb8f501b3fccddb269efce5567bcdd447` e `runtime/local-store.ts` blob `b753e3ffbfcdc06de373388845c686afac26dec8`. São referências do recibo, sem releitura do produto atual do owner nesta etapa; os diretórios dos dois basenames não foram presumidos.

Essas lacunas não foram atribuídas como causa dos timeouts da fixture e não são encerradas pela proposta PR59 nem pelos 36 testes de S5. Proveniência fornecida pelo agente de diagnóstico após recuperação seletiva dos recibos via GitHub MCP.

## Disposição final e dependências

**FIN-IND-005 permanece OPEN.** S5 comprova a redução de trabalho nos produtores selecionados, preservando verificações e contraprovas; S3 e S6 não completam a cadeia de threshold confirmado, histórico, replay e reabertura. A expiração do guard em S6 foi seguida de revalidação false e recusa stale, sem publicar o resultado financeiro confirmado. Não se infere uma revogação de negócio independente da guarda. O CHECK compartilhado continua FAIL e não foi dispensado.

As dependências exatas permanecem com seus owners: proposta PR59 de envelopes WP10 ainda NOT_APPLIED/NOT_RUN na origem; contrato de snapshot FIN-R2-REV-01 e grant privado de campanha históricos; diagnósticos de tipo e gates de arquivo histórico; consumidores e provas instaladas do escopo original. Nenhuma dessas pendências é encerrada pelos 36 testes de S5.

O produto testado é W4 `7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1`, tree `2da074668b164b1aa5e051f8a70366969425906f`. A entrega final é descendente de W4 com somente receipts; a PR42 registra seu SHA exato. Os runs continuam atribuídos aos seus W/S originais, sem reatribuir testes ao commit de receipts.

## Evidência durável

Prefixo: `modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP11/finance-resume-performance/`.

- `S1-result.json` a `S6-result.json`: seleções, W/S, runs/jobs, fases, contadores, duração e resultado.
- `CHECK-W4-result.json`: CHECK compartilhado e comparação de diagnósticos/gates.
- `CI-LEDGER.json`: encadeamento dos registros de CI.
- `scope-manifest.json`: fronteiras e arquivos da correção.
- `HANDOFF-FINAL.md`: implementação, resultados, limites e dependências.
- `criteria-provenance.json` e `criteria-provenance.md`: este mapa integral de critérios/proveniência.

## Preservação normativa

As 29 cláusulas normativas, contratos C08/C09/C10, oráculo, finding e escopo originais permaneceram inalterados; oito obrigações continuam explícitas. Digest canônico antes/depois: `1cb232e686d4253619396df39d546b9ebdd682aac0f5549d853dc3b7cd2f6899`. A conferência cobre os objetos normativos, excluindo disposições locais de evidência atualizadas, e não é teste de produto nem aceite. O inventário anterior de 371 critérios, 18 tarefas e 87 checks continua preservado, com status normativos NOT_RUN sem waiver.
