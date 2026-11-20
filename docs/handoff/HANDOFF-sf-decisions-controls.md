# HANDOFF — sf-decisions-controls

## SHA e estado

- Estado: **PARTIAL — dois bloqueios de oracle corrigidos; contratos posteriores ainda não reconciliados**.
- Branch isolada: `sf-decisions-controls`.
- SHA de código: `bdbd8e0c455064d9c1a22c78d3a2c60f9f689dd2`.
- Árvore de código: `e10328decb74c72ffe344cf03b843cf769a1865f`.
- Base exata: `a235a2d5ff69638bd8463cfe08e549811424b9cd` (`sf-ops-transport`).
- A base já contém UI f1, ingress Reports/Decisions permitido, Requests com valores plain e omissão de opcionais indefinidos, e a correção de transporte WP04.
- O commit documental posterior referencia este SHA de código. Não houve gate, PR, merge ou execução local neste recorte.

## Evidência real anterior

Run [44654471102](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44654471102), attempt 1, snapshot `1a755bfa542653efb24386348d41022a21d38605`, parent `fba289d484d0c0ff2463cbc26ab587777516a8db`: **failure**.

| Job | Resultado |
| --- | --- |
| `136017194591` — test (ubuntu-24.04) | failure |
| `136021708625` — cleanup | success |

| Caso em decisions.spec.ts no snapshot anterior | Resultado observado |
| --- | --- |
| 16:1 — evidência, duas alternativas e escolha após mudança de fonte | failure; primeira asserção em `decisions-support/planner-sources.ts:19:24`: `[data-sf-record-detail]`, esperado 1, recebido 0 |
| 26:1 — proposta Procurement, aprovação e recibo único de Apply | timeout 180000 ms no step `create the real requisition through its human form`; log sem stack interno que identifique a asserção/await causal |
| 41:1 — criar, editar e reabrir o mesmo caso nativo | passed |
| 48:1 — catálogo real de alternativas | failure em `decisions-support/journey.ts:124:24`, chamado por spec:55:27; botão `Create decision` inexistente |
| 97:1 — recuperar criação sem reenviar | passed |

Resultado total: **2 passed, 3 failed**, aproximadamente 5,5 minutos de testes. As mensagens `ECONNREFUSED 127.0.0.1:4174` pertencem às sondagens iniciais antes de cada servidor pertencente ao fixture ficar pronto. O log depois confirma instalação, discovery autenticado, contexto e seleção do projeto; dois casos nativos completaram. Não há fundamento para classificar essa corrida como bloqueio geral de ingresso.

Artefato: `playwright-ubuntu-24.04-1`, id `14593735111`, 10158622 bytes. Digest **do ZIP de diagnóstico**, não de pacote de distribuição: `sha256:d215e3d751e363605667feb02b44d15e04c68ca71aa57766e78597724bee5baf`. Nenhum trace privado, credencial ou URL assinada foi reproduzido neste documento.

## Causas corrigidas

### Planner: escolher o registro do readback autorizado

O produto em `packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx:285–315` recebe sucesso sem identidade em alguns comandos. Ele retorna à lista autorizada após save/copy e exige escolha explícita, evitando atribuir a criação de outro escritor ao comando atual.

O helper agora:

1. Aguarda a lista nativa depois da criação e exige exatamente uma linha autorizada.
2. Lê seu `data-sf-row`, abre `Open record` pela UI e confirma que o ID no detalhe é o mesmo.
3. Após copy, exige duas linhas, preserva a linha do baseline e seleciona exatamente o nome `Decisions baseline plan — Copy`.
4. Confirma ID próprio da cópia, diferente do baseline, antes de continuar.

As provas existentes de ano 2027, IDs, CAS, cópia de linha, moeda, owner e valores **1200 → 2400** permanecem. Nenhuma versão ou linha é criada por requisição substituta.

### Decisions: revisão real, confirmação e link nativo

`fillDecision` já executava `Review creation`; os callers remanescentes procuravam o botão antigo `Create decision`. Eles agora usam `Confirm this decision creation` e o link `Open decision`, como o sibling que passou.

O critério específico de initial-alternatives é passado a `fillDecision` **antes** da revisão. Isso é necessário porque editar o textarea depois da revisão retorna a fase a editing (`cases/create.tsx:213`). Os callers existentes conservam `draft.criteria` como default e os mesmos controles de revisão.

O readback de initial-alternatives agora verifica rota nativa UI34, ID e versão na UI, objetivo, estado, período/moeda e a projeção autorizada original lida pelo helper existente `readCase`. Essa leitura não cria nem altera o caso.

### Procurement: localização da pendência, sem reenviar

Foram acrescentados labels estáticos em navegação, revisão, confirmação única e espera pela resposta original. O listener continua registrado antes dos cliques; a sequência envia um único comando.

As asserções do helper foram preservadas textualmente. O timeout anterior não foi atribuído só a input string: `packages/schema/src/sucafina/procurement.ts:11` aceita finite, string e null. A base inclui a correção concreta de plain payload/omissão de opcionais, mas este recorte ainda não possui execução que prove sua contribuição para Decisions.

## Fronteiras encontradas na revisão até o término

Estes pontos permanecem **abertos**. Não foram removidos, convertidos em skip, substituídos por HTTP writes ou tratados como aceitação.

| Fronteira | Evidência e ação necessária |
| --- | --- |
| Editor de fontes legado | Neste SHA, `decisions-support/initial-alternatives.ts:25` ainda procura `form[data-decision-edit]`; a UI nativa expõe `data-sf-decision-editor` em `decisions/intent/sources.tsx:182`. A UI já oferece descoberta/inspeção BI com refs originais de Planner (sources.tsx:77–123). Falta reconciliar o percurso e todas as provas de preview/ref/CAS, sem trocar por resposta sintética. |
| Primeira alternativa e cobertura | `decisions/alternatives/authoring.tsx:79–102` seleciona uma alternativa já existente e recusa review sem anchor; :148 produz referência de cobertura dessa alternativa. Um caso recém-criado tem alternatives vazio. O teste mantém criação de cobertura pendente original em `initial-alternatives.ts:256–257`. É necessária uma proposta concreta de produtor/controle nativo de entrada, não uma alternativa sem origem inserida pelo teste. |
| Catálogo exigido pelo spec | `decisions.spec.ts:63,76–78` mantém Explore a portfolio e o contrato `decision-portfolio-catalog({purpose:"catalog",caseRefs:[...]})`. `portfolio/scenarios/producer.ts:103–114` usa `decisions.controls.read`, que é outro contrato. Não foi substituída a asserção de catálogo por uma leitura de controls. A mesma fronteira reaparece em `initial-alternatives.ts:166–171`. |
| Escolha e história | `decisions-support/choice-history.ts:19,137–143` ainda usa form/context e rota do console antigo. É preciso reconciliar observações nativas mantendo alternativas, choice imutável, cobertura pendente e mudança real da fonte. Não basta renomear seletores. |
| Regra numérica e Apply/recuperação | `decisions-support/comparison-rule.ts:8–54` e `decisions-support/apply-recovery.ts:9,39–42,111–147` ainda dependem dos contratos/controles anteriores. As provas de regra, aprovação financeira antes de Apply, recibo único e recuperação permanecem exigidas. Nenhuma equivalência completa foi demonstrada neste recorte. |
| Timeout Procurement | Causa interna ainda unbound no run anterior; o novo step `Decisions Procurement original response` está em `procurement-source.ts:154`. Não há novo resultado de execução. |

**Não preparar um gate idêntico apenas para atravessar os dois primeiros bloqueios e reencontrar fronteiras já conhecidas.** O próximo gate completo precisa de correção concreta das dependências restantes ou de qualificação de um recorte já existente que mantenha seu contrato, sob coordenação do integrador.

## Readback e escopo

GitHub confirmou conteúdo exato dos cinco arquivos após o commit. O diff base→SHA de código contém somente estes paths; não altera UI, produtores, runtime proibido, configuração de workflow, suites, baseline ou asserts finais de contrato.

| Path | Blob |
| --- | --- |
| `packages/app-shell/e2e/sucafina/decisions-support/initial-alternatives.ts` | `2d4a79eae2ce1ab4f88a45bbdb6dc0b7e24083c6` |
| `packages/app-shell/e2e/sucafina/decisions-support/journey.ts` | `4b0435c6ee754b63ea916c2463ec4a1658f5e027` |
| `packages/app-shell/e2e/sucafina/decisions-support/planner-sources.ts` | `3a63066b0c373a42eda1c96d161265cf4aca34ae` |
| `packages/app-shell/e2e/sucafina/decisions-support/procurement-source.ts` | `16669596da7934b535786edfcc7a427908462363` |
| `packages/app-shell/e2e/sucafina/decisions.spec.ts` | `d705e710e002b7339ea7df9e31414f02071744dc` |

Não houve mudança de timeout, retry, seleção da suite, assertion skip/xfail, baseline, cobertura ou recibo. Os comentários de limite de prova e os testes vermelhos por falta de equivalência permanecem.

## Integração, guards, sf-ci e pacote

- Ordem de merges: nenhuma neste trabalho.
- Gate do novo SHA: não executado.
- Guards do novo SHA: não executados.
- `sf-ci`: não executado; reservado à única corrida final do integrador.
- Artefato/baseline de corrida completa: nenhum novo.
- Pacote de distribuição/sha256: nenhum novo.
- PR #392 e #237: não alterados.
- A base herdada contém os dois blobs de #393 apenas como dependência de composição. Este recorte não autoriza merge indireto de #393.
- Estado não é COMPLETE; não há GO, deploy ou pacote verificado.

## Como retomar

1. Revisar o SHA de código e as fronteiras acima. A base incorpora o recorte Operations; não confundir essa composição com integração aprovada.
2. Resolver os contratos nativos restantes com seus responsáveis, preservando as provas originais de identidade, autoridade, CAS, valores e imutabilidade. Não recriar o console anterior.
3. Só então preparar o snapshot Actions pertinente, com commit sem `[skip ci]`, respeitando o máximo global de dois gates e sem repetir código idêntico.
4. Ler o resultado real e promover o handoff somente com evidência suficiente. Manter `sf-ci` e pacote sob coordenação final do integrador.
