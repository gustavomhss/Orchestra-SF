# Cold read independente — WP09 schedule

**Conclusão:** não encontrei um bug concreto novo no incremento de pinagem publicado em W1 e conservado em W2. Esta revisão é estática; não executou produto nem repete o CI `43615514065` (42 pass, 0 fail, informado pelo root).

Escopo: `product/routines/schedule.ts`, blob `c2f76fb6ebf2f05b8b89a08561bfac14cc52ad66`, e o diff de `test/product/wp09/schedule-boundaries.test.ts`, blob `2e4b277dc0e2b15bbc7ff83fc3d6fae0d0d2f400`. Reviewer WP07 não escreveu esse incremento.

| Questão | Leitura da fonte |
| --- | --- |
| Pinagem de providers | `withPinnedScheduleProviders` captura os objetos `occurrences` e `resultAccess`, os métodos do host, todos os métodos de ocorrência e todos os métodos C08 usados pela API. `current()` compara identidade de objeto e método; cada chamada assíncrona é cercada por checagens e há uma última checagem antes da entrega do resultado. A substituição durante `owner`, leitura, dispatch ou retorno não autoriza o provider novo. |
| Receiver e protótipo | Os wrappers chamam os métodos capturados com `.apply` no receptor original: `source`, `providers`, `host.occurrences` ou `host.resultAccess`. Isso conserva acesso a estado de instância e métodos herdados de protótipo; não depende de `Object.keys` para descobrir métodos. O caso novo `NativeSchedules` cobre esse risco específico. |
| Síncrono/assíncrono | `validateRecurrence` continua síncrono e booleano, com checagens imediatamente antes/depois; não foi embrulhado em Promise truthy. Os demais ports têm contrato Promise, e `invoke` aguarda sua conclusão. Todos os callbacks `action` usados pelo wrapper são `async`, portanto suas rejeições passam pelo catch final. |
| Erro original | O wrapper transforma somente a instância privada `changed` em `unavailable/schedule-provider-changed`. Rejeições dos providers são relançadas sem substituir seu objeto ou causa. Uma troca acompanhada de erro original não vira sucesso. |
| Mutação e retry | O payload é clonado antes dos awaits e novamente ao entregá-lo ao provider. O `idempotencyKey` original continua chegando ao dispatch. Uma troca posterior ao efeito oculta a saída; o código não afirma rollback nem gera chave nova. A deduplicação durável continua no producer de ocorrências, sem segunda implementação neste wrapper. |
| Cobertura adicionada | Os testes discriminam troca de autorizer, método C08, objeto/método de ocorrência, `readResult` e revalidador no retorno; verificam ausência de dispatch quando a troca é anterior, ocultação de sentinelas quando posterior e preservação da chave submetida. |

Limite: o teste de fronteira usa providers controlados, corretamente adequado à pinagem/receiver. Não é recibo nativo, não demonstra a deduplicação real da ocorrência nem torna o host externo concluído. Não recomendo ampliar a seleção ou repetir o CI por esta leitura, pois não identifiquei risco concreto adicional a resolver.
