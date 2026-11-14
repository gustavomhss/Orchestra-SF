# D-OPS-01 — Reextração documental

Estado da correção: **verificada na seleção cirúrgica — 8 PASS / 0 FAIL, 96 assertions**.
Este recibo trata apenas D-OPS-01. Não concede aceite integral de WP06, da composição, de GNATIVE ou das jornadas humanas.

## Identidade e fontes

- Base revisada: `ba8a09e371ce8d93eb917eabb102caaee5affaf4`, PR #34.
- Parecer independente: [PR #49](https://github.com/gustavomhss/Orchestra-SF/pull/49), commit `6830fa159d30b60d001f91a47326ae88c6255282`.
- Plano normativo: `dbf9547211d9b0fade619790de7c19c0869b7c7d`, COMMON, WP06 e C14.
- Produto W: `ee2e14ac940ba62177052f44c0f0e781132e7564`; tree `01a10e66482be74e95c099761e31eca2d9be4363`.
- Snapshot S: `96da0ee1011e4a47086830c0a4bde00b878f54e5`; tree `7f81d6b83868a60ca41fd0c9c6543959dba60bdd`; request blob `d4b4a6b5796c6657c35ca09dc5392e34606b6b59`.
- [Run 43625203326](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625203326), [job 132539378028](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625203326/job/132539378028): **SUCCESS**, 8 PASS / 0 FAIL / 96 assertions, 20,93 s na seleção.
- Produto W, snapshot S e envelope CI permanecem identificados separadamente no recibo estruturado da publicação. O resultado não é atribuído a outro candidato.

## Causa e mecanismo da correção

O form criava uma identidade de schema para cada operação, enquanto a identidade do candidato dependia da fonte e do campo. A repetição reencontrava o candidato original com outro schema e acionava a proteção `candidate-schema-conflict`.

`schemas.register` agora procura uma definição equivalente na fonte atual, sob a mesma identidade, instalação, projeto, revisão de acesso e política. A equivalência mantém exatamente os campos, tipos, unidades e ordem. Se já existem schemas duplicados no estado legado, prefere o schema e a versão vinculados ao candidato existente, incluindo sua confirmação. Mais de um vínculo material compatível permanece conflito explícito.

A reutilização não cria novo schema nem candidato. Ela registra a nova intenção no ledger C08 existente, com digest e `{id, version}`; essa escrita é necessária para impedir que a mesma chave seja reutilizada depois com outro conteúdo. Repetição exata reutiliza o recibo. Recibos legados booleanos exigem a presença e conferência do schema derivado da operação original; não podem ser reinterpretados como sucesso para outra definição.

Após o resultado da transação, o código confere a identidade original, resolve novamente o schema e revalida fonte, confirmação humana e acesso. Mudanças de tipo, unidade ou versão não se tornam equivalentes por conveniência. `capabilities.ts` não foi alterado: a comparação estrita de `schemaRef/schemaVersion` continua protegendo os candidatos.

O workbench mantém duas chaves distintas para a mesma intenção pendente — schema e extração — e impede submits simultâneos. Em resposta incerta, repete a sequência completa com as mesmas chaves. Uma submissão independente concluída recebe novas chaves e o produtor reencontra o schema equivalente.

## Provas executadas e oráculos

| Corpo | Oráculo discriminante | Resultado |
|---|---|---|
| `operations-fixes/document-reextract.test.ts` | Dois ciclos completos com serviços reais; candidato e confirmação preservados; chave com payload alterado recusada; duplicatas legadas e recibo booleano; tipo/unidade/versão; revogação isolada; substituição física com mesmo ID/texto. | **PASS** |
| `operations-fixes/document-workbench.test.ts` | Script e DOM reais; requests originais chegam ao HTTP/serviços/SQLite; respostas perdidas depois dos commits de schema e extração; chaves e bodies estáveis no retry, novas chaves no submit independente, nenhum candidato adicional indevido. | **PASS** |
| `wp06/documents/extraction-reuse.test.ts` | Reuso direto existente continua preservando candidato, evidência, confirmação e recusa de fonte alterada. | **PASS** |
| `wp06/documents/schemas.test.ts` | Versionamento, vínculo à fonte e revogação do produtor existente permanecem protegidos. | **PASS** |

O log terminal confirma **8 PASS / 0 FAIL**, com os cinco casos novos de integração, a jornada do workbench e as duas regressões existentes. O controle Omni passou com nonce `fc7cd8762c5c4bb20a74a7d409bb934a`: uma declaração, um spawn, zero delegações. O driver confirmou encerramento físico, zero contextos remanescentes, conexão encerrada, processos Node/Chromium encerrados normalmente e remoção do socket/diretório.

A jornada observou dois schemas e dois candidatos, correspondentes aos campos Price e Active; a confirmação de Price permaneceu. Nos dois pontos de perda, o serviço real havia respondido 200 depois do commit, mas a entrega ao browser foi 503. O retry conservou body e chave de cada etapa. Submissões independentes de Price usaram novas chaves e conservaram o mesmo schema e candidato.

As provas novas usam a composição documental real, persistência SQLite e autoridades existentes. A jornada browser usa o driver direto já existente em WP02; a interceptação somente encaminha o request ao handler real e, nos pontos declarados, retém sua resposta depois do commit. Não fornece schema ou candidato constante ao consumidor.

## Critérios afetados e limites

A correção fornece evidência delimitada para `WP06.SUC.10`, `WP06.QLT.10`, `WP06.DOD.04`, `WP06.CMP.04`, `WP06.T05.DOD.01` e C14, preservando especialmente `WP06.T05.CHK.02`, `WP06.T05.INV.01`, `WP06.T05.QLT.19`, `CAMP.CMP.02` e `CAMP.INV.04`. Uma seleção verde não fecha integralmente os critérios de três formatos, todos os consumidores ou toda a campanha.

A prova browser cobre o renderer documental, seu script, HTTP, produtores e armazenamento na fixture real; não prova reinício completo do processo, a montagem global de todas as superfícies, qualificação de scanner ou GNATIVE. A reextração não aplica mudança financeira. O mapeamento HTTP preexistente de conflito semântico de extração para 503 permanece no owner de `document-services.ts/document-http.ts`; o caso idêntico deixa de acionar esse conflito, enquanto os negativos semânticos continuam recusados.

Nenhum teste de produto local foi executado. O resultado acima vem de GitHub Actions, sem rerun equivalente. Typecheck e guards são gates separados, descritos no HANDOFF; o resultado terminal da checagem final é registrado na PR #52. Este run não os substitui.

