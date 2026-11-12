#!/usr/bin/env bash
set -euo pipefail
umask 077

work_dir=""
cleanup() {
  if [[ -n "$work_dir" ]]; then
    rm -rf "$work_dir"
  fi
}
trap cleanup EXIT

cd "$(dirname "$0")/../.."

python3 - <<'PY'
import os, re

def need(name):
    if name not in os.environ:
        raise SystemExit(f"missing {name}")
    return os.environ[name]

if need("OPERATION") not in {"preview", "apply"}:
    raise SystemExit("operation rejected")
need("CONFIRM")
uuid = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
for name in ("AZURE_CLIENT_ID", "AZURE_TENANT_ID", "AZURE_SUBSCRIPTION_ID"):
    if re.fullmatch(uuid, need(name)) is None:
        raise SystemExit(f"{name} rejected")
group = need("AZURE_RESOURCE_GROUP")
if re.fullmatch(r"[A-Za-z0-9_.()-]{1,90}", group) is None or group.endswith("."):
    raise SystemExit("resource group rejected")
if need("VM_SIZE") not in {"Standard_D2as_v5", "Standard_D4as_v5"}:
    raise SystemExit("sku rejected")
image_pattern = "[0-9]+.[0-9]+.[0-9]+"
if re.fullmatch(image_pattern.replace(".", r"\."), need("IMAGE_VERSION")) is None:
    raise SystemExit("image rejected")
key = need("AZURE_VM_SSH_PUBLIC_KEY").strip()
public = r"(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256) [A-Za-z0-9+/]{20,}={0,3}(?: [ -~]{1,200})?"
if "PRIVATE" in key or re.fullmatch(public, key) is None:
    raise SystemExit("public key rejected")
PY

if [[ "$(az cloud show --query name -o tsv)" != "AzureCloud" ]]; then
  printf '%s\n' "cloud rejected" >&2
  exit 1
fi
subscription="$(az account show --query id -o tsv)"
tenant="$(az account show --query tenantId -o tsv)"
if [[ -z "$subscription" || -z "$tenant" || "${subscription,,}" != "${AZURE_SUBSCRIPTION_ID,,}" || "${tenant,,}" != "${AZURE_TENANT_ID,,}" ]]; then
  printf '%s\n' "account rejected" >&2
  exit 1
fi
location="$(az group show --name "$AZURE_RESOURCE_GROUP" --query location -o tsv)"
if [[ ! "$location" =~ ^[a-z0-9]+$ ]]; then
  printf '%s\n' "location rejected" >&2
  exit 1
fi

work_dir="$(mktemp -d)"
chmod 0700 "$work_dir"
params="${work_dir}/parameters.json"
template="${work_dir}/main.json"
PARAMS_PATH="$params" LOCATION="$location" python3 - <<'PY'
import json, os, pathlib, re
location = os.environ["LOCATION"]
if re.fullmatch(r"[a-z0-9]+", location) is None:
    raise SystemExit("location rejected")
key = os.environ["AZURE_VM_SSH_PUBLIC_KEY"].strip()
if "PRIVATE" in key or "\n" in key or not key.startswith(("ssh-ed25519 ", "ssh-rsa ", "ecdsa-sha2-nistp256 ")):
    raise SystemExit("public key rejected")
size = os.environ["VM_SIZE"]
if size not in {"Standard_D2as_v5", "Standard_D4as_v5"}:
    raise SystemExit("sku rejected")
image = os.environ["IMAGE_VERSION"]
image_pattern = "[0-9]+.[0-9]+.[0-9]+"
if re.fullmatch(image_pattern.replace(".", r"\."), image) is None:
    raise SystemExit("image rejected")
destination = pathlib.Path(os.environ["PARAMS_PATH"])
destination.write_text(json.dumps({
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "location": {"value": location},
        "vmSize": {"value": size},
        "imageVersion": {"value": image},
        "adminSshPublicKey": {"value": key},
        "adminUsername": {"value": "sfadmin"},
        "dataDiskSizeGiB": {"value": 64},
    },
}), encoding="utf-8")
destination.chmod(0o600)
PY

bicep_bin="$(command -v bicep || true)"
if [[ -z "$bicep_bin" || ! -x "$bicep_bin" ]]; then
  printf '%s\n' "bicep rejected" >&2
  exit 1
fi
python3 - "$bicep_bin" <<'PY'
import hashlib, json, pathlib, sys
binary = pathlib.Path(sys.argv[1])
pin = json.loads(pathlib.Path("infra/azure/tools.json").read_text())["bicep"]
version, url, digest = pin["version"], pin["url"], pin["sha256"]
actual = hashlib.sha256(binary.read_bytes()).hexdigest()
if not isinstance(version, str) or not version or not isinstance(url, str):
    raise SystemExit("bicep pin rejected")
if not url.startswith("https://github.com/Azure/bicep/releases/download/") or not url.endswith(f"/{version}/bicep-linux-x64"):
    raise SystemExit("bicep pin rejected")
if not isinstance(digest, str) or len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest) or actual != digest:
    raise SystemExit("bicep pin rejected")
PY
"$bicep_bin" build infra/azure/main.bicep --outfile "$template"
chmod 0600 "$template"
if [[ ! -s "$template" ]]; then
  printf '%s\n' "template rejected" >&2
  exit 1
fi

az deployment group what-if --mode Incremental \
  --name orchsf-foundation \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --template-file "$template" \
  --parameters "@${params}"

if [[ "$OPERATION" == "preview" ]]; then
  exit 0
fi
if [[ "$CONFIRM" != "APPLY ${AZURE_RESOURCE_GROUP}" ]]; then
  printf '%s\n' "confirmation rejected" >&2
  exit 1
fi

az deployment group create --mode Incremental \
  --name orchsf-foundation \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --template-file "$template" \
  --parameters "@${params}"
