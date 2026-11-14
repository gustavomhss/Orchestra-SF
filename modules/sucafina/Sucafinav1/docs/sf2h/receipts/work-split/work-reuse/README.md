# work-reuse — custo de confirmação/reuso e attachment

## Resultado

O diagnóstico R01 demonstrou amplificação de leituras autenticadas no produtor retido. No retry, a confirmação levou **2685,07ms** e o answer-read obrigatório **3886,46ms**: **6571,53ms** de trabalho sequencial antes do attachment, acima do waiter existente de5000ms. A chamada de attachment ingressou6616,59ms após o marcador imediatamente anterior ao waiter; o teste falhou conservando esse limite.

O 404 observado depois pertence ao fixture sem montagem de attachment. O endpoint real já existe em compose-resume. Não há PASS instalado nem defeito404 do produto demonstrado.

## Medição discriminante

| Etapa | HTTP do produtor | threadReads.read | Participação inclusiva | Auditoria da resposta |
| --- | ---: | ---: | ---: | ---: |
| prepare-message | 4346,52ms | 17 chamadas /4309,41ms | 99,15% | 0,01ms |
| confirmação inicial | 2556,35ms | 10 chamadas /2507,44ms | 98,09% | 0,01ms |
| retry da confirmação | 2685,07ms | 10 chamadas /2647,49ms | 98,60% | 0,01ms |
| answer-read | 3886,46ms | 15 chamadas /3839,81ms | 98,80% | 0,02ms |

Cada leitura de thread volta a autorizar e reemitir fontes. O código retido ainda repete emissão de evidence em answer e membership/resolve em scopeForAnswer. O W6 já elimina essas repetições: contagens estáticas genéricas17→9,10→4 e15→7. O W7 muda somente testes. A redução de chamadas está publicada; **latência após intake ainda NOT_RUN**.

A medição é de uma amostra instrumentada no componente. Spans são inclusivos; não somar filhos/pais. currentSnapshots inclui fingerprint do fixture e não é o custo dominante. Eventos do browser e servidor têm relógios distintos. O relatório no finally ocorre após a falha e não retroage HTTP200 ao momento do timeout. [run-01.json](run-01.json) registra tempos, timeline, limites e checks.

## Escopo efetivamente alcançado

A primeira confirmação passou as asserções de identidade da segunda mensagem de texto igual, referência diferente da antiga, entrega corrompida e HTTP200. O retry produziu outro200 com a mesma chave; answer-read retornou200; a chamada decision-answer-question chegou tarde ao fallback404. O waiter falhou antes das asserções finais de igualdade dos snapshots, leitura explícita e reload. Essas etapas não recebem PASS por aparecerem no log.

As três jornadas aprovadas no run43621603578 foram reanexadas sem repetição: reply direto com perda/retry/reload; destinatário distinto com ACK incerto; seleção do primeiro ciclo.

## Patch e dependências

- [Patch mínimo proposto](patches/generic-answer-dedup.NOT_APPLIED.patch): um arquivo,13 adições/10 remoções, trechos publicados W6 aplicáveis ao preimage retido. **NOT_APPLIED / NOT_COMPILED / NOT_RUN.** Aplicabilidade textual conferida; nenhum source alheio alterado.
- [Intake preferido](patches/published-producer-intake.NOT_APPLIED.json):16 blobs exatos com dependências de C05 e fences. O patch mínimo é alternativa não cumulativa; não substitui o fence R10 nem a qualificação do produtor completo.
- [Request pós-intake](request-owner-after-intake.json): seleção canônica dos mesmos quatro arquivos existentes, para medir o delta real do owner sem modificar deadlines.
- [Attachment: próxima ação do owner](attachment-owner-request.md): endpoint existente, falta de wiring real de recipientAuthority na composição inspecionada, contrato e oracle completo até replay/reload/revogação do attachment. Não fabricar grants ou um mount paralelo.

## Provas e checks

| Prova | W / S | Resultado |
| --- | --- | --- |
| [R01:43625766773](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625766773) | c5a0ced6493410d321a61f8a2fbe4c3d7d9fd40b /5d5ae7d98cf6db43f5ef409ddf87bd802ef97870 | 2pass/2fail. Diagnóstico falhou no waiter; startup/lifecycle PASS. Typecheck11 erros,2 próprios e9 herdados. Guards0gate/53avisos. OmniPASS,4spawns. |
| [Colaboração W6:43623257640](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43623257640) | dc21cd389de67c2e7fac996b663d9c0aa7d8cae5 /72848c2122b68e15341baa41e5beef4e9237562a | 7pass/3fail; consultado antes da escrita. Sete provas scoped reanexadas; timeout e falhas históricas preservados. |
| [Colaboração W7:43625515062](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625515062) | 9e1f44af7689946d27d37ed48b9f5e9849417121 /a4f8c7bd673de3e4092f20185f4c3ea2d10d0ec3 | 5pass/0fail,62assertions. Corrige testes de C05/R10 e divide a cadeia longa; nenhum delta de produto. Omni não aplicável. Não é prova de UI/attachment. |

A correção das duas anotações TS7006 é somente de tipo: o JavaScript emitido por stripTypeScriptTypes é byte a byte igual ao W1. A próxima seleção própria é **somente static-gates.test.ts**, em [request-02.json](request-02.json), para verificar a correção sem duplicar a jornada. Resultado ainda pendente neste checkpoint.

Em cada par W/S registrado, a comparação contém somente .ci-run.json. W1 tree456f62ed8689ebeb6db7d874826be4849dca2c5a; S1 tree2cda9823b600b73565ccb97b968fe938bf3002c3.

## Autoridade e critérios

Zero alterações de produção, shared fixtures, drivers, workflows ou namespaces de outros writers. Testes próprios apenas em test/product/work-split/work-reuse. Propostas somente sob estes recibos. Nenhum teste de produto local, deadline aumentado, merge, force push ou alteração de branches anteriores.

[criteria.json](criteria.json) conserva o universo75+78 e os requisitos C03/C06. Os recibos anteriores de UI Work, o plano fixo e seus estados continuam íntegros. Esta entrega não declara GLOBAL_RELEASE, p95, aceitação nativa ou attachment instalado.
