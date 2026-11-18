# Handoff 01 — auditoria independente de composição

## Parecer no SHA efetivamente examinado

**PRESERVATION_PASS_FOR_INCREMENT_01; BUNDLE_NOT_READY_FOR_FINAL_CI.**

Árvore material examinada: `sf2-stack@47273c4f20c7c1af9b08537d26618901c36725e3`, tree `894074bb9436867979f81e93a8360bc900cf5f7a`. O parecer limita-se a esse conteúdo e ao delta admitido. Não aceita um C final, não acompanha automaticamente heads futuros e não substitui os três revisores finais.

Declaro ausência de autoria do produto examinado. Minha escrita é exclusivamente documental, nesta pasta de bundle-review, pela PR #64 `sf2-bundle-review → sf2-control`. Não executei testes, typechecks, guards, compilação, geração de produto, CI ou epic. Não corrigi produto, aprovei ignores, fiz merge, enviei mensagens/comentários externos ou criei agentes.

## Resultado verificável

O delta próprio da PR #58, `import-recovery@e1dc51a6df8cd40a125d960dce6fa5e5d8b33c5e`, foi comparado por árvores completas contra sua base `ba8a09e371ce8d93eb917eabb102caaee5affaf4`. São **nove arquivos**: um produtor, quatro testes/fixtures e quatro recibos. Todos estão no incremento com o **mesmo blob e modo**, e o preimage do produtor também coincide. Não há arquivo aceito omitido, deleção, rename ou alteração de modo. O único décimo arquivo do incremento é seu recibo de integração.

A cadeia estática foi lida: `apps/cli/src/sucafina-product/import-services.ts` chama `product/imports/host.ts`; este constrói `createSfStagedImportFiles` e publica `admit: files.admit`. Os 39 caminhos distintos importados diretamente pelos dois consumidores e pelos quatro arquivos de teste/fixture existem. **17 têm blob diferente da árvore de origem**. A comparação completa com ambos os hashes está no parecer JSON. Isso não demonstra quebra, compatibilidade funcional ou equivalência transitiva; mantém a qualificação da composição pendente, como o próprio integrador declarou.

Os resultados funcionais anteriores continuam atribuídos aos W/S originais. O typecheck Sucafina de origem reprovado não foi convertido em PASS por CLI/guards verdes. Todos os gates do conteúdo composto permanecem NOT_RUN/não estabelecidos.

Não encontrei defeito de preservação no delta admitido desse incremento. Arquivos ainda não selecionados das demais fontes são **pendências de composição**, não correções supostamente perdidas pelo incremento 1.

## Cobertura documental completa

- [Índice e disposições](inventory/index.json): 42 heads fixos, suas árvores, ancestralidade, contagens completas e estado por fonte.
- Quatro manifestos JSONL: **23.349 ocorrências de paths alterados**, **4.933 paths distintos** e **5.934 versões por path**. Cada registro conserva entrada da base e variantes por PR. A ausência de uma PR no registro significa igualdade com a base, não ausência do arquivo.
- Os 39 heads de produto descendem da base inicial. Os três heads de revisão/control divergem e são **somente evidência**; substituírem a árvore de produto removeria 519 arquivos existentes. Nenhum desses snapshots foi tratado como delta aceito.
- Há 413 paths com mais de uma versão não-baseline em fontes de produto. Isso sinaliza reconciliação de ownership; não é, isoladamente, defeito.
- [Arquivo histórico de inputs](inventory/input-archive-audit.json): **139 referências / 138 blobs únicos**, todas com path, tamanho, blob e modo corretos no pin de instrução. A repetição é deduplicação legítima de conteúdo; as cópias permanecem dados inertes em control.
- [Obrigações críticas por fonte e blob](inventory/critical-obligations-47273c4f.json): ACK exato/consumidor UI, Memory/fences, dois cenários Atlas, exportações/artefatos, seis arquivos Finance, preparação dos oito requests finais e specs/helpers E2E.
- [Parecer da árvore composta](trees/47273c4f20c7c1af9b08537d26618901c36725e3.json): delta completo, nove pares fonte→composto, cadeia de consumidores, 39 dependências, isolamento e recheck.
- Também foram registrados a [base inicial](trees/6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0.json) e o [ACK documental](trees/df0107b553e3aa99b0ac0e3c1f38d79eed82ccda.json). O ACK não muda produto.

A comparação usa árvores Git não truncadas e igualdade Merkle de subárvores, não o resumo limitado de compare. Um source head tinha 1.961 arquivos diferentes da base, enquanto a resposta compare expunha apenas 300; o inventário completo não perde os demais.

## Preservação e limites para o próximo incremento

**Integrador/session14:** consumir deltas do owner com suas provas, não substituir snapshots inteiros. Em particular, ui-work tem um consumidor novo de mutationReceipt, mas ainda herda um produtor antigo: preservar separadamente o produtor/authority da PR #41. As fontes #54/#61 não podem apagar a comparação exata por intenção, principal, chave, thread e identidade da mensagem. Guardar também a intenção original após reload e a readmissão atual; texto/autor não identifica a operação.

Memory em PR #29 já contém o preflight de recall/captures, Request original e fences posteriores. A fonte declara IMPLEMENTATION_PREPARED_NOT_RUN. Preservar esse delta, suas fixtures e o oráculo histórico, sem converter preparação em prova funcional. Não sobrescrever com analysis-stale-commit de Compose ou de diagnósticos mais antigos.

Para Atlas, conservar os **dois cenários** e a **mesma WeakSet** de Operations na autoridade e BusinessServices. O patch antigo de WeakSet isolada arquivado na PR #58 é proposta histórica, não solução aplicada. Downloads da PR #57 devem ser reconciliados com o runtime Procurement de Operations, preservando testes e bytes dos CSV/HTML de evidência.

Finance continua com FIN-IND-005 aberto, a falha S6 e checks reprovados. Decisions E2E existe na PR #40, mas a tentativa lida teve zero PASS/três FAIL no bootstrap e typecheck App/E2E NOT_RUN. A presença dos specs ou uma validação estática do workflow não aprova as jornadas.

**S0:** manter C/G7, D/G8, oito seleções finais, AM01–AM06 e três pareceres finais sobre o candidato exigido. Esta auditoria não concede READY_FOR_FINAL_CI nem GLOBAL_RELEASE. Os arquivos em control não são licença para copiar control ao produto ou introduzir Azure.

## Recheck do delta

Novo head material requer novo parecer fixado por SHA/tree: comparar o delta completo ao último conteúdo examinado, verificar cada decisão do recibo contra fonte/base/preimage/postimage, reavaliar os consumidores afetados e reter os recibos anteriores. Uma árvore igual não cria nova aprovação ou motivo para repetir leitura sem trabalho novo.

Os findings obrigatórios estão vazios neste recorte. As obrigações de qualificação e de composição restantes estão explicitamente separadas no JSON, com owner, critério, fonte, SHA e condição de recheck. Nenhuma aprovação funcional foi inferida.
