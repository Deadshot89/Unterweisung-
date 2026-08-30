-- Unterweisungsmanager Online v0.6
-- Produktiver Login/Rollenbetrieb mit Microsoft Entra / Static Web Apps Auth.
-- Bestehende Users-Tabelle wird erweitert, ohne bestehende Daten zu verlieren.

IF COL_LENGTH('dbo.Users','entraObjectId') IS NULL
  ALTER TABLE dbo.Users ADD entraObjectId NVARCHAR(120) NULL;
GO
IF COL_LENGTH('dbo.Users','provider') IS NULL
  ALTER TABLE dbo.Users ADD provider NVARCHAR(60) NOT NULL CONSTRAINT DF_Users_Provider DEFAULT 'aad';
GO
IF COL_LENGTH('dbo.Users','lastSeenAt') IS NULL
  ALTER TABLE dbo.Users ADD lastSeenAt DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.Users','invitedAt') IS NULL
  ALTER TABLE dbo.Users ADD invitedAt DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.Users','notes') IS NULL
  ALTER TABLE dbo.Users ADD notes NVARCHAR(1000) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Users_Email_Active' AND object_id=OBJECT_ID('dbo.Users'))
  CREATE INDEX IX_Users_Email_Active ON dbo.Users(email,active);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Users_Company_Role' AND object_id=OBJECT_ID('dbo.Users'))
  CREATE INDEX IX_Users_Company_Role ON dbo.Users(companyId,role,active);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Users_EntraObjectId' AND object_id=OBJECT_ID('dbo.Users'))
  CREATE INDEX IX_Users_EntraObjectId ON dbo.Users(entraObjectId) WHERE entraObjectId IS NOT NULL;
GO

IF OBJECT_ID('dbo.SecurityEvents','U') IS NULL
BEGIN
  CREATE TABLE dbo.SecurityEvents (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    companyId NVARCHAR(80) NULL,
    actorUserId NVARCHAR(120) NULL,
    eventType NVARCHAR(120) NOT NULL,
    severity NVARCHAR(40) NOT NULL DEFAULT 'info',
    ipAddress NVARCHAR(80) NULL,
    userAgent NVARCHAR(500) NULL,
    detailsJson NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_SecurityEvents_Company_Date' AND object_id=OBJECT_ID('dbo.SecurityEvents'))
  CREATE INDEX IX_SecurityEvents_Company_Date ON dbo.SecurityEvents(companyId,createdAt DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_SecurityEvents_Type_Date' AND object_id=OBJECT_ID('dbo.SecurityEvents'))
  CREATE INDEX IX_SecurityEvents_Type_Date ON dbo.SecurityEvents(eventType,createdAt DESC);
GO

CREATE OR ALTER VIEW dbo.vUserAccess AS
SELECT u.id,
       u.companyId,
       c.name AS companyName,
       u.email,
       u.displayName,
       u.role,
       u.active,
       u.entraObjectId,
       u.provider,
       u.lastSeenAt,
       u.createdAt,
       u.updatedAt
FROM dbo.Users u
JOIN dbo.Companies c ON c.id=u.companyId;
GO
