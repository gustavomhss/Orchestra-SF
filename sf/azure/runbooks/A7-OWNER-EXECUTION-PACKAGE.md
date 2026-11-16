# A7 — PACOTE REAL DE IMPLANTAÇÃO AZURE (para execução pelo dono)

**Controle: 2026-11-16 · W1 PREPARED, EXECUTION NOT_RUN.** Estados: AZ-01=BLOCKED_BY_OWNER/ENV/SOURCE; AZ-03=BLOCKED_BY_OWNER/ENV. Não confundir CI de PR com Azure instalado, Microsoft autenticado ou go-live. A7 edita só sf/azure/{vm,runtime,data,recovery,runbooks}/**; A8 é DRI de identidade/factory, A9 de F04/AM, A10 de freeze C e workflow release. O histórico azure-hardening tem Caddy 503, não app SF.

## 1. O que VOCÊ (dono) deve me entregar — checklist por degrau

### D0 — Acesso e prova da VM (libera só preflight)

- [ ] Subscription ID + tenant de recurso, resource group, VM resource ID, VM name, região/zone, output real de deployment orchsf-foundation (fqdn, publicOrigin, vmName, dataDiskId, backupVaultName, protectedItemName).
- [ ] **IP público e IP privado**, DNS FQDN e URL HTTPS, certificado válido e política 80/443; NSG/firewall/subnet/VNet reais. A foundation não abre porta 22: informar SSH por Bastion, Azure Run Command ou VPN privada + username técnico e fingerprint de host. **Nunca enviar private key SSH, password, bearer ou cookie em chat/Git.**
- [ ] Azure managed disk id LUN0, UUID ext4, mount de /var/lib/orchestra-sf, UID/GID da conta orchestra-sf, cloud-init done, status do caddy e estado do Caddyfile (503 esperado ANTES da ativação).
- [ ] Nome do operador autorizado, janela, custo/RTO/RPO, permissão de rollback, prova de backup pré-migração, plano de manutenção.

Receita de coleta sanitizada na VM real (somente leitura):
~~~bash
uname -sm
cloud-init status
id orchestra-sf
findmnt -o SOURCE,TARGET,FSTYPE /var/lib/orchestra-sf
sudo blkid /dev/disk/azure/scsi1/lun0
systemctl is-active caddy
curl -sS -I https://REQUIRES_REAL_FQDN
~~~
A7 executa depois do acesso: sudo python3 /opt/orchestra-sf/source-C/sf/azure/vm/deploy.py preflight. Um 503 HTTPS não é sucesso de AZ-01.

### D1 — Freeze C, factory e pacote imutável (libera só stage)

- [ ] **C de 40 hex** e Git tree SHA de 40 hex, com run de CI fresco exatamente em C; preflight/static/Omni/5 Bun/3 browser/sf/verify verdadeiramente GREEN; A10 registra run_id, attempt, job IDs, 8 receipts e hash de todos os inputs. Um merge-ref diferente de C não vale.
- [ ] Checkout C limpo contendo estas ferramentas A7, proveniência de Bun/toolchain e Linux x86_64 glibc. CLI built (apps/cli/dist/cli-linux-x64/bin/orchestra) e Web built (apps/web/dist/index.html), addon Omni (bin/hugr_omni.node) e supervisor (bin/hugr-omni-supervisor), todos da fábrica original.
- [ ] **A8**: trusted factory absoluto que produz a instalação SF e configura Entra, owner/project/host/origin; factory SHA256 64 hex e revisão independente da fonte. Não criar stub/dummy só para empacotar.
- [ ] Artifact SHA256, ID/URL imutável do artefato, manifest interno file-by-file, hash de factory/Omni/CLI/Web, atestado do produtor e storage de distribuição privado. Não fazer download de branch móvel.
- [ ] Comprovação A8 de migração reversível (ou plano de restore clone obrigatório antes da ativação), schema versions, diretórios de dados e integração com o produtor original.

No **builder Linux x64** em checkout C:
~~~bash
C=REQUIRES_C_40_HEX
TREE=REQUIRES_TREE_40_HEX
FACTORY=/PRIVATE/A8/installation.mjs
FACTORY_SHA=REQUIRES_A8_SHA256_64_HEX
test "$(git rev-parse HEAD)" = "$C"
test "$(git rev-parse 'HEAD^{tree}')" = "$TREE"
bun install --frozen-lockfile
bun --cwd apps/web build
bun run apps/cli/script/build.ts --target linux-x64
python3 sf/azure/runtime/package.py --candidate "$C" --tree "$TREE" \
  --factory "$FACTORY" --factory-sha "$FACTORY_SHA" \
  --output /PRIVATE/ARTIFACT/orchestra-sf-linux-x64.tar.gz
sha256sum /PRIVATE/ARTIFACT/orchestra-sf-linux-x64.tar.gz
~~~
Em caso de Omni ausente, web vazio, ELF errado, checkout/manifest divergente, package.py falha: não afrouxar flags nem substituir o binário. A fábrica **não** cria secrets nem valida sign-in; A8 faz essa prova separada.

### D2 — A8 Entra/ativação de produção (libera activate após autorização A10)

- [ ] PublicOrigin=https://FQDN, mount real SF, listenerOrigin interno http://127.0.0.1:4096 e ingresso/origem de Host compatíveis com o produtor. O CLI recusa Host diferente de ingressOrigin. A8 determina o binding correto; nunca habilitar CORS aberto ou remover validação Host.
- [ ] Tenant issuer, clientId, redirect URI, consentimento, authority/claims, CSRF/state/nonce, cookie HttpOnly/Secure/SameSite e expiry/revogação, principalRef real, installationId/projectId/hostId reais; negativas anônimo/ator denied/cross-owner. Registrar sem enviar credenciais ao agente.
- [ ] Secrets OIDC e keys através de KeyVault/arquivos privados fora do repo; A8 fornece cookie de sessão Microsoft **real** de navegador autorizado para o teste positivo num arquivo EFÊMERO root 0600, uma linha iniciada por Cookie: (não em argv/stdout/artefato). Revogar/apagar após prova.
- [ ] Approval humano para C exato/tree/digest/janela/backup/risco; ambiente protegido do A10. Sem isso Caddy permanece 503.
- [ ] DNS e CA reais; health positivo exige **bytes exatos de Web** e contexto original Microsoft, não apenas HTTP 200.

Na VM, dono cria /etc/orchestra-sf/owner.json **root 0600** (dir root 0700) com dados substituídos e aprovados:
~~~json
{
  "schema": "orchestra-sf.azure-owner.v1",
  "fqdn": "REQUIRES_REAL_FQDN",
  "publicOrigin": "https://REQUIRES_REAL_FQDN",
  "port": 4096,
  "mount": "/REQUIRES_REAL_A8_MOUNT",
  "installationId": "REQUIRES_REAL_A8_INSTALLATION",
  "projectId": "REQUIRES_REAL_A8_PROJECT",
  "hostId": "REQUIRES_REAL_A8_HOST",
  "principalRef": "REQUIRES_REAL_A8_PRINCIPAL",
  "diskUuid": "REQUIRES_REAL_EXT4_UUID_LUN0"
}
~~~
Todo literal REQUIRES_* é sentinela, não valor para executar. O digest do pacote e fonte C devem chegar de canal imutável confiável, não de clipboard sem prova. A aprovação humana root 0600 em /etc/orchestra-sf/approve-C.json:
~~~json
{
  "schema": "orchestra-sf.azure-approval.v1",
  "action": "ACTIVATE",
  "candidateSha": "REQUIRES_C_40_HEX",
  "treeSha": "REQUIRES_TREE_40_HEX",
  "bundleSha256": "REQUIRES_PACKAGE_SHA_64_HEX",
  "approver": "REQUIRES_AUTHORIZED_OWNER",
  "approvedAtUtc": "REQUIRES_REAL_ISO_UTC_Z"
}
~~~
Esse JSON registra uma decisão, **não** é assinatura criptográfica. A10 confirma autorização, assinatura e ambiente protegido por trilha independente antes de W4. O operador mantém secrets fora do environment-file público.

Na VM com checkout de C **exatamente** em /opt/orchestra-sf/source-C (proibido mudar de C entre G1/G2/G3):
~~~bash
SRC=/opt/orchestra-sf/source-C
C=REQUIRES_C_40_HEX
TREE=REQUIRES_TREE_40_HEX
SHA=REQUIRES_PACKAGE_SHA_64_HEX
PACKAGE=/PRIVATE/INBOX/orchestra-sf-linux-x64.tar.gz
sudo python3 "$SRC/sf/azure/vm/deploy.py" preflight
sudo python3 "$SRC/sf/azure/vm/deploy.py" stage \
  --candidate "$C" --tree "$TREE" --bundle "$PACKAGE" --bundle-sha "$SHA"
# STOP até A10 e A8 aprovarem e o checkpoint ser recuperável.
sudo python3 "$SRC/sf/azure/vm/deploy.py" activate \
  --candidate "$C" --tree "$TREE" --bundle-sha "$SHA" \
  --approval /etc/orchestra-sf/approve-C.json \
  --cookie /etc/orchestra-sf/A8-real-browser-cookie
~~~
Stage copia artefato autenticado para /opt/orchestra-sf/releases/C root-owned e é idempotente com hash igual; **não ativa**. Activate valida systemd User=orchestra-sf e loopback, Caddy TLS e prova HTML sha256 + 401/403 anônimo + 200 Microsoft com stamps owner/projeto/host/policy/access/principal; em erro restaura Caddy anterior e para serviço **sem downgrade automático de DB**. Não reexecutar bootstrap.sh: substitui proxy com resposta 503.

### D3 — AZ-03 real: backup, restore, rollback e F04 (libera aceite somente após provas)

- [ ] Recovery Services Vault, RG, policy real, container-name da listagem Azure, protectedItemName, Backup job ID Operation=Backup Status=Completed, recoveryPointName/Time, classificação de consistência, RPO/RTO/retention observados. Não confundir ConfigureBackup, Vault policy e restore.
- [ ] Backup de SQLite e demais produtores com escrita drenada (Task/Relay) e app parado, sem copiar SQLite/WAL live; mídia de backup cifrada em disco diferente do volume, root 0700, hash/manifest assinado. Responsável A8 aprova isolamento/revogação.
- [ ] VM clone separada, resource ID IMDS diferente, RG e storage account de restore separados, disco/nova rede isolada **sem** egress para CTRM/Graph/Webhook, credenciais desativadas, sem DNS de produção; restaurar discos **somente** AlternateLocation. Nenhum restore em produção.
- [ ] Restore job Completed com recoveryPoint exato, montagem segura no clone, SQLite integrity + arquivos originais/permissions, leitura de revisão antes/depois, mutação original authorized e negativa CAS 409/422, restart e migração idempotentes, backup failure injection + RPO/RTO mensurados.
- [ ] A8/A9: runner Linux Actions protegido + installed manifest real 0600, scratchRoot 0700, BrowserContext original com login Microsoft, atores requester/holder/denied, duas jornadas U39/U40 e 8 recipes + AM01–AM06 sem skip.
- [ ] A10: 3 cold reviews independentes, log do release protegido ligando C/artifact ao mesmo SHA, owner aprova; ruleset/required checks não alterados antes de evidência.

Para checkpoint root-owned, aprovação root 0600 com schema orchestra-sf.azure-recovery-approval.v1, action QUIESCE_CHECKPOINT, approver/approvedAtUtc, candidateSha/treeSha reais, writesBlockedByOwner=true e taskRelayDrainedByOwner=true, apenas DEPOIS de ato real do dono/A8. O checkpoint **pára o serviço e não religa**:
~~~bash
sudo python3 "$SRC/sf/azure/recovery/recovery.py" checkpoint \
  --candidate "$C" --tree "$TREE" \
  --output-dir /PRIVATE/ENCRYPTED-SEPARATE-DISK/backup \
  --approval /etc/orchestra-sf/approve-checkpoint.json
~~~
Para disparar Azure Backup via CLI Azure autenticada com RBAC (fora do repo), aprovação mesma schema com action AZURE_BACKUP e valores resourceGroup, vault, container, item exatos:
~~~bash
sudo python3 "$SRC/sf/azure/recovery/recovery.py" vault-backup \
  --resource-group REQUIRES_RG --vault REQUIRES_VAULT \
  --container REQUIRES_API_CONTAINER --item REQUIRES_PROTECTED_ITEM \
  --retain-until REQUIRES_DD-MM-YYYY_UTC \
  --checkpoint-receipt /PRIVATE/ENCRYPTED-SEPARATE-DISK/backup/ACTUAL.tar.gz.json \
  --approval /etc/orchestra-sf/approve-backup.json
~~~
Após, consultar az backup recoverypoint list e validar RPO, timestamp, job, VM, consistency antes de liberar writes. O CLI Azure documenta --retain-until no formato UTC d-m-Y.

Restore (aprovação privada com action RESTORE_DISKS_ISOLATED e resourceGroup, targetResourceGroup, recoveryPoint reais):
~~~bash
sudo python3 "$SRC/sf/azure/recovery/recovery.py" vault-restore-disks \
  --source-group REQUIRES_SOURCE_RG --target-group REQUIRES_ISOLATED_RG \
  --vault REQUIRES_VAULT --container REQUIRES_CONTAINER \
  --item REQUIRES_ITEM --recovery-point REQUIRES_RP \
  --storage-account REQUIRES_STORAGE --approval /etc/orchestra-sf/approve-restore.json
# Após conferir resource IDs/egress, no CLONE (não na VM ativa):
sudo python3 "$SRC/sf/azure/recovery/recovery.py" verify-clone \
  --clone-role /PRIVATE/clone-role.json \
  --archive /PRIVATE/backup/ACTUAL.tar.gz \
  --receipt /PRIVATE/backup/ACTUAL.tar.gz.json \
  --target /mnt/orchestra-sf-restore
~~~
verify-clone atesta integridade local em clone isolado, **não** equivale a provar que Azure disk restore foi montado, nem transação restaurada: essas provas são passos humanos/runner separados, fail-closed. Não usar OriginalLocation ou anexar disco RW em duas VMs.

F04 transação **original** (não Playwright mock). Requer que o runner real defina automaticamente GITHUB_ACTIONS=true / RUNNER_OS=Linux / RUNNER_ARCH=X64, que A9 instale suas sessões CDP e manifesto e que o dono autorize RUN_REAL_PRODUCER_MUTATION para C em arquivo privado 0600. A7 não seta essas variáveis para simular Actions:
~~~bash
SF_NATIVE_CANDIDATE_SHA="$C" \
SF_NATIVE_INSTALLED_MANIFEST=/PRIVATE/F04/installed-manifest.json \
SF_A7_TRANSACTION_APPROVAL=/PRIVATE/F04/approve-transaction.json \
SF_A7_PROOF_DIR=/PRIVATE/F04/results \
  bash sf/azure/runtime/smoke-transaction.sh
~~~
O script executa os casos U39/U40 do produtor: UI create/edit/delete com CAS e mensal versionado; exige 2 casos reais por spec, status PASS sem retry/skip, JSON somente em diretório privado do runner. Não produz auth, cookies, approval nem fixture de produtor. F04 mais amplo e 8 recipes/AM01–06 são responsabilidade A9.

Rollback código SOMENTE se antiga versão é compatível com schema atual e dono aprovar via root 0600 schema orchestra-sf.azure-recovery-approval.v1, action ROLLBACK_CODE_COMPATIBLE, currentCandidate, targetCandidate, schemaCompatibilityProofSha256 (hash da prova independente), writesBlockedByOwner=true, approver e approvedAtUtc:
~~~bash
sudo python3 "$SRC/sf/azure/recovery/recovery.py" rollback-code \
  --target-candidate REQUIRES_OLD_C --target-tree REQUIRES_OLD_TREE \
  --target-archive-sha REQUIRES_OLD_BUNDLE_SHA256 \
  --approval /etc/orchestra-sf/approve-rollback.json \
  --cookie /etc/orchestra-sf/A8-real-browser-cookie
~~~
Schema incompatível: STOP, colocar app em manutenção, restaurar/reconciliar em ambiente isolado, obter decisão do dono sobre escritas pós-ponto de recuperação; jamais downgrade automático no volume vivo.

## 2.1 O que cada ferramenta PROVA, e o que NÃO prova

| Tool | Prova positiva se executada no local real | Não pode alegar |
|---|---|---|
| package.py / bundle.py | Integridade file-by-file e destino Linux x86_64 de C | C seguro, factory OIDC, deploy Azure |
| deploy.py preflight/stage | Config VM/disk/identidade Linux, arquivo imutável staged | Serviço funcionando |
| deploy.py activate + identity_health.py | systemd não-root, HTTPS com Web hash, sessão Microsoft/owner/stamps | Mutação, PITR, release |
| smoke-transaction.sh | U39/U40 create/edit/delete e CAS do produtor instalado | Todas 8 recipes/AM/F04 ou política Azure |
| recovery.py checkpoint | DB legível/integridade com processo parado, snapshot local com digest | Vault protection / RPO |
| recovery.py vault-backup / restore-disks | Jobs Azure Backup/Restore reais com IDs/Completed | App de clone íntegra, auth ou CAS |
| recovery.py verify-clone | Exame offline de arquivo em host Azure isolado real | Restore Azure e smoke de negócio completos |
| recovery.py rollback-code | Troca de C imutável com approval, health de leitura | Recuperação sem perda de dados |

## 4. Escada de aceitação

1. **VM_ACCESS_VERIFIED:** D0, identidade host/IP/SSL/disk/UID e preflight observados; apenas infraestrutura.
2. **C_ARTIFACT_STAGED:** D1, produto CI FULL GREEN no SHA C, tree/digest, CLI+Omni+Web+factory/manifest e stage determinísticos.
3. **AZ-01_READY:** D2, A8 Microsoft/origin/CSRF real, HTTPS/Web hashes, systemd, restart com readback + smoke de transação original, negativas sem sessão/cross-owner.
4. **AZ-03_READY:** D3, backup Azure Completed/recovery point e aplicação consistente, restore isolado **do mesmo C** com dados/CAS e failure injection/rollback, RPO/RTO medidos.
5. **AZURE_RELEASE_QUALIFIED:** só depois de AZ-01..08, F04/U39/U40, AM01..AM06/8 recipes, três revisores independentes, environment protected e decisão explícita do dono (A10). PR #248 e jobs verdes não mudam esta flag.

Nenhuma ação destrutiva executada pelo A7 nesta entrega, nenhum segredo criado, nenhum merge/label/required check alterado. O shell Azure fica BLOCKED até o dono fornecer os insumos acima. Path do pacote: sf/azure/runbooks/A7-OWNER-EXECUTION-PACKAGE.md.

**Fontes no repositório:** sf/ci/GPT-PLAN-10.md §A7; sf/release-target.json; apps/cli/script/build.ts e packages/script/src/omni.ts (compilação CLI/Omni); apps/cli/src/commands/handlers/serve.ts e sucafina-product/installation.ts (host/origem); packages/server/src/web-ui.ts (frontend); packages/app-shell/e2e/sucafina/native/fixture/readiness.ts + journeys/u39/u40.spec.ts (evidência original); histórico azure-hardening@22d8da9948810562deed2b051d4903d80d6f2370 (somente fundação).
