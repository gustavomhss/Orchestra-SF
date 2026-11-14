# Bundle final de CI — Orchestra SF

Estado: **preparação executável, validação estática realizada, CI de produto NOT_RUN**.
Owner desta preparação: S0-C; consumidor e autoridade do freeze/execução/aceite: S0.

## Origem e escopo

Missão: `final-ci-preparation.json` e `COMMON.md` em
`c708ec0609dbfc95b259707d8c38481617f74f11`.
Planejamento: `dbf9547211d9b0fade619790de7c19c0869b7c7d`, pack completo S0-C e anexos obrigatórios.
Branch/PR de preparação: `astra-compose` / #32; head examinado
`9048e0e65351a5bd80768458a79fed94a4993db7`, tree
`f073278e9fb11ca93b129c16331460e1fb6e25c4`.

O builder original e os sete artefatos de `parallel-wave/artifacts/final-bundle/` foram reutilizados.
Antes dos ajustes abaixo, a geração usando os workflows atuais reproduziu exatamente os **50.332 bytes**
e SHA256 **87aeb489a441ed24cd823c747748bff53053831b7307e4e94ab85ddf8e714c4c** publicados.
Os workflows fonte, os validadores e o planner continuam com os hashes originais.
A configuração Playwright de produção atual possui SHA256
`492f3145a61e5469f43618270701d2ba1972bb82e271633dc5f952557de3dc66`;
sua mudança de host condicional WP04 foi registrada, sem editá-la.

Adaptações desta missão:

1. Builder portável, sem caminhos de máquina pessoal, com `--repo-root`, `--output` e `--check`.
   Divergência dos dois workflows fonte ou das oito receitas exatas interrompe a geração.
2. Recibo por receita identifica C, tree, request normalizada/hash, run/attempt, runtime e hashes das fontes.
   Neste bundle o request é materializado no checkout do job: **não existe commit snapshot S**.
3. Playwright confere também o JSON da execução, as identidades listadas e pelo menos um teste
   executado em cada arquivo solicitado. Resultado ausente, seleção incompleta, all-skipped,
   falha, timeout, interrupção ou retry não recebe sucesso. Skips individuais continuam visíveis.
4. Bun conserva seleção e controle Omni e acrescenta JUnit. O relatório deve existir, ter contagens
   consistentes e ao menos um testcase executado que não seja skip/todo ou controle identificável.
   Essa validação de dados complementa exit code, nonce e evidência do job; não comprova sozinha cobertura.

O diff de workflow altera apenas o job `recipe`; os outros oito jobs e a matrix das oito receitas
são estruturalmente idênticos ao artefato original. A preparação não altera specs, fixtures,
validadores canônicos, workflows alheios, políticas, engines ou infraestrutura.

## Arquivos executáveis

| Arquivo | Função |
| --- | --- |
| `.github/workflows/sf2-epic.yml` | Bundle completo, acionável exclusivamente por push em `sf2-epic-c`, no repo e ID previstos |
| `build-artifact.py` | Reproduz o YAML a partir dos dois workflows existentes; não faz operações remotas |
| `requests.json` | Oito requests obrigatórias, separadas e preservadas |
| `validate-requests.mjs` | Admissão estática pelo resolver e validator reais; não coleta nem executa testes |
| `verify-runtime.mjs` | Confere JSON list/runtime Playwright pela seleção canônica |
| `verify-bun-report.py` | Confere JUnit Bun e emite observação de contagens |

Requisitos dos helpers: Python 3 padrão e Node 24 com type stripping; nenhuma dependência nova
foi acrescentada. O workflow mantém as actions e o setup Bun já usados pelo repositório.

## Seleções preservadas

| Receita | Package / runner | Args e configuração |
| --- | --- | --- |
| CI-SF | sucafina / bun | `[]`, em `modules/sucafina` |
| CI-CLI | cli / bun | `[]`, em `apps/cli` |
| CI-APP-SRC | app / bun | `[]`, raiz `src`, condição `solid` |
| CI-APP-BROWSER | app / bun | `["test-browser"]`, condição `browser`, happydom e Omni |
| CI-ATLAS-BUSINESS | atlas-boundary / bun | `["--timeout","30000"]`, suíte inteira |
| CI-UI-OPERATIONS | app / playwright | `e2e/sucafina/operations.spec.ts` |
| CI-UI-DECISIONS | app / playwright | `e2e/sucafina/decisions.spec.ts` |
| CI-UI-REPORTS | app / playwright | `e2e/sucafina/reports.spec.ts` |

Os três Playwright usam `e2e/playwright.production.config.ts`, um worker,
zero retries, uma repetição e o seletor exato produzido por `playwrightArgs`.
APP-SRC, APP-BROWSER, os três Playwright e o E2E herdado permanecem provas distintas.

O inventário herdado conserva Core particionado em Linux/Windows, demais pacotes/libraries,
app, CLI/server/client, desktop/Script Windows, Atlas e seus guards, HttpApi, hosted sandbox,
process query, Relay pytest/shell/doc-index e rollback legado. O E2E completo herdado usa os
shards calculados no planner e Linux; benchmarks manuais seguem as exclusões originais.
Não há replay de resultado Turbo/E2E; `--force` e execução cold permanecem.

Gates estáticos de C: Atlas `check:generated`, geração com diff limpo, cinco `bun typecheck`
(Atlas boundary, Sucafina, Core, CLI, app), `check:spawn-imports` e
`bun run check:guards --base origin/dev`. Atlas herdado também mantém seu typecheck e guards.
O agregador exige sucesso de todos os jobs; skipped/cancelled/failure não satisfazem o bundle.
Se uma etapa anterior impedir um gate posterior, esse gate é NOT_RUN, nunca PASS.

## Verificação antes do freeze

Na raiz do checkout que S0 pretende congelar:

```bash
python3 script/sf2h/final-bundle/build-artifact.py --repo-root . --check
node script/sf2h/final-bundle/validate-requests.mjs
```

Esses comandos são estáticos. O segundo usa `validateRequest`, `locateTestPackage`
e `omniControlScope` reais, inclusive a validação de todos os manifests do registry.
Sucesso significa admissão de requests, sem alegar seleção observada ou execução.

Para regenerar o YAML **antes de C**, após reconciliar uma mudança autorizada:

```bash
python3 script/sf2h/final-bundle/build-artifact.py --repo-root .
```

Não ajustar um hash para silenciar SOURCE_DRIFT/REQUEST_DRIFT. Primeiro revisar a mudança,
suas seleções/consumidores e o novo diff; atualizar código e proveniência em um novo candidato.

No head auditado, os três specs finais estão ausentes. O preflight executado aceitou
cinco requests e recusou exatamente os três Playwright. Isso é um bloqueio de composição
esperado e registrado, sem substituição por specs históricos. Os três owners devem entregar
os arquivos, seus helpers e o mount/consumidor real compatível com a configuração existente.

## Procedimento final de S0 — depois da composição e freezeC

1. Reconciliar os heads/handoffs e integrar as entregas reais, incluindo os três specs.
   Conferir também código, fixtures, contratos, skills/prompts, manifests, assets e
   guia/roteiro/changelog normativos. Todos os arquivos desta preparação entram **antes** de C.
2. Executar os dois comandos estáticos acima no checkout real; registrar resultado.
   Congelar C e seu tree hash. Registrar hashes de workflow/validator/config/runtime,
   fixtures/seleção, quatro gerados Atlas, guard e allowlist. Nenhum C é afirmado nesta preparação.
3. Com lease de dispatcher, consultar runs existentes e deduplicar por C/tree/request
   normalizada/workflow+validator/runtime+config/fixtures+seleção. Só adotar evidência completa
   da mesma chave; não promover green de outro head.
4. Quando S0 autorizar a rodada final, usar **GitHub MCP** para a ref `sf2-epic-c`:
   se ausente, `github_create_branch` com `branch_name: "sf2-epic-c"`, `sha: C`
   e `repository_full_name: "gustavomhss/Orchestra-SF"`; se existente, reconsultar o head
   e usar `github_update_ref` com `sha: C`, `expected_sha: head_observado`,
   `force: false`. Não criar ref intermediária. Uma rejeição de CAS/fast-forward exige
   reconciliação, sem force/reset, ref alternativa ou duplicação.
5. Confirmar por GET `/repos/gustavomhss/Orchestra-SF/actions/runs?branch=sf2-epic-c&per_page=100`
   que há o run pretendido, `event=push`, `head_sha=C` e `path=.github/workflows/sf2-epic.yml`.
   Se a ref já aponta C, reconciliar o run existente; não mover refs apenas para forçar execução.
   Se não houver run, registrar o bloqueio e investigar. Esta preparação não faz nenhum desses disparos.
6. Coletar run/attempt, jobs completos, logs integrais e artifacts. Confirmar cada job
   `recipe (CI-...)`, a matrix herdada prevista pelo planner e os gates estáticos.
   `requireTestJobs("linux")` não serve para estes nomes de receita; esse helper espera
   o workflow cirúrgico `test (...)`. Usar os IDs reais dos jobs e o controle canônico
   `controlVerdict` sobre o log integral, incluindo o passo que gera o nonce.
7. Nos artifacts de cada receita, conferir `request.json`, hash da request,
   `recipe-run.log` e `runtime-observation.json`; para Playwright também list/runtime JSON,
   traces/report; para Bun também `bun-runtime.xml`. Conferir candidatos/trees/digests,
   contagens realmente executadas, seleção, Omni, conclusões e tempos.
   O modo direto tem `head_sha=checkout=C` e `ci_snapshot_sha=null`; não inventar Sj.
   Geração Atlas, typechecks e guard exigem seus resultados reais, inclusive SHA da base dev.
8. Completar **C/G7** com as oito seleções, adicionais herdadas, AM01–AM06,
   três pareceres finais independentes no mesmo C, critérios/consumidores e nenhum finding obrigatório aberto.
   O universo global continua 5 perfis, 18 skills, 8 packs e 39 operações. Provas nativas,
   scanner/Atlas/restart, revogação/isolamento e consumo após reload não vêm automaticamente do CI.
9. Somente depois formar D e verificar o envelope abaixo. Uma mudança material de produto,
   teste, config, workflow, skill ou documento normativo cria novo C e reabre gates pertinentes.

`bun run test:ci` continua sendo a interface conceitual cirúrgica, mas seu uploader usa git/gh
remoto; não executá-lo por esse canal nesta campanha. O bundle final reutiliza seus validadores
e executor com a adaptação operacional aprovada de execução direta em C.

## D/G8 é separado

D é descendente de C e apenas acrescenta novos recibos UTF-8 `.json`/`.md`/`.txt`,
modo `100644`, nos prefixes normativos `receipts/WP00/` a `receipts/WP14/` ou nos
paths completos de controle previamente alocados por S0 em lista finita.

Conferir diff completo, ancestralidade, status/path/mode/blob, hashes preservados e ausência
de novos inputs de build/test/runtime. Nenhum arquivo antigo pode ser editado, removido,
renomeado ou ter modo alterado. Dependência desconhecida impede aceitar o envelope.
**`receipts/final-ci-preparation/` não é prefixo de D**: estas evidências de preparação
entram antes do freeze; as evidências finais usam o envelope normativo.

No checkout real D, em executor já autorizado, repetir separadamente:

```bash
bun run check:guards --base origin/dev
```

Registrar D, SHA efetivo de origin/dev, comando, exit code e stdout/stderr **fora de D**.
O receipt interno aponta C e não inclui seu próprio hash, futuro SHA de D ou guard posterior.
Não disparar o epic em D. O modo delivery do `astra-compose-check.yml` existente verifica
apenas um subconjunto WP00/WP10; não é verificador genérico de todos os paths admitidos.
Aceite global exige envelope e G8 comprovados, além de G7.

## Evidência desta preparação

Ver `modules/sucafina/Sucafinav1/docs/sf2h/receipts/final-ci-preparation/attempt-01/`.
A sintaxe do YAML/scripts e a consistência da geração foram verificadas; actionlint está NOT_RUN
porque não está instalado. Bun, typechecks, geração Atlas, guards, testes, CI, AMs e aceites finais
estão NOT_RUN nesta missão. Não há declaração de C aceito, D, G7, G8 ou GLOBAL_RELEASE.
