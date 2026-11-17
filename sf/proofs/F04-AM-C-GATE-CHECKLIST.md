# A9 / F04-AM — CHECKLIST ÚNICO DE ENTRADA EM GO/NO-GO (C congelado)

**Estado em 2026-11-16:** **PREPARED_NOT_EXECUTED; AZ-04/05 BLOCKED_BY_ENV, release NO_GO**. Documento de operação, não um recibo live. Todos os comandos abaixo são para executar **futuramente** no runner Linux protegido/VM, com dados reais e acesso autorizado. Não atribuir PASS por executar um comando que apenas imprime dados. **Dono: Daniel França.** Vault de Entra já identificado: kv-orchsf-2611162127; identidade gerenciada da VM informada, principalId 5cd0de58-fa3f-4ceb-bb0e-9455955bf07f e papel Key Vault Secrets User. **Isto não comprova login Microsoft, sessão, client secret efetivamente carregado, instalação ou operação de negócio.** Nunca imprimir client secret, private key, cookie, CDP WebSocket, tokens nem conteúdo do manifesto privado.

**Escopo de artefatos e paths efetivos (não confundir os dois produtores):**

| Produto / processo | Fonte imutável | Lugar para extrair/copiar | Lugar realmente consumido na VM |
|---|---|---|---|
| **CLI/Web/Omni** | GitHub Actions app-build, artifact **orchestra-sf-linux-<C>**, contém distribution-logs/orchestra-sf-linux-x64-baseline.tar.gz e build-receipt.json | staging privado fora do checkout no runner protegido; original archive copiado para **$SF_NATIVE_SCRATCH_ROOT/distributions/orchestra-sf-linux-x64-baseline.tar.gz**; receipt 0600 em **.../distributions/build-receipt.json** | CLI **/opt/orchestra-sf/releases/<C>/bin/orchestra**, Web **.../web/index.html**, Omni **.../bin/hugr_omni.node**, **.../bin/hugr-omni-supervisor** |
| **Factory SF** | sf-factory-package, artifact do run **sf-factory-package-<run>-<attempt>-<C>** após correção do produtor, contém **orchestra-sf-factory-linux-x64-baseline.tar.gz**, factory-package-receipt.json, distribution.json, factory-closure.json | archive original 0600 em **$SF_NATIVE_SCRATCH_ROOT/distributions/orchestra-sf-factory-linux-x64-baseline.tar.gz**; receipt 0600 em **.../distributions/factory-package-receipt.json**; extração validada, **fora do checkout**, em **.../distributions/factory-extracted/** | factory **/opt/orchestra-sf/releases/<C>/factory/installation.mjs** (copiado de factory-extracted/bin/local/entry.mjs) e **24 assets** em **.../product/ai/** (copiados de factory-extracted/bin/product/ai/**). Systemd usa **/opt/orchestra-sf/current/factory/installation.mjs** por symlink de release **<C>** |
| **Application host** | mesmo release <C> | A7 stages immutable A7 bundle, não PR/devserver | systemd orchestra-sf não-privilegiado; loopback **http://127.0.0.1:4096**; HTTPS público real via Caddy; Web do release em ORCHESTRA_WEB_UI_DIR **/opt/orchestra-sf/current/web** |
| **Runner das provas** | checkout limpo exato <C> (fonte de testes, **não** app lançado no checkout) | GitHub Actions real Linux/x86_64, com acesso read-only aos bytes de release + $SF_NATIVE_SCRATCH_ROOT 0700 | Q01 via Bun de **packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts**, U39/U40 via Playwright **packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts** e **u40.spec.ts**, AM01–06 via Bun **modules/sucafina/Sucafinav1/test/product/integrated-proofs/am0[1-6]/**. Todas atingem **target.publicOrigin HTTPS + target.mount** do manifesto, source real do produto implantado, não localhost:4110 |
| **Provas privadas** | manifesto emitido de claim A7/A8 assinado e produtores originais | $SF_NATIVE_SCRATCH_ROOT direto 0700; distribuição/ci-receipts/azure-evidence/proofs dir 0700, arquivos 0600; endpoint CDP 0600 apenas loopback | manifest **$SF_NATIVE_SCRATCH_ROOT/native-installed-manifest.json**; receipts em **$SF_NATIVE_SCRATCH_ROOT/proofs/{q01,u39,u40,am01..06}**; nunca criar pasta em Git/artifact público |

**Atenção — integração A7 ainda não entregue:** a versão lida de sf/azure/runtime/package.py em sfa-vm copia apenas factory/installation.mjs, **não** os 24 arquivos de bin/product/ai; o loader apps/cli/src/sucafina-product/installation.ts calcula sourceRoot relativo à factory em **../product/ai**. A7 (único owner do empacotamento Azure) deve incluir a árvore verificada no bundle e manifest A7 **antes** de AZ-01 PASS. A9 **não edita sf/azure/**. O verificador A9 rejeita o release se a factory ou qualquer um dos 24 assets não corresponder ao digest real do archive. Se existir divergência entre binário CLI app-build e o binário compilado do archive factory, **NÃO substituir silenciosamente**: registrar o emparelhamento de produtos de C, atestado A7/A10 e, se incompatível, NO_GO.

## 1. Checklist de execução — executar exatamente nesta ordem

Definir variáveis em ambiente do runner protegido **somente** com os valores observados:

    C=<40hex congelado por A10>                         # nunca branch movível
    TREE=<40hex git tree C observado>
    SF_NATIVE_CANDIDATE_SHA=$C
    SF_NATIVE_CANDIDATE_TREE_SHA=$TREE
    SF_NATIVE_INSTALLED_ARTIFACT_SHA256=<64hex do pacote A7 final instalado>
    SF_NATIVE_SCRATCH_ROOT=<path absoluto 0700 sob UID do runner protegido>
    SF_NATIVE_INSTALLED_MANIFEST=$SF_NATIVE_SCRATCH_ROOT/native-installed-manifest.json

Variáveis adicionais (trusted keys PEM públicos e pins) são preenchidas de canal externo:
SF_NATIVE_INSTALLER_PUBLIC_KEY_FILE, SF_NATIVE_INSTALLER_TRUST_SHA256,
SF_NATIVE_WITNESS_PUBLIC_KEY_FILE, SF_NATIVE_WITNESS_TRUST_SHA256,
SF_NATIVE_OWNER_PUBLIC_KEY_FILE, SF_NATIVE_OWNER_TRUST_SHA256 e
SF_NATIVE_OWNER_PERSON_ID (valor aprovado por Daniel França).
**GITHUB_ACTIONS, GITHUB_SHA, RUNNER_OS, RUNNER_ARCH, GITHUB_RUN_ID e GITHUB_RUN_ATTEMPT devem ser originais do GitHub Actions, nunca definidos manualmente.**

| # | O que deve estar verdadeiro antes da próxima porta | Comando verificável e evidência mínima | Critério de reprovação (fail-closed) / dono |
|---:|---|---|---|
| **01** | A10 congelou C exato, tree, source do CI, zero mudanças não requalificadas | **git rev-parse HEAD**; **git rev-parse HEAD^{tree}**; **git status --porcelain --untracked-files=no**; conferir contra C/TREE; **test "$GITHUB_SHA" = "$C"** no run protegido W4 | SHA event/checkout diferente, tree diferente, checkout alterado ⇒ NO_GO. No app-build workflow_dispatch, run.headSha pode ser ref dev: validar **input revision** e **receipt.sourceSHA/checkout real**, não igualar headSha dev indevidamente. **A10/A6** |
| **02** | CI C full GREEN com os 12 contextos e 8 receipts A2; run efetivo em C, não PR merge-ref diferente | **gh run view "$CI_RUN" -R gustavomhss/Orchestra-SF --json status,conclusion,headSha,jobs**; conferir headSha C, conclusão success e todos ids; baixar 8 receipts originais para **$SF_NATIVE_SCRATCH_ROOT/ci-receipts/CI-*.json** (0700/0600), verificar sourceSha=checkoutSha=C, runId/attempt e SHA256 de cada JSON; sf/verify success | Job ausente/failure/skipped/cancelled, receipt de outro run/attempt/SHA, qualquer suite vazia, digest diferente ⇒ NO_GO. **A2/A6/A1** |
| **03** | Binário CLI/Web/Omni vem do **artifact orchestra-sf-linux-<C>** de app-build no C | **gh run view "$CLI_RUN" ... --json status,conclusion,jobs**; **sha256sum "$SF_NATIVE_SCRATCH_ROOT/distributions/orchestra-sf-linux-x64-baseline.tar.gz"**; **jq -e --arg C "$C" '.schema=="orchestra-web-build-proof-v1" and .sourceSHA==$C and .archive.file=="orchestra-sf-linux-x64-baseline.tar.gz"' "$SF_NATIVE_SCRATCH_ROOT/distributions/build-receipt.json"**; casar digest do archive e sha do bin/orchestra em manifest | Artifact nome não contém C, build receipt.sourceSHA diferente de C, archive diferente do digest, ELF/Web/Omni ausentes ⇒ NO_GO. Histórico do app-build pode selecionar revision diferente de run.headSha, só autoriza **receipt + checkout** em C. **A7/A10** |
| **04** | Factory do **mesmo C** aprovada em Ubuntu, receipt contra **GitHub run HEAD real** | **gh run view "$FACTORY_RUN" -R gustavomhss/Orchestra-SF --json headSha,status,conclusion**; **jq -e --arg C "$C" '.schema=="sf-factory-package-proof-v1" and .sourceSHA==$C and .checkoutSHA==$C and .expectedSourceSHA==$C and .archiveFile=="orchestra-sf-factory-linux-x64-baseline.tar.gz" and .checkedEndpoint=="/sucafina/status" and .status==200 and .origin=="http://localhost:4110" and .extractedOutsideCheckout==true and .assetCount==24 and .compilerInputCount>=750' "$SF_NATIVE_SCRATCH_ROOT/distributions/factory-package-receipt.json"**; exigir run.headSha=C e arquivo sha256 do archive igual ao recibo | **Run 43988598685**: headSha 55a366a892… e receipt.sourceSHA 6d1ff11e… ⇒ **REJEITAR**. Run 43988588834 tinha source/head 55a… mas não qualifica outro C. Ausência de checkoutSHA/expectedSourceSHA em recibo legado ⇒ também reprovar até novo run corrigido. **Factory A11/A6/A10** |
| **05** | Ambos archives foram extraídos com verificação de conteúdo e factory ficou **fora do checkout** | **sha256sum "$SF_NATIVE_SCRATCH_ROOT/distributions/"*.tar.gz**; **test -s "$SF_NATIVE_SCRATCH_ROOT/distributions/factory-extracted/distribution.json"**; **test -s "$SF_NATIVE_SCRATCH_ROOT/distributions/factory-extracted/bin/local/entry.mjs"**; **test -s "$SF_NATIVE_SCRATCH_ROOT/distributions/factory-extracted/bin/local/closure.json"**; **test ! -e "$SF_NATIVE_SCRATCH_ROOT/distributions/factory-extracted/node_modules"**; conferir distribution/closure hashes e 24 assets | ZIP do Actions não é o tar da factory; não executar tar não verificado nem aceitar symlink/traversal; hash/arquivo faltante ou extração dentro do checkout ⇒ NO_GO. O gate A9 recalcula todos hashes. **A7/factory** |
| **06** | Release A7 em **/opt/orchestra-sf/releases/<C>** contém CLI+Web+Omni e factory+24 assets realmente instalados | **test -x "/opt/orchestra-sf/releases/$C/bin/orchestra"**; **test -s "/opt/orchestra-sf/releases/$C/factory/installation.mjs"**; **test -s "/opt/orchestra-sf/releases/$C/product/ai/manifests/resident.json"**; **find "/opt/orchestra-sf/releases/$C/product/ai" -type f \\| wc -l** (=24); **sha256sum "/opt/orchestra-sf/releases/$C/bin/orchestra" "/opt/orchestra-sf/releases/$C/factory/installation.mjs"**; comparar build receipt e closure. A7 executa deploy.py preflight/stage/activate só sob approval | A7 package.py atual sem assets ⇒ **BLOCKED_BY_SOURCE** até A7 corrigir o empacotador/manifest, rebuild em C e requalificação; qualquer byte difere ⇒ NO_GO. **A7/A10** |
| **07** | VM e app de C realmente ativos (não apenas Caddy 503), Web e Host por TLS correto, storage persistente | **systemctl show -P User orchestra-sf** (=orchestra-sf); **systemctl is-active orchestra-sf**; **findmnt /var/lib/orchestra-sf**; **readlink -f /opt/orchestra-sf/current** (releases/<C>); **curl --fail --silent --show-error "https://<REAL_FQDN>/sucafina/status"** + teste privado de contexto Microsoft original com A8 | 200 em **http://localhost:4110** prova factory apenas; 200 no FQDN sozinho não comprova Entra/capacidade. Servidor errado, HTTP público, TLS inválido, Caddy 503, C diferente => NO_GO. **A7** |
| **08** | Entra/OIDC original com sessão/cookies/CSRF/revogação e 3 ou 4 atores reais, Key Vault por MI sem segredo exposto | **az keyvault show -n kv-orchsf-2611162127 --query id -o tsv**; **az vm show -g <RG> -n <VM> --query identity.principalId -o tsv** (=5cd0de58-...); usar A8 scripts de contraprovas OIDC e seu witness privado (não imprimir Key Vault secret); **node script/sf-release-proofs/installed-manifest.mjs prepare-root** | Papel Key Vault Secrets User **não** prova sessão OIDC; secret ausente, redirect URI errado, tenant/issuer, grant/cross-owner, CSRF/revogação não exercitados => **BLOCKED_BY_OWNER/ENV**. Não buscar/imprimir client secret no checklist. **A8 e Daniel** |
| **09** | Instalador real emitiu claim Ed25519 com C/tree/artifact+atores/producer witnesses; manifesto 0600 sob root 0700 | **node script/sf-release-proofs/installed-manifest.mjs emit** e **verify**; **stat -c '%a %U %n' "$SF_NATIVE_SCRATCH_ROOT" "$SF_NATIVE_INSTALLED_MANIFEST"**; **sha256sum "$SF_NATIVE_INSTALLED_MANIFEST"**. Signature/certificados do instalador (chave **diferente** da do dono) gerados fora do repo após A7+A8 | Claim fabricado pelo A9, SHA divergent, symlink, UID errado, 0644/0755, proxy falso ou atores duplicados ⇒ NO_GO. Emitter não cria sessão nem permissão. **A7/A8/A9** |
| **10** | CDP loopback e selected-installation CAP04/CAP05 de F01 privado 0600; logins realmente observados | **test -s "$SF_NATIVE_BROWSER_ENDPOINT_FILE"**; **stat -c '%a %U %n' "$SF_NATIVE_BROWSER_ENDPOINT_FILE"**; **test -s "$SF_NATIVE_SCRATCH_ROOT/native-installed-u39.json"** e **native-installed-u40.json**; A8 constata observeNativeBinding/readiness no app C | CDP remoto/externo, storageState synth, missing CAP04/05, actor denied com grant ou principalRef divergente ⇒ NO_GO. A9 não edita fixture/selector A5/A8. **A5/A8** |
| **11** | Q01 negativas **três** na origem HTTPS do manifest, um batch real + três receipts individuais | **node script/sf-release-proofs/run.mjs run q01**; conferir proofs/q01/report.xml, summary.json, receipt.json e q01-transport-{guest,invalid-owner,stale-fence}.json | Guest não retorna 401/403, duplicate owner 200, stale-fence toca network, XML não tem exatamente três Q01 sem skipped ⇒ NO_GO. Stale-fence é negativa **local de dispatch**, não falso request HTTP. **A9** |
| **12** | U39/CAP04 e U40/CAP05, **22 + 22** casos reais no original producer | **node script/sf-release-proofs/run.mjs run u39**; **node script/sf-release-proofs/run.mjs run u40**; recibo em proofs/u39 e proofs/u40. Comparar selected U39/CAP04 e U40/CAP05, original source/CAS | BrowserContext, sourceKey ou suite errados, resultado 409/422 mascarado, skip/retry, contagem <22 ou fallback devserver ⇒ NO_GO. **A9; A5 cuida código** |
| **13** | AM01–AM06 **19 arquivos**, cada AM com witness real e negativos independentes | **for m in am01 am02 am03 am04 am05 am06; do node script/sf-release-proofs/run.mjs run "$m"; done**; SHA do report + source/witness por AM, validações Task/Permission/Relay/skill, 5 perfis, C16, replay, gitleaks e C07 conforme matriz | Bun unit green sem original producer witness/5 perfis/Task/Permission/Relay/CAS não é PASS AM; arquivo A5 ausente, wildcard vazio ou correlator NOT_ATTESTED ⇒ NO_GO. **A9 + A7/A8** |
| **14** | Emissores independentes assinaram witnesses **q01,u39,u40,am01..06** e A9 verificou bytes | **for m in q01 u39 u40 am01 am02 am03 am04 am05 am06; do node script/sf-release-proofs/run.mjs attest "$m"; done**; conservar <mode>-witness.json/.sig privados, observation-receipt.json sob proofs/<mode>/; conferir signer diferente da fonte | Assinatura, C/tree/report/receipt/origin/actor ou operação original divergentes ⇒ NO_GO. Assinatura válida não implica review final. **A7/A8/A9** |
| **15** | Linux backup/restore/rollback e transação original de C efetivos em Azure, sem sobrescrever produção | **sudo python3 sf/azure/recovery/recovery.py verify-clone --clone-role <private> --archive <real> --receipt <real> --target /mnt/orchestra-sf-restore** e outputs reais Azure Backup/Restore jobs; **sf/azure/runtime/smoke-transaction.sh** com aprovação do dono/A7, seguindo runbook A7. Criar AZ03-RESTORE-ROLLBACK.json de witness separado | Restore só local sem Azure, backup job não Completed, clone sem isolamento, rollback sem compatibilidade, transação simulada ou owner approval ausente ⇒ NO_GO. **A7/dono** |
| **16** | A1/A10 têm três revisores frios distintos **de Daniel França** e zero blocker; 4 receipts Azure reais com source C | Staging privado **$SF_NATIVE_SCRATCH_ROOT/azure-evidence/{AZ01-DEPLOY,AZ02-ENTRA,AZ03-RESTORE-ROLLBACK,AZ07-PROTECTED-IMMUTABLE-RELEASE}.json** (0700/0600), com id/status=PASS_REVIEWED/candidateSha/artifactSha256; **sha256sum** de cada; conferir reviewRef e pareceres assinados | reviewer duplicado/autor/dono, status não PASS_REVIEWED, ausência de Azure ou artifact SHA, review não material ⇒ NO_GO. **A1/A10; aprovação Daniel** |
| **17** | Bundle real completo, bytes brutos dos **dois** package receipts e **oito** CI receipts no root privado; owner Daniel autorizou GO **sobre esses bytes** | Preencher **sf/proofs/go-no-go-bundle.template.json** em arquivo novo privado 0600 **$SF_NATIVE_SCRATCH_ROOT/go-no-go-bundle.json**; comparar com fonte e hashes reais, sem substituir por mocks. Assinatura Ed25519 **detached sobre bytes exatos** como §2. **node script/sf-release-proofs/go-no-go.mjs check**; só se exit=0 devolver GO_OWNER_SIGNED_EVIDENCE_ACCEPTED_NOT_DEPLOY_EXECUTED | Qualquer placeholder, job faltante, receipt SHA divergente, run head factory desigual C, assinatura inválida, reviewer=owner, owner NO_GO, archive/asset não instalado ⇒ **NO_GO / exit 3**. **Daniel e A10** |
| **18** | Release operacional (fora do A9): só após gate e aprovação humana explícita | A10 controla environment protegido sf-release.yml, imutabilidade C/backup, deploy/rollback; owner assina go-live e confirma rulesets. A9 entrega apenas pacote de provas e não muda protected paths/required checks | GATE sucesso **não é** deploy real; sem ambiente protegido/autorização humana ⇒ BLOCKED_BY_OWNER. **A10 e Daniel** |

**Execução do negativo offline de contrato, SEM VM (não é F04):**

    node --test script/sf-release-proofs/release-contracts.test.mjs

Esperado: todos os testes passam **porque** quatro mutações obrigatórias são corretamente rejeitadas: factory/CI receipt SHA ≠ C, assinatura inválida, reviewer id igual owner, job faltante; testes extras de package source/head, pin e recipe missing. Se o teste negativo **deixar passar** uma mutação, é **RED_HARNESS**, não PASS. Rodar de novo em C após qualquer mudança de fonte.

## 2. Procedimento independente de assinatura Ed25519 do proprietário

**Daniel França** só assina após A10 verificar a matriz inteira 01–16, hashes e os três pareceres. Cliente secreto OIDC em **kv-orchsf-2611162127** **NÃO** é e não pode virar a chave de assinatura de release. A chave privada Ed25519 deve ser controlada pelo dono em cofre/signer apropriado **fora do Git, não enviada ao agente, não escrita em log nem passada em argv**. Azure Key Vault para client secret não implica automaticamente suporte Ed25519 de assinatura: escolher emissor externo que efetivamente suporte Ed25519 e fixar a **chave pública Ed25519 real** aprovada por Daniel. Não gerar chaves ad hoc no runner para fazer a prova passar.

Contrato dos arquivos: bytes UTF-8 exatos de **$SF_NATIVE_SCRATCH_ROOT/go-no-go-bundle.json**, com line endings, espaços, ordenação e newline finais **INALTERADOS** depois da assinatura. Assinar *arquivo*, **não** sua string JSON normalizada nem SHA256 digest, nem um ZIP, nem receipt de outro C. Exemplo com OpenSSL em estação/serviço aprovado pelo dono (somente depois de garantir private key fora do checkout):

    umask 077
    BUNDLE="$SF_NATIVE_SCRATCH_ROOT/go-no-go-bundle.json"
    PUBLIC=<path/owner-approved-ed25519-public.pem>
    PRIVATE=<path/protected-ed25519-private.key>
    test -s "$BUNDLE" && test -s "$PUBLIC"
    sha256sum "$BUNDLE"                      # registrar SHA dos bytes que serão assinados
    openssl pkeyutl -sign -rawin -inkey "$PRIVATE" \
      -in "$BUNDLE" -out "$SF_NATIVE_SCRATCH_ROOT/owner-signature.bin"
    base64 -w0 "$SF_NATIVE_SCRATCH_ROOT/owner-signature.bin" \
      > "$SF_NATIVE_SCRATCH_ROOT/go-no-go-bundle.sig"
    chmod 0600 "$SF_NATIVE_SCRATCH_ROOT/go-no-go-bundle.sig"
    SF_NATIVE_OWNER_TRUST_SHA256="$(sha256sum "$PUBLIC" | awk '{print $1}')"
    sha256sum "$PUBLIC"                      # pin **bytes PEM exatos**, não fingerprint de chave textual
    openssl pkeyutl -verify -rawin -pubin -inkey "$PUBLIC" \
      -sigfile "$SF_NATIVE_SCRATCH_ROOT/owner-signature.bin" -in "$BUNDLE"
    sha256sum "$BUNDLE"                      # DEVE ser idêntico ao anterior

Mover somente **public.pem** e seu hash pinned por canal autenticado independente para SF_NATIVE_OWNER_PUBLIC_KEY_FILE e SF_NATIVE_OWNER_TRUST_SHA256 do runner protegido. Definir **SF_NATIVE_OWNER_PERSON_ID** do registro humano real (Daniel França). Nunca confiar em pin fornecido pelo próprio arquivo JSON que está sendo assinado. Arquivos privados de assinatura mantidos sob 0700; se o signing station não é o runner, use transferência cifrada autenticada mantendo a **mesma sequência de bytes**.

**Contraprova da assinatura, sem mutar a prova original:**

    cp "$BUNDLE" "$SF_NATIVE_SCRATCH_ROOT/tamper-copy.json"
    chmod 0600 "$SF_NATIVE_SCRATCH_ROOT/tamper-copy.json"
    printf ' ' >> "$SF_NATIVE_SCRATCH_ROOT/tamper-copy.json"
    if openssl pkeyutl -verify -rawin -pubin -inkey "$PUBLIC" \
      -sigfile "$SF_NATIVE_SCRATCH_ROOT/owner-signature.bin" \
      -in "$SF_NATIVE_SCRATCH_ROOT/tamper-copy.json"; then
      echo "F04_SECURITY_FAILURE_TAMPERED_BUNDLE_ACCEPTED" >&2
      exit 1
    fi
    # A assinatura íntegra do original DEVE passar:
    openssl pkeyutl -verify -rawin -pubin -inkey "$PUBLIC" \
      -sigfile "$SF_NATIVE_SCRATCH_ROOT/owner-signature.bin" -in "$BUNDLE"
    rm -f "$SF_NATIVE_SCRATCH_ROOT/tamper-copy.json"

A prova negativa **programática** de assinatura/owner/reviewer/SHA/job também está em release-contracts.test.mjs; nenhum segredo, credencial Entra ou identidade fake é usado em execução real. A assinatura final gravada em **go-no-go-bundle.sig** deve ser **base64 canônico** de 64 bytes Ed25519, sem output em chat/PR. O gate Node revalida a assinatura sobre os bytes originais e pin independente. **Qualquer alteração no bundle após assinar invalida o signature e força revisão/assinatura nova.**

## 3. Forma exata e materialidade do bundle

A fonte normativa dos **nomes e campos** é o arquivo **sf/proofs/go-no-go-bundle.template.json**. Ele contém explicitamente 12 objetos ci.jobs, 8 ci.recipeReceipts com a estrutura **real** de script/sf-ci/gate.mjs, 11 proofs, 4 azure, 3 reviews e owner. O template usa sentinelas **REQUIRES_**, owner.decision=NO_GO, resultados NOT_RUN e assetCount=0: **por definição não passa no gate**. Substituir cada valor somente a partir do artifact/receipt original, GitHub Actions real ou atestado A7/A8/A10 revisado, nunca por string hex arbitrária.

**Diretório privado requerido pelo validador final:**

    $SF_NATIVE_SCRATCH_ROOT/                          # 0700 UID do runner
      installer-claim.json                            # 0600 signed installer data
      installer-claim.sig                             # 0600 base64 detached Ed25519
      native-installed-manifest.json                  # 0600 emit
      manifest-receipt.json                           # 0600 emit
      go-no-go-bundle.json                            # 0600 OWNER-SIGNED EXACT BYTES
      go-no-go-bundle.sig                             # 0600 detached Ed25519
      distributions/                                  # 0700
        build-receipt.json                            # 0600 raw app-build
        factory-package-receipt.json                  # 0600 raw sf-factory-package
        orchestra-sf-linux-x64-baseline.tar.gz        # original CLI archive, 0600
        orchestra-sf-factory-linux-x64-baseline.tar.gz# original factory archive, 0600
        factory-extracted/                            # real dirname, 0700, outside checkout
          distribution.json
          bin/local/entry.mjs
          bin/local/closure.json
          bin/product/ai/**                           # exact 24 content-hashed assets
      ci-receipts/                                    # 0700
        CI-SF.json CI-CLI.json CI-APP-SRC.json CI-APP-BROWSER.json
        CI-ATLAS-BUSINESS.json CI-UI-OPERATIONS.json
        CI-UI-DECISIONS.json CI-UI-REPORTS.json       # all 0600 ORIGINAL receipt bytes
      azure-evidence/                                 # 0700
        AZ01-DEPLOY.json AZ02-ENTRA.json
        AZ03-RESTORE-ROLLBACK.json
        AZ07-PROTECTED-IMMUTABLE-RELEASE.json         # all 0600, original reviewed C witness
      proofs/                                         # 0700
        q01/ u39/ u40/ am01/ am02/ am03/ am04/ am05/ am06/
      q01-witness.json q01-witness.sig                # + 8 other modes in same root

**Casamento obrigatório:** pacote A7 final tem um SHA256 próprio **SF_NATIVE_INSTALLED_ARTIFACT_SHA256** (não confundir com digest do archive CLI nem do archive factory). Uma fábrica qualificada em Ubuntu com hash de fonte de um branch diferente de C **não** basta para o release C. O app-build manual em ref dev pode ter run.headSha dev diferente de C porque houve input revision explícito: verificar receipt.sourceSHA=C e checkout C, não aplicar a regra errada de factory PR ao workflow_dispatch.

**Emissão e aceite:** as 11 proofs devem ter status PASS_REVIEWED somente depois de receipts originais + testemunha assinada + cold review distinta; quatro Azure idem. O código verifica bits/digests/source/assinaturas/arquivos instalados e origem C, mas a autoridade do revisor e do dono vem de fontes externas conferidas por A1/A10. O sucesso de go-no-go não dispara deploy e não prova implantação por si só.

## 4. Pendências exatas com o dono e operadores (futuro)

**Já informado e não pedir novamente:** nome do vault **kv-orchsf-2611162127**, managed identity principalId **5cd0de58-fa3f-4ceb-bb0e-9455955bf07f**, papel Key Vault Secrets User, dono **Daniel França**; runs Ubuntu factory 43988588834/43988598685. São inventário, não sessão Microsoft.

**Daniel/A10 precisam entregar ou autorizar:** C e tree finais imutáveis + run completo CI C com 12 jobs e 8 receipts; revisão/aceite do pacote factory **novo para C** com sourceSHA=checkoutSHA=headSha=C e artifact id; app-build artifact orchestra-sf-linux-C com build receipt/sourceSHA=C; approval Azure e assinatura Ed25519 owner **real**, pin PEM aprovado e owner person ID; três revisores independentes aprovados; autorização expressa de transação/backup/restore/rollback, janela/RPO/RTO, acesso ao ambiente protegido sf-release e decisão de promotion/rulesets (fora A9).

**A7/dono do ambiente:** RG/subscription/VM FQDN IP ou Bastion/Azure Run Command e service UID real (sem chave/secret no chat); discos e deploy scripts no host; atualizar A7 package.py/bundle.py para copiar/validar factory policy tree 24 assets; staging imutável dos dois archives fora do checkout; Caddy/TLS/systemd com Web & factory de C; Artifact A7 final SHA256; storage backup/restauração em clone isolado e recibos assinados. A7 não deve pedir que A9 toque seus arquivos.

**A8/dono da identidade:** tenant ID, app registration clientId, redirect URIs, Key Vault **nome/URI do secret** e mecanismo de LoadCredential/MI (sem valor da senha), issuer/session/origin/cookie/CSRF reais; provisionar requester/holder/denied/(dashboardAdmin) distintos com concessão e negações originais; acesso CDP loopback privado, U39 CAP04/U40 CAP05 selected-installation originais, testemunhas Entra/CAS/revogação/producer; payload installer claim assinado via chave de instalador independente.

**A5/A6/A2:** X/Y/Z PR240 e suites U39/U40/fixed selected; reconciliar manifesto/8 recipes e recibos CI do C; corrigir drift do sf-factory-package producer (sourceSHA divergente de run head) **no próprio lease da factory**, não por A9; resolver ancestry do PR #249 antes de merge. Nenhuma dessas dependências pode ser convertida em PASS pelo A9.

**Resultado atual:** **PACOTE DE TESTE E GATE PREPARADOS, execuções AZ-04/AZ-05/U39/U40/AM/Q01 LIVE NOT_RUN, implantação/Entra/restore NO_GO**. Run 43988588834 prova a **factory de 55a366…** em Ubuntu, não C final; run 43988598685 deve ser **rejeitado para fonte C** por mismatch. Refreeze obrigatório ao mudar qualquer código, workflow, archive, hash, manifest ou original producer/identity relevante.
