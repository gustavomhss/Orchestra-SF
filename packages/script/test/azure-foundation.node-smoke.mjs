import { execFileSync, spawnSync } from "node:child_process"
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import assert from "node:assert/strict"
import { test } from "node:test"
import { compileBicep, expectedPins, pins, requireHostedLinux, source, tool } from "./fixture/azure-tools.mjs"

test("pinned bicep compiles the Azure foundation", { timeout: 120_000 }, async () => {
  requireHostedLinux()
  assert.deepEqual(pins().bicep, expectedPins.bicep)
  const main = source("infra/azure/main.bicep")
  const bootstrap = source("infra/azure/bootstrap.sh")
  execFileSync("bash", ["-n", bootstrap])
  const script = readFileSync(bootstrap, "utf8")
  const template = compileBicep(await tool(pins().bicep, "bicep"), main)
  assert.ok(template.resources?.length > 0)
  assertParameters(template)
  assertTopology(template)
  assertBackup(template)
  assertCloud(template, script)
  assertBootstrap(script)
  assertBootstrapRefuses(script)
})

function resources(template) {
  const found = []
  const walk = (list) => {
    for (const resource of list ?? []) {
      found.push(resource)
      walk(resource.resources)
    }
  }
  walk(template.resources)
  return found
}

function typed(template, type) {
  return resources(template).filter((resource) => resource.type === type)
}

function allSecurityRules(template) {
  const inline = typed(template, "Microsoft.Network/networkSecurityGroups").flatMap((nsg) => nsg.properties?.securityRules ?? [])
  return [...inline, ...typed(template, "Microsoft.Network/networkSecurityGroups/securityRules")].map((rule) => rule.properties ?? rule)
}

function variableValue(template, expression) {
  const match = /^\[variables\('([^']+)'\)\]$/.exec(String(expression))
  assert.ok(match, String(expression))
  assert.equal(Object.hasOwn(template.variables, match[1]), true, match[1])
  return template.variables[match[1]]
}

function assertParameters(template) {
  const parameters = template.parameters
  assert.deepEqual(Object.keys(parameters).sort(), ["adminSshPublicKey", "adminUsername", "dataDiskSizeGiB", "imageVersion", "location", "vmSize"])
  assert.equal(parameters.location.defaultValue, "[resourceGroup().location]")
  assert.deepEqual(parameters.vmSize.allowedValues, ["Standard_D2as_v5", "Standard_D4as_v5"])
  assert.equal(Object.hasOwn(parameters.vmSize, "defaultValue"), false)
  assert.equal(Object.hasOwn(parameters.imageVersion, "defaultValue"), false)
  assert.equal(parameters.adminSshPublicKey.type, "securestring")
  assert.equal(Object.hasOwn(parameters.adminSshPublicKey, "defaultValue"), false)
  assert.equal(parameters.adminUsername.defaultValue, "sfadmin")
  assert.deepEqual(
    [parameters.dataDiskSizeGiB.type, parameters.dataDiskSizeGiB.defaultValue, parameters.dataDiskSizeGiB.minValue, parameters.dataDiskSizeGiB.maxValue],
    ["int", 64, 32, 1024],
  )
  assert.deepEqual(Object.keys(template.outputs).sort(), ["backupPolicyName", "backupVaultName", "dataDiskId", "fqdn", "protectedItemName", "publicOrigin", "vmName"])
  const rendered = JSON.stringify(template.outputs)
  assert.equal(Object.values(template.outputs).every((output) => output.type.toLowerCase() !== "securestring"), true)
  assert.equal(/listKeys|listSecrets|password/i.test(rendered), false)
}

function assertTopology(template) {
  const vms = typed(template, "Microsoft.Compute/virtualMachines")
  assert.equal(vms.length, 1)
  const vm = vms[0].properties
  const image = vm.storageProfile.imageReference
  assert.deepEqual([image.publisher, image.offer, image.sku], ["Canonical", "ubuntu-24_04-lts", "server"])
  assert.match(String(image.version), /parameters\('imageVersion'\)/)
  assert.notEqual(image.version, "latest")
  assert.equal(vm.securityProfile.securityType, "TrustedLaunch")
  assert.equal(vm.securityProfile.uefiSettings.secureBootEnabled, true)
  assert.equal(vm.securityProfile.uefiSettings.vTpmEnabled, true)
  assert.equal(vm.osProfile.linuxConfiguration.disablePasswordAuthentication, true)
  assert.equal(Object.hasOwn(vm.osProfile, "adminPassword"), false)
  assert.match(JSON.stringify(vm.osProfile.linuxConfiguration.ssh), /adminSshPublicKey/)
  assert.equal(vms[0].identity, undefined)
  assert.equal(vm.storageProfile.diskControllerType, "SCSI")
  assert.equal(vm.storageProfile.osDisk.managedDisk.storageAccountType, "StandardSSD_LRS")
  const data = vm.storageProfile.dataDisks
  assert.deepEqual([data.length, data[0].lun, data[0].caching, data[0].deleteOption], [1, 0, "None", "Detach"])
  const disks = typed(template, "Microsoft.Compute/disks")
  assert.equal(disks.length, 1)
  assert.equal(disks[0].sku.name, "StandardSSD_LRS")
  assert.equal(disks[0].properties.networkAccessPolicy, "DenyAll")
  const vnet = typed(template, "Microsoft.Network/virtualNetworks")
  assert.equal(vnet.length, 1)
  assert.deepEqual(vnet[0].properties.addressSpace.addressPrefixes, ["10.62.0.0/24"])
  assert.equal(vnet[0].properties.subnets.length, 1)
  assert.equal(vnet[0].properties.subnets[0].properties.addressPrefix, "10.62.0.0/26")
  const nsgId = vnet[0].properties.subnets[0].properties.networkSecurityGroup?.id
  const matched = typed(template, "Microsoft.Network/networkSecurityGroups").filter((nsg) => nsgId === `[resourceId('Microsoft.Network/networkSecurityGroups', '${nsg.name}')]`)
  assert.equal(matched.length, 1)
  const security = [
    ...(matched[0].properties?.securityRules ?? []),
    ...typed(template, "Microsoft.Network/networkSecurityGroups/securityRules").filter((rule) => String(rule.name ?? "").startsWith(`${matched[0].name}/`)),
  ].map((rule) => rule.properties ?? rule)
  const allows = security.filter((rule) => rule.direction === "Inbound" && rule.access === "Allow")
  for (const rule of allows) {
    assert.equal(rule.destinationPortRanges, undefined)
    assert.equal(rule.sourceAddressPrefixes, undefined)
    assert.equal(String(rule.protocol).toLowerCase(), "tcp")
    assert.equal(rule.sourceAddressPrefix, "Internet")
    assert.match(String(rule.destinationPortRange), /^(80|443)$/)
  }
  assert.deepEqual(allows.map((rule) => String(rule.destinationPortRange)).sort(), ["443", "80"])
  const denies = security.filter((rule) => rule.direction === "Inbound" && rule.access === "Deny" && (rule.destinationPortRange === "*" || rule.destinationPortRange === "0-65535"))
  assert.ok(denies.length >= 1)
  const denyPriority = Math.min(...denies.map((rule) => Number(rule.priority)))
  assert.equal(allows.every((rule) => Number(rule.priority) < denyPriority), true)
  assert.equal(security.some((rule) => rule.direction === "Outbound" && rule.access === "Deny"), false)
  assert.equal(allSecurityRules(template).some((rule) => rule.direction === "Outbound" && rule.access === "Deny"), false)
  const ips = typed(template, "Microsoft.Network/publicIPAddresses")
  assert.equal(ips.length, 1)
  assert.equal(ips[0].sku.name, "Standard")
  assert.equal(ips[0].properties.publicIPAllocationMethod, "Static")
  assert.equal(ips[0].properties.publicIPAddressVersion, "IPv4")
  const label = String(ips[0].properties.dnsSettings.domainNameLabel)
  assert.match(label, /orchsf-/)
  assert.match(label, /uniqueString\(resourceGroup\(\)\.id\)/)
  assert.equal(resources(template).some((resource) => resource.identity || /Microsoft\.(Storage|NetApp|ManagedIdentity)\//.test(resource.type) || resource.type.startsWith("Microsoft.Authorization/roleAssignments")), false)
}

function assertBackup(template) {
  const vaults = typed(template, "Microsoft.RecoveryServices/vaults")
  const policies = typed(template, "Microsoft.RecoveryServices/vaults/backupPolicies")
  const protectedItems = typed(template, "Microsoft.RecoveryServices/vaults/backupFabrics/protectionContainers/protectedItems")
  assert.deepEqual([vaults.length, policies.length, protectedItems.length], [1, 1, 1])
  for (const resource of resources(template).filter((resource) => resource.type.startsWith("Microsoft.RecoveryServices/"))) {
    const version = String(resource.apiVersion)
    assert.match(version, /^\d{4}-\d{2}-\d{2}$/)
    const month = Number(version.slice(5, 7))
    const day = Number(version.slice(8, 10))
    assert.equal(month >= 1 && month <= 12 && day >= 1 && day <= 31, true)
    assert.equal(version >= "2025-01-01", true)
    assert.equal(version.toLowerCase().includes("preview"), false)
  }
  assert.equal(vaults[0].sku.name, "Standard")
  assert.equal(vaults[0].properties.redundancySettings.standardTierStorageRedundancy, "LocallyRedundant")
  assert.equal(JSON.stringify(vaults[0].location), JSON.stringify(typed(template, "Microsoft.Compute/virtualMachines")[0].location))
  const policy = policies[0].properties
  assert.equal(policy.backupManagementType, "AzureIaasVM")
  assert.equal(policy.schedulePolicy.schedulePolicyType, "SimpleSchedulePolicy")
  assert.equal(policy.schedulePolicy.scheduleRunFrequency, "Daily")
  assert.equal(policy.schedulePolicy.hourlySchedule, undefined)
  assert.deepEqual(policy.schedulePolicy.scheduleRunTimes, ["[variables('scheduleTime')]"])
  assert.deepEqual(policy.retentionPolicy.dailySchedule.retentionTimes, ["[variables('scheduleTime')]"])
  assert.equal(variableValue(template, policy.schedulePolicy.scheduleRunTimes[0]), "2026-01-01T04:00:00Z")
  assert.equal(variableValue(template, policy.retentionPolicy.dailySchedule.retentionTimes[0]), variableValue(template, policy.schedulePolicy.scheduleRunTimes[0]))
  assert.equal(policy.retentionPolicy.dailySchedule.retentionDuration.count, 35)
  assert.equal(policy.retentionPolicy.dailySchedule.retentionDuration.durationType, "Days")
  assert.notEqual(policy.policyType, "V2")
  assert.equal(/PITR|ApplicationConsistent|hourlySchedule/i.test(JSON.stringify(policy)), false)
  const item = JSON.stringify(protectedItems[0])
  assert.match(item, /Microsoft\.Compute\/virtualMachines/)
  assert.match(item, /backupPolicies/)
  assert.equal(vaults[0].name, "orchsf-vault")
  assert.equal(policies[0].name, "[format('{0}/{1}', 'orchsf-vault', 'orchsf-daily')]")
  assert.equal(protectedItems[0].properties.policyId, "[resourceId('Microsoft.RecoveryServices/vaults/backupPolicies', 'orchsf-vault', 'orchsf-daily')]")
  assert.equal(protectedItems[0].properties.sourceResourceId, "[resourceId('Microsoft.Compute/virtualMachines', variables('vmName'))]")
  assert.equal(typed(template, "Microsoft.Compute/virtualMachines")[0].name, "[variables('vmName')]")
  assert.equal(template.variables.vmName, "orchsf-vm")
}

function assertCloud(template, script) {
  const cloud = template.variables?.cloudConfig
  assert.equal(typeof cloud, "object")
  assert.equal(Array.isArray(cloud), false)
  assert.deepEqual([...cloud.packages].sort(), ["bubblewrap", "ca-certificates", "caddy", "curl", "python3", "socat"])
  assert.equal(template.variables.bootstrapPath, "/usr/local/sbin/orchestra-sf-bootstrap.sh")
  assert.equal(cloud.write_files.length, 1)
  assert.equal(cloud.write_files[0].path, "[variables('bootstrapPath')]")
  assert.equal(variableValue(template, cloud.write_files[0].path), template.variables.bootstrapPath)
  assert.ok(String(variableValue(template, cloud.write_files[0].content)).replaceAll("\r\n", "\n").includes(script.replaceAll("\r\n", "\n").trim()))
  assert.deepEqual(cloud.runcmd, [["[variables('bootstrapPath')]", "__PUBLIC_FQDN__"]])
  assert.equal(variableValue(template, cloud.runcmd[0][0]), template.variables.bootstrapPath)
  assert.doesNotMatch(JSON.stringify(cloud.runcmd), /\|\||\|\s*true\b/)
  const rendered = JSON.stringify(template)
  assert.match(rendered, /base64\(/)
  assert.match(rendered, /replace\([\s\S]*__PUBLIC_FQDN__/)
  assert.equal(rendered.includes("#cloud-config\\n"), true)
  assert.match(`${script}\n${JSON.stringify(cloud)}`, /\b503\b/)
}

function assertBootstrap(script) {
  for (const needle of ["/dev/disk/azure/scsi1/lun0", "/var/lib/orchestra-sf", "/opt/orchestra-sf", "/etc/orchestra-sf", "orchsf-data", "ext4", "0700", "nologin"])
    assert.ok(script.includes(needle), needle)
  assert.match(script, /set -euo pipefail/)
  assert.match(script, /\$#/)
  assert.match(script, /UUID=/)
  assert.match(script, /fstab/)
  assert.match(script, /findmnt|mountpoint/)
  const probe = script.search(/blkid|wipefs/)
  assert.ok(probe >= 0 && script.search(/\bmkfs\b/) > probe)
  assert.doesNotMatch(script, /openssh-server|\bsshd\b|apparmor=0|unprivileged_userns/)
}

function assertBootstrapRefuses(script) {
  const root = mkdtempSync(path.join(tmpdir(), "azure-bootstrap-"))
  try {
    const bin = path.join(root, "bin")
    const device = path.join(root, "device")
    const state = path.join(root, "state")
    const fstab = path.join(root, "fstab")
    const log = path.join(root, "calls")
    const file = path.join(root, "bootstrap.sh")
    mkdirSync(bin)
    writeFileSync(device, "")
    writeFileSync(fstab, "\n")
    writeFileSync(log, "")
    writeFileSync(file, retargetBootstrap(script, device, state, fstab))
    chmodSync(file, 0o755)
    writeBootstrapMocks(bin, log)
    const env = { PATH: `${bin}${path.delimiter}/usr/bin${path.delimiter}/bin`, HOME: root, TMPDIR: root }
    refuseBootstrap(file, env, log, { BLKID_IO: "1" }, "blkid TYPE failed")
    refuseBootstrap(file, env, log, { BLKID_TYPE: "xfs", BLKID_LABEL_STATUS: "2", BLKID_PTTYPE_STATUS: "2" }, "refusing filesystem xfs")
    refuseBootstrap(file, env, log, { BLKID_TYPE: "ext4", BLKID_LABEL: "foreign", BLKID_LABEL_STATUS: "0", BLKID_PTTYPE_STATUS: "2" }, "refusing existing ext4 without label orchsf-data")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function retargetBootstrap(script, device, state, fstab) {
  assert.equal(script.includes("device=/dev/disk/azure/scsi1/lun0"), true)
  assert.equal(script.includes('[[ -b "$device" ]]'), true)
  assert.equal(script.includes("state=/var/lib/orchestra-sf"), true)
  assert.equal(script.includes("/etc/fstab"), true)
  return script
    .replaceAll("device=/dev/disk/azure/scsi1/lun0", `device=${device}`)
    .replaceAll('[[ -b "$device" ]]', '[[ -e "$device" ]]')
    .replaceAll("state=/var/lib/orchestra-sf", `state=${state}`)
    .replaceAll("/etc/fstab", fstab)
}

function writeBootstrapMocks(bin, log) {
  const quotedLog = JSON.stringify(log)
  const files = {
    wipefs: `#!/bin/bash
printf '%s\\n' "wipefs $*" >> ${quotedLog}
case " $* " in
  *" -a "*|*" -f "*|*" --all "*|*" --force "*) printf '%s\\n' wipefs-destructive >> ${quotedLog}; exit 99 ;;
esac
case " $* " in
  *" --no-act "*) exit 0 ;;
esac
printf '%s\\n' wipefs-destructive >> ${quotedLog}
exit 99
`,
    blkid: `#!/bin/bash
printf '%s\\n' "blkid $*" >> ${quotedLog}
if [[ "\${BLKID_IO:-}" == 1 ]]; then
  exit 5
fi
tag=""
prev=""
for arg in "$@"; do
  if [[ "$prev" == -s ]]; then
    tag=$arg
  fi
  prev=$arg
done
case "$tag" in
  TYPE) printf '%s' "\${BLKID_TYPE:-}"; exit "\${BLKID_TYPE_STATUS:-0}" ;;
  LABEL) printf '%s' "\${BLKID_LABEL:-}"; exit "\${BLKID_LABEL_STATUS:-0}" ;;
  PTTYPE) printf '%s' "\${BLKID_PTTYPE:-}"; exit "\${BLKID_PTTYPE_STATUS:-2}" ;;
  UUID) printf '%s' "\${BLKID_UUID:-}"; exit "\${BLKID_UUID_STATUS:-0}" ;;
esac
exit 5
`,
    lsblk: `#!/bin/bash
printf '%s\\n' "lsblk $*" >> ${quotedLog}
exit 0
`,
    "mkfs.ext4": `#!/bin/bash
printf '%s\\n' "mkfs.ext4 $*" >> ${quotedLog}
exit 99
`,
    mount: `#!/bin/bash
printf '%s\\n' "mount $*" >> ${quotedLog}
exit 99
`,
    useradd: `#!/bin/bash
printf '%s\\n' "useradd $*" >> ${quotedLog}
exit 99
`,
  }
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(bin, name)
    writeFileSync(file, body)
    chmodSync(file, 0o755)
  }
}

function refuseBootstrap(script, env, log, extra, stderrText) {
  writeFileSync(log, "")
  const result = spawnSync("bash", [script, "app.example.com"], { env: { ...env, ...extra }, encoding: "utf8" })
  assert.notEqual(result.status, 0, result.stderr)
  assert.match(String(result.stderr), new RegExp(stderrText))
  assert.equal(/mkfs|wipefs-destructive|\bmount\b|useradd/.test(readFileSync(log, "utf8")), false, readFileSync(log, "utf8"))
}
