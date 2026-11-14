# Operations24 — patch completo de montagem para sessão23

Estado: **READY_PATCH_PENDING_SESSION23_ASSEMBLY_AND_QUALIFICATION**. Este diretório contém uma proposta inerte. Só a sessão23 aplica os três arquivos compartilhados.

## Inputs e ordem de aplicação

A composição usada no run nominal é `d8ab1d3321a76870ed3092ba043fe1b5781a2c23`, produto C `b62c32940d06c15c04f52b88209d5b4930cf1a3e`. O avanço observado até C2/checkpoint `c7c2ffdc113764f7bcf67c07ef2e86b49004bbb1` está registrado em [advanced-input-disposition.json](../advanced-input-disposition.json). Ele não alterou o host, selector, config ou helpers de Operations.

1. Consuma os cinco arquivos próprios listados em [manifest.json](manifest.json), pelos blobs exatos do handoff terminal; o teste de montagem corrige o setup de upload após o commit [0042a959](https://github.com/gustavomhss/Orchestra-SF/commit/0042a95967ad651fe65ac0da216db6af86ed804c). Não importe a árvore antiga inteira de astra-wp04.
2. Confira os preimages completos. Se o head aceito avançou, reconcilie semanticamente; não sobrescreva outro writer.
3. Aplique [shared.patch](shared.patch): host compartilhado, reconhecimento do pré-requisito de host e abrangência do projeto E2E. Os postimages completos estão em `postimages/`; os originais, em `preimages/`. As extensões `.txt` mantêm as cópias documentais fora do grafo TypeScript.
4. Qualifique o grafo pelo script existente `bun run typecheck:e2e`, em `packages/app-shell`, somente em Actions.
5. Execute [regression-request.json](regression-request.json) e a [requisição nominal](../nominal-request.json) na composição resultante, pelo dispatcher existente e com deduplicação. A primeira inclui os cinco testes de montagem e os dois testes do selector real. Esses sete testes não substituem as cinco jornadas de UI.

## Montagem real

O limite de anexos de 16 MiB é configurado pelo comando real Settings/save com sua versão corrente; isso permite alcançar o scanner, sem alterar os cálculos financeiros.

O host conserva seu listener, diretório privado, SQLite, fonte/autorização por registro, autenticação do operador, fixture comercial e teardown. Delega a montagem ao helper próprio `operations-support/installation.ts`, que usa os factories de produção:

- Procurement e C02 pelo business-services atual; Planner pelo `PlannerModule`.
- Importação pelo `createSfImportServices` e `createSfImportHttp`.
- Documentos pelo `createSfDocumentServices` e `createSfDocumentHttp`.
- Assets sobre a mesma persistência autoritativa; fonte documental por `createSfDocumentTargetAuthority`.
- Idempotência derivada do `Idempotency-Key`, grants mínimos de documentos/receipts, operações necessárias e ações humanas somente para writers.
- Read-only sem grants de mutação humana; autenticação revogada volta a ser recusada.

Nenhum renderer, parser, handler de negócio, veredicto de scanner ou resposta de sucesso é reimplementado. O descarte respeita os dois contratos publicados do factory documental e sempre descarta business-services; a fixture libera todos os recursos mesmo diante de falha.

## Scanner real: dependência externa ainda pendente

A montagem chama `scanLocalFile` de produção. Usa apenas um serviço ClamD já aprovado em `127.0.0.1`, com a porta recebida do ambiente do host em `SF_OPERATIONS_CLAMD_PORT`. Não instala nem inicia serviços. Ausência do endpoint causa recusa explícita.

O workflow atual não provisiona esse serviço e a allowlist de `.ci-run.json` não aceita essa variável. Não há endpoint hospedado aprovado demonstrado. A sessão23 precisa resolver essa capacidade com o owner do ambiente antes de qualificar upload/import positivos; não deve inserir veredictos sintéticos nem copiar o servidor falso de testes de protocolo.

## Provas e limites

O run nominal publicado em [nominal-run.json](../nominal-run.json) executou os cinco corpos, que falharam em `readManifest`, antes do login ou de qualquer ação comercial. Não valida este postimage.

O check [43640212098](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43640212098) passou em `0042a959`: geração canônica, `bun typecheck` de `modules/sucafina` e guards contra origin/dev. O teste de montagem importa o helper, trazendo esse grafo ao typecheck. O grafo inteiro da UI de Operations permanece pendente do patch de tsconfig e da execução de `typecheck:e2e`.

O arquivo de regressão de seleção permanece NOT_RUN até o aceite do selector compartilhado. As regressões HTTP/SQLite são auxiliares. C06 material, native/AM, human timing e outros formatos documentais continuam sem aceite.
