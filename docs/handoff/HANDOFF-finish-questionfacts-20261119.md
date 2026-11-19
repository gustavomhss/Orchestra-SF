# Handoff — finish-questionfacts-20261119

SHA: 19aa402fb17b2656f7de0514ff24cb5b88193467 (código qualificado; este commit acrescenta somente a evidência)
Data: 2026-11-19
Estado: partial

## Feito
- Ajustadas duas expectativas do helper WP12 e do cenário Dashboard answer para a semântica publicada de um cenário sem operações nem suposições.
- `product/planner/scenario-port.ts:107-118` observa a fonte corrente e mantém `restrictions: []` quando ambas as listas são vazias. Não publica `scenario-is-hypothetical` nem `preview-not-applied` nesse caminho.
- Preservados subtotal 210000, total null, comparisonStatus conditioned, cobertura pending, todos os entries, nenhum missing category/issue, componentes confirmados e ausência de escrita na fonte.
- Acrescentadas igualdades da descrição integral do cenário, sourceRefs, evaluatedSourceRefs, basisId/basisVersion, moeda e horizonte. As condições são exatamente o aviso agregado do comparador e a pendência humana de training.

## Pendente
- Nenhum pendente nos dois consumidores qualificados. O caso Planner separado continua unbound pelas razões abaixo.
- Planner answer scope: `apps/cli/src/sucafina-product/business-services.ts:205` não fornece resolveAnswerScope; `product/collaboration/host.ts:262-266` tem fallback somente Dashboard e exige fields exatos do ref.
- O callback simples não basta: `product/integration/planner-sources.ts:23` emite as chaves da projeção inteira, enquanto `product/planner/confirmation.ts:22` só admite fields [summary]. Não foi publicado um callback incapaz de satisfazer esse contrato, nem afrouxada a igualdade.
- `test/product/wp12/native-execution-questions.test.ts:340` permanece unbound até existir leitura de resposta Planner com prova canônica do escopo. Produtor/capacidade ainda sem ligação compatível; não é autorizado inventar sourceRef, digest, confirmação ou readiness.

## Decisões e justificativas
- Asserções removidas: as duas expectativas de rótulo hipotético e preview foram substituídas, em cada local, por asserções exatas do caminho de fonte corrente. O produtor não emite esses dois rótulos sem operações/suposições. As igualdades adicionais provam a fonte e a cobertura, evitando aceitar um source mismatch real por apenas seu rótulo agregado.
- `planner/port.ts:121-125` também publica cost-coverage-unresolved-or-source-mismatch para cobertura legítima pending; o nome agregado não prova divergência. As novas igualdades source/evaluatedRefs e os entries originais exatos continuam exigindo a mesma evidência.
- Nenhum timeout, skip, código de produtor, baseline, recibo, grant ou digest esperado foi alterado.

## Como retomar
1. Ler o diff desta branch e revisar as duas substituições com os produtores citados.
2. Integrar os dois arquivos de unidade qualificados pelo run 44602006474.
3. Resolver a ligação Planner separadamente; não enfraquecer o contrato de confirmação ou substituir fields do ref original.

## Comandos e resultados
- Auditoria original [44585817131](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585817131), shard 7 job 135778309477: FAILURE; expectativas antigas de cenário e leitura Planner observadas como falhas.
- `bun run typecheck`: não rodado neste recorte.
- `bun run check:guards --base origin/dev`: não rodado neste recorte.
- test-ci [44602006474](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44602006474): SUCCESS, 2 pass / 0 fail / 243 expect. Snapshot `2bed9f802eb1f921252a59fb665e3453b87b0346`, pai `19aa402fb17b2656f7de0514ff24cb5b88193467`; job `135835605438`, cleanup `135839919351` SUCCESS.
- Pedido: `{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/wp12/native-execution-dashboard-answer.test.ts","Sucafinav1/test/product/wp12/native-execution-question-handoff.test.ts"]}`. Timeouts originais mantidos; consumidores reais concluídos em 162.12 s e 155.87 s.
- O run não executou native-execution-questions.test.ts, não publicou comprovação de inferência nativa quando nenhum modelo estava configurado e não declara GO.
