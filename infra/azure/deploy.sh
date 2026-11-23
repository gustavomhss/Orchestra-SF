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
import ipaddress, json, os, re

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
profile = os.environ.get("NETWORK_PROFILE", "mvp")
qa_groups = {
    "g08-qa": "orchestra-sf-g08-qa",
    "g10-source": "orchestra-sf-g10-source",
    "g10-clone": "orchestra-sf-g10-clone",
}
if profile not in {"mvp", *qa_groups}:
    raise SystemExit("network profile rejected")
if profile != "mvp" and group.lower() != qa_groups[profile]:
    raise SystemExit("qualification resource group rejected")

def host_cidrs(name, public_only=False):
    raw = os.environ.get(name, "[]")
    try:
        values = json.loads(raw)
    except (ValueError, TypeError):
        raise SystemExit(f"{name} rejected")
    if not isinstance(values, list) or len(values) > 32:
        raise SystemExit(f"{name} rejected")
    for value in values:
        if not isinstance(value, str):
            raise SystemExit(f"{name} rejected")
        try:
            network = ipaddress.IPv4Network(value, strict=True)
        except (ValueError, TypeError):
            raise SystemExit(f"{name} rejected")
        address = network.network_address
        if network.prefixlen != 32 or str(network) != value:
            raise SystemExit(f"{name} rejected")
        if (address.is_unspecified or address.is_loopback or address.is_multicast
                or address.is_link_local or address.is_reserved
                or address.packed[0] == 0 or address == ipaddress.IPv4Address("255.255.255.255")):
            raise SystemExit(f"{name} rejected")
        if public_only and not address.is_global:
            raise SystemExit(f"{name} rejected")
    if len(values) != len(set(values)):
        raise SystemExit(f"{name} rejected")
    return values

https = host_cidrs("QA_HTTPS_INGRESS_CIDRS")
admin = host_cidrs("CLONE_ADMIN_EGRESS_CIDRS", public_only=True)
if profile == "mvp" and (https or admin):
    raise SystemExit("MVP network overrides rejected")
if profile in {"g08-qa", "g10-source"}:
    if not https:
        raise SystemExit("qualification HTTPS endpoints required")
    if admin:
        raise SystemExit("non-clone administration endpoints rejected")
if profile == "g10-clone":
    if https:
        raise SystemExit("clone HTTPS ingress rejected")
    if not admin:
        raise SystemExit("clone administration endpoints required")

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

# In the dedicated groups, MVP is only the first bootstrap of an empty group.
# A partial deployment is deliberately not retried with the open MVP network.
case "${AZURE_RESOURCE_GROUP,,}" in
  orchestra-sf-g08-qa|orchestra-sf-g10-source|orchestra-sf-g10-clone)
    if [[ "${NETWORK_PROFILE:-mvp}" == "mvp" ]]; then
      resource_count="$(az resource list --resource-group "$AZURE_RESOURCE_GROUP" --query 'length(@)' -o tsv)"
      if [[ "$resource_count" != "0" ]]; then
        printf '%s\n' "qualification bootstrap requires an empty resource group" >&2
        exit 1
      fi
    else
      foundation_state="$(az deployment group show --name orchsf-foundation --resource-group "$AZURE_RESOURCE_GROUP" --query properties.provisioningState -o tsv)"
      vm_state="$(az vm show --name orchsf-vm --resource-group "$AZURE_RESOURCE_GROUP" --query provisioningState -o tsv)"
      if [[ "$foundation_state" != "Succeeded" || "$vm_state" != "Succeeded" ]]; then
        printf '%s\n' "qualification requires a completed foundation VM deployment" >&2
        exit 1
      fi
    fi
    ;;
esac

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
parameters = {
    "location": {"value": location},
    "vmSize": {"value": size},
    "imageVersion": {"value": image},
    "adminSshPublicKey": {"value": key},
    "adminUsername": {"value": "sfadmin"},
    "dataDiskSizeGiB": {"value": 64},
}
# The default serializes exactly the original six parameters in the original order.
profile = os.environ.get("NETWORK_PROFILE", "mvp")
if profile != "mvp":
    parameters.update({
        "networkProfile": {"value": profile},
        "qaHttpsIngressCidrs": {"value": json.loads(os.environ.get("QA_HTTPS_INGRESS_CIDRS", "[]"))},
        "cloneAdminEgressCidrs": {"value": json.loads(os.environ.get("CLONE_ADMIN_EGRESS_CIDRS", "[]"))},
    })
destination.write_text(json.dumps({
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": parameters,
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
