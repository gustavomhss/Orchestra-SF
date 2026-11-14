# Retomada da composição — PR #44

**Entrega parcial publicada, revisável e em draft. Sem aceite global.** A branch `compose-resume` preserva a origem `astra-compose`/PR #32 e integra 22 blobs de código/teste publicados pelos owners. Depois, incorpora três trechos exatos do guia de Interface correspondentes a comportamento já consumido. Esta entrega não é D.

## Identidades

| Papel | SHA | Árvore |
|---|---|---|
| Origem recuperada, PR #32 | `9048e0e65351a5bd80768458a79fed94a4993db7` | `f073278e9fb11ca93b129c16331460e1fb6e25c4` |
| R01: Planner + Schedule | `f56b413147a5c9425c1da688775ce327d0bad5a5` | `f07d2c42d350e33ec629d3228f9fc026831c32ba` |
| R02: Interface | `e9d07f0ffe36925b1b0e044738a78cefb2eb2aca` | `1ca2a658f46fd1fedae77b5f88c31b1183676a1d` |
| W executado: R03, ciclo de vida IA | `e1a1888bd2117616d53c5af5f5014e81c4b4e530` | `64d26157c0044018712074e55a4a56f36db15d5f` |
| Guia normativo parcial publicado | `d86d119c15d1149fd6f463e07acce836b197eb4e` | `a34d95ee5992bbb9099f073baf66422eded90934` |

O commit que acrescenta este conjunto de recibos é descendente do último item e muda somente o namespace de recibos. Seu SHA/árvore são registrados no fechamento da [PR #44](https://github.com/gustavomhss/Orchestra-SF/pull/44), evitando autorreferência dentro do commit. O head documental e o W executado têm papéis distintos; a mudança do guia não é classificada como evidência D.

## Consumo concreto

| Input aceito | Pin | Recorte |
|---|---|---|
| Financeiro #42 | `88b9b6bff53a4f64d37d04ddc868f1443cecf5b3` | Normalizador HR canônico no runtime/port e contraprova de rate identity; 3 blobs. |
| Colaboração #41 | `20821df310ebc6ea08ccab27e829008d72a04de6` | Identidade dos providers de Schedule através dos awaits, receiver e retry; 2 blobs. |
| Interface #43 | `ad94fd2d78be47cecfb91f801ce7764127667b60` | ACK por operação, revogação, captura no escopo original e fixtures/testes de browser; 11 blobs. Depois, 3 trechos do guia, sem importar o restante do comportamento C05. |
| IA #39 | `812f8427423dc143cefc2731edc3485eeb8d1f04` | Pin/clone de entradas, binding e lease em publicação/cancelamento/leitura; 3 arquivos de produto e 3 testes. |

As fontes agrupadas não foram mescladas indiscriminadamente. Três blobs de #36 já equivalem a blobs consumidos pela seleção de #39 e foram deduplicados. Blobs distintos de memória, portfólio e C12 continuam explícitos em [overlaps críticos](R04-critical-overlaps.json). Não houve deleção de produto/teste, substituição ours/theirs, modificação de branches dos autores ou merge de `sf2-control`.

## Evidência executada

| Run | W | Resultado real | Limite |
|---|---|---|---|
| [43618683440](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43618683440) | `e1a1888…` | 66 PASS / 795 assertions, IA | Determinístico; não prova execução nativa. |
| [43619530864](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619530864) | `e1a1888…` | 30 PASS / 513 assertions, UI | 6 declarações e 6 spawns Omni; 6 provas de encerramento físico. |
| [43619906853](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619906853) | `e1a1888…` | 34 PASS / 149 assertions, Planner/rotinas | Nenhum spawn; controle Omni explicitamente não aplicável. |
| [43618711524](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43618711524) | `e1a1888…` | Sucafina typecheck FAIL, 14 diagnósticos; CLI/spawn/guards PASS | Guards:78 regras,1432 paths,0 gates,47 avisos,0 erros. Não é G7/G8. |

Total no mesmo W: **130 testes, 1.457 assertions, 12 arquivos, zero falhas nas três seleções de produto**. Isso não inclui contagem duplicada dos passes históricos CI01/CI02. Os 14 diagnósticos de typecheck mantêm o candidato incompleto.

[R05-validation.json](R05-validation.json) contém seleção normalizada, request hash, W/S e árvores, run/job, logs/excertos, artifacts e prova por igualdade Merkle. Cada S é filho do seu W e altera apenas `.ci-run.json`; o snapshot estático altera somente seu envelope. R01/R02 foram revalidados porque seus consumidores alcançam arquivos alterados depois. Não houve reteste de produto pela mudança exclusivamente documental.

## Como revisar e continuar

1. Leia [HANDOFF-S0.md](HANDOFF-S0.md) e [FINDINGS.md](FINDINGS.md).
2. Use [R04-reconciliation.json](R04-reconciliation.json), os oito arquivos `matrix/pr-*.json` e [R07-final-source-observation.json](R07-final-source-observation.json) para cada pin/path. As matrizes se referem ao W executado; o guia posterior tem intake próprio. `latest` é observação, nunca troca implícita do pin aceito.
3. Revise as cinco propostas em [proposals/index.json](proposals/index.json). Somente o owner/S0 decide aplicação e validação.
4. Use [FORWARDING.md](FORWARDING.md) como texto de encaminhamento; nenhuma mensagem a terceiros foi enviada.
5. As [requests de qualificação final](R06-s0-qualification-requests.json) são preparadas para S0, **não despachadas**. Oito seleções mínimas, gates adicionais, AM01–AM06 e três revisões independentes continuam obrigatórios no C final; depois vêm envelope e guard D/G8.

O plano imutável continua em `dbf9547211d9b0fade619790de7c19c0869b7c7d`. SHA256 de campaign.json: `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. Foram preservados **15 WPs,74 tasks,17 contratos e1.610 critérios**. [R06-obligations.tsv](R06-obligations.tsv) indexa todos os IDs e hashes dos textos; esta retomada não concede aceite de nenhum critério global por inferência de um green parcial.
