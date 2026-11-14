# W15 — associação estável dos selects da pergunta

O W14 recebeu o diretório autorizado real (HTTP200 e opção do principal presentes), mas as duas contraprovas não chegaram à ação de seleção: o locator `getByLabel("Recipient", { exact: true })` permaneceu sem correspondência.

A causa está no HTML próprio: o label envolvia o select e suas options. A fonte primária do Playwright 1.59.1, `packages/injected/src/selectorUtils.ts` (blob `6466e1b7b02a3cf2be2973e9a96013d9a571c77b`), usa o texto recursivo do label, incluindo seus descendentes. O texto esperado `Recipient` ganhava o placeholder e os nomes retornados pelo diretório. O mesmo padrão existia no select Record.

O reparo separa os dois labels de suas options e liga cada label ao select por `for`/`id`, com UUID por formulário. Os nomes visíveis, rotas, autoridade, campos, scripts de recuperação e comportamento assíncrono permanecem. Não há seletor CSS ou `force` para contornar o controle.

Os dois casos reais mantêm todos os locators, assertions finais e prazos. Recebem apenas observações aditivas da associação explícita, unicidade/estabilidade do id, texto isolado do label e controle habilitado antes de selecionar. Nenhum teste, check ou browser foi executado localmente.

Seleção causal proposta: browser-startup primeiro, question-recipients, browser-lifecycle último. Os sete casos de seleção/destino e a contraprova tardia aprovados no W14 não precisam de execução equivalente por este ajuste exclusivo do HTML da pergunta.

Este incremento não conclui a seleção global de responsáveis nem a montagem de workSignals/workDestination. O resultado de produto continua dependente do run cirúrgico Actions e de seus SHAs exatos.
