# C12 — reabertura após resposta perdida: contraprova W10

## Identidade da execução

- Produto W: `0c3d98dd1263a305ce294c78ad5939cdda110a78`.
- Árvore de produto: `5c236ef687871149e9150630a16c4ce0ac70c2a7`.
- Snapshot S: `91938040fb95c0e2fdfd3e0e8f149a9ec05ae19e`.
- Árvore de snapshot: `39d5b35aa65c9372aa8f10fe3ee815baaa55e49b`.
- Request SHA256: `1c23d7683439a71e1a1bc198675efda4bd321d384f8f47574959bc1be01d28f8`.
- [Run43587346579](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43587346579), job132424575339; cleanup132425576332 PASS.
- Teste preservado: `Dashboard recovers the same C12 application receipt after a committed response is lost and the page reloads`.

O resultado agregado foi **33 PASS / 1 FAIL**, em seis arquivos. Este caso inteiro permanece **FAIL**. A compilação Sucafina/CLI e os guards passaram no run43587348649, no mesmo W.

## O que foi observado antes da falha

O corpo chegou à linha386 de workbench-recovery.test.ts. As assertions anteriores observaram aplicação real por HTTP200, resposta descartada somente na entrega, domínio Hot Topic alterado, um recibo C12, alteração preparada em estado applied, controles travados durante incerteza e body/key opacos em history.state. O estado do navegador não continha os textos privados do draft.

Após reload, a página mostrou que existia uma tentativa anterior. O teste pediu opções autorizadas atuais e aguardou `Opções atualizadas com seu acesso atual.`. Essa mensagem não apareceu dentro do prazo30s. As assertions posteriores de retry, receipt idêntico, versão inalterada e limpeza da correlação **não executaram e não recebem crédito**.

O log não traz tracing de cada callback de evidência nem atribui um status HTTP específico à descoberta nessa falha. A evidência executada é o ponto de parada acima. A explicação de composição vem da leitura estática separada em c12-current-closure-w10.md: o baseline do grupo não contém a cadeia Dashboard capture/history/receipt/recorded-operation já publicada por Compose.

## Intake e limite

W10 usa o apply exato Operations `4bdd12ac162d61465557363953e25dfd99fad5e8` e preserva prepared-apply `a45436a6fef8598b7ef9eae33d061ddebf0aa43d`. Os seis testes reais de host C12 passaram, incluindo aplicação, recibo, replay e negativos de vínculo. Quatro outros cenários de recuperação passaram.

O resultado confirma que esse intake isolado não substitui a composição dos leitores usados depois do reload. Não enfraquecer a assertion, inferir sucesso pelo primeiro efeito nem repetir esta seleção sem mudança material no caminho de reabertura.

## Próxima ação de integração

Consumir a composição atual de Compose para fontes históricas/capturas, receipt Dashboard, resolução da operação aplicada e verifyScenarioOperations, preservando os inputs mais recentes de Operations e Interface. Reexecutar este consumidor real após essa mudança. O fechamento exige a mesma receipt, o mesmo body/key e nenhuma segunda alteração do domínio, com acesso corrente e negativos de substituição/revogação preservados.
