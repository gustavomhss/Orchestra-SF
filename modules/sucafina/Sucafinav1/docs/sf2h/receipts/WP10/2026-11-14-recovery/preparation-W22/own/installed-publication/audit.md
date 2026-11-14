# W22 — correção do fixture de publicação instalada

## Resultado estático

O fixture agora exporta `SessionExecution.node` no grupo raiz da aplicação. A substituição existente por `SessionExecutionLocal.node` continua usando a implementação pública real. Somente o arquivo próprio `test/product/wp10/native-host/routine-installed-publication.test.ts` mudou; nenhum helper, host, provider ou arquivo estrangeiro foi alterado.

## Causa observada e API

No W21 `532da498e08fa36fadbd3c01e3e7da00d869dd47`, snapshot `43e3f3cc819a0e154dbe927662a0b473ffa6a401`, run `43604032487`, job `132474686748`, os cinco casos falharam durante a montagem da Location com `Task requires an exported process-global service: @orchestra/v2/SessionExecution`. Os corpos não chegaram ao provider de publicação. A é failure e cleanup success; o recibo bruto e sua normalização permanecem imutáveis.

`LayerNode.compile` fornece dependências com `Layer.provide`, enquanto combina os nós explícitos da raiz com `Layer.provideMerge`. Uma substituição resolve a implementação de uma dependência, mas não a exporta automaticamente. `AppNodeBuilder` entrega o contexto completo de exports à Location; `Task.captureGlobal` exige ali o mesmo serviço global. A omissão no grupo era a causa do diagnóstico, não uma ausência do provider real. Os seis arquivos de referência foram verificados por Git blob contra a árvore W21.

A montagem de `native-host-disposal.test.ts`, no mesmo SHA, já inclui explicitamente `SessionExecution.node` e usa `SessionExecutionLocal.node`; seus sete casos passaram no run A. Esse recibo apoia a seleção do grafo funcional, sem substituir a prova dos cinco casos C07 corrigidos.

## Mudança e preservação

O diff adiciona o nó ao grupo e duas linhas de comentário sobre a fronteira de exports. Os cinco corpos e imports são byte-idênticos; todas as expressões `expect`, os cinco limites de 120000 ms, a ordem e os nomes dos casos estão preservados. Permanecem reais SessionV2, SessionStore, LocationServiceMap, Relay, SkillV2, AuthoringStore e os registros de autoridade. Não há `noopLayer`, serviço simulado, Task/ledger fabricado ou verificador permissivo. A asserção de duas contribuições do provider permanece inalterada: o export adicional pertence ao grupo de aplicação do fixture.

## Validação e limites

Foram executados somente leitura, comparação textual e hashes de arquivos/dados. Não houve execução de produto, import, teste, typecheck, build, publicação ou alteração remota. `verification.json` registra a comparação exata com a única mutação autorizada. O próximo CI deve executar o arquivo completo, sem filtro e sem aumento de orçamento. O candidato não recebeu aceite C07, nativo ou global; esta entrega de builder não substitui revisão independente.
