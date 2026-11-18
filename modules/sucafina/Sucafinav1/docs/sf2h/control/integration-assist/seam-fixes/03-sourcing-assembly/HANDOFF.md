# SF2-SEAM-003 — montagem completa de sourcing

**PROPOSED/NOT_APPLIED.** Aplicação exclusiva da sessão14. Nenhum produto, teste, typecheck, browser, guard ou CI foi executado/disparado por esta sessão.

## Entrega

- [Manifesto de entradas de árvore](manifest.json).
- [Patch unificado completo](sourcing-assembly.patch.txt), cinco hunks.
- [Postimage completo de sourcing-analysis.ts](postimages/sourcing-analysis.ts.txt).
- [Postimage completo de interface/http.ts](postimages/interface-http.ts.txt).

Os dois arquivos formam uma unidade de aplicação. A base de conferência é `f511f30b73289c2f21c843254569d31c02eb9608`, árvore `ee2964cd6cc96ee2697e9d05835777870a843f65`. O destino é o candidato real da sessão14 em `sf2-stack`, que precisa de novo pin e recheck de preimages/dependências antes de receber o delta. Não substituir a árvore inteira pelo snapshot WP10 e não afirmar aplicabilidade a um head posterior.

| Arquivo relativo ao módulo | Preimage | Postimage |
| --- | --- | --- |
| `product/procurement/sourcing-analysis.ts` | `987f7179101ffe3db0276d9c6172b3bcf6024329` | `e54386d4b84331ff255546dc891ccad5b1391709` |
| `product/interface/http.ts` | `930c93a1704d0444519ffa85b8f69f57cc6c2735` | `81b7cd4ef5a73670642df42a2f891b9d95420dac` |

Ambos permanecem modo `100644`. Os arquivos em `postimages/` contêm os bytes integrais das duas postimages; a extensão de documentação não faz parte do caminho de destino.

## Conflitos resolvidos pela proposta

O consumidor sourcing importa `analysisHistory`, que a versão corrente de Forecast não exporta. O patch mantém o markup escapado já publicado por Operations localmente no renderer. O script sourcing não é alterado.

Além disso, o Workbench fixado não monta o formulário, o script e a rota `workbench-sourcing-input`, embora o handler e o provider reais já estejam compostos no host. O patch porta apenas essa montagem da versão Operations. O caso autorizado escolhe sourcing quando possui referência de procurement-request; nos demais casos permanece Forecast. Scenario e intent continuam presentes.

A versão atual de `forecastAnalysisScript` já contém o controller do histórico, inclusive refresh e limpeza do histórico após revogação. Ela permanece intacta, e não há inserção do antigo `analysisHistoryScript` nem duplicação de seção. Não se atribui a este patch uma nova correção de revogação do próprio sourcing script.

## Dependências e segurança preservadas

O manifesto fixa as 27 dependências diretas e o caminho instalado até `createSfSourcingInputs`, `sourcing-inputs.ts` e `business-services.ts`. O provider real mantém intenção, autorização atual, versão do caso, identidade/digest da fonte, projeção autorizada fresca, segunda leitura do caso e revalidação. O handler conserva origem, método, tipo/limite do corpo, idempotência, `ui.admit`, `validate`, `revalidate` e `finally finish`.

A alteração de HTTP conserva as composições mais recentes de Work, contexto de contrato, perguntas, review, record search, scenario e intent. Nenhuma assertion ou validação é removida; nenhuma implementação vira stub. C16, CAS, owner de Memory, observações e identidade permanecem nos caminhos existentes.

## Aplicabilidade estática e recheck

Os cinco hunks foram reaplicados textualmente sobre as preimages obtidas pelo GitHub MCP. Linhas de contexto/remoção, contagens e offsets conferem; o resultado coincide integralmente com as postimages fornecidas. A identidade dos blobs é conferida no objeto de árvore de documentação antes da publicação do ref. Isso verifica o artefato, sem executar código de produto.

O teste já existente `test/product/wp04/ui-sourcing-analysis.test.ts`, blob `ce1064c72d28b3cb281c0adbd50964b22e753099`, está presente no alvo e permanece intacto. Após aplicação: a sessão14 e os verificadores já atribuídos devem conferir os blobs finais, fixar o candidato, executar o typecheck canônico e reavaliar selectors, escaping, identidade, indisponibilidade, rota 503/403, provider instalado, seleção sourcing/forecast e histórico no browser.

O [CHECK30 histórico](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43629131094/job/132551590764) registra o TS2305, mas executou produto em `d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7`, com workflow `00d1ba5220121c8490ae28ed0fc839c56b0b7192`. Não é uma execução em `f511…`. A incompatibilidade atual foi confirmada diretamente nos blobs fixados. Os outros doze diagnósticos históricos de fixtures/callers permanecem fora desta correção.

## Proveniência

A montagem foi extraída do [HTTP publicado por Operations](https://github.com/gustavomhss/Orchestra-SF/blob/15df31a67efab0aae6e2bff2b7eb8e5e59511324/modules/sucafina/Sucafinav1/product/interface/http.ts), blob `e79a5aa7b601cd6e0ab50c62033c72ec89362ab7`. O markup vem do Forecast publicado nesse mesmo commit, blob `b40d8be0088e7900af9bfc1d4bc4e03eef35819c`. Não há cópia integral dessas versões antigas.

Forecast continua sob sessão12, ACK UI sob sessão10, exports sob sessão11 e Memory sob sessão13. Nenhuma prova nativa, E2E ou revisão oficial é reivindicada por este pacote.
