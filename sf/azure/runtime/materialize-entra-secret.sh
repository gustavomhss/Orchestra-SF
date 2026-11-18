#!/usr/bin/env bash
# A7 ExecStartPre root: system-assigned IMDS -> pinned Key Vault -> private file.
# No secret/token in stdout, argv, systemd environment, or Git.
set -Eeuo pipefail
set +x
umask 077
export LC_ALL=C
fail() { printf '%s\n' "SF_KV_SECRET_PRESTART_REFUSED: $*" >&2; exit 1; }

[[ "$EUID" -eq 0 ]] || fail "root ExecStartPre required"
command -v curl >/dev/null && command -v jq >/dev/null && command -v python3 >/dev/null ||
  fail "curl jq python3 are required"
[[ -n "${SUCAFINA_MICROSOFT_CONFIG:-}" && "${SUCAFINA_MICROSOFT_CONFIG:0:1}" == / ]] ||
  fail "SUCAFINA_MICROSOFT_CONFIG missing or nonabsolute"
config="$SUCAFINA_MICROSOFT_CONFIG"
config_dir="${config%/*}"
[[ "$config_dir" == /var/lib/orchestra-sf/* && "$config_dir" != /var/lib/orchestra-sf ]] ||
  fail "private config must live on the mounted durable disk"
[[ -d "$config_dir" && ! -L "$config_dir" && -f "$config" && ! -L "$config" ]] ||
  fail "A8 Microsoft installation JSON not provisioned"
[[ "$(readlink -f -- "$config_dir")" == "$config_dir" ]] ||
  fail "config directory is noncanonical"
uid="$(id -u orchestra-sf)"
gid="$(id -g orchestra-sf)"
[[ "$uid" != 0 && "$(stat -c %u -- "$config_dir")" == "$uid" &&
   "$(stat -c %g -- "$config_dir")" == "$gid" &&
   "$(stat -c %a -- "$config_dir")" == 700 ]] ||
  fail "config dir must be private 0700 and owned by orchestra-sf"
[[ "$(stat -c %u -- "$config")" == "$uid" &&
   "$(stat -c %a -- "$config")" == 600 &&
   "$(stat -c %h -- "$config")" == 1 ]] ||
  fail "installation JSON must be mode 0600, owned by orchestra-sf, nlink=1"
# FLAMENGO demo: fail before requesting any token if tenant/client/origin or
# Caddy ingress are inconsistent or still contain the unresolved placeholder.
jq -e '
  .version == 1 and .deployment == "azure-https" and .authentication == "microsoft" and
  .tenantId == "449dfd17-d627-45da-b22c-1be49d8df99f" and
  .clientId == "9006dcb8-1a75-4886-9475-1e7f1dc5d7cd" and
  .origin == "https://orchsf-spug5rxxyqkdw.swedencentral.cloudapp.azure.com" and
  .listenerOrigin == "http://127.0.0.1:4096" and
  .mount == "/sucafina" and
  (.ingressOrigin | type == "string" and test("^http://[^/]+$") and (contains("REQUIRES_") | not)) and
  (.groups | type == "object") and
  (.grants | type == "array")
' "$config" >/dev/null ||
  fail "FLAMENGO Microsoft config/ingress not admitted; Key Vault was not called"
for name in session bank assets; do
  key="$config_dir/$name.key"
  [[ -f "$key" && ! -L "$key" &&
     "$(stat -c %u -- "$key")" == "$uid" &&
     "$(stat -c %a -- "$key")" == 600 &&
     "$(stat -c %s -- "$key")" == 32 &&
     "$(stat -c %h -- "$key")" == 1 ]] ||
    fail "owner-created private installation key missing"
done
dest="$config_dir/client-secret.txt"
if [[ -e "$dest" || -L "$dest" ]]; then
  [[ -f "$dest" && ! -L "$dest" &&
     "$(stat -c %u -- "$dest")" == "$uid" &&
     "$(stat -c %a -- "$dest")" == 600 &&
     "$(stat -c %h -- "$dest")" == 1 ]] ||
    fail "existing secret file unsafe"
fi
# Known owner-provenanced managed identity / vault; no client_id selector.
vault=kv-orchsf-2611162127
secret_name=entra-client-secret
scratch="$(mktemp -d /run/orchestra-sf-kv.XXXXXXXX)"
chmod 0700 "$scratch"
cleanup() { rm -rf -- "$scratch"; }
trap cleanup EXIT
curl --noproxy '*' --proto '=http' --fail --silent --show-error \
  --connect-timeout 3 --max-time 15 -H 'Metadata: true' \
  'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fvault.azure.net' \
  -o "$scratch/identity.json" || fail "IMDS token unavailable"
jq -er '.access_token | select(type == "string" and length > 100)' "$scratch/identity.json" > "$scratch/token" ||
  fail "IMDS did not issue managed identity access token"
# curl --config (0600) keeps the bearer token out of process arguments.
{
  printf 'url = "https://%s.vault.azure.net/secrets/%s?api-version=7.4"\n' "$vault" "$secret_name"
  printf 'header = "Authorization: Bearer %s"\n' "$(cat "$scratch/token")"
  printf 'noproxy = "*"\nproto = "=https"\nconnect-timeout = 5\nmax-time = 20\nfail\nsilent\nshow-error\n'
} > "$scratch/curl.conf"
curl --config "$scratch/curl.conf" --output "$scratch/response.json" ||
  fail "Key Vault HTTPS GET failed (RBAC/secret/network/CA)"
jq -er --arg prefix "https://$vault.vault.azure.net/secrets/$secret_name/" '
  select(.id | type == "string" and startswith($prefix)) |
  .value | select(type == "string" and length > 0 and length <= 4096)
' "$scratch/response.json" > "$scratch/value" ||
  fail "Key Vault response missing expected versioned secret"
python3 - "$scratch/value" <<'PY'
from pathlib import Path
import sys
value = Path(sys.argv[1]).read_bytes()
if not value.endswith(b"\n") or not 1 <= len(value[:-1]) <= 4096 or \
   any(ch < 33 or ch > 126 for ch in value[:-1]):
    raise SystemExit("SF_PRIVATE_CREDENTIAL_FORMAT_INVALID")
PY
# Never trust a pathname under a user-writable directory with root cp/chown.
# Open the directory once with O_NOFOLLOW, create via openat(O_EXCL|O_NOFOLLOW)
# and renameat in that SAME directory; no symlink race to a root-owned path.
python3 - "$scratch/value" "$config_dir" "$uid" "$gid" <<'PY'
import os
from pathlib import Path
import secrets
import stat
import sys
source, directory, uid_text, gid_text = sys.argv[1:]
uid, gid = int(uid_text), int(gid_text)
data = Path(source).read_bytes()
dfd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
name = ".client-secret." + secrets.token_hex(16)
created = False
try:
    st = os.fstat(dfd)
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != uid or st.st_gid != gid or stat.S_IMODE(st.st_mode) != 0o700:
        raise SystemExit("SF_CONFIG_DIR_IDENTITY_CHANGED")
    try:
        previous = os.stat("client-secret.txt", dir_fd=dfd, follow_symlinks=False)
    except FileNotFoundError:
        previous = None
    if previous is not None and (not stat.S_ISREG(previous.st_mode) or previous.st_uid != uid or
                                 previous.st_gid != gid or previous.st_nlink != 1 or
                                 stat.S_IMODE(previous.st_mode) != 0o600):
        raise SystemExit("SF_EXISTING_CREDENTIAL_UNSAFE")
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=dfd)
    created = True
    with os.fdopen(fd, "wb") as out:
        out.write(data)
        out.flush()
        os.fchown(out.fileno(), uid, gid)
        os.fchmod(out.fileno(), 0o600)
        os.fsync(out.fileno())
    os.replace(name, "client-secret.txt", src_dir_fd=dfd, dst_dir_fd=dfd)
    created = False
    os.fsync(dfd)
    check = os.open("client-secret.txt", os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=dfd)
    try:
        st = os.fstat(check)
        if not stat.S_ISREG(st.st_mode) or st.st_uid != uid or st.st_gid != gid or st.st_nlink != 1 or stat.S_IMODE(st.st_mode) != 0o600:
            raise SystemExit("SF_MATERIALIZED_CREDENTIAL_UNSAFE")
    finally:
        os.close(check)
finally:
    if created:
        os.unlink(name, dir_fd=dfd)
    os.close(dfd)
PY
printf '%s\n' 'SF_KV_SECRET_PRESTART_OK (materialized 0600; no value displayed)'
