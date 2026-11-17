# A7 — implantação real via Azure Run Command: factory + Managed Identity

**FLAMENGO — atualização do dono (2026-11-16):** os valores de tenant, client, 11 grupos e origin HTTPS estão preenchidos em [flamengo-microsoft.example.json](../runtime/flamengo-microsoft.example.json), com paths não secretos em [runtime.env.flamengo.example](../runtime/runtime.env.flamengo.example). **O único origin não decidido é ingressOrigin**, deliberadamente inválido no exemplo até A8 observar o Host encaminhado por Caddy. Leia [A7-FLAMENGO-MICROSOFT-INGRESS.md](./A7-FLAMENGO-MICROSOFT-INGRESS.md) antes de executar qualquer passo daqui. O mapeamento dos grupos NÃO é prova de membership/autoridade dos atores; grants permanecem [] até os objectIds e capacidades reais serem admitidos.

**Status: PREPARED_NOT_RUN — AZ-01 e AZ-03 seguem BLOCKED_BY_OWNER/ENV.** PR #248 continua DRAFT. Nenhum comando abaixo foi executado. Este runbook substitui as instruções legadas para o bundle experimental; a fábrica CI REAL tem `bin/orchestra`, `bin/web`, `bin/local/entry.mjs`, `distribution.json` e `checksums.sha256`, target `linux-x64-baseline`. Os scripts antigos `sf/azure/vm/deploy.py` e `sf/azure/runtime/package.py` NÃO são compatíveis com esse tar.

## 1. Inventário aceito do dono (não pedir novamente)

- RG Azure: `orchestra-sf-mvp`. VM managed identity system-assigned principalId `5cd0de58-fa3f-4ceb-bb0e-9455955bf07f`, role Key Vault Secrets User no `kv-orchsf-2611162127`. IMDS token OK; GET segredo `entra-client-secret` HTTP 200 (40 bytes). Segredo não foi fornecido e não deve ser.
- Linux x86_64, disco 64 GiB montado em `/var/lib/orchestra-sf`, owner orchestra-sf 0700; `/opt/orchestra-sf` root 0755; `/etc/orchestra-sf` root 0700; orchestra-sf sem login. Caddy ativo com respond 503.
- CI app-build `43982346743`: artefato nativo ELF x64 com bin/orchestra e bin/web. Provas factory nos runs `43988588834`/`43988598685`: tar.gz Linux-x64-baseline extraído FORA do checkout e GET `http://localhost:4110/sucafina/status` 200. Isso não prova Entra, HTTPS, backup ou produto verde. Produzir/atestar factory no mesmo C final congelado por A10.

**Distinguir os digests:** o Actions artifact é ZIP; `archiveSha256` do `factory-package-receipt.json` refere-se ao TAR.GZ interno `orchestra-sf-factory-linux-x64-baseline.tar.gz`. O instalador recebe o TAR e o SHA do TAR, nunca ZIP/digest do upload.

## 2. Lista EXATA de placeholders para o dono/A8/A10

| Placeholder a preencher | Fonte e condições |
| --- | --- |
| `AZ_SUBSCRIPTION_ID` | Assinatura Azure contendo RG orchestra-sf-mvp. |
| `AZ_VM_NAME` | Nome real da VM no RG, confirmado por az vm show. IP/FQDN e fingerprint TLS devem ser inventariados, sem presumir SSH público. |
| `SF_FQDN` | **FORNECIDO: `orchsf-spug5rxxyqkdw.swedencentral.cloudapp.azure.com`** (ainda confirmar DNS/certificado efetivamente servido pela VM; não inventar prova de TLS). |
| `SF_C` | Commit Git C exato de 40 hex congelado por A10, CI sf/verify FULL GREEN no C e factory proof nova com sourceSHA == C. Não usar PR merge SHA divergente. |
| `SF_FACTORY_TAR_ON_VM` | Caminho absoluto do TAR.GZ interno produzido no mesmo run/attempt de factory. |
| `SF_FACTORY_TAR_SHA256` | SHA256 64 hex do TAR.GZ interno, idêntico a factory-package-receipt.archiveSha256. |
| `SF_FACTORY_RECEIPT_ON_VM` | Caminho absoluto do factory-package-receipt.json desse mesmo TAR/run/C. |
| `A7_OPERATOR_TREE_ON_VM` | Código A7 revisado, root-owned e SHA verificado, em /opt/orchestra-sf/operator (copiar via Bastion/SCP/transferência privada aprovada antes de Run Command). |
| `SF_PRIVATE_CONFIG_DIR` | Diretório absoluto no volume /var/lib/orchestra-sf/home, owner orchestra-sf 0700, configuração/keys originais do A8. |
| `SF_ENTRA_TENANT_ID`, `SF_ENTRA_CLIENT_ID`, `SF_A8_GRANTS_GROUPS_WORKSPACE` | **Tenant já fornecido `449dfd17-d627-45da-b22c-1be49d8df99f` e clientId `9006dcb8-1a75-4886-9475-1e7f1dc5d7cd`; 11 grupos já no exemplo.** Resta A8 aprovar **objectIds/grants de operações**, memberships reais e provisionar workspace privado (paths propostos no exemplo, não observados). |
| `SF_A8_OWNER_JSON`, `SF_A8_COOKIE_FILE` | Arquivos root 0600 de binding e sessão Microsoft reais, providos por A8 para prova HTTP positiva, não impressos. |
| `SF_OLD_C` | SHA 40 hex de uma release anterior compatível e retida. Sem anterior, rollback de versão = NOT_RUN. |
| `A10_COMPATIBILITY_PROOF`, `A10_ROLLBACK_APPROVAL` | Arquivos JSON root 0600, hash do laudo de schema/backup, revisão independente e autorização humana; ver G7. |
| `SF_A10_RELEASE_APPROVAL` | Congelamento C, autorização de janela, backup/restore, A8/F04, 3 revisores, environment e go/no-go do dono; não vira variável que cria PASS. |

**Não são placeholders:** vault `kv-orchsf-2611162127`, segredo `entra-client-secret`, managed principalId, RG, Linux user, volume, loopback port 4096, mount `/sucafina`.

## 3. Contrato da instalação, arquivos entregues

- `sf/azure/vm/install-factory-distribution.py`: modo install recebe --artifact, --sha256, --receipt, --candidate, --fqdn e ou --dry-run ou --apply. Verifica SHA tar **antes de qualquer write**, run receipt SHA=C, JSON, checksums de todos os arquivos, factory closure, ELF/Omni/Web, nega symlinks/hardlinks/traversal; stage em `/opt/orchestra-sf/releases/C` root/read-only; `current` symlink atômico; mantém anterior. Switch real somente com Caddy 503 + serviço parado. --dry-run não cria nem lock. Repetir o mesmo C+tar compara bytes, não reextrai.
- `sf/azure/runtime/materialize-entra-secret.sh`: ExecStartPre root via prefixo +, usa IMDS 169.254.169.254 com Metadata:true e Key Vault REST HTTPS default CA; token + resposta só em tmpfs root 0700, bearer em config curl 0600 (não argv/log); valida id/value, grava atomicamente client-secret.txt owner orchestra-sf modo 0600, sem expor valor. Falha de IMDS/403/TLS/JSON/permissão => não inicia serviço.
- `sf/azure/runtime/orchestra-sf.service`: User=orchestra-sf, Group=orchestra-sf, EnvironmentFile=/etc/orchestra-sf/runtime.env, WorkingDirectory=/var/lib/orchestra-sf/home, ORCHESTRA_WEB_UI_DIR=/opt/orchestra-sf/current/bin/web. ExecStart usa `bin/orchestra serve --hostname 127.0.0.1 --port 4096 --allowed-host SF_FQDN --installation /opt/orchestra-sf/current/bin/local/entry.mjs`. Processo principal nunca vira root.
- `sf/azure/runtime/Caddyfile.template` e `sf/azure/vm/caddy-switch.py`: troca 503/proxy com Caddy validate ANTES do reload e rollback da config anterior se reload falhar; Host preservado e URI /sucafina SEM rewrite/strip.
- `sf/azure/vm/probe-serving.py`: unit User/porta loopback, local e public /sucafina/status=200, TLS default CA, Web index bytes SHA do manifest de C, opcional A8 Microsoft context com 401/403 anônimo e 200 ator verdadeiro; NÃO faz transação, F04 ou backup.

## 4. Configuração A8 privada antes do serviço (NÃO criar identidade fake)

A8 deve criar `SF_PRIVATE_CONFIG_DIR/installation.json` com UID orchestra-sf, 0600, dir 0700; keys `session.key`, `bank.key`, `assets.key` de 32 bytes (0600), `host-credential.key` 0600 e dirs host-data/config/cache/state/tmp privados. Microsoft profile exige:
- `deployment=azure-https`, `authentication=microsoft`, `origin=https://SF_FQDN`;
- `listenerOrigin=http://127.0.0.1:4096`; `ingressOrigin` **AINDA NÃO RESOLVIDO**: o valor esperado é `http://SF_FQDN` somente **se** o Host realmente entregue por Caddy for `SF_FQDN` sem porta. Não preencher sem verificação do Host; veja A7-FLAMENGO-MICROSOFT-INGRESS.md.
- `mount=/sucafina`, tenantId/clientId reais, grants/grupos/workspaceDirectory separados do config. `SUCAFINA_LOCAL_CONFIG` deve estar AUSENTE.
- `SUCAFINA_MICROSOFT_CONFIG` absoluto apontando para installation.json. Chave cliente virá do Key Vault **apenas no ExecStartPre**.

Para **FLAMENGO**, preparar `/etc/orchestra-sf/runtime.env` root:root 0600 a partir de `sf/azure/runtime/runtime.env.flamengo.example` (FQDN e paths não secretos já explícitos, sujeitos à escolha/provisionamento A8). O template genérico `runtime.env.example` continua disponível apenas para outras organizações. Não colocar valor de segredo em env. O systemd manager root lê EnvironmentFile; o processo não-root não lê /etc/orchestra-sf.

## 5. Ordem exata de execução pelo dono (G0–G8), NOT_RUN pelo A7

### G0 — congelamento e material (READ-ONLY)

A10 verifica PRODUCT_CI_GREEN sf/verify no SHA C, receipts e factory run no **mesmo C**. Operador baixa artifact ZIP autorizado da factory, extrai TAR interno e JSON de recibo, confere sha256sum TAR==archiveSha256, sourceSHA==SF_C e target==linux-x64-baseline. Envia TAR/recibo e scripts A7 (hash verificado e root-owned) à VM por canal privado; Run Command não copia automaticamente arquivos citados por caminho. NÃO usar digest do ZIP nem a distribuição app-build antiga sem factory.

No shell operador (substituir placeholders por valores reais):
~~~bash
AZ_RG=orchestra-sf-mvp
AZ_VM_NAME=REQUIRES_VM_NAME
AZ_SUBSCRIPTION_ID=REQUIRES_SUBSCRIPTION_ID
SF_FQDN=REQUIRES_REAL_FQDN
SF_C=REQUIRES_FROZEN_C_40HEX
SF_FACTORY_TAR_ON_VM=/PRIVATE/INBOX/orchestra-sf-factory-linux-x64-baseline.tar.gz
SF_FACTORY_TAR_SHA256=REQUIRES_INNER_TAR_SHA256_64HEX
SF_FACTORY_RECEIPT_ON_VM=/PRIVATE/INBOX/factory-package-receipt.json
A7_OPERATOR_TREE_ON_VM=/opt/orchestra-sf/operator
az account set --subscription "$AZ_SUBSCRIPTION_ID"
az vm show -g "$AZ_RG" -n "$AZ_VM_NAME" --query '{name:name,principal:identity.principalId}' -o json
~~~
O principal deve ser o da identidade informada; qualquer drift/source C diferente = STOP. Azure Run Command exige RBAC Microsoft.Compute/virtualMachines/runCommands/write (não SSH público).

### G1 — dry-run (nenhuma alteração)

Na CLI do operador, o comando envia apenas uma linha de shell (sem segredo) ao VM Agent; código e TAR já precisam existir na VM:
~~~bash
az vm run-command invoke -g "$AZ_RG" -n "$AZ_VM_NAME" --command-id RunShellScript \
  --scripts "python3 $A7_OPERATOR_TREE_ON_VM/sf/azure/vm/install-factory-distribution.py install --artifact '$SF_FACTORY_TAR_ON_VM' --sha256 '$SF_FACTORY_TAR_SHA256' --receipt '$SF_FACTORY_RECEIPT_ON_VM' --candidate '$SF_C' --fqdn '$SF_FQDN' --dry-run"
~~~
Esperado DRY_RUN_NO_WRITES. Digest errado/ZIP no lugar do tar/receipt ou factory inválido => STOP e **zero alterações** no disco, lock ou symlink.

### G2 — janela, Caddy 503 e stop/dreno

Dono/A10 libera janela e backup/capacidade de retorno. Se upgrade: primeiro manter HTTPS 503 (`caddy-switch.py --mode maintenance --fqdn SF_FQDN --apply`) com config validada; bloquear novas gravações/drenar Task+Relay e parar `systemctl stop orchestra-sf.service`. Primeira instalação já parte de Caddy 503. Se app ativa ou Caddy proxy, installer --apply RECUSA switch. Sem backup, STOP.

### G3 — instalar release (SEM abrir tráfego)

Repetir comando G1 com mudança ÚNICA `--dry-run` para `--apply`. Verificar resposta INSTALLED_NOT_STARTED_CADDY_STILL_503 e leitura do symlink current → releases/SF_C; staging é root-owned e imutável. A primeira falha de hash não escreve nem lock. Mesma archive em nova rodada é idempotente; arquivo diferente sob SHA igual é rejeitado. Não inicia serviço nem Caddy.

### G4 — instalar unit/secret materializer (ainda Caddy 503)

A8 já provisionou config/keys/runtime.env. Inspecionar qualquer unit preexistente com diff e obter autorização antes de substituir. Executar via Run Command root:
~~~bash
install -d -o root -g root -m 0755 /usr/local/libexec/orchestra-sf
install -o root -g root -m 0755 /opt/orchestra-sf/operator/sf/azure/runtime/materialize-entra-secret.sh /usr/local/libexec/orchestra-sf/materialize-entra-secret.sh
install -o root -g root -m 0644 /opt/orchestra-sf/operator/sf/azure/runtime/orchestra-sf.service /etc/systemd/system/orchestra-sf.service
systemd-analyze verify /etc/systemd/system/orchestra-sf.service
systemctl daemon-reload
~~~
Validar runtime.env root:root 0600 e A8 config/keys antes de start; não criar client-secret placeholder. Prestart root materializa secret cada start; qualquer falha para start. JAMAIS executar `cat client-secret.txt`.

### G5 — startup privado e verificação antes do proxy

~~~bash
systemctl start orchestra-sf.service
systemctl is-active --quiet orchestra-sf.service
stat -c '%U:%G %a %h %n' /var/lib/orchestra-sf/home/REQUIRES_PRIVATE_CONFIG_DIR/client-secret.txt
python3 /opt/orchestra-sf/operator/sf/azure/vm/probe-serving.py --fqdn REQUIRES_FQDN --candidate REQUIRES_C_40HEX --local-only
~~~
Esperado owner/mode `orchestra-sf:orchestra-sf 600 1`, app rodando como orchestra-sf, loopback 127.0.0.1:4096, JSON /sucafina/status=200, login=configured-unverified. **Não significa login Microsoft válido.** Falha IMDS, KeyVault 403, permission, config, listener ou Host => serviço não sobe; Caddy permanece 503.

### G6 — Caddy validate antes de reload e smoke HTTPS

~~~bash
python3 /opt/orchestra-sf/operator/sf/azure/vm/caddy-switch.py --mode proxy --fqdn REQUIRES_FQDN --dry-run
python3 /opt/orchestra-sf/operator/sf/azure/vm/caddy-switch.py --mode proxy --fqdn REQUIRES_FQDN --apply
python3 /opt/orchestra-sf/operator/sf/azure/vm/probe-serving.py --fqdn REQUIRES_FQDN --candidate REQUIRES_C_40HEX
~~~
Caddy helper rejeita sites/config desconhecidos; gera Caddyfile temporário, chama `caddy validate --config` e só depois recarrega. Bloco real: `FQDN { reverse_proxy 127.0.0.1:4096 { header_up Host {host}; header_up -Forwarded } }`, sem `handle_path` e sem `strip_prefix`, preserva /sucafina. Teste externo exige CA TLS correta, /sucafina/status remoto == local, Web HTML hash igual a bin/web/index.html do mesmo C. Se falhar recarga, tenta restaurar config anterior, GO_LIVE RED.

A8 pode complementar com prova positiva **somente** quando já forneceu os arquivos privados (sem tokens em argv):
~~~bash
python3 /opt/orchestra-sf/operator/sf/azure/vm/probe-serving.py --fqdn REQUIRES_FQDN --candidate REQUIRES_C_40HEX \
  --owner-json /etc/orchestra-sf/A8-owner-binding.json \
  --auth-cookie-file /etc/orchestra-sf/A8-real-browser-session.cookie
~~~
Exige 401/403 anônimo, 200 com sessão Microsoft verdadeira, owner/project/install/principalRef, policy/access stamps; não produz sessão falsa. A8 ainda comprova OIDC/CSRF/revogação e A9 transações reais/U39-U40/F04/AM/8 recipes.

### G7 — rollback ensaiado com release antiga, reload e teste

Sem release anterior retida, ou schema incompatível, ou sem backup/approval, marcar BLOCKED_BY_OWNER/ENV — jamais trocar binário velho na DB migrada. Dois arquivos root 0600 exigidos:

`A10_COMPATIBILITY_PROOF` JSON: schema orchestra-sf.azure-migration-compatibility.v1; currentCandidate=SF_C, targetCandidate=SF_OLD_C, compatible=true, reviewer=REVISOR_INDEPENDENTE.

`A10_ROLLBACK_APPROVAL` JSON: schema orchestra-sf.a7-code-rollback-approval.v1; fromCandidate=SF_C, toCandidate=SF_OLD_C, schemaCompatible=true, compatibilityProofSha256=SHA256 real do proof, approvedBy=DONO distinto do reviewer, approvedAtUtc ISO UTC Z, backupRecoveryPointId=RECOVERY_POINT_AZURE_REAL.

Na VM, nesta ordem (autorização humana efetiva):
~~~bash
python3 /opt/orchestra-sf/operator/sf/azure/vm/caddy-switch.py --mode maintenance --fqdn REQUIRES_FQDN --apply
# Confirmar HTTPS 503; drenar writes/Task/Relay.
systemctl stop orchestra-sf.service
python3 /opt/orchestra-sf/operator/sf/azure/vm/install-factory-distribution.py rollback \
  --from-candidate REQUIRES_CURRENT_C_40HEX --to-candidate REQUIRES_PREVIOUS_C_40HEX \
  --approval /etc/orchestra-sf/A10-rollback-approval.json \
  --compatibility-proof /etc/orchestra-sf/A10-schema-compatibility.json \
  --fqdn REQUIRES_FQDN --dry-run
# Revisão humana; repetir só com --apply.
systemctl start orchestra-sf.service
python3 /opt/orchestra-sf/operator/sf/azure/vm/probe-serving.py --fqdn REQUIRES_FQDN --candidate REQUIRES_PREVIOUS_C_40HEX --local-only
python3 /opt/orchestra-sf/operator/sf/azure/vm/caddy-switch.py --mode proxy --fqdn REQUIRES_FQDN --apply
python3 /opt/orchestra-sf/operator/sf/azure/vm/probe-serving.py --fqdn REQUIRES_FQDN --candidate REQUIRES_PREVIOUS_C_40HEX
~~~
Aceite de rollback de C requer current→release anterior, systemd user, novo ExecStartPre/KeyVault, Caddy reload validado, TLS /sucafina/status=200 e Web hash da release ANTERIOR. Se erro: manter 503 e investigar, não aceitar HTTP 200 isolado nem restaurar DB sobre produção. O A7/A9 devem comprovar backup real e RESTORE ISOLADO Linux com CAS/actor/RPO/RTO para AZ-03 — não é inferível da troca de symlink.

### G8 — decisão posterior, não go-live automático

A10 confere C/tree, CI FULL, mesmo TAR/manifest, Microsoft real A8, F04/AM/8 recipes A9, backup/restore/rollback real A7, 3 revisores e environment protegido. Só o dono autoriza release e migração required-checks. Sem esses recibos `AZURE_RELEASE_QUALIFIED=BLOCKED`.

## 6. Matriz de falhas e recusa

| Fase | Falha concreta | Critério fail-closed |
| --- | --- | --- |
| G1/G3 | tar SHA256 diferente, ZIP em vez de TAR, receipt sourceSHA!=C, factory/Omni/Web/manifest ou checksums inválidos | STOP sem criar lock/release/current |
| G2/G3 | app ativa, Caddy não 503, /opt ou disco com UID/mount errado | STOP sem mover current |
| G4/G5 | keys/A8 Microsoft config ausentes; IMDS token, Vault HTTP 403, cert TLS, modo 0600, JSON ou credencial inválida | ExecStartPre !=0; serviço NÃO inicia, Caddy 503 |
| G6 | TLS sem CA, Caddy validate/reload falha, Host errado, prefixo /sucafina removido, hash Web não coincide | STOP/rollback config anterior e estado RED |
| G7 | sem release anterior, compatibilidade/backup inexistente, restart/health antigo falha | manter 503, sem downgrade/restore de DB |
| G8 | F04/AM/Entra/backup+restore reais ou 3 reviews ausentes | GOLIVE BLOQUEADO |

**Ownership:** A7 somente `sf/azure/{vm,runtime,recovery,runbooks}/**`; A8 identidade/OIDC/config; A9 F04/AM; A10 freeze/release. Nenhum path protegido, workflow de release ou settings GitHub alterado. Fontes: `microsoft-configuration.ts`, `microsoft-installation.ts`, `local/entry.ts`, `distribution-payload.ts`, `factory-distribution-linux.test.ts` e `sf/ci/GPT-PLAN-10.md` A7.
