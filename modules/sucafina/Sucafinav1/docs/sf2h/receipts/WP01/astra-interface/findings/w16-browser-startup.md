# W16 — deadline compartilhado e cancelamento observado

Base W15: `5fe39f1259d2f8631cef6172aaa7e6c92f436801`. Candidato implementado em quatro paths próprios de harness/README; nenhum produto, typecheck, guard, browser ou CI foi executado para este candidato.

## Falha que motivou o reparo

No run43593121437, o prazo externo de15s começou antes dos imports. O Node recebeu outro timeout de15s para Chromium, iniciado573ms depois. O caller cancelou aos14.997ms, antes de terminar o prazo interno. O Chrome PID4158 não respondeu ao primeiro Browser.getVersion e alternou D/folio_wait_bit_common com S/futex_do_wait. Os dois casos de recipients não executaram; o W15 não prova falha nem sucesso do reparo de labels.

O reparo transmite um deadline absoluto do pool até o Node e recalcula o restante após imports/preparação, antes do único launchServer. Restante vencido falha sem admitir browser. O pool tem30s totais para preparação/launch/connect/PID; o named startup tem35s. Os outros callers mantêm default e teto15s. Os prazos de operações e testes dos consumidores não mudaram.

## Cancelamento e limite de observação

A falha cancela e aguarda o escopo AppProcess existente. Só depois dessa conclusão são consultados, por sinal0 somente de leitura, o PID Node e o conjunto cumulativo de filhos cujo parent correspondeu ao Node nos diagnósticos. A janela compartilhada começa no primeiro cancelamento e tem5s; nenhum await ou probe reinicia esse prazo.

O evento separado SF_BROWSER_DRIVER_STARTUP_CANCEL_CLEANUP registra startupSucceeded:false e normalBridgeProof:false. Falta de PID, erro de observação, processo ainda presente ou prazo excedido gera incomplete e mantém a falha. Se o próprio finalizer de infraestrutura ultrapassar5s, a ownership continua aguardada; depois disso não há probes tardias que afirmem limpeza dentro do prazo. Este é um limite de observação, não garantia de saída física do kernel em5s. Não há segundo teardown, broad kill ou mudança de Core/Omni.

O transporte Node, o fechamento normal, o protocolo de proof, as leases e o finalizer permanecem byte a byte nos blocos registrados pelo manifesto. As cinco assertions do named startup permanecem; lifecycle e os24 corpos de consumidores são idênticos ao W15. O deferred ready continua rejeitado para o caller, com observador instalado para o caso em que o deadline vence antes da criação da race.

## Fonte e prova seguinte

CI.md e AGENTS não impõem teto de10s/15s a esse startup e continuam intactos. A documentação primária Playwright1.59.1 define30s como default usual de início do browser (`docs/src/api/params.md`, blob391504655ce2ba244a1c97f6773d2e680243c5fa; shared options de launchServer em class-browsertype.md, blobfa7a0b05f7f9e5f89c0bbdcf9addba5ab7f12f4d). Essa referência não demonstra a causa nem a cura do stall de I/O.

Seleção causal: browser-startup.test.ts → question-recipients.test.ts → browser-lifecycle.test.ts. Startup prova a fronteira alterada; recipients contém os dois corpos ainda não executados em W15; lifecycle mantém todos os requisitos de lançamento único, leases balanceadas, contextos vazios, PID CDP, saída dos processos e bridge limpa. O inventário dos24 dependentes permanece como mapa, sem impor suite de grupo ou execução equivalente adicional.

O novo caminho de recibo de cancelamento é revisão de fonte neste momento. Nenhum PASS de execução, native ou gate global é atribuído ao candidato.
