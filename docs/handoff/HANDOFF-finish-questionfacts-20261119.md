# Handoff — finish-questionfacts-20261119

SHA: 350dfc1bf332fcf1806813231c4aec8a3a45440f (base; o commit deste handoff contém a alteração proposta)
Data: 2026-11-19
Estado: partial

## Feito
- Ajustadas duas expectativas do helper WP12 e do cenário Dashboard answer para a semântica publicada de um cenário sem operações nem suposições.
- `product/planner/scenario-port.ts:107-118` observa a fonte corrente e mantém `restrictions: []` quando ambas as listas são vazias. Não publica `scenario-is-hypothetical` nem `preview-not-applied` nesse caminho.
- Preservados subtotal 210000, total null, comparisonStatus conditioned, cobertura pending, todos os entries, nenhum missing category/issue, componentes confirmados e ausência de escrita na fonte.
- Acrescentadas igualdades da descrição integral do cenário, sourceRefs, evaluatedSourceRefs, basisId/basisVersion, moeda e horizonte. As condições são exatamente o aviso agregado do comparador e a pendência humana de training.

## Pendente
- Gate das duas unidades que consomem esses helpers: ainda não executado; a alteração será submetida à revisão concreta antes da Actions.
- Planner answer scope: `apps/cli/src/sucafina-product/business-services.ts:205` não fornece resolveAnswerScope; `product/collaboration/host.ts:262-266` tem fallback somente Dashboard e exige fields exatos do ref.
- O callback simples não basta: `product/integration/planner-sources.ts:23` emite as chaves da projeção inteira, enquanto `product/planner/confirmation.ts:22` só admite fields [summary]. Não foi publicado um callback incapaz de satisfazer esse contrato, nem afrouxada a igualdade.
- `test/product/wp12/native-execution-questions.test.ts:340` permanece unbound até existir leitura de resposta Planner com prova canônica do escopo. Produtor/capacidade ainda sem ligação compatível; não é autorizado inventar sourceRef, digest, confirmação ou readiness.

## Decisões e justificativas
- Asserções removidas: as duas expectativas de rótulo hipotético e preview foram substituídas, em cada local, por asserções exatas do caminho de fonte corrente. O produtor não emite esses dois rótulos sem operações/suposições. As igualdades adicionais provam a fonte e a cobertura, evitando aceitar um source mismatch real por apenas seu rótulo agregado.
- `planner/port.ts:121-125` também publica cost-coverage-unresolved-or-source-mismatch para cobertura legítima pending; o nome agregado não prova divergência. As novas igualdades source/evaluatedRefs e os entries originais exatos continuam exigindo a mesma evidência.
- Nenhum timeout, skip, código de produtor, baseline, recibo, grant ou digest esperado foi alterado.

## Como retomar
1. Ler o diff desta branch e revisar as duas substituições com os produtores citados.
2. Criar snapshot test-ci dos arquivos native-execution-dashboard-answer.test.ts e native-execution-question-handoff.test.ts.
3. Registrar run/resultado e resolver a ligação Planner separadamente; não enfraquecer o contrato de confirmação.

## Comandos e resultados
- Auditoria original [44585817131](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585817131), shard 7 job 135778309477: FAILURE; expectativas antigas de cenário e leitura Planner observadas como falhas.
- `bun run typecheck`: não rodado neste recorte.
- `bun run check:guards --base origin/dev`: não rodado neste recorte.
- test-ci: ainda não rodado nesta alteração; nenhum resultado de qualificação afirmado.
