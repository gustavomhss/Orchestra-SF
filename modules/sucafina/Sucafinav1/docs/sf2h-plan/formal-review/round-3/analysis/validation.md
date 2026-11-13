# Aceleração de validação e revisão — proposta

Base examinada: `0aa2405bb3668314f60d6a674d2bd53fd5003091`. Fonte local congelada: `sf2h-final-0aa2405`. Esta análise modifica somente a proposta; não implementa produto, não executa CI e não concede PASS a critério de implementação.

## Diagnóstico

O plano já contém a decisão correta de não fazer uma execução por axioma: são 18 conjuntos de evidência para 1.610 critérios. `AGENTS.md` já exige suite completa uma vez por epic, testes escopados por unidade e typecheck do pacote. `WP10.T03` já permite repetir somente provas afetadas. Portanto, inventar esses princípios outra vez não acelera nada; precisamos dar ao supervisor um procedimento que os faça acontecer.

Há três oportunidades concretas:

1. **Requests duplicadas.** O plano tem um dispatcher por vez, com handoff S0-C → S2 em T40 e S2 → S0-C em T75, mas não define a chave que permite adotar um run já em voo. Vários writers podem solicitar a mesma seleção após receberem o mesmo candidato.
2. **Cauda de AM02.** Seis dos oito packs têm último output funcional em T72 e prova por T75. Esperar o pack inteiro para iniciar a matriz cria uma concentração de três minutos. A prova de cada rota pode começar quando seu produtor, skill, bridge, contexto e consumidor reais estiverem integrados; o gate fecha a matriz cumulativa inteira.
3. **Achados enviados tarde.** Os juízes entram em T72/T75, mas a redação enfatiza correções T95–103. Encaminhar uma objeção assim que demonstrada permite corrigir enquanto os outros revisores e CI seguem trabalhando. O intervalo final vira reserva, não fila obrigatória.

Fontes: `ci-recipes.json.{parallelism,failure_policy,receipt_rules,early_probe}`, `resident-proof-plan.json:AM02.pack_matrix`, `work-packages/WP10.json:T02/T03/T04`, `schedule.json:milestones/ci_budget`, `evidence-plan.json:scope/validity`, `AGENTS.md:Testing/CI Cadence/Guardrail`.

## Uma supervisora, um dispatcher, nenhuma bateria duplicada

S0 é dona do registro de validação da campanha e do fechamento. As N sessões trabalhadoras emitem pedidos de validação e eventos de achados para S0. A operação mecânica pode ser delegada ao dispatcher que possuir o lease vigente; no padrão atual, S0-C → S2 → S0-C permanece válido. Supervisão central não significa obrigar a coordenadora a monitorar cada job pessoalmente.

Cada pedido identifica candidato de produto, árvore, seleção normalizada, receita, contexto de execução sem segredos e motivo. O dispatcher consulta o registro antes de criar snapshot/branch:

- Se houver request **idêntica** em voo, associa o solicitante e o critério ao run existente.
- Se houver resultado completo e válido para a **mesma identidade de execução**, usa esse recibo real, preservando SHA, run, attempt, seleção e artefatos.
- Se mudou código, teste, contrato, fixture, skill, configuração ou ambiente pertinente, é outra identidade; gera request nova.
- Resultado incompleto, cancelado, BLOCKED, seleção vazia/divergente ou artefato ausente nunca vira PASS pelo cache.

Usar os diretórios de controle/recibos WP10 já atribuídos. Não criar serviço de filas, banco, broker, workflow, harness de teste novo ou polling por worker. S0-C/S2 transferem também requests em voo e seus IDs; a transferência não dispara cópias.

## Execução incremental e aceitação completa

**Desde T0:** o dispatcher verifica o mecanismo real de CI, aliases, configuração, seletores, acesso ao executor dos guards e disponibilidade observável de runners. Pode iniciar uma seleção existente válida antes de T25, dentro de WP10.T04 já iniciado em T0; o resultado mede fila/setup dessa seleção. Não inventa arquivos futuros, novos acessos ou equivalência com a suite final. Esse probe é identificado como preflight, separado da primeira prova de produto.

**Durante a construção:** executar apenas os testes afetados pelo incremento e suas dependências, depois de integrado o respectivo produtor real. Agrupar pedidos idênticos e materializar uma observação específica para cada critério coberto pela mesma execução. Uma captura de UI, um run ou um pacote verde não concede aprovação indiscriminada a todas as linhas relacionadas.

**AM01/AM02:** aproveitar cenários reais já necessários a J01–J13. As dezoito skills precisam de dezoito witnesses de carga/contribuição/consumo, mas não de dezoito baterias independentes que repetem o mesmo setup. AM02 pode usar o harness direto autorizado já previsto: as 39 chamadas passam pelo wrapper, binding e `SkillLoadReceipt`, sem exigir uma nova inferência apenas para repetir uma chamada determinística. AM01 continua provando inferência real e contribuições; o Revisor residente usa Session/run separado. Nunca substituir a execução real por catálogo ou mock.

**Candidato final:** as oito seleções mínimas continuam obrigatórias, além de toda suite exigida pela footprint/epic: CI-SF, CI-CLI, CI-APP-SRC, CI-APP-BROWSER, CI-ATLAS-BUSINESS e os três Playwright. AM01–AM06, generated/typecheck/spawn guard e guard final continuam obrigatórios. Todos os recibos de aceitação referem-se ao mesmo candidato C. Jobs podem executar em paralelo somente conforme a capacidade real dos runners; não supor oito runners.

**Correção:** o juiz publica imediatamente `{finding_id, candidate, criterion, reproduction, affected_paths, owner, severity}`. S0 atribui ao writer ativo, que devolve commit e testes afetados. O juiz reexamina o delta e as bordas. Nenhuma sessão coordenadora termina por ter entregue sua primeira parte; permanece responsável por retomadas até fechamento global. Builders podem encerrar e liberar slots para reviewers, com handoff explícito ao writer de correções. O revisor nunca corrige o objeto que julga.

## Limites do cache e invalidadores

A matriz JSON acompanhante lista os invalidadores. A regra conservadora é: falta de uma dependência conhecida invalida a reutilização; ampliar a seleção é preferível a declarar cobertura impossível de justificar. Mudança de caminho não é o único critério: o consumidor de um contrato, um fixture alterado ou um skill carregado pode estar em outro WP.

O cache proposto economiza **requests idênticas, setup repetido e verificação incremental**. Não permite trocar o SHA de um recibo antigo pelo final, considerar suites parciais como suite completa ou dispensar as oito seleções finais. É permitido reutilizar um resultado que já pertence exatamente a C e à seleção/configuração exigidas.

### Evitar o ciclo de invalidar a prova ao salvar a prova

Propor uma regra explícita de **candidato C e entrega D**. C é o último commit com alteração de código, testes, configuração, fixtures, skills ou guias normativos. Todos os checks de produto finais executam C. D pode acrescentar somente recibos, pareceres e estado de execução em paths evidenciais previamente admitidos. O diff C→D deve ser conferido; D aponta C e preserva os SHAs originais das provas. Guardrails devem ser executados em D. Uma alteração fora dessa lista cria C novo e reabre os gates pertinentes.

Isso não é declarar que o teste de um SHA executou em outro. É deixar explícito qual produto foi testado e qual commit arquiva seu recibo. Extensão `.md` não basta: prompts e SKILL.md são runtime e invalidam. Esta regra requer atualização coerente de C, task, gate e recibo; não pode entrar como exceção informal.

## Condição mensurável para as duas horas

Calcular em cada G2H o último término possível considerando: trabalho pendente dos builders; slots realmente disponíveis; fila/setup/execução/coleta por seleção; concorrência observada dos runners; duração de inferência/skills/scanner; revisão, correção e rechecagem. O supervisor precisa de pelo menos uma observação comparável para cada classe obrigatória; seleção pequena não mede suite completa.

Não há medição neste estudo que permita prometer 120 minutos. Os ganhos esperados são menos requests e menos espera artificial; precisam aparecer nos recibos: quantidade solicitada/disparada/adotada, minutos de setup/fila evitados, idade do achado até despacho, tempo do produtor até primeira prova e caminho crítico residual. G2H mantém CONDITIONAL/AT_RISK/MISSED quando cabível e o escopo continua inteiro.

## Axiomas da aceleração

- **DoD:** uma única identidade para cada request efetiva, seleção final completa em C, três revisores independentes, recibos íntegros e fechamento global pelo supervisor.
- **Invariants:** nenhum teste fora de GitHub Actions; nenhuma nova permissão, workflow ou allowlist; nenhuma prova transferida ficticiamente entre SHAs; nenhum autor julga a própria correção; nenhum escopo descartado por tempo.
- **Quality standards:** selecionar por dependências observadas; deduplicar antes de disparar; corrigir achados assim que reproduzidos; manter os IDs e artefatos reais de cada execução.
- **Completeness criteria:** todos os oito requests mínimos, adicionais do epic, AM01–AM06, gates estáticos e observações específicas por critério permanecem cobertos; contratos, skills, fixtures, UI e ambiente participam da invalidação.
- **Success criteria:** as requests idênticas são adotadas sem novo run; não há espera por lote de review para encaminhar achado; G2H usa durações observadas; concluir em 120 minutos exige todos os gates reais no prazo, e não apenas uma tabela de janelas.
