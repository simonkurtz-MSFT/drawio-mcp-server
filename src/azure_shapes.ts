/**
 * Azure shape library for Draw.io MCP Server
 * Based on official Azure architecture diagram icons from:
 * https://github.com/dwarfered/azure-architecture-icons-for-drawio
 * 
 * Note: These shapes reference draw.io's built-in Azure icon library.
 * When opening the generated diagram in draw.io, ensure the Azure
 * shape library is enabled (More Shapes > Azure).
 */

export interface AzureShape {
  name: string;
  category: string;
  style: string;
  defaultWidth: number;
  defaultHeight: number;
}

/**
 * Azure shape definitions organized by category
 * Each shape uses draw.io's built-in Azure icon references
 */
export const azureShapes: Record<string, AzureShape> = {
  // Compute Services
  "azure-virtual-machine": {
    name: "Azure Virtual Machine",
    category: "Compute",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/compute/Virtual_Machine.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-vm-scale-sets": {
    name: "Azure VM Scale Sets",
    category: "Compute",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/compute/VM_Scale_Sets.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-app-service": {
    name: "Azure App Service",
    category: "Compute",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/app_services/App_Services.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-function-app": {
    name: "Azure Function App",
    category: "Compute",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/compute/Function_Apps.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-kubernetes-service": {
    name: "Azure Kubernetes Service",
    category: "Compute",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/compute/Kubernetes_Services.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-container-instances": {
    name: "Azure Container Instances",
    category: "Compute",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/compute/Container_Instances.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-container-registry": {
    name: "Azure Container Registry",
    category: "Compute",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/containers/Container_Registries.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-batch": {
    name: "Azure Batch",
    category: "Compute",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/compute/Batch_Accounts.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },

  // Storage Services
  "azure-storage-account": {
    name: "Azure Storage Account",
    category: "Storage",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/storage/Storage_Accounts.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-blob-storage": {
    name: "Azure Blob Storage",
    category: "Storage",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/storage/Blob_Storage.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-file-storage": {
    name: "Azure File Storage",
    category: "Storage",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/storage/File_Storage.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-disk-storage": {
    name: "Azure Disk Storage",
    category: "Storage",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/storage/Disks.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-queue-storage": {
    name: "Azure Queue Storage",
    category: "Storage",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/storage/Queue_Storage.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-table-storage": {
    name: "Azure Table Storage",
    category: "Storage",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/storage/Table_Storage.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },

  // Networking
  "azure-virtual-network": {
    name: "Azure Virtual Network",
    category: "Networking",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/networking/Virtual_Networks.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-load-balancer": {
    name: "Azure Load Balancer",
    category: "Networking",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/networking/Load_Balancers.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-application-gateway": {
    name: "Azure Application Gateway",
    category: "Networking",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/networking/Application_Gateways.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-vpn-gateway": {
    name: "Azure VPN Gateway",
    category: "Networking",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/networking/VPN_Gateways.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-traffic-manager": {
    name: "Azure Traffic Manager",
    category: "Networking",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/networking/Traffic_Manager_Profiles.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-firewall": {
    name: "Azure Firewall",
    category: "Networking",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/networking/Firewalls.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-dns": {
    name: "Azure DNS",
    category: "Networking",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/networking/DNS_Zones.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-front-door": {
    name: "Azure Front Door",
    category: "Networking",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/networking/Front_Doors.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-cdn": {
    name: "Azure CDN",
    category: "Networking",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/networking/CDN_Profiles.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },

  // Databases
  "azure-sql-database": {
    name: "Azure SQL Database",
    category: "Databases",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/databases/SQL_Database.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-cosmos-db": {
    name: "Azure Cosmos DB",
    category: "Databases",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/databases/Azure_Cosmos_DB.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-database-mysql": {
    name: "Azure Database for MySQL",
    category: "Databases",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/databases/Azure_Database_MySQL_Server.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-database-postgresql": {
    name: "Azure Database for PostgreSQL",
    category: "Databases",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/databases/Azure_Database_PostgreSQL_Server.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-sql-managed-instance": {
    name: "Azure SQL Managed Instance",
    category: "Databases",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/databases/SQL_Managed_Instance.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-cache-redis": {
    name: "Azure Cache for Redis",
    category: "Databases",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/databases/Azure_Cache_Redis.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },

  // AI + Machine Learning
  "azure-cognitive-services": {
    name: "Azure Cognitive Services",
    category: "AI + Machine Learning",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/ai_machine_learning/Cognitive_Services.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-machine-learning": {
    name: "Azure Machine Learning",
    category: "AI + Machine Learning",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/ai_machine_learning/Machine_Learning.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-bot-service": {
    name: "Azure Bot Service",
    category: "AI + Machine Learning",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/ai_machine_learning/Bot_Services.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-openai": {
    name: "Azure OpenAI Service",
    category: "AI + Machine Learning",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/ai_machine_learning/Azure_OpenAI.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },

  // Analytics
  "azure-synapse-analytics": {
    name: "Azure Synapse Analytics",
    category: "Analytics",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/analytics/Azure_Synapse_Analytics.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-databricks": {
    name: "Azure Databricks",
    category: "Analytics",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/analytics/Azure_Databricks.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-data-factory": {
    name: "Azure Data Factory",
    category: "Analytics",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/analytics/Data_Factory.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-stream-analytics": {
    name: "Azure Stream Analytics",
    category: "Analytics",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/analytics/Stream_Analytics_Jobs.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-event-hubs": {
    name: "Azure Event Hubs",
    category: "Analytics",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/analytics/Event_Hubs.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },

  // Security + Identity
  "azure-active-directory": {
    name: "Azure Active Directory",
    category: "Security + Identity",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/identity/Azure_Active_Directory.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-key-vault": {
    name: "Azure Key Vault",
    category: "Security + Identity",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/security/Key_Vaults.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-security-center": {
    name: "Azure Security Center",
    category: "Security + Identity",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/security/Security_Center.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-sentinel": {
    name: "Azure Sentinel",
    category: "Security + Identity",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/security/Azure_Sentinel.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },

  // Management + Governance
  "azure-monitor": {
    name: "Azure Monitor",
    category: "Management + Governance",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/monitor/Monitor.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-log-analytics": {
    name: "Azure Log Analytics",
    category: "Management + Governance",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/monitor/Log_Analytics_Workspaces.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-automation": {
    name: "Azure Automation",
    category: "Management + Governance",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/management_governance/Automation_Accounts.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-backup": {
    name: "Azure Backup",
    category: "Management + Governance",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/management_governance/Backup.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-policy": {
    name: "Azure Policy",
    category: "Management + Governance",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/management_governance/Policy.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },

  // Integration
  "azure-service-bus": {
    name: "Azure Service Bus",
    category: "Integration",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/integration/Service_Bus.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-logic-apps": {
    name: "Azure Logic Apps",
    category: "Integration",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/integration/Logic_Apps.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-api-management": {
    name: "Azure API Management",
    category: "Integration",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/integration/API_Management_Services.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-event-grid": {
    name: "Azure Event Grid",
    category: "Integration",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/integration/Event_Grid.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },

  // DevOps
  "azure-devops": {
    name: "Azure DevOps",
    category: "DevOps",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/devops/Azure_DevOps.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-pipelines": {
    name: "Azure Pipelines",
    category: "DevOps",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/devops/Pipelines.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-repos": {
    name: "Azure Repos",
    category: "DevOps",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/devops/Repos.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },

  // General
  "azure-resource-group": {
    name: "Azure Resource Group",
    category: "General",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/general/Resource_Groups.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-subscription": {
    name: "Azure Subscription",
    category: "General",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/general/Subscriptions.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
  "azure-management-group": {
    name: "Azure Management Group",
    category: "General",
    style: "aspect=fixed;html=1;points=[];align=center;image;fontSize=12;image=img/lib/azure2/general/Management_Groups.svg;",
    defaultWidth: 50,
    defaultHeight: 50,
  },
};

/**
 * Get all Azure shape categories
 */
export function getAzureCategories(): Array<{ id: string; name: string }> {
  const categories = new Set<string>();
  Object.values(azureShapes).forEach((shape) => categories.add(shape.category));
  
  return Array.from(categories).map((category) => ({
    id: category.toLowerCase().replace(/\s+/g, "-"),
    name: category,
  }));
}

/**
 * Get all shapes in a specific Azure category
 */
export function getAzureShapesInCategory(categoryId: string): AzureShape[] {
  const categoryName = categoryId.replace(/-/g, " ");
  return Object.values(azureShapes).filter(
    (shape) => shape.category.toLowerCase() === categoryName.toLowerCase()
  );
}

/**
 * Get a specific Azure shape by name
 */
export function getAzureShapeByName(shapeName: string): AzureShape | undefined {
  const normalizedName = shapeName.toLowerCase().replace(/\s+/g, "-");
  return azureShapes[normalizedName] || 
         Object.values(azureShapes).find(
           (shape) => shape.name.toLowerCase() === shapeName.toLowerCase()
         );
}

/**
 * Get all Azure shape names (for autocompletion/discovery)
 */
export function getAllAzureShapeNames(): string[] {
  return Object.keys(azureShapes);
}
