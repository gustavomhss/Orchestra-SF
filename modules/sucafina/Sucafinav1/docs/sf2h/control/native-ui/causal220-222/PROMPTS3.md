# Três correções causais novas — 220 a222

Um bloco completo por chatNOVO. Branches preparadas; execução ainda não iniciada por esta publicação.

## 220

```text
Trabalhe em gustavomhss/Orchestra-SF em uma sessão NOVA. Missão220: Fechar validação Decisions e captura C12 real.

Branch:sf-decisions-capture; HEAD:c5db89c85817b8b12f535b51717313133c296e12; epoch:causal-ci-e1-browser220. Baseproduto:e6488a4d7694464d9d7d457f0604abe93e0ea49e. Confira HEAD/S0-FENCE, publique ACK e registre modelo/session somente se expostos. Preserve trabalho anterior e todos os contratos.

Leia o pacote COMPLETO, com logs/inputs/seletores reais e referências próprias completas:
https://github.com/gustavomhss/Orchestra-SF/blob/2a6684837d73eefa565c33f9e79ec2f8cf2b81c5/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/220.json
Leia AGENTS, START/WORKFLOW/executionCOMMON e os próprios packs/ordens/anexos canônicos. Planejamento imutáveldbf9547211d9b0fade619790de7c19c0869b7c7d; normativoUXcbac654784714f68779ae1434d30e6ea8970c4d1. Esta missão corrige falha efetivamente observada noCI, não acrescenta escopo/etapa ao produto.

Conclua TODA a causa e os consumidores correspondentes:
1. Resolver a aceitação indevida de projection.cases input{includePrivate:true}; input{} legítimo devepassar, qualquer unknown/grantfield devefalhar. Preservar contratos/11cases/asserções e decodeEffect4correto; não relaxar closedobject ou oracle.
2. Diagnosticar decision-prepare-changes HTTP400 em prepareC12Change fixture:244 e Real C12 original capture unavailable memory-integrityfixture:142. Inspecionar o body/causareal/contrato decommand, origem/proveniência e construçãoChoiceSnapshot. Não supor que400éerrado e trocar por200.
3. Corrigir o produtor ou o setup legítimo conforme fonte canônica, até preparar/aplicar comando real, obter recibo atômico e permitir as provas existentes AM04/perdaderetorno/idempotência e AM05 originalreplay/rollback. Semgrant,recibo,comparação financeiraoucomando fabricados.
4. Preservar revisão/escolha humana autorizada,CAS,key+digest, únicoefeito,recovery apósreopen, perda deautoridade, scannerC08 eC09 outbox. Nenhuma transaçãoglobalimplícita ou bypass.
5. Completar a mudança e regressõescomportamentais nos limitesdoescopo; fora deles, patchINERTOcompre/post para211. Entregarselectors para214: Decisions, AM04domainrecovery/keycollision e AM05replay/rollback com mesmosinputs causais.

Ler código e dependências reais antes de editar, inclusive request/HTTPbody e fronteiras de permissão. Não trocar expectativas, inventar autoridade/recibo/fonte ou desativar checks para PASS. Use APIs públicas existentes; fora do write_paths, entregar patch INERTOcompleto com pre/post/contexto/contrato para211 aplicar, não mera recomendação. Se API/recursoexterno realmenteausente, provar callchain e terminar toda correção independente possível.

Somente nos write_paths do pacote e receipts/repair220/**. Branchisolada; abrir PR para sf-closure-bundle/PR191, com commit e sourceblobs.211écompositora,214 dispatcherproduto,190compiler. Não escrever na branch211/sf2-stack ou sourcebranchalheia.220/221/222têm pathsdisjuntos;219 mantém nativehostcontext.

Nenhum teste/typecheck/build/validator local ouCIpróprio. Requests cirúrgicos para214 após consumo211, dedup porW/tree/input/seleção. Inclua arquivo exato e efeito esperado. Logs históricos não são prova do novoC; não repetir falha semmudançacausal. Comentário não injeta contexto em chatiniciado; publicar handoffdeoutput para consumidor que jápossui esteescoponamissãointegral.

Entregue código/PRcompletos, pre/post blobs, critérios/casos, validação real/NOT_RUN, dependências externas mínimas e recheckindependente. Não encerrar em análise/plano, catálogo ou TODO enquanto houver código autorizado por fazer. GitHubMCP somente para remoto,CASexpected-head/force:false; sem gh/push/token/devmerge/deploy/Azure/engines/restart/guardbypass/segredos. Goalnativapausada,GLOBAL_RELEASEfalse,semnewsupervisor/watchdog.
```

## 221

```text
Trabalhe em gustavomhss/Orchestra-SF em uma sessão NOVA. Missão221: Fechar seleção legítima do cenário na regressão AM01.

Branch:sf-am01-selection; HEAD:cbe4a3e22e6ea6b7a5f15815fc48491fe88d0325; epoch:causal-ci-e1-browser221. Baseproduto:e6488a4d7694464d9d7d457f0604abe93e0ea49e. Confira HEAD/S0-FENCE, publique ACK e registre modelo/session somente se expostos. Preserve trabalho anterior e todos os contratos.

Leia o pacote COMPLETO, com logs/inputs/seletores reais e referências próprias completas:
https://github.com/gustavomhss/Orchestra-SF/blob/2a6684837d73eefa565c33f9e79ec2f8cf2b81c5/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/221.json
Leia AGENTS, START/WORKFLOW/executionCOMMON e os próprios packs/ordens/anexos canônicos. Planejamento imutáveldbf9547211d9b0fade619790de7c19c0869b7c7d; normativoUXcbac654784714f68779ae1434d30e6ea8970c4d1. Esta missão corrige falha efetivamente observada noCI, não acrescenta escopo/etapa ao produto.

Conclua TODA a causa e os consumidores correspondentes:
1. Resolver baseline-coverage-case-not-selected em hypothetical-closure212.test.ts:32, run43781520064/job133019558133.212encerrou;preservar a correção dela que cria previewrealnãocomitante, não reverter para total240000 comoobservadofinal.
2. Comparar Request/caseRef/evidenceRef/cobertura selecionada/contextos reais de cada baseline/pending/complete. Usar a ação/seleção legítima já existente para observar o produtor; não forjar authority/parent/provider/case, nem chamarhumbleprivateAPI.
3. Garantir observaçãolegítima e previewhipotético distintos, totaisnullcomconditionshipotéticas,mínimosknownsubtotals reais, zero vs missingtraining, fontes12meses e nenhum efeitoaplicado. Preservar consumidores finance/reviewer/portfolio.
4. Ler source212 completo+patchinertodoscenarios-review, códigoPlanner eC09/C10/C15/C16. Corrigir setup oucausa deprodutocompatchINERTOsefora delease; não simplesmente remover a observação/assertion nem usarcatchparaPASS.
5. Entregar PRcódigo+prepost+testes completos e request214 incluindo regressão212 e scenario-costs. Foco neste blocker real, sem reescrever18skills oufixturesglobais.

Ler código e dependências reais antes de editar, inclusive request/HTTPbody e fronteiras de permissão. Não trocar expectativas, inventar autoridade/recibo/fonte ou desativar checks para PASS. Use APIs públicas existentes; fora do write_paths, entregar patch INERTOcompleto com pre/post/contexto/contrato para211 aplicar, não mera recomendação. Se API/recursoexterno realmenteausente, provar callchain e terminar toda correção independente possível.

Somente nos write_paths do pacote e receipts/repair221/**. Branchisolada; abrir PR para sf-closure-bundle/PR191, com commit e sourceblobs.211écompositora,214 dispatcherproduto,190compiler. Não escrever na branch211/sf2-stack ou sourcebranchalheia.220/221/222têm pathsdisjuntos;219 mantém nativehostcontext.

Nenhum teste/typecheck/build/validator local ouCIpróprio. Requests cirúrgicos para214 após consumo211, dedup porW/tree/input/seleção. Inclua arquivo exato e efeito esperado. Logs históricos não são prova do novoC; não repetir falha semmudançacausal. Comentário não injeta contexto em chatiniciado; publicar handoffdeoutput para consumidor que jápossui esteescoponamissãointegral.

Entregue código/PRcompletos, pre/post blobs, critérios/casos, validação real/NOT_RUN, dependências externas mínimas e recheckindependente. Não encerrar em análise/plano, catálogo ou TODO enquanto houver código autorizado por fazer. GitHubMCP somente para remoto,CASexpected-head/force:false; sem gh/push/token/devmerge/deploy/Azure/engines/restart/guardbypass/segredos. Goalnativapausada,GLOBAL_RELEASEfalse,semnewsupervisor/watchdog.
```

## 222

```text
Trabalhe em gustavomhss/Orchestra-SF em uma sessão NOVA. Missão222: Fechar autoridade nativa AM02 após reabertura.

Branch:sf-am02-authority; HEAD:99d55d36d37842fa9893c5161b1aa2d04b87fa70; epoch:causal-ci-e1-browser222. Baseproduto:e6488a4d7694464d9d7d457f0604abe93e0ea49e. Confira HEAD/S0-FENCE, publique ACK e registre modelo/session somente se expostos. Preserve trabalho anterior e todos os contratos.

Leia o pacote COMPLETO, com logs/inputs/seletores reais e referências próprias completas:
https://github.com/gustavomhss/Orchestra-SF/blob/2a6684837d73eefa565c33f9e79ec2f8cf2b81c5/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/222.json
Leia AGENTS, START/WORKFLOW/executionCOMMON e os próprios packs/ordens/anexos canônicos. Planejamento imutáveldbf9547211d9b0fade619790de7c19c0869b7c7d; normativoUXcbac654784714f68779ae1434d30e6ea8970c4d1. Esta missão corrige falha efetivamente observada noCI, não acrescenta escopo/etapa ao produto.

Conclua TODA a causa e os consumidores correspondentes:
1. Resolver denied authority-unavailable em nativeValue/native-capabilities-fixture.ts:63 ao executar performance-public-c16-reopen.test.ts:85/126, run43781314836/job133018910748. A recusa é proteção legítima até provaradmissão correta.
2. Rastrear a primeira perda decontextobinding/parent/lease/principal/policy/accessRevision/SkillLoadReceipt/providerobject/generation na composição legítima e apósreabertura. Revalidar RequestautenticadoeSkillcarregada pelo publicC16, sem fabricarautorização ou enfraquecer a recusa.
3. Exercer UI/agente/privateMCP nas mesmas3portasPerformance e recibos reais, reload/rebind correto,ação fora degrant negada,ownerrevoked/bindingantigo negados. A prova é deparidade e fronteira real, não metadata/snapshotoufakeTask.
4. Se a causa for runtime/produtor, fornecer patchINERTOcompleto para211; não alterar host-context.ts que219possui comoautor nativo. Usar APIs públicas existentes e preservar origemTask/C15; se aAPI não exposta realmenteimpedirpositivo, documentar callchain exato e terminar a correção legítima possível.
5. Entregar código/PR/prepost/critério e request214 dessa seleção exata; não editar39operações ou reescrever os packs que196 jáentregou.

Ler código e dependências reais antes de editar, inclusive request/HTTPbody e fronteiras de permissão. Não trocar expectativas, inventar autoridade/recibo/fonte ou desativar checks para PASS. Use APIs públicas existentes; fora do write_paths, entregar patch INERTOcompleto com pre/post/contexto/contrato para211 aplicar, não mera recomendação. Se API/recursoexterno realmenteausente, provar callchain e terminar toda correção independente possível.

Somente nos write_paths do pacote e receipts/repair222/**. Branchisolada; abrir PR para sf-closure-bundle/PR191, com commit e sourceblobs.211écompositora,214 dispatcherproduto,190compiler. Não escrever na branch211/sf2-stack ou sourcebranchalheia.220/221/222têm pathsdisjuntos;219 mantém nativehostcontext.

Nenhum teste/typecheck/build/validator local ouCIpróprio. Requests cirúrgicos para214 após consumo211, dedup porW/tree/input/seleção. Inclua arquivo exato e efeito esperado. Logs históricos não são prova do novoC; não repetir falha semmudançacausal. Comentário não injeta contexto em chatiniciado; publicar handoffdeoutput para consumidor que jápossui esteescoponamissãointegral.

Entregue código/PRcompletos, pre/post blobs, critérios/casos, validação real/NOT_RUN, dependências externas mínimas e recheckindependente. Não encerrar em análise/plano, catálogo ou TODO enquanto houver código autorizado por fazer. GitHubMCP somente para remoto,CASexpected-head/force:false; sem gh/push/token/devmerge/deploy/Azure/engines/restart/guardbypass/segredos. Goalnativapausada,GLOBAL_RELEASEfalse,semnewsupervisor/watchdog.
```
