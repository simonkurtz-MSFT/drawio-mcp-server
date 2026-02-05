using './infra/aci.bicep'

param location = 'eastus'
param workloadName = 'drawio-mcp'
param environment = 'dev'
param locationShort = 'eus'
param containerImage = 'simonkurtzmsft/drawio-mcp-server-standalone:1.0.1'
param cpuCores = 1
param memoryInGb = 1
param dnsLabel = 'drawio-mcp-dev'
param restartPolicy = 'Always'
