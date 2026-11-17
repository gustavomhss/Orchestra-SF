# A7 / AZ-01 — Azure Linux VM: app, HTTPS, artefato e restart

> **SUPERSEDED FOR REAL CI FACTORY DEPLOYMENT (A7 2026-11-16):** This document is retained for W0/W1 provenance only. The CI-produced factory is `orchestra-distribution-v1`, with `bin/local/entry.mjs` and `bin/web`, NOT the earlier experimental `bundle.py`/`deploy.py` contract. **Do not run any deployment commands from this older document.** Use [`A7-REAL-FACTORY-MI-DEPLOY.md`](./A7-REAL-FACTORY-MI-DEPLOY.md) and its explicitly staged scripts. Nothing has been executed in Azure by A7.


**2026-11-16 — W0/W1: RUNBOOK_PREPARED; execução NOT_RUN / BLOCKED_BY_ENV + BLOCKED_BY_OWNER + BLOCKED_BY_SOURCE.** Este guia NÃO é autorização de deploy, troca do Caddy 503 ou liberação do sf-release.

## Base comprovada por leitura de fontes

- Plano sf/ci/GPT-PLAN-10.md: A7 escreve exclusivamente sf/azure/{vm,runtime,data,recovery,runbooks}/** e consome freeze C de A10. sf/release-target.json continua activation.status=BLOCKED. A8 controla identidade/origem; A10 controla workflow release.
- No branch azure-hardening@22d8da9948810562deed2b051d4903d80d6f2370, infra/azure/{README.md,main.bicep,bootstrap.sh} descreve fundação, não app instalada: Caddy devolve 503, Ubuntu 24.04 Linux x64, conta orchestra-sf, /opt/orchestra-sf, disco LUN 0 montado em /var/lib/orchestra-sf; NIC pública só 80/443. **A pasta infra/azure não está no branch sfa-vm**; não inferir que foi aplicada em Azure.
- apps/web/README.md e package.json: Vite build gera apps/web/dist e a CLI usa ORCHESTRA_WEB_UI_DIR; apps/cli/src/commands/handlers/serve.ts e commands.ts: comando serve aceita --hostname, --port, --allowed-host e --installation (exige porta explícita); apps/cli/src/sucafina-product/installation.ts exige factory de módulo confiado, path absoluto e coerência de origem/Host. Esses fatos NÃO provam um pacote de produção pronto para deploy.

## Bloqueios e insumos que só o dono/owners liberam

1. Dono Azure: subscription, RG, VM, saída real do deployment orchsf-foundation (fqdn, publicOrigin, vmName, dataDiskId), acesso autorizado, estado de cloud-init, DNS e cadeia TLS; não inventar nem publicar identificadores.
2. A10/A6: candidato congelado C de 40 hex + tree SHA, sf-ci FINAL de C, artefato imutável Linux + Web + Omni, artifact ID/digest SHA256, manifest de arquivos, invocação de produção reprodutível, aprovação para ativação; o head/merge-ref de PR não equivale automaticamente a C.
3. A8: factory SF real (trusted absolute path), mount, Microsoft Entra/OIDC, shellOrigin vs publicOrigin, sessões, credenciais somente por canal privado, Host/forwarding e CSRF; NUNCA substituir OIDC real por senha Basic nem afrouxar guards.
4. A7 + dono: nome de unidade, porta interna loopback, política de migração/compatibilidade com AZ-03, mecanismo de health **do produto** (a rota /health do plano não foi verificada no router) e smoke transacional, checkpoint pré-release.

Qualquer insumo ausente significa STOP / BLOCKED_BY_ENV, BLOCKED_BY_OWNER ou BLOCKED_BY_SOURCE. Não baixar build de branch móvel, não executar bootstrap.sh novamente após ativação (reinstala resposta Caddy 503), não trocar HTTPS por HTTP nem habilitar CORS aberto.

## Etapas W4 futuras (NÃO executadas hoje)

**A. Inspecionar a fundação no host autorizado, somente leitura:**

~~~bash
set -euo pipefail
test "$(uname -s)" = Linux
test "$(uname -m)" = x86_64
cloud-init status --wait
getent passwd orchestra-sf; getent group orchestra-sf
test ! -L /var/lib/orchestra-sf
test "$(findmnt -n -o TARGET --target /var/lib/orchestra-sf)" = /var/lib/orchestra-sf
test "$(readlink -f "$(findmnt -n -o SOURCE --target /var/lib/orchestra-sf)")" = "$(readlink -f /dev/disk/azure/scsi1/lun0)"
stat -c '%u:%g %a %n' /var/lib/orchestra-sf /var/lib/orchestra-sf/home
systemctl is-active caddy
~~~

Conferir dataDiskId do Azure com LUN real, filesystem e UID/GID do usuário técnico. A fundação descrita responde HTTPS 503; observar URL/certificado sem curl -k. Recusar symlink, ponto de montagem errado, usuário inesperado, cloud-init FAILED ou volume desconhecido.

**B. Preparar ativação sem executar antes do freeze/aprovação:**

O operador instala pacote de C por hash SHA256 em diretório somente leitura /opt/orchestra-sf/releases/<C>/{bin,web,manifest}, com dono root, rejeitando symlink/path traversal e dependências ausentes. Um symlink current aponta atomicamente para versão aprovada; pacote anterior continua intacto. Dados e HOME/XDG sempre em /var/lib/orchestra-sf/home no volume persistente. /etc/orchestra-sf permanece root 0700; secrets entregues fora do Git e sem tokens em argv, HTML, journald ou CI.

**Modelo de unidade systemd; NÃO aplicável literalmente antes de A8 confirmar factory e forma do binário:**

~~~ini
[Unit]
Description=Orchestra-SF Linux host
After=network-online.target
Wants=network-online.target
RequiresMountsFor=/var/lib/orchestra-sf
StartLimitIntervalSec=60
StartLimitBurst=3

[Service]
Type=simple
User=orchestra-sf
Group=orchestra-sf
WorkingDirectory=/var/lib/orchestra-sf/home
Environment=HOME=/var/lib/orchestra-sf/home
Environment=XDG_DATA_HOME=/var/lib/orchestra-sf/home/.local/share
Environment=ORCHESTRA_WEB_UI_DIR=/opt/orchestra-sf/current/web
EnvironmentFile=/etc/orchestra-sf/runtime.env
ExecStart=/opt/orchestra-sf/current/bin/orchestra serve --hostname 127.0.0.1 --port 4096 --allowed-host REQUIRES_OWNER_FQDN --installation /etc/orchestra-sf/REQUIRES_APPROVED_FACTORY
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/orchestra-sf
[Install]
WantedBy=multi-user.target
~~~

A existência de bin/orchestra, factory, env-file e compatibilidade de isolamento com Omni/Task/Permission/Relay é BLOQUEADA até validação real; não usar templates como prova. Arquivo env root 0600; verificar não vazamento e que o usuário orchestra-sf NÃO é root. Com A8, Caddy proposto TLS público e upstream só loopback 127.0.0.1:4096, preservando Host e não confiando em X-Forwarded-* cliente. Host/origin no loader são fail-closed; erro 403 exige correção legítima por A8, nunca abrir admissão. A10 autoriza o switch de Caddy 503 para proxy; A7 não edita sf-release.yml.

**C. Smoke e contraprovas em C instalado:**

~~~bash
set -euo pipefail
test -n "$SF_PUBLIC_ORIGIN" && test -n "$SF_SERVICE_NAME"
test -n "$SF_HEALTH_PATH" && test -n "$SF_ARTIFACT_PATH"
test "$(systemctl is-active "$SF_SERVICE_NAME")" = active
systemctl show "$SF_SERVICE_NAME" -p User -p MainPID -p Restart
ss -ltnp
curl --fail-with-body --silent --show-error --max-time 30 "$SF_PUBLIC_ORIGIN$SF_HEALTH_PATH"
sha256sum "$SF_ARTIFACT_PATH"
~~~

Além de HTTP 200, exigir comparação dos hashes dos bytes **efetivamente servidos** (binário, Web, Omni, factory) com C; TLS verificado, porta apenas loopback, browser+host integrados, jornada autenticada com mutação real e CAS/owner/projeto, negativas anônimo/cross-origin/revogado (A8/A9). Rodar restart real com estado durável e repetir transação (AZ-03). Guardar logs sanitizados com exit status, timestamp UTC, run/attempt/job IDs, head/tree SHA, artifact ID/digests e revisor independente. Não expor cookies/tokens, DB nem dados reais.

**D. Rollback:** A10 mantém versão anterior e determina reversão; A7 exige backup/restore íntegro AZ-03, compatibilidade de migrations e smoke. Falha em health, start, persistência, binding ou transação => abortar, preservar volume, recusar migração destrutiva. Se schema incompatível, nunca apontar versão antiga para DB migrada sem restore isolado/autorizado. Release permanece BLOCKED.

## DoD

AZ-01 PASS somente com VM Azure Linux real, C e tree/artefatos coincidentes, HTTPS/origem/identidade, serviço sem root, health de produto + transação positiva e negativas, restart persistente e evidências/revisão em C. No W1, **nada disso foi executado**: AZ-01=BLOCKED_BY_ENV/OWNER/SOURCE; CI verde de PR não muda o estado.
