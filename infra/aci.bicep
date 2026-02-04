@description('Deployment location for the container group.')
param location string = resourceGroup().location

@description('Workload or application name used for CAF-style naming.')
param workloadName string = 'drawio-mcp-standalone'

@description('Environment name, e.g. dev, test, prod.')
param environment string = 'dev'

@description('Short Azure region code for CAF-style naming, e.g. eus, westeu.')
param locationShort string = 'eus2'

@description('Container image to run.')
param containerImage string = 'simonkurtzmsft/drawio-mcp-server-standalone:latest'

@description('CPU cores allocated to the container group.')
param cpuCores int = 1

@description('Memory in GB allocated to the container group.')
param memoryInGb int = 1

@description('Public port exposed by the container.')
param containerPort int = 3000

@description('DNS label for the public IP. Must be globally unique in the Azure region.')
param dnsLabel string = 'aci-${uniqueString(subscription().id, resourceGroup().id)}-1'

@description('Restart policy for the container group: Always, OnFailure, or Never.')
@allowed([
  'Always'
  'OnFailure'
  'Never'
])
param restartPolicy string = 'Always'

// CAF-style container group name: workload}-{env}-{loc}-cg
var containerGroupName = toLower('${workloadName}-${environment}-${locationShort}-cg')

resource containerGroup 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: containerGroupName
  location: location
  tags: {
    workload: workloadName
    environment: environment
  }
  properties: {
    osType: 'Linux'
    restartPolicy: restartPolicy
    containers: [
      {
        name: toLower('${workloadName}-app')
        properties: {
          image: containerImage
          resources: {
            requests: {
              cpu: cpuCores
              memoryInGB: memoryInGb
            }
          }
          ports: [
            {
              port: containerPort
            }
          ]
        }
      }
    ]
    ipAddress: {
      type: 'Public'
      dnsNameLabel: dnsLabel
      ports: [
        {
          protocol: 'Tcp'
          port: containerPort
        }
      ]
    }
  }
}

output containerGroupResourceId string = containerGroup.id
output containerGroupName string = containerGroup.name
output containerGroupFqdn string = containerGroup.properties.ipAddress.fqdn
