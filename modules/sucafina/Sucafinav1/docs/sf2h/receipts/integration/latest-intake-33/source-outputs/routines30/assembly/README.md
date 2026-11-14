# Montagem para sessão23

Consumidor: **sessão23**, proprietária de sf2-stack e da composição compartilhada. Solicitação de ACK: confirmar o head integrado, os blobs consumidos, a ordem de composição, o registry real de owner e o resultado da validação hospedada/AM06. Este recibo é o pedido; nenhuma mensagem foi enviada à sessão ou a terceiros.

## Aplicação concreta

`host-context.patch` contém o patch completo. `host-context.preimage.txt` e `host-context.postimage.txt` são os arquivos integrais, não fragmentos. `manifest.json` registra SHA Git blob e SHA256 dos dois. O alvo é `apps/cli/src/sucafina-product/host-context.ts` no bundle `9cc27888581a13b55992cdb5dfbd27e43479ac29`, preimage **bdf6d4e2014cc9b2a492b6ae304948c249221e39**. A origem PR30 tem outro host e não deve ser sobregravada com essa postimage.

1. Consumir os blobs próprios da missão identificados no manifesto de entrega, preservando as dependências de engine/publicação do bundle. O arquivo routine-services não existia no head original PR30 e é adicionado a partir do bundle, com gating dos descritores.
2. Comparar o host compartilhado atual ao preimage. Se mudou, reconciliar os poucos hunks; não restaurar o arquivo antigo. Não aplicar sobre a branch fonte PR30.
3. A entrada pública `createSfHostRuntime` mantém seu contrato. A entrada **privada** `createSfHostRuntimeWithRoutineNative(existingInput, installedOwnerPort)` aceita o recurso host-owned. A ausência mantém Rotinas indisponíveis.
4. `installedOwnerPort.resolve(context, request)` deve consultar o registry real de propriedade e devolver o mesmo objeto por vínculo vivo: a Request exata, `authoritySessionID` nativa e, para prepare/start, `task.assistantMessageID/toolCallID` já existentes. Não aceite strings de UI/modelo como vínculo nem reutilize o perfil de negócio `sf_maestro` como Maestro default. O recurso deve ter a mesma duração do host; substituição/remoção exige encerramento daquele scope.
5. O wrapper de governança vem após a composição nativa Maestro/WriteRoots/Arsenal. `routineRuntime.mount(product)` acrescenta dependência real do node: o capture dos serviços, os tokens efetivamente instalados e o callback de descritores acontecem ANTES do registro de ferramentas do produto. A ordem de array isolada não bastaria.
6. A montagem fornece os serviços EXISTENTES do graph: banco/eventos, SessionStore, Agent, TaskGovernance, ToolRegistry, Relay, Location, Config e SessionExecution/LocationServiceMap exportados pelo processo. Nenhum coordinator/Session/supervisor é criado. `native()` conserva a mesma instância enquanto o binding é atual.
7. Não passar `watchAvailable: () => true` para a função atual memory.prepareWatch. Ela não admite um watch nativo. Tampouco substituir knowledge upstream indisponível por fixture.

O patch registra no máximo cinco descritores Task-backed quando os recursos estão instalados; o watch continua ausente. A finalização do scope remove os descritores e invalida os tokens. Cada chamada ainda exige o contexto/Request e a revalidação de autoridade; estar no catálogo não autoriza execução.

## Dependências consumidas

As dependências diretas e blobs observados constam em `../dependency-provenance.json`. Os APIs centrais são os já existentes em TaskTool, TaskGovernance, ToolRegistry.Materialization, SessionExecution.exclusive, CapabilityInvocation, SessionStore.scope/charge, EventV2, GovernanceRecords/Dispatch, WorkflowRecords/Arm, Relay.currentStep/audit/transition e ArmLoad. Nenhuma dependência de workspace, lockfile ou protocolo público é alterada nesta missão.

A aplicação do patch e o registry Request→Maestro ainda são recursos de consumo, não resultados observados nesta PR. O candidato fonte só deve ser chamado integrado após ACK da sessão23 e validação no head consumido. AM06 exige host/provider/caso reais e retorno factual ao caso original.
