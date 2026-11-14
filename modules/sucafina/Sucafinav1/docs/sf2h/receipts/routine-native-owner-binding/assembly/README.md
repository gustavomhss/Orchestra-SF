# Missão41 — montagem privada do owner registry

**Patch completo originalmente destinado à sessão33/S0; consumidor vigente: sessão42/S0, sucessora explícita da sessão33 encerrada. NOT_APPLIED. Infraestrutura privada de binding entregue; produtor autenticado e continuação nativa: HOLD. AM02/AM06: NOT_PROVEN.**

O alvo é `apps/cli/src/sucafina-product/host-context.ts` de `sf2-stack@c5ab23fd7c9b231917bf70123958c9ff03e7d420` (tree `8da2223f2809a08b2c7169981c1d815ad0d7453a`). O patch foi preparado sobre `bf81f9776b6ba5fb6267828a9a029d7e8d6f5587`, terminal33, cujo conteúdo também é idêntico ao de C10 `0c395c462ce0fae67cb274c45ccb06884877d7cd`. O root da missão41 buscou o host no novo head e confirmou igualdade byte a byte com esta preimage. O único delta desse sucessor é o recibo de autoridade42. Patch, preimage e postimage permanecem idênticos. A missão41 não escreveu esse arquivo compartilhado; as postimages ficam neste namespace como material de integração.

## Reconciliação do consumidor

A [autoridade42 publicada](https://github.com/gustavomhss/Orchestra-SF/blob/c5ab23fd7c9b231917bf70123958c9ff03e7d420/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/rolling-intake-42/authority-ack.json), o [COMMON rolling fixado](https://github.com/gustavomhss/Orchestra-SF/blob/365c4b4f809eac232a46b38f7412bfea8ba55d30/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/rolling-wave/COMMON.json) e a [missão rolling-product-integration](https://github.com/gustavomhss/Orchestra-SF/blob/365c4b4f809eac232a46b38f7412bfea8ba55d30/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/rolling-wave/rolling-product-integration.json) foram lidos integralmente. Eles reconhecem o encerramento explícito da lease33 e nomeiam a missão42, epoch `S0-C-e8-browser42`, como única integradora de `sf2-stack`. O destino histórico solicitado, o handoff33 e seu head terminal continuam registrados no manifesto; esta reconciliação não reabre a sessão33.

A missão42 pode consumir somente releases explícitos, completos ou parciais delimitados, com dependências, paths e imagens verificados. Ela não recebe a lease fonte41, não move sua branch e não pode executar testes, typecheck, guards, CI ou AM. S0 conserva o dispatcher final e a aceitação. A autoridade cirúrgica de Actions da própria fonte41 permanece sujeita ao fluxo já autorizado, sem ampliação ou revogação por essa sucessão. O ACK de autoridade42 ainda não é ACK de consumo desta montagem. Qualquer delta material integrado exige novo candidato; os W/S/runs e resultados fonte permanecem vinculados à fonte.

## Conteúdo e identidade

| Artefato | Identidade |
| --- | --- |
| Preimage completa | `host-context.preimage.txt`; git blob `2bf1e6e66c13dd099029ec16b1f1ddf1f698dae6` |
| Postimage completa | `host-context.postimage.txt`; git blob `ce3081f75ec97fd3daa7ef4073c51963bdff606f` |
| Patch integral | `host-context.patch` |
| Hashes e dependências | `manifest.json` |
| Capability ausente e owner | `missing-capability.json` |

A preimage conserva toda a composição Reports25, Finance22, Operations24, Routines30 e os demais serviços existentes. O patch contém somente os hunks necessários para instanciar o registry, ligar o hook, cercar anúncio e limpar o ciclo de vida. Não altera Protocol, ServerHttpApi, contratos públicos, permissões de perfis, engines ou records Task.

## Callsite real e ordem de montagem

A instalação atual já entrega `createSfHostRuntime` à factory confiável em `installation.ts`. Esse export continua chamando `createSfHostRuntimeWithRoutineNative(input)`; o corpo agora instancia o registry concreto, sem depender de um owner externo opcional.

A sequência dentro da mesma closure é:

1. `createSfRoutineNativeGovernance` recebe `ownerHook: () => routineOwners`, além do reader de records existente. O hook efetivo é chamado por `routine-native-governance.ts` no wrapper de `ToolSafety.run`, preservando o effect e os guards originais.
2. `createSfRoutineNativeRuntime` captura os serviços reais de Location/Task, incluindo a Permission acrescentada pela implementação privada da missão41.
3. `createSfRoutineNativeOwnerRegistry` recebe esses resources, a Request privada de `authority.host.requestFor`, revalidação do domínio e geração. O observador não recebe nem chama `governance.bind`.
4. O adapter existente recebe `routineOwners.owners`. Não há segundo adapter.
5. As contributions de governança/runtime são montadas no caminho padrão, e `routineRuntime.mount(product)` mantém a dependência real antes do registro de tools.
6. O finalizer descarta o registry **antes** de aguardar shutdown assíncrono de análises. O descarte de runtime/governança e das demais estruturas mantém a ordem existente depois disso.

As referências cruzadas de governance/runtime/registry são closures deferidas. Isso foi inspecionado estaticamente; não constitui construção executada do grafo.

## Anúncio de operações

O callback de readiness consulta `routineOwners.owners.available()` antes de copiar descritores. No host atual não existe produtor de scope autenticado: a consulta permanece false e **zero descritores de rotina são acrescentados por esta montagem**. Instalar o hook ou criar o objeto registry não equivale a instalar uma admissão.

A criação de um binding depois do startup não refaz silenciosamente um catálogo já materializado. O mecanismo de readiness e registro de descritores para uma admissão efetiva permanece parte da capability pendente. A missão41 não declara resolvido esse comportamento futuro.

Quando um produtor legítimo for instalado e qualificado, no máximo cinco operações Task poderão ser anunciadas por esse caminho. `sf_watch_prepare` continua exigindo uma admissão Schedule própria: `memory.prepareWatch` ou a existência do código de uma função não satisfaz esse recurso.

## Limite que o patch não fabrica

Nenhum callsite inspecionado possui simultaneamente a Request SF autenticada e a autoridade de admissão da sessão nativa Maestro. O hook Task recebe contexto nativo; a autenticação SF mantém Request e leases de domínio; a conexão entre ambos não foi observada.

`withRequest(context, request, effect)` permanece uma capability privada do registry, sem exposição pelo `SfHostRuntime`, sem endpoint HTTP e sem callsite fictício. A instalação aqui não o chama a partir de sessionID ou owner recebidos por transporte/modelo. O método precisa ser exercido pelo owner de uma origem nativa autenticada e uma admissão/continuação válida.

`withRequest` não concede admissão, mesmo quando seu contexto UI é válido. O produtor precisa comprovar a operação autorizada, C07 atual, caso, fontes e publicação. O observador apenas associa e cerca ownership; o guard original continua exigindo a lease forte de plano do adapter/admissão. Ele não pode criar ou substituir essa lease por uma checagem genérica de Request, pois isso perderia os fences de caso/fontes/publicação durante Task/Relay.

O binding residente SF não substitui essa origem: `native-host.ts` cria sessões com `agent=selected.profile.id` e sem parent Maestro; `sf_maestro` não é o agente nativo `maestro`. Os perfis SF continuam proibidos de usar ferramentas de aprovação Maestro.

Capturar uma chamada Task em execução e tentar reexecutá-la por `adapter.start` também não resolve o fluxo: o dispatcher usa a exclusão nativa da sessão com `wait:false`. Uma chamada ainda ativa pode produzir busy. Reter o frame depois de encerrado para contornar isso violaria liveness. Falta admissão/handoff explícito de continuação no owner correto.

## Consumo pela sessão42 e encaminhamento a S0

1. Reconciliar a autoridade42 vigente, HEAD, lease e terminal33 preservado; esta entrega não concede nova autoridade de integração.
2. Consumir os módulos privados da missão41 a partir do SHA W e manifesto do handoff terminal, preservando os sete arquivos anteriores da missão30 e os records Task.
3. Comparar o blob atual de host-context com a preimage. Se houver divergência, reconciliar os hunks; não substituir o host pelo snapshot antigo da PR30.
4. Aplicar o patch completo e verificar o blob da postimage. O `manifest.json` fixa ambos e os hashes SHA256.
5. Registrar o novo candidato exato e ACK de consumo, encaminhando a qualificação da composição ao dispatcher S0 autorizado. A missão42 não executa Actions, testes, typecheck, guards ou AM. A qualificação pendente precisa incluir ausência de descritores sem admissão e cleanup do hook; a evidência dos módulos fonte não se transfere automaticamente ao host composto.
6. Resolver a capability descrita em `missing-capability.json` e suas provas antes de declarar binding instalado, operações disponíveis ou AM02/AM06 completos.

## Verificação desta montagem

Executadas somente transformações determinísticas de texto, geração do diff e hashes locais de bytes; nenhum código de produto foi executado. A preimage reproduz o git blob remoto esperado e o patch foi produzido diretamente das duas imagens completas. Testes, typecheck e construção do grafo desta postimage: **NOT_RUN**. O resultado fonte de Actions, se obtido pela missão41, pertence ao W/S/runs do handoff e não representa aplicação deste patch.
