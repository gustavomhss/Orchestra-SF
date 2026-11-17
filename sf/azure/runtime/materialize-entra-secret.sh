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
jq -e '.version == 1 and .deployment == "azure-https" and .authentication == "microsoft" and
       (.origin | type == "string" and startswith("https://")) and
       (.tenantId | type == "string" and length > 0) and
       (.clientId | type == "string" and length > 0)' "$config" >/dev/null ||
  fail "actual Microsoft profile not present (no local fallback)"
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
next=""
cleanup() { [[ -z "$next" ]] || rm -f -- "$next"; rm -rf -- "$scratch"; }
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
next="$(mktemp "$config_dir/.client-secret.XXXXXXXX")"
cp -- "$scratch/value" "$next"
chown "$uid:$gid" "$next"
chmod 0600 "$next"
sync -f "$next"
mv -T -- "$next" "$dest"
next=""
[[ ! -L "$dest" && "$(stat -c %u:%g:%a:%h -- "$dest")" == "$uid:$gid:600:1" ]] ||
  fail "materialized secret identity/mode mismatch"
printf '%s\n' 'SF_KV_SECRET_PRESTART_OK (materialized 0600; no value displayed)'
