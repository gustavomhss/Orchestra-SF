# Atualização da dev durante o fechamento

A auditoria principal permanece ancorada em `5b48dab52621037168ad4e3a6243c79a4fe5ad6e`. Antes de publicar a entrega, a branch `dev` avançou para **`b71ecbcc644ee3363ccd1ce0e149c08c80e6130e`**, integrando a [PR #716](https://github.com/gustavomhss/Orchestra-SF/pull/716). Esta nota prevalece sobre referências históricas a #716 como PR aberta nos relatórios especialistas.

O [compare entre as duas referências](https://github.com/gustavomhss/Orchestra-SF/compare/5b48dab52621037168ad4e3a6243c79a4fe5ad6e...b71ecbcc644ee3363ccd1ce0e149c08c80e6130e) contém 22 arquivos; a lista e os patches estão em [dev-delta.json](dev-delta.json). Não houve reexecução da campanha visual completa nesta atualização. Os **34 achados e 757 PNGs** continuam sendo a contagem histórica da base auditada; os testes e imagens da PR integrada não foram somados a esses números.

## SYS-03: ocorrência histórica tratada por correção integrada

O toast observado dizia **Failed to reload providers / CancelledError**. A investigação inicial registrou corretamente a ocorrência, mas tratou sua origem assíncrona como parcialmente inferida.

A revisão do delta precisa essa atribuição:

- `toast.project.reloadFailed.title` traduz **Failed to reload {{project}}**.
- A fixture do caso de Providers usa `directory = "/repo/providers"`; o basename substituído é **providers**.
- O catch específico de ProviderList usa **Could not reload the providers list**, um título diferente.
- A correção integrada em [bootstrap.ts](https://github.com/gustavomhss/Orchestra-SF/blob/b71ecbcc644ee3363ccd1ce0e149c08c80e6130e/packages/app-shell/src/context/global-sync/bootstrap.ts#L524-L535) ignora somente uma instância real de `CancelledError` na consulta de catálogo substituída. O catch de ProviderList e falhas operacionais reais permanecem preservados.

Portanto, **a fonte que produzia a ocorrência SYS-03 foi corrigida em #716**. O item fica no histórico, com resolução posterior registrada; não deve ser apresentado como a mesma pendência ainda aberta na dev do fechamento. Isso não certifica toda concorrência possível nem justifica suprimir erros com base apenas no texto da mensagem.

O patch de teste integrado aguarda a leitura GET terminar com HTTP 200 e verifica a ausência do falso erro. A documentação da PR registra controle negativo com o código anterior e controle de erro comum chamado CancelledError. Os estados dos runs foram conferidos diretamente:

| Evidência da PR integrada | Resultado verificado | Limite desta auditoria |
| --- | --- | --- |
| [45123430979 — controle negativo](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45123430979) | Failure, como documentado para o código anterior | O detalhamento de 15 passes/1 falha vem da documentação da PR. |
| [45123433733 — Providers corrigido](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45123433733) | Success | A PR registra sete casos; não houve nova inspeção independente desses PNGs no fechamento. |
| [45126003911 — gate final](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45126003911) | Success | A PR registra oito checks e 129 regressões. Esses números não integram a contagem da campanha de auditoria. |

## Efeito sobre os demais achados

| Escopo | Efeito do delta |
| --- | --- |
| BA-01, perda de rascunho | O controlador de drafts/Teams não foi alterado. O delta não corrige o mecanismo demonstrado pelo probe. A prova de runtime continua referida ao commit original do teste. |
| SYS-01, material de Teams | Sem alteração no CSS/componente causal identificado. |
| SYS-02, contraste do input de Teams | Sem alteração no token/estilo causal examinado. Mudanças de paleta da PR se limitam ao foco de controles de Settings. |
| SYS-04, token de warning inexistente | Nenhuma declaração ou consumidor causal corrigido pelo delta. |
| SUP-01, Add server | Relação entre a classe de DialogV2 e o seletor específico permanece sem alteração. O novo enquadramento de ProviderV2 é outro diálogo. |
| REF-01/02, Home e hierarquia de Teams | Sem mudança nos módulos causais. |
| Planner | O padding de select passa a reservar espaço para a seta. Isso não demonstra solução de registro/ação separados pelo scroll, mês/cabeçalho ou hierarquia de IDs apontados pela auditoria. |
| Decisions | Rótulos de estado, retorno visual e contexto de caso receberam correções. Os recortes históricos desses elementos não devem ser usados para alegar sua geometria ou copy atuais. Os dados vazios e as fronteiras de qualificação das folhas permanecem explicitados em COVERAGE. |
| Settings e ProviderV2 | Melhorias de reflow, foco, identidade de modelos e enquadramento foram integradas. A auditoria já as distinguia como sobreposição de trabalho, sem criar novos itens para implementá-las em paralelo. |

## Outras PRs

Na checagem de fechamento, [#613](https://github.com/gustavomhss/Orchestra-SF/pull/613) e [#713](https://github.com/gustavomhss/Orchestra-SF/pull/713) continuavam abertas e em draft. Seus heads estão em [open-work.json](open-work.json). B3/UI50 e B4/UI47 têm correções inspecionadas no patch de #613; a presença de um patch aberto não equivale à integração na dev.

Os relatórios especialistas preservam a leitura da base histórica. A ausência de alteração causal em um delta não é uma nova execução nem uma aprovação universal dos descendentes. A entrega da auditoria continua documental; nenhuma correção de produto feita por outra frente é atribuída a esta PR.
