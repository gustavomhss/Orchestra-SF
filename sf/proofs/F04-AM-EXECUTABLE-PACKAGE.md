# A9 — F04/AM: pacote de prova executável para o candidato final C

> **ATUALIZAÇÃO — PACKAGE REAL / SHA FAIL-CLOSED:** o checklist único normativo desta rodada está em **sf/proofs/F04-AM-C-GATE-CHECKLIST.md** e o modelo integral assinável em **sf/proofs/go-no-go-bundle.template.json**. O CLI/Web/Omni deve sair exclusivamente do GitHub artifact **orchestra-sf-linux-<C>** (app-build, sourceSHA=C); a factory vem do archive **orchestra-sf-factory-linux-x64-baseline.tar.gz** (sf-factory-package, sourceSHA=checkoutSHA=headSha=C), extraído **fora do checkout**. O binário implantado é **/opt/orchestra-sf/releases/<C>/bin/orchestra**; a factory é **.../factory/installation.mjs**, derivada de bin/local/entry.mjs, mais **24 assets product/ai** admitidos pelo manifest A7. O pacote antigo de A7 sob sf/azure/runtime/package.py ainda não inclui essa árvore — **BLOCKED_BY_SOURCE/A7**, e A9 não toca esse lease. O gate A9 exige agora recibos brutos CLI/factory/CI, snapshot do run factory, arquivos instalados, SHA C/tree, assinatura owner Ed25519, reviews e negativos; **o mismatch sourceSHA=6d1ff11e… vs headSha=55a366a892… do run 43988598685 deve ser rejeitado**. W1/PR não qualificam Azure; sem VM/Entra/manifest, resultado **NO_GO**.


**Emissão 2026-11-16 · sfa-f04 · PREPARED_NOT_EXECUTED.** Complementa F04-AM-W1-MATRIX.md, F04-AM-W1-RUNBOOK.md e F04-AM-W1-CERTIFICATES.md. O código agora permite emissão **pelo instalador autorizado** do manifesto, execução integral da tríade Q01, jornadas U39/U40, seis AM, witness assinado, recibos privados e decisão go/no-go. **Não é prova executada.** AZ-04/05, jornadas e AM LIVE continuam **BLOCKED_BY_ENV** até o proprietário entregar Azure VM + Entra + atores reais + signed installer claim.

## 1. Restrições absolutas e donos

- A10 e dono congelam C = commit 40 hex, tree SHA 40 hex, SHA256 do artefato **imutável instalado**. A2/A6 entregam CI no mesmo C e oito receitas; A1 verifica IDs de runs/jobs; A5 corrige U39/U40, selected-installation e AM05 sequence-integrity; A7 implanta Web real com backup/restore/rollback Linux; A8 fornece Microsoft Entra/OIDC, sessões e atores; A9 apenas opera seus scripts e provas; três revisores e owner autorizam release.
- Usar somente runner GitHub Actions **real**, protegido, Linux/x86_64, com checkout exato de C. **Nunca** definir GITHUB_ACTIONS=true manualmente, falsificar RUNNER_OS/ARCH, utilizar devserver, inventar cookie/ator/storageState/grant, trocar produtor original por mock, editar U39/U40/readiness/selected-installation, modificar caminhos protegidos, aumentar retries/timeouts ou relaxar assert.
- Chaves privadas pertencem ao vault do instalador, da testemunha externa e do dono, **nunca** ao repositório. Trust anchors são chaves públicas Ed25519 *pinned por SHA256 externally provisionado*. A assinatura atesta procedência do emissor; não substitui a observação material da aplicação/identidade no host.

## 2. Preflight e emissão do manifesto 0600 / scratchRoot 0700

**Ferramenta:** script/sf-release-proofs/installed-manifest.mjs com subcomandos **prepare-root**, **emit**, **verify**. Variáveis exigidas do runner autorizado, sem valores fictícios:

| Env | Regra |
|---|---|
| SF_NATIVE_CANDIDATE_SHA | C, igual a git rev-parse HEAD |
| SF_NATIVE_CANDIDATE_TREE_SHA | igual a git rev-parse HEAD^{tree} |
| SF_NATIVE_INSTALLED_ARTIFACT_SHA256 | 64 hex do artefato verificado por A7/A10 no host |
| SF_NATIVE_SCRATCH_ROOT | path absoluto canônico; root exclusivo 0700 do UID executor, sem symlink |
| SF_NATIVE_INSTALLED_MANIFEST | root/native-installed-manifest.json, path exato |
| SF_NATIVE_INSTALLER_PUBLIC_KEY_FILE | caminho de chave pública Ed25519 do instalador |
| SF_NATIVE_INSTALLER_TRUST_SHA256 | SHA256 pinned **dos bytes** da chave PEM |
| GITHUB_ACTIONS, RUNNER_OS, RUNNER_ARCH | fornecidas nativamente pelo workflow protegido; true/Linux/X64 |
| GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, SF_NATIVE_PROOF_JOB_ID | IDs reais da prova, verificados externamente A1 |

A7 primeiro executa **node script/sf-release-proofs/installed-manifest.mjs prepare-root** dentro da VM/runner autorizado: cria ou valida diretório 0700 e retorna somente PRIVATE_ROOT_READY_NOT_AUTHENTICATED. Depois A7/A8 colocam na raiz (regular 0600, UID correto, sem hardlink/symlink) **installer-claim.json** e **installer-claim.sig**. O claim é emitido pelo *instalador com observações reais*, **não por A9**. O payload JSON exato contém estas chaves no topo:

    schema: "sf2h.native-installer-attestation.v1"
    candidateSha: <C>
    treeSha: <tree>
    artifactSha256: <digest do artefato C>
    manifest: <objeto abaixo, sem campos adicionais>
    observations:
      installationReceiptSha256: <64hex da observação de A7>
      entraActorWitnessSha256: <64hex da observação real de A8>
      originalProducerWitnessSha256: <64hex da fonte original A8>
      observedAt: <ISO8601 UTC observado>

O objeto **manifest** segue exatamente o parser do produtor em packages/app-shell/e2e/sucafina/native/fixture/readiness.ts:

    schema: "sf2h.native-installed-manifest.v1"
    candidateSha: <C>
    target: { serverKey, discoveryOrigin, shellOrigin, publicOrigin,
      installationId, projectId, hostId, mount, chapterHref }
    wrongServer: <mesmas 9 chaves; serverKey de OUTRO servidor real>
    wrongProject: <mesmas 9 chaves; projectId diferente, publicOrigin igual ao target>
    wrongInstallation: <mesmas 9 chaves; installationId diferente, publicOrigin igual>
    actors: { requester, holder, denied, dashboardAdmin? }
    scratchRoot: <path privado absoluto exato>

Os valores dos atores são **principalRef observados no contexto Microsoft real**, todos distintos; dashboardAdmin opcional somente se não exigido pela jornada. Todos os origins são HTTPS corretos, sem usuário/senha. O owner verifica as **três fronteiras negativas realmente existentes** e os hashes das fontes do domínio/instalador; nenhuma string gerada sinteticamente passa a ser identidade. A8 garante signed witness de issuer/audience/nonce/state/PKCE, sessão, CSRF, owner/install/project, política, CAS e revogação.

A7/instalador assina **bytes exatos** de installer-claim.json com chave Ed25519 externa ao repo; grava detached assinatura **base64** em installer-claim.sig. Exemplo operacional no host autorizado (sem colocar key no repositório):

    umask 077
    openssl pkeyutl -sign -rawin -inkey <key-in-vault> \
      -in installer-claim.json -out <signature-private-file>
    base64 -w0 <signature-private-file> > installer-claim.sig
    chmod 600 installer-claim.json installer-claim.sig

Depois, somente no mesmo C e no runner original:

    node script/sf-release-proofs/installed-manifest.mjs emit
    node script/sf-release-proofs/installed-manifest.mjs verify
    stat -c '%a %U %n' "$SF_NATIVE_SCRATCH_ROOT" "$SF_NATIVE_INSTALLED_MANIFEST"
    sha256sum "$SF_NATIVE_INSTALLED_MANIFEST"

**Saídas:** native-installed-manifest.json e manifest-receipt.json (**0600**, criação exclusiva, no-clobber); recibo liga C/tree/artifact, SHA256 do manifesto/claim, key pin e digest dos principalRefs (sem expor identificadores). Sem claim *assinado*, sem chave pinned, ou se stat/hash divergir: **falha dura**. Um root preparado **não** é instalado/autenticado; emissão também **não é PASS F04**.

## 3. Catálogo congelado e execução F04

O catálogo script/sf-release-proofs/catalog.json é a seleção **release-only A9**. Não altera sf/ci/suites.json (A2) nem as oito receitas de script/sf2h/final-bundle/requests.json (A6). Script/sf-release-proofs/run.mjs rejeita arquivos não rastreados, seleção AM incompleta, checkout sujo, manifest ausente, root público e mismatch de C; usa report JUnit de Bun e Playwright e verificador **verify-junit.py**, que recusa XML vazio, testcase não identificável, skip/todo/retry, falha, duplicação e ausência de qualquer arquivo esperado.

**Pré-condições adicionais:** BrowserContext Microsoft já autenticado e privativo de A8 no CDP local; SF_NATIVE_BROWSER_ENDPOINT_FILE 0600 dentro do root (URL loopback, nunca em logs); bundles sf2h.native-selected-installation.v1 de U39 CAP04 e U40 CAP05 **emitidos por F01 original**, 0600 e mesmo root; C idêntico ao app servido; fontes/versions reais, nunca seed nem fixture nova. A5 corrige X/Y/Z antes de qualquer run LIVE.

**Comandos W4** (NÃO EXECUTADOS pelo A9 em 2026-11-16):

    set -euo pipefail
    node script/sf-release-proofs/installed-manifest.mjs verify
    node script/sf-release-proofs/run.mjs run q01
    node script/sf-release-proofs/run.mjs run u39
    node script/sf-release-proofs/run.mjs run u40
    for am in am01 am02 am03 am04 am05 am06; do
      node script/sf-release-proofs/run.mjs run "$am"
    done

Tríade Q01 **exatamente** 3 casos na source transport-integration.test.ts:

| ID | Negativa verificável |
|---|---|
| Q01-TRANSPORT-GUEST | GET real a /api/ui/context sem cookie => 401/403, Location ausente |
| Q01-TRANSPORT-INVALID-OWNER | GET real sem ator com projectId duplicado => **nunca 200**, somente 400/401/403/404/409 |
| Q01-TRANSPORT-STALE-FENCE | geração antiga no cliente => transport-error/contract-mismatch, **networkCalls=0** (negativa client-side; **não** declarar como chamada HTTP real) |

Dois Q01 **portáteis** de A4 continuam no CI de PR; estes três são **release-only**, não simulados. U39/CAP04 e U40/CAP05 executam **22 casos cada** (source/draft/review/CAS/409/422, denied/readonly, revogação, held/lost responses, cross-installation, original producer + 2026). Não alterar o produtor, selecionar record IDs falsos ou esconder caso por wildcard/skip.

Se Playwright/Bun não emitir identidade de arquivo/caso no JUnit de modo verificável, o verificador falha **fechado**: corrigir captura/report no lease A9 ou escalar ao dono; **não** aprovar por contagem global ou report sem cases.

## 4. AM01–AM06 — arquivo, casos, identidade, CAS e witness

O script enumera e executa cada arquivo (AM01=3, AM02=2, AM03=3, AM04=3, AM05=4, AM06=4, total **19**, inclusive o arquivo am05/sequence-integrity216.test.ts de A5 **read-only**). O relatório positivo Bun **não equivale** a aceite nativo AM. Cada AM precisa de observação **externa** do produtor com skill/Task/Permission/Relay, fonte original/actor/grant, efeitos CAS e operação reais + revisão independente:

| AM | Prova positiva real | Negativa obrigatória / limite |
|---|---|---|
| 01 | cinco perfis de recall, persistência/reopen de resultados | preview hipotética não publica nem concede grant |
| 02 | UI, agent/MCP C16, provider calls reais, três saídas pós-restart | catalogue/tool metadata sozinho não demonstra execução |
| 03 | sessões corretas por principal, generation/host atuais | cross-principal, revogação, generation stale negados |
| 04 | human choice e grant independentes, scanner+model, atomicidade domain write/receipt | lost-response reaberto sem duplo efeito; CORRELATABLE_NOT_ATTESTED veta |
| 05 | scanner real gitleaks clean/hit/timeout/missing, C08 rollback, ordinais de journal | hit/timeout/missing não fazem append; arquivo A5 intocado |
| 06 | C07 pinado, 5 calls, prepare/run/status/result, skill, Brief persistido/consumido | CORRELATED_NOT_ATTESTED ou reentry sem Permission veta |

Para **cada** proof mode (q01, u39, u40, am01..am06), A7/A8/operador original produz fora do runner um **<mode>-witness.json** e **<mode>-witness.sig** no scratchRoot (0600, key Ed25519 independente e pinned). Schema obrigatório: sf2h.native-original-producer-witness.v1. Campos: proofId, candidateSha=C, treeSha, artifactSha256, manifestSha256, processReceiptSha256 (digest de proofs/<mode>/receipt.json), reportSha256, originalProducerSha256, actorAuthorizationSha256, taskPermissionRelaySha256, witnessedBy e observedUtc. Para **Q01**, também negativeDenialSha256, zeroNetworkDispatchSha256 e negativeCaseIds exatos; para **U39/U40/AM**, sourceCasSha256 e operationReceiptSha256 (array não-vazio de 64 hex). Cada digest deve ser de **fato produzido** no host, sob custody privada; strings hex arbitrárias não são evidência.

Após A7/A8 assinar um witness real e não antes:

    for mode in q01 u39 u40 am01 am02 am03 am04 am05 am06; do
      node script/sf-release-proofs/run.mjs attest "$mode"
    done

Attest verifica assinatura+key pin, identidade C/tree/manifest/artefato, hashes de report e run receipt. Status de saída: **SIGNED_ORIGINAL_PRODUCER_OBSERVATION_PENDING_INDEPENDENT_REVIEW**, nunca autorização automática de release.

## 5. Artefatos e recibos — preservação dos dados privados

| Etapa | Diretório (0700) | Saídas (0600) |
|---|---|---|
| manifest | scratchRoot | installer-claim.json/.sig **externos**; native-installed-manifest.json; manifest-receipt.json |
| Q01×3 | scratchRoot/proofs/q01 | process.log, report.xml, summary.json, receipt.json **e** q01-transport-{guest,invalid-owner,stale-fence}.json; observation-receipt.json só após attest |
| U39, U40 | proofs/u39 e proofs/u40 | log/JUnit/summary/receipt de **22 casos cada**, depois observation-receipt |
| AM01–06 | proofs/am01..am06 | log/JUnit/summary/receipt por suite, depois observation-receipt externa |
| 8 CI | Actions A2/A6 | oito report/receipt, IDs de run/attempt/job, hash e seleção, sf/verify success no **mesmo C** |
| AZ-03 Linux | VM/A7 | backup SHA, restore isolado, rollback, journal/estado reaperto reais, testemunha |
| Owner gate | scratchRoot | go-no-go-bundle.json/.sig **assinados externamente pelo dono** |

Recibos de **run** só são gravados após exit 0, JUnit validado com identidade de arquivos/casos, zero skipped/todo e reports completos. Caso haja falha, comando sai nonzero e log/XML continuam privados para triagem — **nunca** fingir receipt PASS. **No-clobber** em todos os arquivos; cada tentativa requer root novo autorizado, não sobrescrever evidência anterior. Logs crus, manifest, URLs privadas, CDP, cookies, tokens, storageState e principalRefs **não** entram no artifact público nem no PR. A1/A10 só recebem hashes, refs opacas, certificado saneado, run IDs e cold reviews.

## 6. Go/no-go automatizado e assinado pelo dono

**Comando** após reviews, execução real e decisão humana:

    node script/sf-release-proofs/go-no-go.mjs check

O validador lê somente o bundle privado **go-no-go-bundle.json** e assinatura detached **go-no-go-bundle.sig** 0600, verifica Ed25519 com chave do **dono** pinned por env e compara provas reais em disco. Sem owner GO assinado retorna **NO_GO** (exit 3) e **NÃO** chama deploy/merge/settings. Schema do bundle: **sf2h.f04-am-go-no-go.v1**. Conteúdo obrigatório:

- No topo: candidateSha, treeSha, artifactSha256, installedArtifactSha256 e manifestSha256 exatamente iguais ao C instalado.
- **ci**: candidateSha/checkoutSha/effectiveGithubSha iguais C; runId e attempt; verify="success"; doze jobs **exatos** preflight, static, omni, cinco Bun, três UI, verify. Cada job: id, jobId, runId, attempt, checkoutSha, conclusion="success", artifactOrLogSha256. recipeReceipts: oito IDs sf/test-CI-*, cada um com sha256 e checkoutSha=C.
- **proofs**: onze IDs **exatos** (três Q01, U39, U40, seis AM); cada entrada id, status="PASS_REVIEWED", independentReviewRef, processReceiptSha256 e originalProducerObservationSha256. O gate revalida os arquivos 0600 correspondentes, recibo de processo, testemunha original **assinada**, report, digest e o mesmo C.
- **azure**: quatro IDs AZ01-DEPLOY, AZ02-ENTRA, AZ03-RESTORE-ROLLBACK e AZ07-PROTECTED-IMMUTABLE-RELEASE; cada um status="PASS_REVIEWED", candidateSha=C, artifactSha256, immutableEvidenceSha256 e independentReviewRef.
- **reviews**: três pessoas diferentes, cada uma com personId, reviewRef, signedReviewSha256 e disposition="APPROVE"; distintas do owner.
- **owner**: personId, decision="GO", approvalRef, approvedUtc. Bundle assinado com chave de autoridade externa verificada. O owner assina **somente após** A10 conferir jobs/artefatos no GitHub e Azure, integridade dos hashes e reviews.

Um job omitido, receipt sem assinatura, SHA divergente, suite sem cases, negativação insuficiente, ato sem fonte original, reviewer autoatribuído, ausência de Entra/restore/VM ou qualquer pendência de fonte/approval => **NO_GO**. Sucesso do script é **GO_OWNER_SIGNED_EVIDENCE_ACCEPTED_NOT_DEPLOY_EXECUTED**: ainda não é comprovante de deploy. A10 decide o passo de release protegido e o dono efetua a autorização humana. Um novo commit/config/segredo/origem/artifact material invalida o pacote de C.

## 7. Ordem operacional do fechamento

**W1:** A9 codifica provas/manifest/runner/gate, sem acessar credenciais. **W3:** A6 integra, A5 corrige, A10 congela C; A1 valida 12 jobs e 8 receipts CI no SHA C. **W4:** A7 instala C em VM e prova Linux restore/rollback; A8 valida Entra, 3/4 atores, sessão, browser CDP e origem; instalador A7/A8 assina claim real; A9 emite/verifica manifest e executa Q01, U39, U40, AM; testemunhas externas e cold reviews conferem efeitos. **W5:** A10 recebe 3 pareceres, prepara bundle; dono assina GO ou NO_GO; gate e release protegidos separados. Só após essas condições AZURE_RELEASE_QUALIFIED pode ser candidato a PASS.

**Estado factual neste commit:** não há Azure VM/atores/manifest/signature/claim nem recibos originais entregues ao A9. Nenhuma negativa F04, jornada U39/U40 ou AM foi executada. **AZ-04/05=BLOCKED_BY_ENV; AZURE_RELEASE_QUALIFIED=NO_GO.** O CI do PR draft é **somente prova da branch**, não qualificação Azure.
