# HANDOFF — final-ci-preparation / tentativa 01

**Estado: PREPARED_STATICALLY_VALIDATED_NOT_RUN.** A entrega desta missão é a preparação
executável do bundle final. S0 conserva composição, freezeC, execução final e aceite.

- Repo: `gustavomhss/Orchestra-SF`; branch `astra-compose`; PR #32, base `sf2-stack`.
- Head reconciliado antes de publicar: `9048e0e65351a5bd80768458a79fed94a4993db7`;
  tree `f073278e9fb11ca93b129c16331460e1fb6e25c4`. História, produto W17 e recibos anteriores preservados.
- Missão em `c708ec0609dbfc95b259707d8c38481617f74f11`; pack S0-C e anexos
  do planejamento `dbf9547211d9b0fade619790de7c19c0869b7c7d` lidos.
- Consulta do head/PR e dos runs da própria branch repetida antes da publicação; nenhum run dessa branch observado.
  A missão atribui estes novos paths. Não houve substituição de escritor de produto por inferência de silêncio.
- O commit que contém este handoff é a publicação da preparação; seu SHA será registrado na descrição da PR,
  sem inserir identidade autorreferente neste arquivo.

## Entrega

`.github/workflows/sf2-epic.yml`, builder portável, manifesto das oito requests,
admissão estática canônica, validadores de evidência Playwright/JUnit e procedimento S0 em
`script/sf2h/final-bundle/`. A lista de arquivos e hashes está em `files.json`;
fontes, blobs e hashes em `provenance.json`.

Workflow original reproduzido exatamente: **50.332 bytes**,
SHA256 `87aeb489a441ed24cd823c747748bff53053831b7307e4e94ab85ddf8e714c4c`.
Workflow preparado: SHA256 `cd2c4ec908967a745101dc0b41689eb323a822c75a775f7ac263e9c020bb1ed8`.
Mudanças delimitadas ao job recipe; oito demais jobs e matrix obrigatória preservados.
Todos os sete artefatos originais permanecem rastreáveis no commit de missão.

Os recibos futuros identificam C e seu tree; as recipes materializam request no checkout,
com `ci_snapshot_sha=null`. Esta adaptação não cria snapshots S nem autoriza reatribuir
evidência cirúrgica antiga. Omni, E2E completo, suites herdadas, cinco typechecks e guards mantidos.

## Verificações realmente executadas

| Verificação | Resultado |
| --- | --- |
| Regeração inicial com fontes atuais | MATCH byte a byte do workflow original |
| Regeração final e `build-artifact.py --check` | PASS |
| Parsing YAML / estrutura | PASS; trigger exclusivo, permissões e oito seleções preservados |
| Bash de 62 run steps | PASS em `bash -n` |
| Dois heredocs + cinco snippets JS embutidos | PASS em `node --check` |
| Dois scripts Python + dois módulos JS | PASS de sintaxe |
| 73 cópias de inputs vs Git blobs remotos | PASS, zero divergências |
| Admissão estática dos oito requests pelo código canônico | Cinco VALID; três BLOCKED por specs finais ausentes |
| Checks de JSON/XML sintético dos helpers | 12 + 15 PASS reportados pelos executores; somente validação de dados |
| actionlint | NOT_RUN: executável indisponível |
| Bun typechecks, generate/check:generated Atlas, spawn guard, guards | NOT_RUN: Bun indisponível; CI não autorizado nesta missão |
| Testes de produto / CI / epic | NOT_RUN |
| AM01–AM06, pareceres finais e C/G7 / D/G8 | NOT_RUN nesta missão |

Os dados sintéticos validam apenas o tratamento dos reports; não exercitam produto, Bun ou
Playwright. A revisão `review.json` é de preparação e não substitui os três pareceres finais.

## Pendências e próxima ação executável

No head examinado faltam:

- `packages/app-shell/e2e/sucafina/operations.spec.ts`;
- `packages/app-shell/e2e/sucafina/decisions.spec.ts`;
- `packages/app-shell/e2e/sucafina/reports.spec.ts`.

As três sessões designadas entregam esses specs e a prova de seus consumidores reais.
Não foram escritos ou alterados por esta missão. Configuração e fixtures compartilhados
continuam nos blobs examinados. A config de produção teve deriva anterior conhecida;
o novo hash está preservado na proveniência, sem editar seu host WP04 condicional.

**S0:** incorporar as entregas, reconciliar consumidores/configuração e a documentação
normativa, então executar na raiz do checkout completo:

```bash
python3 script/sf2h/final-bundle/build-artifact.py --repo-root . --check
node script/sf2h/final-bundle/validate-requests.mjs
```

Após freezeC e dedupe da chave completa, S0 pode executar o procedimento GitHub MCP
descrito em `script/sf2h/final-bundle/README.md`: ref final aponta diretamente C,
run confirmado por SHA/path/evento, coleta de todas as recipes/jobs/logs/artifacts e gates.
Qualquer falha de CAS ou readiness exige reconciliação; nenhum force/reset ou novo dispatcher.

**C/G7 e D/G8 continuam separados.** Esta pasta de preparação entra antes de freezeC e não
é prefixo permitido do envelope D. D preserva todos os inputs de C, incorpora apenas evidências
admitidas e recebe guard próprio no checkout real D; publicar o resultado fora de D.
Nenhum C/D ou GLOBAL_RELEASE foi declarado.

## Limites de escrita e execução

A publicação adiciona somente o YAML autorizado, `script/sf2h/final-bundle/` e esta tentativa.
Nenhum merge, nova branch/PR, comentário a terceiros, label epic, dispatch, CI, habilitação
de workflows alheios, deploy/schedule, instalação de infraestrutura ou alteração de produto foi realizado.
