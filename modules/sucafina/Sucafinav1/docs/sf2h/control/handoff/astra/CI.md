# CI cirúrgico pelo Astra

O Astra de cada WP implementa, corrige e executa seus próprios checks. Sem testes de produto locais, sem epic por WP e sem depender de Terra antigo. As regras AGENTS e os validadores reais do candidato continuam obrigatórios. Full suite/epic será do bundle integrado.

## Protocolo existente, preservando GitHub MCP

1. Leia `.github/workflows/test-ci.yml`, `script/test-ci.ts`, `script/test-ci-request.ts` e `script/test-ci-location.ts` no seu head real. O workflow existente dispara por push em `ci-run-*`. Os arquivos `WPxx.ci-request.json` são seleções iniciais dos testes já salvos, não prova de que passaram nem limite para novos testes necessários.
2. A interface padrão é `bun run test:ci <package> [arquivos...]`. Como seu uploader pode fazer operações remotas por git/gh, não o execute por esse canal nesta campanha. Use GitHub MCP para produzir o mesmo snapshot/request consumido pelo workflow existente, sem mudar ou contornar o validador. Não instalar uma plataforma nova.
3. Commite primeiro o produto na branch `astra-wpNN`. Registre SHA W e tree. Normalize e valide a seleção conforme `validateRequest` e `locateTestPackage`: paths relativos ao package, runner, directory/packageSelector quando requeridos, env permitido e arquivos existentes. Sucafina tem diretório `modules/sucafina`; não presumir `packages/sucafina`. O workflow faz a validação canônica novamente. Playwright usa package app, config admitida e lista explícita não vazia de specs reais. Estenda os templates com testes das mudanças/consumidores; não use seleção vazia ou filtro amplo acidental.
4. Via GitHub MCP, crie blob `.ci-run.json`, tree sobre W com apenas esse request e commit S descendente de W. Crie diretamente em S uma ref única `ci-run-linux-astra-wpNN-<Wcurto>-<requesthash>-<tentativa>`. A exceção de nome longo vem do protocolo do repositório. Criar branch antes do request geraria um run inválido: não faça isso. Não incluir secrets/inputs fora do escopo no snapshot.
5. Antes de disparar, procure run existente que corresponda à árvore de produto, seleção normalizada, config/env/fixtures e tentativa. No máximo um run de testes em voo por WP. Use GET `/repos/gustavomhss/Orchestra-SF/actions/runs?branch=<branch>&per_page=30` via MCP; confira `head_sha == S`. Um helper que só consulta eventos de PR pode ocultar estes runs de push.
6. Aguarde resultado e leia jobs/logs/artefatos. Registre run ID/URL, conclusão, testes realmente selecionados, request validado e omni positive control `pass` ou `not applicable`, conforme exigido. Cancelado, falho, vazio ou artefato obrigatório ausente não é PASS. O workflow pode limpar a branch temporária; preserve recibos/run IDs antes de esquecer a ref.
7. Registre W e S separados. Prove que todos os blobs de produto/testes/config/fixtures de W são idênticos em S; só o request é envelope. Não atribuir a W um green de outro produto, antigo checkpoint ou seleção. Mudança material posterior requer revalidação afetada.

## Typecheck e guards

`bun typecheck` roda no diretório de package relevante; nunca `tsc` direto. `bun run check:guards --base origin/dev` roda na raiz, com a base realmente disponível. Corrija findings sem inventar aprovação Maestro. Mudança Protocol/Server HttpApi exige geração oficial em packages/client.

Se o chat browser não tiver execução de comandos, rode esses checks no GitHub Actions em job mínimo delimitado ao WP, preservando workflows existentes. Pode adicionar `.github/workflows/astra-wpNN-check.yml` com trigger push exclusivamente `astra-check-wpNN`, `contents: read`, checkout de SHA do produto explicitamente registrado, setup Bun existente e somente geração/typecheck/guards pertinentes. Checkout/fetch da base para guards ocorre dentro do runner hospedado. Use actions já pinadas no repo; nenhuma credencial nova, deploy, schedule, full-suite ou habilitação global. Valide permissões reais do connector antes: ausência de ferramenta de edição de workflow/consulta de logs deve ser reportada, não burlada. Mudanças necessárias ao workflow também são código revisável e precisam entrar no commit da PR. Registre o SHA realmente examinado pelo job e relação exata com o head entregue.

## Entrega

Publique a PR contra sf2-stack com matriz dos critérios, checks/run IDs e SHAs. Não adicione label epic, não faça merge dev nem deploy. O integrador fará revisão e composição. Qualificação global C/G7, D/G8, AM01–AM06 e oito seleções finais continuam exigidas depois; o green cirúrgico deste WP não substitui nenhuma delas.
