# Handoff — finish-agenda-evidence-20261119

SHA base das três folhas: b29e5909fcee7bfe49cdc933beebe056d63afc78 (Assembly29)
SHA anterior de evidência: dafe5523272e9e4dae6f80d20ee5cea577e1bdca
Data: 2026-11-19
Estado: partial

## Feito

- A coluna Evidence/Evidência já compõe a integração desde291d28: os quatro rótulos traduzem apenas value.evidenceState original.
- UI47 simples e múltiplos domínios agora exibem sourceRef.observedAt original em um parágrafo separado, com time/dateTime recebendo exatamente o mesmo timestamp do produtor.
- Contrato conferido em packages/schema/src/sucafina/reviews.ts:26–30: SourceRef.observedAt é Text obrigatório. ProjectionContext:50–55 não possui asOf; nenhuma data é inferida desse contexto.
- A linha de origem permanece com surface/type/id/version/incarnation; tabela e valores, moeda/unidade, período, fonte e evidência permanecem.
- Copy EN Observed at; PT Observado em, sem fallback temporal ou cálculo.
- A versão atual de multi-domain preserva structuredClone(unwrap(option.item)) de7ba91; folhas foram lidas do Assembly29 antes da alteração.

## Decisões e justificativas

- reviews/labels.tsx WhenText foi conferido: aceita iso opcional e delega ao formatador. Este campo é obrigatório, e o consumidor exibe o timestamp original em time para manter sua representação explícita. Não usa Date.now, instante da preservação, período, versão ou outra data como substituto.
- A asserção original de2026-11-13 no host-workbench:160 continua em proposals.spec.ts:520. O produtor do fixture oferece13 em sourceRef.observedAt; o consumidor precisa renderizar esse fato.
- Asserções removidas: nenhuma. Nenhum spec/helper foi alterado neste checkpoint.

## Pendente

- packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx:355 e multi-domain.tsx:210: ainda dependem de qualificação de navegador do composto que absorver essas folhas.
- packages/app-shell/e2e/sucafina/dashboard-installed/proposals.spec.ts:520: a asserção de data permanece; gate5 em execução não inclui este checkpoint.
- Gate Reports/Proposals posterior deve comprovar as duas folhas e continuar verificando os mesmos sourceRefs, valores, unidades/moedas, períodos e evidenceState.

## Como retomar

1. Root absorve somente os três blobs UI/copy deste commit no finish-reports, preservando helpers e os demais arquivos atuais.
2. Gate5 de Proposals deve terminar antes de nova execução. Incorporar este checkpoint no composto seguinte e usar o spec estreito existente; não criar gate separado de tipos.
3. Atualizar este handoff com o SHA composto e os runs terminais. Nenhuma aprovação de UI está afirmada aqui.

## Runs e resultados

- [44612824007](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44612824007): FAILURE,5 testes Proposals falharam; os três typechecks SUCCESS; cleanup135878209685 SUCCESS. O quinto caso parou antes de UI47 por grant ausente, portanto esse run não verificou observedAt.
- [44615301691](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44615301691): gate5 em execução sobre Assembly27 dde78b94d45b384f589435ba57a89659772f9970, snapshot b1d173beac4daea9054cb7cce73fcfa6af05536e. Não inclui este delta observedAt.
- Nenhum teste adicional foi executado para este checkpoint.
