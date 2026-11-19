# Runbook operacional — consolidação Orchestra-SF

Este documento transforma o plano canônico em passos executáveis. Ele não autoriza deploy, VM ou GO.

## 1. Papéis

| Papel | Responsabilidade | Permissão de escrita |
|---|---|---|
| Coordenador | fixa base, distribui escopo, mantém estado da campanha | docs/ledger |
| Miner | lê PRs, classifica paths, produz evidência | nenhuma na branch do bundle |
| Integrador | único writer do bundle | branch do bundle |
| CI triager | baixa logs, agrupa assinaturas, identifica owner | docs/PR; código somente via integrador |
| Revisor A | semântica, segurança, dados | nenhuma |
| Revisor B | integração, duplicação, escopo | nenhuma |
| Dono | decisões bloqueantes e GO/NO-GO | decisão explícita |

Nunca existem dois integradores simultâneos no mesmo bundle.

---

## 2. Preparação da campanha

### 2.1 Variáveis

```bash
set -euo pipefail

export REPO=gustavomhss/Orchestra-SF
export BASE_BRANCH=close-final-candidate
export PROMOTION_PR=237
export WORKDIR="$PWD/orchestra-sf-consolidation"
```

### 2.2 Capturar base

```bash
export BASE_EXPECTED="$(gh api repos/$REPO/git/ref/heads/$BASE_BRANCH --jq .object.sha)"
test -n "$BASE_EXPECTED"
printf 'BASE_EXPECTED=%s\n' "$BASE_EXPECTED"
```

Registrar no PR da campanha e no ledger.

### 2.3 Confirmar runner e política

Verificar `.github/workflows/sf-ci.yml` no mesmo SHA. Não assumir que nomes de jobs ou branches de trigger permaneceram iguais.

### 2.4 Criar clone de análise

Git é usado para inspeção, diff e criação de commits. Testes locais continuam proibidos.

```bash
git clone "https://github.com/$REPO.git" "$WORKDIR"
cd "$WORKDIR"
git fetch --all --prune
git checkout --detach "$BASE_EXPECTED"
```

---

## 3. Snapshot completo da fila

### 3.1 Listar todos os PRs

```bash
gh pr list \
  --repo "$REPO" \
  --state open \
  --limit 1000 \
  --json number,title,isDraft,state,baseRefName,headRefName,headRefOid,author,updatedAt \
  > /tmp/orchestra-sf-open-prs.json
```

Verificar:

```bash
jq 'length' /tmp/orchestra-sf-open-prs.json
jq 'map(.number) | unique | length' /tmp/orchestra-sf-open-prs.json
```

Os dois números devem coincidir.

### 3.2 Snapshot por PR

Para cada PR:

```bash
PR=123

gh pr view "$PR" \
  --repo "$REPO" \
  --json number,title,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid,mergeable,mergeStateStatus,files,commits,statusCheckRollup \
  > "/tmp/pr-$PR.json"
```

Se `files` for truncado pela ferramenta utilizada, paginar a REST API até não haver próxima página.

### 3.3 Pin da branch

```bash
SOURCE_HEAD="$(jq -r .headRefOid "/tmp/pr-$PR.json")"
SOURCE_BRANCH="$(jq -r .headRefName "/tmp/pr-$PR.json")"

REMOTE_HEAD="$(git ls-remote origin "refs/heads/$SOURCE_BRANCH" | awk '{print $1}')"

if [ -z "$REMOTE_HEAD" ]; then
  disposition=BLOCKED_MISSING_BRANCH
elif [ "$REMOTE_HEAD" != "$SOURCE_HEAD" ]; then
  echo "HEAD_REF_DIVERGENCE pr=$PR api=$SOURCE_HEAD branch=$REMOTE_HEAD" >&2
  exit 1
fi
```

### 3.4 Fetch read-only

```bash
git fetch origin "$SOURCE_HEAD:refs/review/pr-$PR"
git cat-file -e "$SOURCE_HEAD^{commit}"
```

Nunca fazer checkout e push na branch histórica.

---

## 4. Classificação de um source PR

### 4.1 Prova 1 — ancestralidade

```bash
if git merge-base --is-ancestor "$SOURCE_HEAD" "$BASE_EXPECTED"; then
  disposition=ABSORBED_ANCESTOR
fi
```

### 4.2 Prova 2 — diff final vazio

```bash
if git diff --quiet "$BASE_EXPECTED...$SOURCE_HEAD"; then
  disposition=ABSORBED_PATCH
fi
```

Não usar este teste sozinho para branch empilhada sem inspecionar base/ancestry.

### 4.3 Construir o superset candidato

```bash
SOURCE_MB="$(git merge-base "$BASE_EXPECTED" "$SOURCE_HEAD")"
git diff --name-status "$SOURCE_MB..$SOURCE_HEAD" > "/tmp/pr-$PR-name-status.txt"
git diff --binary "$SOURCE_MB..$SOURCE_HEAD" > "/tmp/pr-$PR-candidate.patch"
```

Nome correto: `SOURCE_CANDIDATE_SUPERSET`.

### 4.4 Classificação por path

Para cada path:

1. descobrir status: add/modify/delete/rename;
2. comparar blob final;
3. comparar ausência;
4. calcular patch-id do commit ou patch focal;
5. inspecionar dependências;
6. atribuir owner;
7. registrar evidência.

Exemplo de blob:

```bash
PATH_TO_CHECK='packages/app-shell/example.ts'

source_blob="$(git rev-parse "$SOURCE_HEAD:$PATH_TO_CHECK" 2>/dev/null || true)"
base_blob="$(git rev-parse "$BASE_EXPECTED:$PATH_TO_CHECK" 2>/dev/null || true)"

if [ -n "$source_blob" ] && [ "$source_blob" = "$base_blob" ]; then
  disposition=ABSORBED_BLOB
fi
```

Exemplo de deleção:

```bash
source_exists="$(git cat-file -e "$SOURCE_HEAD:$PATH_TO_CHECK" 2>/dev/null && echo yes || echo no)"
base_exists="$(git cat-file -e "$BASE_EXPECTED:$PATH_TO_CHECK" 2>/dev/null && echo yes || echo no)"

if [ "$source_exists" = no ] && [ "$base_exists" = no ]; then
  disposition=ABSORBED_BLOB
fi
```

### 4.5 Patch-id

```bash
git show --pretty=email --binary "$SOURCE_HEAD" | git patch-id --stable
```

Patch-id é evidência de equivalência textual de patch, não prova de equivalência semântica completa.

### 4.6 Duplicidade de head

```bash
jq -r 'group_by(.headRefOid)[] | select(length > 1) | map({number,baseRefName,headRefName,headRefOid})' \
  /tmp/orchestra-sf-open-prs.json
```

Mesmo head com bases diferentes exige escolha de rota; não mergear ambos.

### 4.7 Arquivo misto

Usar hunk apenas quando o path inteiro não pode ser classificado.

Gerar patch focal:

```bash
git diff "$SOURCE_MB..$SOURCE_HEAD" -- "$PATH_TO_CHECK" > /tmp/path.patch
sha256sum /tmp/path.patch
```

Registrar `hunk_id` e contexto suficiente para revisão posterior.

---

## 5. Escrita do ledger

Cada linha é um JSON válido conforme `ledger.schema.json`.

Validação recomendada:

```bash
while IFS= read -r line; do
  printf '%s\n' "$line" | jq -e . >/dev/null
done < docs/qa/sucafina/consolidation/consolidation-ledger.jsonl
```

O ledger real não deve usar os registros de `ledger.example.jsonl` como fatos.

Campos obrigatórios mínimos:

- source PR/head/base/branch;
- path;
- bundle;
- disposition;
- status;
- evidência;
- owner;
- timestamp;
- close readiness.

---

## 6. Preparação de um bundle

### 6.1 Lease inicial

```bash
current="$(gh api repos/$REPO/git/ref/heads/$BASE_BRANCH --jq .object.sha)"
test "$current" = "$BASE_EXPECTED"
```

### 6.2 Criar branch

```bash
BUNDLE_BRANCH=consolidate/00-baseline-green

git checkout --detach "$BASE_EXPECTED"
git switch -c "$BUNDLE_BRANCH"
git push origin "$BUNDLE_BRANCH"
```

### 6.3 Abrir PR draft

```bash
gh pr create \
  --repo "$REPO" \
  --base "$BASE_BRANCH" \
  --head "$BUNDLE_BRANCH" \
  --draft \
  --title "fix(sf): consolidate B0 baseline" \
  --body-file /tmp/bundle-body.md
```

### 6.4 PR body mínimo

O body deve conter:

- `BASE_EXPECTED`;
- bundle;
- ownership;
- source PRs;
- paths;
- dispositions;
- checkpoints;
- stop conditions;
- CI exigido;
- ledger path;
- declaração de nenhum teste local;
- declaração de nenhum merge/close automático.

---

## 7. Portar conteúdo

### 7.1 Regra

Não cherry-pickar branch empilhada inteira.

Preferir:

1. reimplementar a intenção sobre o código atual;
2. aplicar patch focal revisado;
3. cherry-pickar commit somente quando ele for atômico, isolado e livre de ancestry indevida.

### 7.2 Trailer de commit

```text
Source-PR: #123
Source-Head: <sha>
Ledger-Record: <record_id>
Disposition: REPLAY
Bundle: B1
```

### 7.3 Checkpoint

Após cada subescopo:

```bash
git status --short
git diff "$BASE_EXPECTED...HEAD" --stat
git log --oneline "$BASE_EXPECTED..HEAD"
git push origin "$BUNDLE_BRANCH"
```

Não rodar Bun localmente.

---

## 8. CI

### 8.1 Coletar checks

```bash
gh pr checks "$BUNDLE_PR" --repo "$REPO"
```

### 8.2 Encontrar runs

```bash
gh run list \
  --repo "$REPO" \
  --branch "$BUNDLE_BRANCH" \
  --limit 20
```

### 8.3 Baixar falhas

```bash
RUN_ID=...
gh run view "$RUN_ID" --repo "$REPO" --log-failed > "/tmp/run-$RUN_ID-failed.log"
```

### 8.4 Classificação da falha

Para cada falha:

1. job;
2. step;
3. erro primário;
4. primeiro arquivo do bundle envolvido;
5. assinatura;
6. baseline atual;
7. owner;
8. ação.

Classes:

- `OWN_CODE`
- `OWN_TEST`
- `BASELINE_B0`
- `INFRA_TRANSIENT`
- `CANCELLED_BY_CONCURRENCY`
- `OWNER_DECISION`
- `UNKNOWN`

`UNKNOWN` bloqueia merge.

### 8.5 Infra transient

Rerun permitido uma vez no mesmo head quando a assinatura for registry, network, runner ou artifact service.

```bash
gh run rerun "$RUN_ID" --repo "$REPO" --failed
```

Registrar primeira e segunda execução. Não apagar evidência.

### 8.6 Vermelho compartilhado

Depois de B0, a categoria deixa de existir. Um vermelho reproduzido na base indica que a base não estava verde e a campanha deve parar.

---

## 9. Cold review

### 9.1 Fixar SHA

```bash
BUNDLE_HEAD="$(gh pr view "$BUNDLE_PR" --repo "$REPO" --json headRefOid --jq .headRefOid)"
```

Ambos os revisores precisam citar esse SHA.

### 9.2 Checklist do Revisor A

- auth/origin/provenance;
- dados e invariantes;
- guards;
- comportamento fail-closed;
- decisão de produto;
- receipts;
- paths protegidos.

### 9.3 Checklist do Revisor B

- duplicação;
- ancestry;
- escopo;
- ownership;
- código morto;
- fixtures;
- CI;
- rollback.

Mudança depois da review invalida a review.

---

## 10. Merge

### 10.1 Lease final

```bash
current="$(gh api repos/$REPO/git/ref/heads/$BASE_BRANCH --jq .object.sha)"
test "$current" = "$BASE_EXPECTED"
```

### 10.2 Confirmar head

```bash
actual_head="$(gh pr view "$BUNDLE_PR" --repo "$REPO" --json headRefOid --jq .headRefOid)"
test "$actual_head" = "$BUNDLE_HEAD"
```

### 10.3 Confirmar checks

```bash
gh pr checks "$BUNDLE_PR" --repo "$REPO" --required
```

Se o repositório ainda não possuir required checks formais, comparar explicitamente a lista do workflow/verify.

### 10.4 Merge serial

Mergear um bundle por vez. Após o merge:

```bash
BASE_EXPECTED="$(gh api repos/$REPO/git/ref/heads/$BASE_BRANCH --jq .object.sha)"
printf 'NEW_BASE=%s\n' "$BASE_EXPECTED"
```

Nunca iniciar o próximo bundle com o SHA antigo.

---

## 11. Fechar source PRs

### 11.1 Reprovar residual

Para cada source PR associado ao bundle:

```bash
git fetch origin "$BASE_EXPECTED"
git diff --quiet "$BASE_EXPECTED...$SOURCE_HEAD" || true
```

O diff bruto não basta. Revalidar os registros do ledger por path/hunk.

### 11.2 Critério

Fechar somente quando:

- todos os registros do PR estão terminais;
- nenhum `REPLAY` pendente;
- nenhum `BLOCKED` escondido;
- residual útil zero;
- `close_ready=true`.

### 11.3 Comentário

Usar o modelo do plano canônico. Não alegar que o PR “mergeou” quando houve replay/supersession.

---

## 12. Rollback

### 12.1 Antes do merge

Fechar ou abandonar o bundle; a base permanece intacta.

### 12.2 Depois do merge

Se regressão crítica:

1. parar a campanha;
2. fixar SHA ruim e SHA anterior;
3. identificar checkpoint causador;
4. criar revert PR específico;
5. rodar full CI no revert;
6. mergear o revert;
7. atualizar ledger;
8. reabrir o bundle com correção limpa.

Não fazer force-push na base.

---

## 13. Entregável de cada bundle

Publicar no PR:

```text
Bundle:
BASE_START:
BUNDLE_HEAD:
MERGE_REF:
BASE_END:

Source PRs:
Records ported:
Records absorbed:
Records superseded:
Records blocked:

Commits/checkpoints:
CI runs:
Reruns:
Cold review A:
Cold review B:
Owner decisions:
Merge SHA:
PRs close-ready:
PRs remaining:
```

---

## 14. Entregável final da campanha

- ledger terminal;
- quatro PRs de bundle;
- tabela source PR → bundle/commit/disposição;
- lista de blockers;
- lista de branches preservadas;
- SHA final;
- merge ref do #237;
- artifact digest;
- receipts;
- UAT;
- rollback;
- GO/NO-GO.
