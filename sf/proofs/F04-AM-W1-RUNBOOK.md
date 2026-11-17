# A9 / F04–AM | Runbook fail-closed (W1 preparado; execução W4 NÃO REALIZADA)

> **ADENDO OPERACIONAL (2026-11-16):** este runbook W1 preserva o inventário histórico. Para as instruções executáveis e os paths reais dos dois produtores, usar **sf/proofs/F04-AM-C-GATE-CHECKLIST.md** (checklist único ordenado) e **sf/proofs/go-no-go-bundle.template.json**. A factory agora é **bin/local/entry.mjs** de um tar extraído fora do checkout, instalado como **/opt/orchestra-sf/releases/<C>/factory/installation.mjs** com os 24 assets em **/product/ai**; o CLI é **/opt/orchestra-sf/releases/<C>/bin/orchestra** originado de **orchestra-sf-linux-<C>**. Recibo factory com sourceSHA/checkoutSHA diferente de HEAD C ou do run.headSha é **RED**; não aceitar o PR run 43988598685 como qualificação de C. O workflow factory em Ubuntu não comprova Entra, F04, AM ou Azure. Dono: Daniel França; vault/MI já informados, execução de host e atores ainda BLOQUEADA.


**Data:** 2026-11-16. **Nesta W1:** planejamento e inventário apenas. **AZ-04/05 = BLOCKED_BY_ENV**, U39/U40, AM01–AM06 e restore Linux = **NOT_RUN**. Documento NÃO autoriza VM, Entra, deploy, fabricação de manifesto nem execução. Ler `F04-AM-W1-MATRIX.md` para inventário das oito recipes, casos e testes sob lease.

## 1. Caminho crítico e critérios de entrada

| Ordem | Entrega exigida | DRI, decisão/resultado mínimo |
|---|---|---|
| 0 | C congelado com HEAD/tree, artifact SHA256, source/release digests | A10 freeze, A6 integração, dono decide merge; sem C ⇒ BLOCKED_BY_OWNER |
| 1 | Doze jobs de CI Linux em C (preflight/static/Omni/5 Bun/3 UI/verify) e 8 receipts | A2 gate/manifest, A6 YAML/equivalência B3, A1 valida jobs; nenhum skip, runner Linux/X64 |
| 2 | SF Web app de C instalado em Azure VM Linux x86_64, HTTPS funcional | A7 AZ-01/03 e dono da VM; foundation com Caddy 503 não é instalação |
| 3 | Tenant Microsoft Entra/OIDC, cookies/CSRF/sessão reais, Task/Permission/Relay, owner/projeto/instalação, CAS/revogação | A8 AZ-02 + dono provisiona usuários reais; role flags/storageState falso são proibidos |
| 4 | Instalador autorizado publica `sf2h.native-installed-manifest.v1` privado e CDP browser host real | A7/A8/operador; A9 só verifica; file 0600/root 0700 sem symlinks, owner e candidate C |
| 5 | X/Y/Z do PR #240 revisados, bindings CAP04/05 independentes | A5 único editor U39/U40/selected-installation; A9 apenas executa |
| 6 | Q01 F04×3, U39×22, U40×22, AM01–06, 8 recipes, Linux restore | A9 executa **somente após 0–5**, A7 testemunha restore, A1/A10 recebe |
| 7 | Três revisores frios, release protegido, autorização expressa | A1/A10/dono; A9 não assina seu próprio aceite |

Qualquer mudança de C, árvore de fonte, workflow, test/fixture, artefato instalado ou auth/origem material reabre freeze e invalida provas prévias.

## 2. Pré-verificação no executor Linux *já autorizado* (futuro)

O próprio GitHub Actions precisa fornecer identidade. **Jamais setar `GITHUB_ACTIONS=true` artificialmente nem passar token/actor/fake cookie para convencer a fixture.** O processo instalado fornece browsers com Microsoft-authenticated BrowserContext via endpoint privado CDP local, que `installed-browser.ts` apenas anexa (não lança browser nem importa storageState).

```bash
set -euo pipefail
test "$GITHUB_ACTIONS" = true
test "$RUNNER_OS" = Linux
test "$RUNNER_ARCH" = X64
test "$(uname -s)" = Linux
test "$(uname -m)" = x86_64
test -n "$SF_NATIVE_CANDIDATE_SHA"
test "$(git rev-parse HEAD)" = "$SF_NATIVE_CANDIDATE_SHA"
git rev-parse 'HEAD^{tree}'
git status --short
node --version
bun --version
test -n "$SF_NATIVE_INSTALLED_MANIFEST"
test -f "$SF_NATIVE_INSTALLED_MANIFEST"
stat -c '%a %U %n' "$SF_NATIVE_INSTALLED_MANIFEST"
# readNativeManifest valida ainda: absolute, regular, 0600, owner, 0700,
# sem symlink, C, target + wrongServer/wrongProject/wrongInstallation distintos.
```

Relatar preflight como `PREREQUISITES_OBSERVED`, **não** PASS F04. Não logar conteúdo do manifest, atores, secrets, headers, dados de negócio ou CDP URL. A8 comprova `readNativeManifest`, `observeNativeBinding`, `requireNativeJourney` com fonte original. Para U39/U40, A5 mantém `sf2h.native-selected-installation.v1` privado: suites U39/U40 têm caso `entry`, CAP04/05 e `year=2026`; `chapterHref` precisa corresponder ao binding real de cada uma.

## 3. Comandos release-only previstos no contrato A9

**Transcrição de comandos PREPARADOS, NÃO EXECUTADOS.** Usar somente runner protegido com artifact C instalado, F04 emitido, sessões reais já autenticadas e prova de fonte/owner.

```bash
(cd packages/app-shell &&
  bun test --conditions=browser \
    --preload ../../script/test-omni-control.ts \
    --preload ./happydom.ts \
    ./test-browser/sucafina-native/transport-integration.test.ts)
(cd packages/app-shell &&
  bun run test:e2e:local e2e/sucafina/native/journeys/u39.spec.ts \
    --config e2e/playwright.production.config.ts --workers 1 --retries 0)
(cd packages/app-shell &&
  bun run test:e2e:local e2e/sucafina/native/journeys/u40.spec.ts \
    --config e2e/playwright.production.config.ts --workers 1 --retries 0)
```

Exigir seleção exata 3 Q01 e 22 U39 + 22 U40 casos (revalidar contra C), zero retries/skips/todo e asserts não enfraquecidos. Q01-guest e invalid-owner exercitam HTTP sem actor; stale-fence exige **zero chamadas** por generation obsoleta (preflight client-side, não request live). U39 e U40 usam **bindings CAP04/CAP05 distintos**: não editar surfaceId, chapterHref ou claims para passar. Se o autor A5 corrigir as specs, refreeze e rerun.

## 4. AM01–AM06: não confundir unit tests com execução nativa

No checkout de C enumerar os 19 arquivos `*.test.ts` em `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am0[1-6]/`: AM01=3, AM02=2, AM03=3, AM04=3, AM05=4 (**sequence-integrity216.test.ts é exclusivo A5**), AM06=4. São 2 helpers sem `.test.ts` (`am02/observe-native-c16.ts`, `am06/correlate.ts`). Testes dinâmicos precisam contar casos reais; o filename não é contagem de execução.

```bash
git ls-files -- \
  'modules/sucafina/Sucafinav1/test/product/integrated-proofs/am01/*.test.ts' \
  'modules/sucafina/Sucafinav1/test/product/integrated-proofs/am02/*.test.ts' \
  'modules/sucafina/Sucafinav1/test/product/integrated-proofs/am03/*.test.ts' \
  'modules/sucafina/Sucafinav1/test/product/integrated-proofs/am04/*.test.ts' \
  'modules/sucafina/Sucafinav1/test/product/integrated-proofs/am05/*.test.ts' \
  'modules/sucafina/Sucafinav1/test/product/integrated-proofs/am06/*.test.ts'
# A9 compara manualmente a lista de 19 caminhos e hash por arquivo.
# Isto é INVENTÁRIO, não executor AM. Runner/seleção normativa ainda
# BLOCKED_BY_SOURCE até dispatcher e receipts homologados.
```

Para homologar o dispatcher das AMs (A9 sob `script/sf-release-proofs/**`, somente depois de handoff A2/A6 e ambiente), exigir seleção explícita dos casos, teste runner com exit code, lista/contagens >0, zero skip/todo, trace original de produtor, Session/ToolState/skill/Task/Permission/Relay, receipt assinado e correlacionado a C. Nunca `--pass-with-no-tests`, wildcard vazio ou pular caso com sucesso aparente.

| AM | Condição positiva que precisa de testemunha externa | Contra-prova obrigatória |
|---|---|---|
| AM01 | cinco perfis de recall e resultados persistidos/reabertos | preview hipotética sem efeito/sem concessão |
| AM02 | UI + agent/MCP C16 + chamadas provider reais e receipts pós-restart | nenhuma inferência de tool call só pelo catálogo |
| AM03 | sessões distintas e geração nova autorizada | revogado/geração velha/cross-owner não retém acesso |
| AM04 | scanner/model/ator humano reais; atomicidade receipt+efeito, reconcile pós-perda | retorno perdido sem duplicação; correlator `CORRELATABLE_NOT_ATTESTED` não é PASS |
| AM05 | binário gitleaks real, single-effect outbox, ordinais de journal, rollback C08 | hit/timeout/missing não gravam; A5 possui seq-integrity |
| AM06 | C07 publicação pinada, 5 calls, prepare/run/status/result, DecisionBrief consumido | `CORRELATED_NOT_ATTESTED`, falta de witness, tentativa de reentry sem permission negam |

A7 testemunha backup/restore Linux real separadamente; `parity-pitr.test.ts` macOS é read-only A7 e não substitui prova do host.

## 5. Correlação e custódia dos oito receipts CI

Para **cada** ID `CI-SF`, `CI-CLI`, `CI-APP-SRC`, `CI-APP-BROWSER`, `CI-ATLAS-BUSINESS`, `CI-UI-OPERATIONS`, `CI-UI-DECISIONS`, `CI-UI-REPORTS` registrar: `sourceSha=checkoutSha=C`, `HEAD^{tree}`, `run_id/attempt/job_id`, runner Linux/X64, config/seleção e casos executados, exit code, job conclusion, report digest SHA256, artifact IDs; e check `sf/verify=success`. PR GitHub CI pode usar merge SHA ≠ C. A2/A6 comprovam equivalência do seletor; o `ci-recipes.json` histórico está ausente no snapshot do plano (BLOCKED_BY_SOURCE de A6), mas a lista dos oito IDs está presente em `requests.json` e `suites.json`. Sem equivalência não certificar B3.

**Classificação:** `BLOCKED_BY_OWNER` = permissão/merges/Entra/provisão/approval que só o dono entrega; `BLOCKED_BY_ENV` = VM/sessão/manifest/runner não fornecido; `BLOCKED_BY_SOURCE` = dispatcher ou fonte normativa não verificada; `NOT_RUN` = prova não iniciada; `RED_PRODUCT/RED_HARNESS` = prova efetivamente executada e falhou. "Aguardando" não é "PASS".

## 6. Certificados, reviewers e veto de release

Cada prova `Q01×3` + `U39` + `U40` + `AM01–AM06` + `CI×8` + `AZ03-RESTORE` exige receipt próprio do mesmo C, SHA256 dos materiais originais, nomes/casos e contagem, status e horário/attempt, witness de pessoa/host independente de autor. Guardar segredo/cookie/traces privados somente no armazenamento controlado; no bundle público colocar apenas URIs opacas, digests e evidência saneada. Três revisores independentes e owner validam o pacote; A10 mantém release inerte até lá. O formulário e a certidão W1 estão em `F04-AM-W1-CERTIFICATES.md`.

**Nenhum comando desta página foi executado por A9 nesta W1.** CI draft PR deste branch serve só como validação de documentação/branch e não reclassifica AZ-04/05.
