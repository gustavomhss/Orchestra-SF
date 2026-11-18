# Missão 236 — procedimento executável de G7 em C e G8 em D (NÃO EXECUTADO)

**Fontes:** plano imutável `dbf9547211d9b0fade619790de7c19c0869b7c7d` (`execution/COMMON.md`, `WP10.T04/T05`, `ci-recipes.json`), produto-base `998f0afd6047409956418f40c570dc9c48dc6c8f`, proposta 228 `33474b2158a4703f256191f61f1a16ac85c26004` (inert), último handoff CI 232 `ad330d3ce08649671aae5c7e6aa3b3f40e446c72`.

**Estado:** C formal = **não definido**, D = **não criado**, G7 = **NOT_RUN**, G8 = **NOT_RUN**. Isto é uma receita de execução para os responsáveis já autorizados, não um comando executado pela 236, não atribui dispatcher nem cria supervisor. A própria pasta `receipts/closure236/` é preparação **pré-freeze** e NÃO pertence aos quinze prefixos admitidos para adicionar arquivos novos em D.

## 1. Formar e aceitar C antes de G7

211/S0 consome somente os postimages autorizados e reconciliados, incluindo o detached 228 (70 propostas, oito conflitos), e handoffs reais 224/229/230/231. O produto final deve incluir código, testes, fixtures, manifests, quatro gerados Atlas, skills/prompts, assets, README com guia/roteiro/changelog. Produzir um commit imutável C e seu hash de árvore, com origem dos blobs e registro de freeze. Sem integração, nenhuma elegibilidade.

Dispatcher único **expressamente autorizado** assume a fila 232, reconcilia runs existentes por chave C/tree/request/workflow/validator/runtime/config/fixtures/seleção, só então executa as 19 seleções causais quando houver W material e as oito finais + epic/E2E e demais suites devidas quando S0 aceitar C. Para cada run: registrar head e snapshot S (se usado), ids/attempt/jobs, arquivos e contagens realmente selecionados (não zero), Omni, artifacts, logs e conclusão. AM01–AM06 precisam de positivos **nativos** e negativos no mesmo C; três julgamentos independentes **finais** sem autoria, sem finding obrigatório aberto. Não reatribuir histórico verde/falha de outro SHA.

## 2. G7 — exclusivamente no checkout real de C, proprietário 190/WP10.T04

Executor autorizado, já com checkout local válido **naquele** commit (sem `git fetch`, `git push`, novo token ou workflow da 236), grava a observação do ambiente e roda **separadamente**:

```sh
git rev-parse HEAD
git rev-parse HEAD^{tree}
git rev-parse origin/dev
bun run check:guards --base origin/dev
```

Verificar `HEAD == C_ACEITO` e árvore == árvore congelada **ANTES** do comando. Guard precisa de código/configuração originais; registrar comando, commit C, tree, SHA real de `origin/dev` local, source digests das regras, stdout/stderr, exit code, artefato e seu hash, executor, run/attempt/URL. Se base inexistente, engine ausente, output incompleto, erro ou exit !=0, **BLOCKED/FAIL**, nunca PASS. Completar também gerador/check:generated/typecheck/guards de spawn/epic/AM/3 final reviews; não inferir do guard isolado que G7 inteiro passou. Qualquer mudança material cria C novo e requalificação causal.

## 3. Somente após G7 aprovado: alocação e D

S0 publica em `sf2-control` **antes** de criar D um registro imutável com `execution_instance`, `C`, `expected_parent`, `attempt`, e cada **path completo** de recibo de controle autorizado. Branch de controle jamais é mergeada em D. S0 parte de C e incorpora somente **novos** `.json/.md/.txt` UTF-8 de evidência, `100644`, dentro de `docs/sf2h/receipts/WP00/` a `WP14/` ou paths exatos pré-alocados. Não modificar, remover, renomear, trocar mode ou substituir qualquer blob de C. Logs e recibos antigos ficam intocados; novos arquivos não podem participar de import, registry, glob, geração, teste, build ou runtime.

O executor/verificador autorizado, com os objetos C e D já presentes em checkout (nenhuma operação remota da 236), captura **integramente** a árvore/diff, não usa truncamento de resposta, e arquiva o resultado fora de D:

```sh
git rev-parse HEAD
git rev-parse HEAD^{tree}
git merge-base --is-ancestor "$ACCEPTED_C" "$PROPOSED_D"
git diff-tree -r --raw -z --no-commit-id "$ACCEPTED_C" "$PROPOSED_D" > envelope-c-to-d.raw.z
git ls-tree -r -z "$ACCEPTED_C" > c-complete-tree.z
git ls-tree -r -z "$PROPOSED_D" > d-complete-tree.z
```

Os três arquivos acima são **artefatos locais temporários do verificador autorizado**, não arquivos a escrever em D ou em caminhos de produto. Um verificador de diff completo precisa examinar todos os registros NUL do raw/tree e recusar: ancestralidade inválida, alteração de preexisting path/mode/blob, deletions/renames, submodules/symlinks, traversal, extensões/modes/encoding proibidos, destinos não pré-alocados, qualquer input novo de produto/build/test/runtime ou dependência desconhecida. Exigir preservação de todos blobs de C e índice dos novos com blob hashes, source/run IDs, provas no C. Não se trata apenas de grep de paths no diff. Sem comprovante completo, **FAIL CLOSED**.

O recibo interno de D aponta `C`, árvore C, paths/hashes das outras evidências e allocation record; **não** inclui próprio blob hash, SHA futuro de D nem resultado posterior G8.

## 4. G8 — somente no checkout real de D, proprietário S0/WP10.T05/190

Em checkout **diferente ou novamente posicionado exatamente em D** e só após envelope comprovado:

```sh
git rev-parse HEAD
git rev-parse HEAD^{tree}
git rev-parse origin/dev
bun run check:guards --base origin/dev
```

Exigir `HEAD == D_PROPOSTO`; guardar independentemente commit D, tree D, `origin/dev`, logs, exit code, artifacts/digests e diff completo. **Nunca** reutilizar o log G7 de C para preencher G8 em D, nem o inverso. O resultado do guard de D e SHA do commit D devem ser publicados **depois**, em fechamento **externo** por S0, sem editar o D para autorreferência. Se falhar, D não é aceito; se houver alteração de produto, reclassificar como C novo.

## 5. Retenção e limite material

A 236 reconciliou metadados GitHub de **55/55 blobs e tamanhos presentes em `998f0afd6047409956418f40c570dc9c48dc6c8f`**, em 20 diretórios, contra `archive210/INDEX-210.json`; **zero exclusão**. A 210 já registrara 55 readbacks completos no W histórico. Isto **não** prova consumidores dinâmicos. B210-01..04 continuam abertos, inclusive divergência do preimage `rolling-intake-42/reports36-semantic-review.json`. O adapter e patch de leitura que já existem em `archive210` permanecem **inertes**; não criar outra implementação e não remover logs. Histórico 163/190/232 de outro SHA não prova G7 ou G8.

**Pedidos:** `CI-DISPATCH-REQUESTS.json` preserva as 27 requisições exatas da 232, todas `NOT_RUN`. `C-D-TRACE.json` identifica gates, donos e recursos. Sem C aceito, sem G7 PASS e sem D verificado, `GLOBAL_RELEASE=false` e campanha continua `CONTINUING_LATE`.
