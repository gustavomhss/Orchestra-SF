# HANDOFF — sf-fixture-control

## SHA, estado e propósito

- Estado: **PREPARED / PARTIAL — controle revisável, nenhuma execução**.
- Branch de controle: `sf-fixture-control`; não tem o prefixo que dispara `test-ci`.
- Commit de controle: `5ea24aae643c76f05ac0641663c6bf81542331ab`.
- Tree de controle: `7c41df06ddeac96eec3d059de5a1d51997948b1b`.
- Fonte de produto/fixtures, parent exato exigido pelo futuro snapshot: `236a1703278d87e478958a957269b04100e5af66`, tree `09b3cd600604fba9a230164ad92e5a857481a294`.
- Código dessa fonte: `56c37078b7238619a16b9e5ae7273a4485c06b54`, sobre integração `45514008d7ce275327003c5d92faaeeab2479739`.
- Este handoff documental sucede o commit de controle. Não há run, qualificação, PR ou merge desta branch.

Este controle executará uma compilação TypeScript real dos três fixtures corrigidos e todas as suas dependências transitivas, seguida pelos três testes Bun originais. Não é o typecheck integral de Sucafinav1 e não resolve por seleção os erros de outros owners. Nenhum diagnóstico do projeto selecionado pode ser descartado.

## Checker original e configuração

`modules/sucafina/package.json` delega `typecheck` para `bun --cwd Sucafinav1 typecheck`. O script interno, blob `18911fee9313f8fb57c1a972bc70eec2f7864c55`, é `tsgo --noEmit`. O dependency lock fixa o checker `@typescript/native-preview` em `7.0.0-dev.20251207.1`; não se instala outro compilador.

Não existe `modules/sucafina/tsconfig.json`. O config original está em `modules/sucafina/Sucafinav1/tsconfig.json`, blob `7907cb2a010cd229b6b28a710cb3b67861e6017b`. O config temporário fica ao lado dele e contém somente:

```json
{
  "extends": "./tsconfig.json",
  "include": [
    "test/native-ui-contract/asset-health.test.ts",
    "test/native-ui-contract/import-health.test.ts",
    "test/native-ui-contract/budget-deviation-projection.test.ts"
  ]
}
```

Não há override de `compilerOptions`, `exclude`, `references`, paths, tipos, libs, strictness ou emit. O `include` estreita somente as raízes; imports continuam sendo carregados e verificados pelo checker original. `strict: true`, `noEmit: true` e as demais opções originais, inclusive `skipLibCheck: true`, são herdadas exatamente.

Com working-directory `modules/sucafina`, o comando único é:

```
bun run typecheck --project tsconfig.sfc-fixture-types.json --pretty false --listFiles
```

O wrapper original muda o diretório para Sucafinav1 e encaminha os argumentos. `--listFiles` acompanha a compilação; não se usa `--listFilesOnly`, transpile, filtro de diagnósticos, cast, supressão TypeScript ou `continue-on-error`.

## Escopo e identidade da fonte

| Input | Blob fixado no controle |
| --- | --- |
| `test/native-ui-contract/asset-health.test.ts` | `5d2f67d3b0a71dc10516f4e6558a2dfda0c0504d` |
| `test/native-ui-contract/import-health.test.ts` | `1208354d5e8260f615b75900bc6ce457f29dea22` |
| `test/native-ui-contract/budget-deviation-projection.test.ts` | `b75a837a419dfb791438659de0d55dc2ced6fcff` |
| `apps/cli/src/sucafina-product/native-ui/import-health.ts` | `817f50ae7dab6c092d13f342cb0f33edc82c0c53` |

Os três paths de teste são relativos a `modules/sucafina/Sucafinav1/`. O último path é relativo à raiz e contém a comparação de identidade `Object.is` em lugar da comparação de interfaces TS2367. Os blobs são confrontados tanto com a fonte Git quanto com os bytes presentes no checkout.

As listas esperadas dos observers recebem somente tipos derivados do retorno original; Budget recebe o construtor canônico de caminho absoluto para o diretório realmente criado. Nenhuma assertion, valor esperado, política, host, segredo, schema, runtime/application, deadline ou baseline foi modificado pelo controle.

## Workflow temporário

- Workflow canônico de origem: `75af315fb7084eb7f95542e6281cc7ae7b6167c8`.
- Workflow com **uma única adição de step**, +111/-0: `a1f3730387eb75b2b4731ff2cf210465119730c4`.
- Config temporário: `b5e2c41c45a419395d1fd67d9bda8639fe4804fc`.
- O step fica imediatamente antes do bloco original `Run tests`. Remover sua adição reproduz integralmente o workflow de origem.
- Ele só admite `refs/heads/ci-run-linux-sfc-fixture-types`, repo exato, push novo, attempt 1, Linux X64, after/HEAD exatos, before zero, created verdadeiro, forced/deleted falsos e parent único exatamente `236a170...`.
- O diff do snapshot contra a fonte deve conter **exatamente** `.ci-run.json`, `.github/workflows/test-ci.yml` e o novo config. A documentação desta branch de controle não pertence a esse diff.
- O request bruto no commit e o request normalizado pelo validador original são verificados integralmente.
- O runner executa uma vez `bun run typecheck`. Toda a saída stdout/stderr segue para o log Actions. O status não zero original permanece fatal.
- A lista real do compilador deve conter os três fixtures e o produtor `import-health.ts`; ausência de qualquer um também é fatal, mesmo se o compilador retornar zero.
- O log contém o recibo estruturado `SF_NATIVE_FIXTURE_TYPES`, e o job summary registra source/snapshot/status/contagem de inclusão. A contagem não é baseline, coverage ou aceitação global.
- Os arquivos `test-ci-evidence/fixture-types.json` e `fixture-types.log` são escritos no runner, mas o workflow canônico não os inclui em um upload próprio. A evidência durável desta etapa é o log e o summary Actions; **não há alegação de artefato novo**.
- Falha nessa etapa impede o `Run tests` posterior pelo comportamento normal de Actions. Os passos canônicos de seleção, guard-context, runner, relatório, upload e cleanup não são alterados. O snapshot ampliado não solicita nem simula a aprovação protected-paths de um PR.

## Request canônico proposto

```json
{
  "package": "sucafina",
  "runner": "bun",
  "args": [
    "--timeout",
    "120000",
    "Sucafinav1/test/native-ui-contract/asset-health.test.ts",
    "Sucafinav1/test/native-ui-contract/import-health.test.ts",
    "Sucafinav1/test/native-ui-contract/budget-deviation-projection.test.ts"
  ],
  "env": {
    "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER": "1"
  }
}
```

O orçamento Bun de 120000 é o default original do request e o usado neste tipo de gate, não um aumento. Não há filtro de nome, skip, retry, Playwright ou serviço de porta neste recorte.

## Como executar e interpretar — somente a raiz

1. Revise a fonte `236a170...` e os dois blobs de controle acima.
2. Crie um snapshot **filho direto da fonte**, copiando somente o workflow temporário, o config e o request exato. Não use o commit/head desta branch de controle como parent.
3. Publique somente quando houver slot, na branch exata fixada pelo step. Este agente não criou nenhum ci-run nem disparou workflow.
4. Registre snapshot, run, typecheck status, a inclusão 4/4, resultados reais dos três fixtures e cleanup. Só success do checker e dos testes qualifica os quatro deltas da fonte para esse escopo.
5. Qualquer erro de compilação transitivo é erro real e encerra o gate. AM02, analysis-stale-calculation e demais arquivos não alcançados continuam sem qualificação integral; não são declarados corrigidos ou ignorados por este controle.
6. Integre somente os deltas legítimos de produto/fixtures e documentação da fonte, após a qualificação. **Nunca integre este workflow temporário ou config**, nem mova a branch de controle para o candidato final.

## Revisão e limites

Foi feita revisão estática dos scripts, config original, validador canônico, diff da fonte e readback dos dois blobs publicados via GitHub. O compare do controle contém exatamente os dois arquivos previstos. Nenhum shell, teste local, tipo local, dispatch, PR, merge, baseline, pacote, GO ou deploy foi executado. A revisão independente de `/root/reports_failure` leu os dois hunks de `5ea24aae`, confirmou os pins, o checker canônico, os quatro inputs em `--listFiles`, a propagação de falhas e a criação prévia do diretório de evidência pelo workflow original. Não identificou bloqueio estático; reforçou que o snapshot deve ser filho direto de `236a170...` e conter somente request/config/workflow. Essa revisão não executou nada e não afirma resultado dinâmico.
