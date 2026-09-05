IF OBJECT_ID('dbo.UserPermissions','U') IS NULL
BEGIN
  CREATE TABLE dbo.UserPermissions (
    companyId NVARCHAR(80) NOT NULL,
    userId NVARCHAR(120) NOT NULL,
    permissionKey NVARCHAR(120) NOT NULL,
    grantedBy NVARCHAR(120) NULL,
    grantedAt DATETIME2 NOT NULL CONSTRAINT DF_UserPermissions_GrantedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_UserPermissions PRIMARY KEY(companyId,userId,permissionKey)
  );
  CREATE INDEX IX_UserPermissions_User ON dbo.UserPermissions(userId,permissionKey,companyId);
END
GO

IF OBJECT_ID('dbo.DiagnosticEvents','U') IS NULL
BEGIN
  CREATE TABLE dbo.DiagnosticEvents (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NULL,
    actorUserId NVARCHAR(120) NULL,
    severity NVARCHAR(20) NOT NULL,
    area NVARCHAR(120) NULL,
    action NVARCHAR(160) NULL,
    errorMessage NVARCHAR(2000) NULL,
    errorCode NVARCHAR(120) NULL,
    apiPath NVARCHAR(500) NULL,
    httpMethod NVARCHAR(16) NULL,
    httpStatus INT NULL,
    userAgent NVARCHAR(1000) NULL,
    appVersion NVARCHAR(60) NULL,
    dedupeKey NVARCHAR(128) NULL,
    detailsJson NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_DiagnosticEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
    alertedAt DATETIME2 NULL,
    alertResultJson NVARCHAR(MAX) NULL
  );
  CREATE INDEX IX_DiagnosticEvents_CreatedAt ON dbo.DiagnosticEvents(createdAt DESC);
  CREATE INDEX IX_DiagnosticEvents_CompanyCreatedAt ON dbo.DiagnosticEvents(companyId,createdAt DESC);
  CREATE INDEX IX_DiagnosticEvents_DedupeCreatedAt ON dbo.DiagnosticEvents(dedupeKey,createdAt DESC);
END
GO

IF OBJECT_ID('dbo.PushSubscriptions','U') IS NULL
BEGIN
  CREATE TABLE dbo.PushSubscriptions (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    userId NVARCHAR(120) NOT NULL,
    endpoint NVARCHAR(2048) NOT NULL,
    endpointHash NVARCHAR(128) NOT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_PushSubscriptions_CreatedAt DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_PushSubscriptions_UpdatedAt DEFAULT SYSUTCDATETIME(),
    lastSuccessAt DATETIME2 NULL,
    lastErrorAt DATETIME2 NULL,
    lastError NVARCHAR(1000) NULL
  );
  CREATE UNIQUE INDEX UX_PushSubscriptions_EndpointHash ON dbo.PushSubscriptions(endpointHash);
  CREATE INDEX IX_PushSubscriptions_User ON dbo.PushSubscriptions(userId,updatedAt DESC);
END
GO
