# W15 — adendo de preservação

**Sem bloqueador de preservação.** Extensão restrita de W14 `edefb5b66706aea866ee45c7e8e76332c27c342a` para W15 `5fe39f1259d2f8631cef6172aaa7e6c92f436801`, tree `68a8d13d3d60164670a7e95310b2cf1afb294e43`, na [PR #31](https://github.com/gustavomhss/Orchestra-SF/pull/31). W14 é o pai direto confirmado pelo GitHub MCP e pelo objeto Git local.

## Delta restrito

| Categoria | Paths | Alteração |
|---|---:|---|
| Produto próprio | 1 | Associação explícita dos labels Record e Recipient em caseQuestionForm |
| Teste próprio | 1 | Observações aditivas de label, ID e controle habilitado |
| Documentos novos | 10 | Finding, manifests, peer, auditoria W14 e recibos já concluídos |
| Foreign/protegidos/exclusões | 0 | Nenhum |

O delta tem 11979 adições e uma substituição textual. Os únicos arquivos existentes alterados são `product/ui/work-collaboration.ts` e `test/product/wp01/question-recipients.test.ts`. Nenhum recibo ou documento anterior foi modificado.

## Assertions e scripts

As **25 linhas anteriores de assertions** continuam exatamente na mesma ordem como subsequência das **34 linhas atuais**. Todas as linhas do arquivo de teste anterior também permanecem como subsequência exata. Não houve troca de locator, prazo, assertion final ou marcador de execução. As nove observações novas não atribuem resultado antes do Actions.

| Definição preservada | SHA256 idêntico em W14/W15 |
|---|---|
| `caseQuestionScript` | `55eefbc164efad33bdcfbd31484398d0ddaa0acf2e204596ad1baf54087a2de2` |
| `workDestinationScript` | `43b4ef03ddd6efd8288777ca5d9f200e36d976e460ad9b8633b9461aa5b9b60b` |

## Histórico e inputs

Os **24 commits recuperados** continuam ancestrais de W15. Os **32 recibos históricos** foram comparados uma vez ao tree W15 e continuam exatos em modo/tipo/blob. Este adendo realizou 32 comparações novas; **não repetiu as 256 comparações** da auditoria W14.

As branches astra-wp01, astra-wp02 e sf2-stack mantêm os heads de recovery. A própria astra-interface e PR #31 apontam para W15. Não houve alteração em foreign inputs, plano fixo, engines, deploy, identidade, políticas financeiras ou Protocol/Server HttpApi. A cadeia herda o BCS retido b289, prepared-apply a454 e todos os demais pins da auditoria W14.

As cópias publicadas de w14-preservation-audit.json/md são byte a byte iguais aos arquivos auditados. Sua proveniência e hashes constam no JSON deste adendo.

## Limites

Esta é uma revisão de metadata e preservação textual. Não consultou Actions, não executou produto/typecheck/guards/browser e não editou arquivos do repo. Não constitui aceite nativo, integração completa ou gate global. O mapa final deve continuar distinguindo componente comprovado, integração pendente e bloqueio, vinculando W/S/run exatos.
