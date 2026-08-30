@description('Azure Region')
param location string = resourceGroup().location

@description('Prefix for all resources')
param namePrefix string = 'um-online'

@description('Blob container for templates, certificates and uploads')
param blobContainerName string = 'unterweisungsmanager'

@secure()
@description('SQL administrator password. Replace with Key Vault/Entra auth before production.')
param sqlAdminPassword string

param sqlAdminLogin string = 'umadmin'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: toLower('${namePrefix}${uniqueString(resourceGroup().id)}')
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: 'Enabled'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  name: 'default'
  parent: storage
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 30 }
    containerDeleteRetentionPolicy: { enabled: true, days: 30 }
    isVersioningEnabled: true
  }
}

resource appContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: blobContainerName
  parent: blobService
  properties: { publicAccess: 'None' }
}

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: '${namePrefix}-sql-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  name: 'unterweisungsmanager'
  parent: sqlServer
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 5
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648
    zoneRedundant: false
    readScale: 'Disabled'
  }
}

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${namePrefix}-swa'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    repositoryUrl: ''
    branch: 'main'
    provider: 'GitHub'
  }
}

output staticWebAppName string = swa.name
output sqlServerName string = sqlServer.name
output databaseName string = sqlDb.name
output storageAccountName string = storage.name
output blobContainerName string = appContainer.name
