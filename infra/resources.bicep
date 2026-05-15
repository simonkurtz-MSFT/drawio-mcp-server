// ─────────────────────────────────────────────────────────────────────────────
// resources.bicep — Resource Group-scoped infrastructure
//
// Provisions:
//   • Log Analytics Workspace   — structured container logs
//   • Container Apps Environment — shared hosting platform
//   • Container App              — Draw.io MCP Server (HTTPS-only)
//
// Image source: public Docker Hub (docker.io/simonkurtzmsft/drawio-mcp-server)
// No ACR or Managed Identity required — image is publicly available.
//
// To migrate to a private ACR later:
//   1. Add ACR + User-assigned Managed Identity + AcrPull role assignment
//   2. Import image: az acr import --name <acr> \
//        --source docker.io/simonkurtzmsft/drawio-mcp-server:latest \
//        --image drawio-mcp-server:latest
//   3. Update the container image reference and add a registries block
// ─────────────────────────────────────────────────────────────────────────────
targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string

@description('Common tags applied to every resource.')
param tags object

@description('Unique token used to ensure globally unique resource names.')
param resourceToken string

@description('Docker Hub image tag to deploy.')
param imageTag string = 'latest'

// ─────────────────────────────────────────────────────────────────────────────
// Entra ID Easy Auth (optional)
//
// When enableAuth = true, all requests without a valid Entra ID Bearer token
// are rejected with HTTP 401 — no anonymous access possible.
//
// Steps to enable:
//   1. Create an App Registration (see README — Azure Container Apps section)
//   2. Set enableAuth = true and entraClientId = <app-registration-client-id>
//      in main.bicepparam
//   3. Run: azd provision
// ─────────────────────────────────────────────────────────────────────────────
@description('Enable Entra ID authentication. Rejects all requests without a valid Bearer token.')
param enableAuth bool = false

@description('Entra ID App Registration client ID. Required when enableAuth = true.')
param entraClientId string = ''

@description('Comma-separated list of allowed IP CIDR ranges. Empty string = allow all. Overrides Entra auth when set.')
param allowedIp string = ''

// ─────────────────────────────────────────────────────────────────────────────
// Log Analytics Workspace
// Receives structured logs from the Container Apps environment.
// disableLocalAuth forces all queries through Entra ID — no shared keys.
// ─────────────────────────────────────────────────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    // Note: disableLocalAuth is intentionally NOT set.
    // Container Apps Environment ships logs via shared key (listKeys());
    // setting disableLocalAuth: true would block that ingestion path.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Container Apps Environment
// Shared environment with Log Analytics integration for structured logging.
// ─────────────────────────────────────────────────────────────────────────────
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${resourceToken}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Container App — Draw.io MCP Server
//
// Security posture:
//   • HTTPS-only ingress (allowInsecure: false)
//   • Public image from Docker Hub (no stored registry credentials)
//   • Non-root, distroless container image (enforced in Dockerfile)
//   • Scale-to-zero when idle (minReplicas: 0)
//   • CPU/memory capped to prevent resource exhaustion
//   • IP allowlisting: only allowedIp CIDR(s) can reach the endpoint (when set)
//   • Entra ID Easy Auth: rejects unauthenticated requests with 401 (when enableAuth=true)
// ─────────────────────────────────────────────────────────────────────────────
// Build the ipSecurityRestrictions array only when allowedIp is provided.
// Container Apps expects CIDR notation; a bare IP is padded to /32.
var ipRules = empty(allowedIp) ? [] : [
  {
    name: 'allow-owner'
    ipAddressRange: contains(allowedIp, '/') ? allowedIp : '${allowedIp}/32'
    action: 'Allow'
  }
]

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-drawio-${resourceToken}'
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080     // Must match HTTP_PORT env var and EXPOSE in Dockerfile
        transport: 'http'    // ACA handles TLS termination; app receives plain HTTP
        allowInsecure: false // SECURITY: reject HTTP; HTTPS only
        ipSecurityRestrictions: ipRules // SECURITY: empty = allow all; set allowedIp to restrict
      }
    }
    template: {
      containers: [
        {
          name: 'drawio-mcp-server'
          // Public image — no registry credentials required
          image: 'docker.io/simonkurtzmsft/drawio-mcp-server:${imageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'HTTP_PORT', value: '8080' }
            { name: 'TRANSPORT', value: 'http' }
            { name: 'LOGGER_TYPE', value: 'mcp_server' }
          ]
        }
      ]
      scale: {
        minReplicas: 0  // Scale to zero when idle — cost-efficient
        // maxReplicas is capped at 1 because HTTP sessions are tracked in-memory
        // per replica. With multiple replicas, a follow-up MCP request can land
        // on a different replica where the session is unknown, silently creating
        // a new session. ACA ingress has no native sticky-session support.
        // Increase to >1 only if you implement an external session store.
        maxReplicas: 1
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entra ID Easy Auth
// Validates Bearer tokens issued for the registered App Registration.
// unauthenticatedClientAction: 'Return401' — API-safe; no browser redirects.
// isAutoProvisioned: false — we own the App Registration.
// No client secret needed for token validation-only mode: Easy Auth verifies
// JWT signatures using the OIDC public keys from the issuer discovery endpoint.
// ─────────────────────────────────────────────────────────────────────────────
resource containerAppAuth 'Microsoft.App/containerApps/authConfigs@2024-03-01' = if (enableAuth && !empty(entraClientId)) {
  name: 'current'
  parent: containerApp
  properties: {
    globalValidation: {
      unauthenticatedClientAction: 'Return401' // SECURITY: 401 for missing/invalid tokens
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraClientId
          // v2.0 endpoint supports both personal and work/school accounts
          openIdIssuer: 'https://sts.windows.net/${tenant().tenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [
            'api://${entraClientId}' // Only tokens issued for this specific app
          ]
        }
        isAutoProvisioned: false
      }
    }
    platform: { enabled: true }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outputs — surfaced to main.bicep
// ─────────────────────────────────────────────────────────────────────────────
output SERVICE_API_URI string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output authEnabled bool = enableAuth
