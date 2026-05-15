// main.bicepparam — Default parameter values for azd
//
// azd sets AZURE_ENV_NAME and AZURE_LOCATION automatically from:
//   azd env set AZURE_ENV_NAME drawio-prod
//   azd env set AZURE_LOCATION eastus2
using 'main.bicep'

param environmentName = readEnvironmentVariable('AZURE_ENV_NAME', 'drawio-dev')
param location       = readEnvironmentVariable('AZURE_LOCATION', 'eastus2')

// Pin a specific Docker Hub image tag (e.g. 3.0.1). Defaults to 'latest'.
// azd env set DRAWIO_IMAGE_TAG 3.0.1
param imageTag = readEnvironmentVariable('DRAWIO_IMAGE_TAG', 'latest')

// Entra ID Easy Auth — set both values to enable:
//   1. Create an App Registration: az ad app create --display-name drawio-mcp-server
//   2. Add the API scope:          az ad app update --id <clientId> --identifier-uris api://<clientId>
//   3. Set enableAuth = true and paste the clientId below
//   4. Run: azd provision
param enableAuth    = bool(readEnvironmentVariable('DRAWIO_ENABLE_AUTH', 'false'))
param entraClientId = readEnvironmentVariable('DRAWIO_ENTRA_CLIENT_ID', '')
param allowedIp     = readEnvironmentVariable('DRAWIO_ALLOWED_IP', '')
