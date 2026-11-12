#!/bin/bash
# Infrastructure boot only. Caddy answers 503 until a qualified app is activated.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "bootstrap.sh expects exactly one fqdn" >&2
  exit 64
fi

fqdn=$1
fqdn_pattern='^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
if ((${#fqdn} > 253)) || [[ ! "$fqdn" =~ $fqdn_pattern ]]; then
  echo "refusing invalid fqdn" >&2
  exit 64
fi

device=/dev/disk/azure/scsi1/lun0
state=/var/lib/orchestra-sf
deadline=$((SECONDS + 90))
until [[ -b "$device" ]]; do
  if ((SECONDS >= deadline)); then
    echo "timed out waiting for ${device}" >&2
    exit 1
  fi
  sleep 2
done

# blkid exit 2 means the requested tag is absent. Any other failure is I/O or probe error.
probe_tag() {
  local tag=$1
  local value status
  set +e
  value=$(blkid -p -s "$tag" -o value -- "$device")
  status=$?
  set -e
  if [[ "$status" -ne 0 && "$status" -ne 2 ]]; then
    echo "blkid ${tag} failed on ${device} with status ${status}" >&2
    exit 1
  fi
  printf '%s' "$value"
}

probe_uuid() {
  local value status
  set +e
  value=$(blkid -s UUID -o value -- "$device")
  status=$?
  set -e
  if [[ "$status" -eq 2 ]]; then
    printf ''
    return 0
  fi
  if [[ "$status" -ne 0 || -z "$value" ]]; then
    echo "blkid UUID failed on ${device} with status ${status}" >&2
    exit 1
  fi
  printf '%s' "$value"
}

# A failed wipefs is not an empty disk. Only a successful probe with no signatures is blank.
signatures=$(wipefs --no-act -- "$device")
fstype=$(probe_tag TYPE)
label=$(probe_tag LABEL)
pttype=$(probe_tag PTTYPE)
partition_types=$(lsblk --noheadings --list --output TYPE -- "$device")
if [[ -n "$pttype" ]] || grep -qx partition <<< "$partition_types"; then
  echo "refusing partitioned data disk" >&2
  exit 1
fi
if [[ "$fstype" == "ext4" && "$label" != "orchsf-data" ]]; then
  echo "refusing existing ext4 without label orchsf-data" >&2
  exit 1
fi
if [[ -n "$fstype" && "$fstype" != "ext4" ]]; then
  echo "refusing filesystem ${fstype}" >&2
  exit 1
fi
if [[ -z "$fstype" && -n "$signatures" ]]; then
  echo "refusing disk with an unknown signature" >&2
  exit 1
fi
if [[ -z "$fstype" ]]; then
  mkfs.ext4 -F -L orchsf-data -- "$device"
  udevadm settle
fi

uuid=$(probe_uuid)
if [[ -z "$uuid" ]]; then
  udevadm settle
  uuid=$(probe_uuid)
fi
if [[ -z "$uuid" ]]; then
  echo "data disk has no uuid" >&2
  exit 1
fi

fstab_line="UUID=${uuid} ${state} ext4 defaults 0 2"
strict_fstab="^UUID=${uuid}[[:space:]]+${state}[[:space:]]+ext4[[:space:]]+defaults[[:space:]]+0[[:space:]]+2[[:space:]]*$"
if awk -v path="$state" -v uuid="$uuid" '
  $0 ~ /^[[:space:]]*#/ { next }
  $2 == path && $1 != "UUID=" uuid { found = 1 }
  END { exit found ? 0 : 1 }
' /etc/fstab; then
  echo "fstab already mounts ${state}" >&2
  exit 1
fi

# Drop only the entry this disk owns. A refusal must not survive into the next boot.
drop_owned_fstab() {
  local tmp
  tmp=$(mktemp)
  awk -v path="$state" -v uuid="$uuid" '
    $0 ~ /^[[:space:]]*#/ { print; next }
    $2 == path && $1 == "UUID=" uuid { next }
    { print }
  ' /etc/fstab > "$tmp"
  cp "$tmp" /etc/fstab
  rm -f "$tmp"
}

mounted_now=0
if [[ -L "$state" ]]; then
  drop_owned_fstab
  echo "refusing symlink at ${state}" >&2
  exit 1
fi
if findmnt --noheadings --mountpoint "$state" >/dev/null; then
  mounted_now=0
else
  if [[ -e "$state" && ! -d "$state" ]]; then
    drop_owned_fstab
    echo "state path is not a directory" >&2
    exit 1
  fi
  if [[ -d "$state" && -n "$(ls -A "$state")" ]]; then
    drop_owned_fstab
    echo "refusing to cover preexisting files in ${state}" >&2
    exit 1
  fi
  install -d -m 0755 "$state"
  if [[ -L "$state" ]]; then
    drop_owned_fstab
    echo "refusing symlink at ${state}" >&2
    exit 1
  fi
  mount -- "$device" "$state"
  mounted_now=1
fi
source=$(findmnt --noheadings --output SOURCE --mountpoint "$state")
if [[ "$(readlink -f "$source")" != "$(readlink -f "$device")" ]]; then
  source_status=0
  source_uuid=$(blkid -s UUID -o value -- "$(readlink -f "$source")") || source_status=$?
  if [[ "$source_status" -ne 0 || "$source_uuid" != "$uuid" ]]; then
    echo "state is mounted from ${source}" >&2
    if [[ "$mounted_now" -eq 1 ]]; then
      umount -- "$state"
    fi
    exit 1
  fi
fi
target=$(findmnt --noheadings --output TARGET --mountpoint "$state")
if [[ "$target" != "$state" ]]; then
  echo "state mount target is ${target}" >&2
  if [[ "$mounted_now" -eq 1 ]]; then
    umount -- "$state"
  fi
  exit 1
fi

if grep -Eq "$strict_fstab" /etc/fstab && ! grep -E "^UUID=${uuid}[[:space:]]+${state}[[:space:]]" /etc/fstab | grep -Evq "$strict_fstab"; then
  true
else
  fstab_tmp=$(mktemp)
  awk -v path="$state" -v uuid="$uuid" '
    $0 ~ /^[[:space:]]*#/ { print; next }
    $2 == path && $1 == "UUID=" uuid { next }
    { print }
  ' /etc/fstab > "$fstab_tmp"
  printf '%s\n' "$fstab_line" >> "$fstab_tmp"
  cp "$fstab_tmp" /etc/fstab
  rm -f "$fstab_tmp"
fi

home="${state}/home"
if [[ -L "$home" ]]; then
  echo "refusing symlink at ${home}" >&2
  exit 1
fi
if ! id -u orchestra-sf >/dev/null 2>&1; then
  if [[ -e "$home" ]]; then
    home_owner=$(stat -c '%u' "$home")
    if [[ "$home_owner" != "0" || ! -d "$home" || -n "$(ls -A "$home")" ]]; then
      echo "refusing to adopt preexisting home ${home}" >&2
      exit 1
    fi
  fi
  useradd --system --user-group --create-home --home-dir "$home" --shell /usr/sbin/nologin orchestra-sf
fi
uid=$(id -u orchestra-sf)
gid=$(id -g orchestra-sf)
group_name=$(id -gn orchestra-sf)
expected_gid=$(getent group orchestra-sf | cut -d: -f3)
passwd_home=$(getent passwd orchestra-sf | cut -d: -f6)
passwd_shell=$(getent passwd orchestra-sf | cut -d: -f7)
if [[ "$uid" -eq 0 || -z "$expected_gid" || "$gid" != "$expected_gid" || "$group_name" != orchestra-sf || "$passwd_home" != "$home" || "$passwd_shell" != /usr/sbin/nologin ]]; then
  echo "refusing existing account orchestra-sf; it is not the technical user" >&2
  exit 1
fi
state_owner=$(stat -c '%u' "$state")
if [[ "$state_owner" != "0" && "$state_owner" != "$uid" ]]; then
  echo "refusing to change owner of ${state}" >&2
  exit 1
fi
if [[ "$state_owner" == "0" ]]; then
  chown "${uid}:${expected_gid}" "$state"
fi
chmod 0700 "$state"
if [[ -e "$home" && ! -d "$home" ]]; then
  echo "home is not a directory" >&2
  exit 1
fi
if [[ -d "$home" ]]; then
  home_owner=$(stat -c '%u' "$home")
  if [[ "$home_owner" != "0" && "$home_owner" != "$uid" ]]; then
    echo "refusing to change owner of ${home}" >&2
    exit 1
  fi
fi
install -d -o "$uid" -g "$expected_gid" -m 0700 "$home"
install -d -o root -g root -m 0755 /opt/orchestra-sf
install -d -o root -g root -m 0700 /etc/orchestra-sf

install -d -o root -g root -m 0755 /etc/caddy
cat > /etc/caddy/Caddyfile <<EOF
${fqdn} {
	respond 503
}
EOF
chmod 0644 /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl enable caddy
systemctl reload-or-restart caddy
