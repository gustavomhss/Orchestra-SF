targetScope = 'resourceGroup'

@description('Region for every resource. Defaults to the resource group.')
param location string = resourceGroup().location

@description('Candidate size only. Not a performance claim.')
@allowed([
  'Standard_D2as_v5'
  'Standard_D4as_v5'
])
param vmSize string

@description('Exact Canonical Ubuntu image version. No latest default.')
param imageVersion string

@description('Linux account that owns the public SSH key.')
param adminUsername string = 'sfadmin'

@secure()
@description('Public SSH key only.')
param adminSshPublicKey string

@description('Persistent data disk size in GiB.')
@minValue(32)
@maxValue(1024)
param dataDiskSizeGiB int = 64

var vmName = 'orchsf-vm'
var bootstrapPath = '/usr/local/sbin/orchestra-sf-bootstrap.sh'
var protectedItemName = 'VM;iaasvmcontainerv2;${resourceGroup().name};${vmName}'
var scheduleTime = '2026-01-01T04:00:00Z'

var cloudConfig = {
  package_update: true
  packages: [
    'caddy'
    'bubblewrap'
    'socat'
    'python3'
    'curl'
    'ca-certificates'
  ]
  write_files: [
    {
      path: bootstrapPath
      permissions: '0700'
      owner: 'root:root'
      content: loadTextContent('bootstrap.sh')
    }
  ]
  runcmd: [
    [
      bootstrapPath
      '__PUBLIC_FQDN__'
    ]
  ]
}

resource nsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'orchsf-nsg'
  location: location
  properties: {
    securityRules: [
      {
        name: 'allow-http'
        properties: {
          priority: 100
          access: 'Allow'
          direction: 'Inbound'
          protocol: 'Tcp'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
        }
      }
      {
        name: 'allow-https'
        properties: {
          priority: 110
          access: 'Allow'
          direction: 'Inbound'
          protocol: 'Tcp'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'deny-inbound'
        properties: {
          priority: 4096
          access: 'Deny'
          direction: 'Inbound'
          protocol: '*'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: 'orchsf-vnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.62.0.0/24'
      ]
    }
    subnets: [
      {
        name: 'orchsf-subnet'
        properties: {
          addressPrefix: '10.62.0.0/26'
          networkSecurityGroup: {
            id: nsg.id
          }
        }
      }
    ]
  }
}

resource publicIp 'Microsoft.Network/publicIPAddresses@2024-05-01' = {
  name: 'orchsf-pip'
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    publicIPAddressVersion: 'IPv4'
    dnsSettings: {
      domainNameLabel: 'orchsf-${uniqueString(resourceGroup().id)}'
    }
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2024-05-01' = {
  name: 'orchsf-nic'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'primary'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          subnet: {
            id: '${vnet.id}/subnets/orchsf-subnet'
          }
          publicIPAddress: {
            id: publicIp.id
          }
        }
      }
    ]
  }
}

resource dataDisk 'Microsoft.Compute/disks@2024-03-02' = {
  name: 'orchsf-data'
  location: location
  sku: {
    name: 'StandardSSD_LRS'
  }
  properties: {
    creationData: {
      createOption: 'Empty'
    }
    diskSizeGB: dataDiskSizeGiB
    networkAccessPolicy: 'DenyAll'
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2024-11-01' = {
  name: vmName
  location: location
  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }
    storageProfile: {
      diskControllerType: 'SCSI'
      imageReference: {
        publisher: 'Canonical'
        offer: 'ubuntu-24_04-lts'
        sku: 'server'
        version: imageVersion
      }
      osDisk: {
        createOption: 'FromImage'
        caching: 'ReadWrite'
        managedDisk: {
          storageAccountType: 'StandardSSD_LRS'
        }
      }
      dataDisks: [
        {
          lun: 0
          createOption: 'Attach'
          caching: 'None'
          deleteOption: 'Detach'
          managedDisk: {
            id: dataDisk.id
          }
        }
      ]
    }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      customData: base64(replace('#cloud-config\n${string(cloudConfig)}', '__PUBLIC_FQDN__', publicIp.properties.dnsSettings.fqdn))
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUsername}/.ssh/authorized_keys'
              keyData: adminSshPublicKey
            }
          ]
        }
      }
    }
    securityProfile: {
      securityType: 'TrustedLaunch'
      uefiSettings: {
        secureBootEnabled: true
        vTpmEnabled: true
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
        }
      ]
    }
  }
}

resource vault 'Microsoft.RecoveryServices/vaults@2025-01-01' = {
  name: 'orchsf-vault'
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    redundancySettings: {
      standardTierStorageRedundancy: 'LocallyRedundant'
    }
  }
}

resource policy 'Microsoft.RecoveryServices/vaults/backupPolicies@2025-01-01' = {
  parent: vault
  name: 'orchsf-daily'
  properties: {
    backupManagementType: 'AzureIaasVM'
    policyType: 'V1'
    timeZone: 'UTC'
    schedulePolicy: {
      schedulePolicyType: 'SimpleSchedulePolicy'
      scheduleRunFrequency: 'Daily'
      scheduleRunTimes: [
        scheduleTime
      ]
    }
    retentionPolicy: {
      retentionPolicyType: 'LongTermRetentionPolicy'
      dailySchedule: {
        retentionTimes: [
          scheduleTime
        ]
        retentionDuration: {
          count: 35
          durationType: 'Days'
        }
      }
    }
  }
}

resource protectedItem 'Microsoft.RecoveryServices/vaults/backupFabrics/protectionContainers/protectedItems@2025-01-01' = {
  name: '${vault.name}/Azure/iaasvmcontainer;iaasvmcontainerv2;${resourceGroup().name};${vmName}/${protectedItemName}'
  properties: {
    protectedItemType: 'Microsoft.Compute/virtualMachines'
    policyId: policy.id
    sourceResourceId: vm.id
  }
}

output fqdn string = publicIp.properties.dnsSettings.fqdn
output publicOrigin string = 'https://${publicIp.properties.dnsSettings.fqdn}'
output vmName string = vm.name
output dataDiskId string = dataDisk.id
output backupVaultName string = vault.name
output backupPolicyName string = policy.name
output protectedItemName string = protectedItemName
