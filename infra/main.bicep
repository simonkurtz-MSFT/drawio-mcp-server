// ─────────────────────────────────────────────────────────────────────────────
// main.bicep — Subscription-scoped orchestrator
//
// Creates the Resource Group and delegates all resource-scoped infrastructure
// to resources.bicep. This separation is required by Bicep's scope model.
//
// Deploy:  azd up
// Preview: azd provision --preview
// ─────────────────────────────────────────────────────────────────────────────
targetScope = 'subscription'

@description('Unique environment name used for resource naming (e.g., drawio-dev, drawio-prod).')
@minLength(1)
@maxLength(32)
param environmentName string

@description('Azure region for all resources.')
param location string = 'eastus2'

@description('Enable Entra ID authentication on the Container App endpoint.')
param enableAuth bool = false

@description('Entra ID App Registration client ID. Required when enableAuth = true.')
param entraClientId string = ''

@description('Your public IP address (CIDR or bare IP). Only this IP can reach the MCP endpoint. Leave empty to allow all.')
param allowedIp string = ''

@description('Docker Hub image tag to deploy (e.g. latest, 3.0.1).')
param imageTag string = 'latest'

// Stable, URL-safe, unique token derived from sub + env + location.
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))

// Common tags applied to every resource for cost tracking and governance.
var tags = { 'azd-env-name': environmentName }

// ─────────────────────────────────────────────────────────────────────────────
// Resource Group
// ─────────────────────────────────────────────────────────────────────────────
resource rg 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

// ─────────────────────────────────────────────────────────────────────────────
// All RG-scoped resources (Log Analytics, ACR, Identity, Container Apps)
// ─────────────────────────────────────────────────────────────────────────────
module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    tags: tags
    resourceToken: resourceToken
    enableAuth: enableAuth
    entraClientId: entraClientId
    allowedIp: allowedIp
    imageTag: imageTag
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────────
@description('Public HTTPS URL of the deployed MCP server.')
output SERVICE_API_URI string = resources.outputs.SERVICE_API_URI

@description('Whether Entra ID authentication is enabled on the endpoint.')
output AUTH_ENABLED bool = resources.outputs.authEnabled
