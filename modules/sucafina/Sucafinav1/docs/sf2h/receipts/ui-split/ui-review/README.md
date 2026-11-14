# ui-review — histórico de revisão preservada

**Status: PARTIAL_OWNER_INTEGRATION_REQUIRED.** Incremento publicado na [PR #45](https://github.com/gustavomhss/Orchestra-SF/pull/45), de `ui-review` para `interface-resume`. O positivo original e a jornada browser de WholeReview passaram no input publicado de WP10. O candidato ui-review ainda depende do mount histórico externo; a emissão de contexto pelo host My work continua pendente.

## Produto e limites de escrita

- Base fixa: `2ee71fc90055814912654ae198f7a1dcf9583943`; tree `cf3676a469a1f8bcab05e322ee7a4a1ada0704c5`.
- Produto ui-review exercitado após correções dos testes: `4183ebdb53b17b8e4efe9c8835ff2b0012e98624`; tree `ec4fac7620aa27bf79f2af671838fd5a1c1db639`.
- O commit final de entrega acrescenta apenas estes recibos ao produto exercitado. A PR registra seu head/tree e o compare final.
- Alterações limitadas a `test/product/ui-split/ui-review/` e a este diretório de recibos.
- `product/ui/work-review-context.ts` já faz apresentação passiva e valida o formato exato dos metadados autorizados. `product/interface/review-analysis-input.ts` monta a análise DecisionCritique. Nenhuma alteração de produção nesses arquivos foi necessária para os defeitos reproduzidos no mount/inputs externos.
- `meeting-number.test.ts`, fixtures compartilhadas, drivers, componentes, shell, HTTP, HTML, contratos e hosts permaneceram intactos.

O teste original conserva o blob `53834c8c0802bf90a2336527460e2ecbf9aa8c97`. Sua fixture real conserva `593a46dad67e490dcfdd4fdc1878353088138dc7`. Não houve substituição de WholeReview por record capture.

## Comportamento exercitado

Os seis arquivos novos usam a fixture publicada de recuperação, identidade de operador, SQLite/C08, ciclo de fontes, comandos canônicos e rotas reais. Os passos browser apenas selecionam controles e aguardam respostas; o driver compartilhado permanece original.

1. Preparar um pin de seção pelo `createReviewThreadContext` usando `dashboard.readReview` real; apresentar referência, versão e seção sem expor digest ou conceder ações.
2. Negar adulteração de versão, digest, seção, versão da fonte e incarnation.
3. Reabrir o contexto preservado depois de mudança financeira legítima, sob nova admissão de leitura; manter corpo e recibo original.
4. Revogar acesso atual e negar reutilização do pin e da rota histórica.
5. Abrir WholeReview 1300, atualizar a fonte canônica para 2400, manter a observação aberta, recarregar a página e reabrir a mesma revisão 1300.
6. Pré-visualizar 2400 e preservar explicitamente uma segunda observação com outra identidade; manter as duas revisões e dois recibos.
7. Remover material preservado do DOM e do painel antigo após a rota real responder 403.

Os itens 3 e a emissão instalada de contexto My work **não estão fechados no candidato composto**. Os resultados abaixo delimitam o que foi executado em cada produto.

## Resultados reais

| Execução | Produto | Resultado agregado | Interpretação |
| --- | --- | --- | --- |
| [43619653668](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619653668), job `132522203465` | WP10 `a1434e7e` | **1 pass, 0 fail, 38 assertions** | Positivo original inalterado: 1300 preservado, fonte atual 2400, mesma incarnation, reabertura HTTP 200 e corpo original. |
| [43620401922](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620401922), job `132524594140` | ui-review `a08d2c6a` | **3 pass, 4 fail, 74 assertions** | Reproduz reader fresh-only: contexto retorna denied e histórico desaparece após a mudança. Revogação do reader passa. Dois problemas próprios dos testes foram corrigidos. |
| [43621128874](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43621128874), job `132526833852` | ui-review `4183ebdb` | **6 pass, 0 fail, 53 assertions** | Casos corrigidos de pin/escopo e revogação browser, com startup/finalização reais. |
| [43621543227](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43621543227), job `132528119418` | WP10 + seis testes idênticos, `ba85e0c6` | **4 pass, 2 fail, 2 erros de importação, 81 assertions** | Jornada browser 1300→reload→nova observação 2400 e revogação **passam individualmente**. Os dois arquivos de contexto não carregam: WP10 não publica `product/reviews/thread-context.ts`. O job agregado é FAIL. |

Nome do positivo original executado:

`C05 reopens the same preserved financial meeting after a canonical budget change with its original authorized content`

A seleção original é HTTP e não declara spawn Omni. As três seleções browser registram controle Omni PASS, um spawn e zero delegações, com encerramento físico do Chromium e zero contextos restantes. Os nonces/veredictos também foram verificados pela implementação publicada de CI em [omni-control-checks.json](omni-control-checks.json). Isso não representa prova de IA nativa.

### Correções próprias e seleção cirúrgica

O primeiro caso agregava várias leituras reais caras sob 60 segundos. As mesmas assertions foram repartidas em três casos independentes, mantendo o prazo de 60 segundos. A UI aborta suas requisições durante a revogação; a inspeção posterior do corpo via CDP falhou. O teste passou a inspecionar a mesma rota real com uma nova leitura HTTP sob o mesmo cookie revogado e conservou as assertions de limpeza do DOM.

O rerun próprio selecionou somente os casos corrigidos. As falhas históricas já reproduzidas e a revogação do reader já verde foram excluídas desse rerun. A prova sobre WP10 mudou o reader/host de entrada e manteve os seis blobs de teste idênticos. Os deadlines e as verificações de negócio foram mantidos; o positivo original verde não foi repetido.

## Protocolo W/S e seleção

| Prova | W (produto) | S (snapshot de CI) |
| --- | --- | --- |
| Original WP10 | `a1434e7ea7340aa1d1c8ce6bb48958b724218170` | `d86464da2f8792afda72867073fe65c0d788ab7b` |
| Contraprova própria | `a08d2c6a4251c391036143fe06666a5b9f629a7b` | `22256892b1aeec870ec8badb9871e96117087fee` |
| Correção própria | `4183ebdb53b17b8e4efe9c8835ff2b0012e98624` | `4324becfe50e203b255ab2aac3748191054c4ff5` |
| Consumidores sobre WP10 | `ba85e0c6fd873026e1b7456214d125f340b170bf` | `7e902b570d1b422b469d5b64253c99c1de97d1b8` |

Cada S é filho de W e difere exclusivamente por `.ci-run.json`. O produto de prova `ba85e0c6` é filho de WP10 `a1434e7e` e acrescenta somente os seis testes próprios. Nenhum fonte de WP10 foi modificado. O módulo ausente não foi copiado para fabricar sucesso.

Requests, SHA256, trees, deltas, resultados nominais e controles estão em [validation.json](validation.json). A igualdade dos seis blobs está em [consumer-blob-equality.json](consumer-blob-equality.json). Os fontes de UI/host de WP10 não são todos iguais aos de ui-review; portanto, seus resultados não promovem o candidato ui-review.

## Findings e critérios

| Finding original | criterion_ids | Disposição desta fatia |
| --- | --- | --- |
| `IR-EXT-C05-WHOLE-REVIEW`; `C05_PRESERVED_MEETING_HISTORY` | `WP01.DOD.03`, `WP01.CMP.02`, `WP02.T03.CMP.01` | Positivo original e consumidor browser exercitados em WP10. Falha no candidato próprio reproduzida; mount externo pendente. |
| `IR-EXT-WORK-REVIEW-CONTEXT` | `WP01.T04.INV.01`, `WP01.T04.SUC.01`, `WP02.T04.INV.02` | Reader/renderer reais e rejeições exercitados na base própria. Contexto após mudança e emissão do host My work dependem de composição dos inputs publicados. |
| Preservação do número de reunião | `WP01.T03.CHK.03` | Prova WholeReview separada da antiga prova de pauta aberta/record capture; nenhum crédito indevido entre elas. |

Ver [owner-findings.json](owner-findings.json) para reprodução, owner, resultados e próxima ação. A prova direta de um pin real apresentado pelo renderer não demonstra que My work instalado emite esse pin.

## Propostas ao owner — NOT_APPLIED

| Proposta | Target e precondição | Delta |
| --- | --- | --- |
| [c05-compose-mount.patch](patches/c05-compose-mount.patch) | compose-resume `ad7fcdef`, BCS `b3595989` | Mover somente a criação de Dashboard services para depois de BusinessContext e adicionar `evidence: context`. |
| [c05-compose-reader.patch](patches/c05-compose-reader.patch) | Mesmo target; blobs guardados em [manifest.json](patches/manifest.json) | Intake preciso do reader e do integrity helper publicados por WP10. Os outros dois helpers já são idênticos. |
| [c05-wp10-thread-context.patch](patches/c05-wp10-thread-context.patch) | WP10 `a1434e7e`, arquivo ausente | Adição exata do módulo de contexto publicado em collab-resume, blob `20d98a97`. |

Todos os patches passaram no `git apply --check` textual, sem aplicação. O terceiro patch é dirigido a WP10. Compose também não contém `collaboration/thread-context.ts` e precisa reconciliar o fechamento de dependências de Collaboration; a adição isolada não resolve seu input. Ver [c05-context-intake.json](patches/c05-context-intake.json).

O avanço observado de compose-resume para `ad7fcdef7739e1bc471e42fac082452799de751b` alterou documentação/recibos e preservou todos os preimages críticos. Collab-resume avançou para `0d9820924b33a8fc7b145f54a675aeef76c98489`, com mudanças próprias no host. Essas mudanças foram preservadas. A reconciliação final está em [publication-reconciliation.json](publication-reconciliation.json). Se algum preimage mudar, o owner deve portar o delta sem substituir seu arquivo inteiro.

## Gates e handoff explícito

- `bun typecheck` em `modules/sucafina`: **NOT_RUN**, Bun ausente no runtime local (exit 127).
- `bun run check:guards --base origin/dev`: **NOT_RUN**, mesma limitação.
- Os workflows de checks existentes usam refs fixas externas ao lease. Nenhum workflow ou branch alheia foi alterado para contornar o limite.
- `node --check` nos seis arquivos próprios: PASS de sintaxe, sem crédito de typecheck.
- Produto executado somente em Actions. Operações remotas somente via GitHub MCP. Nenhum agente foi criado.

**Próxima ação do owner:** reconciliar o reader/mount histórico, o módulo e as dependências atuais de Collaboration, e os providers de contexto My work. Depois, executar os consumidores sobre o candidato realmente composto e executar typecheck/guards. A seleção [context-after-owner-intake.json](requests/context-after-owner-intake.json) é **PROPOSED_NOT_DISPATCHED** e isola os dois arquivos de contexto que faltaram no input WP10. O positivo browser já verde só precisa ser repetido quando o candidato integrar mudanças que afetem esse consumidor.

S0/composição devem consumir este incremento e qualificar o candidato final. Os 153 critérios WP01/WP02 e os gates globais continuam íntegros. Este recibo não declara GLOBAL_RELEASE.
