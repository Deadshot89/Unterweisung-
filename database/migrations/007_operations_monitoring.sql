-- Unterweisungsmanager Online v0.8
-- Betriebsmonitoring, Backup-Export-Protokoll und Restore-Prüfungen.

IF OBJECT_ID('dbo.BackupRuns','U') IS NULL
CREATE TABLE dbo.BackupRuns (
  id NVARCHAR(80) NOT NULL CONSTRAINT PK_BackupRuns PRIMARY KEY,
  companyId NVARCHAR(80) NULL,
  backupType NVARCHAR(60) NOT NULL CONSTRAINT DF_BackupRuns_Type DEFAULT 'manual_export',
  status NVARCHAR(40) NOT NULL CONSTRAINT DF_BackupRuns_Status DEFAULT 'started',
  startedAt DATETIME2 NOT NULL CONSTRAINT DF_BackupRuns_Started DEFAULT SYSUTCDATETIME(),
  completedAt DATETIME2 NULL,
  requestedBy NVARCHAR(120) NULL,
  blobPath NVARCHAR(600) NULL,
  fileName NVARCHAR(260) NULL,
  sizeBytes BIGINT NULL,
  sha256 NVARCHAR(128) NULL,
  tableCountsJson NVARCHAR(MAX) NULL,
  errorMessage NVARCHAR(MAX) NULL,
  notes NVARCHAR(1000) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_BackupRuns_Company_Started' AND object_id=OBJECT_ID('dbo.BackupRuns'))
  CREATE INDEX IX_BackupRuns_Company_Started ON dbo.BackupRuns(companyId,startedAt DESC);
GO

IF OBJECT_ID('dbo.SystemHealthSnapshots','U') IS NULL
CREATE TABLE dbo.SystemHealthSnapshots (
  id NVARCHAR(80) NOT NULL CONSTRAINT PK_SystemHealthSnapshots PRIMARY KEY,
  companyId NVARCHAR(80) NULL,
  status NVARCHAR(40) NOT NULL,
  checkedAt DATETIME2 NOT NULL CONSTRAINT DF_SystemHealth_Checked DEFAULT SYSUTCDATETIME(),
  databaseStatus NVARCHAR(80) NULL,
  blobStatus NVARCHAR(80) NULL,
  mailStatus NVARCHAR(80) NULL,
  authStatus NVARCHAR(80) NULL,
  detailsJson NVARCHAR(MAX) NULL,
  createdBy NVARCHAR(120) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_SystemHealth_Company_Checked' AND object_id=OBJECT_ID('dbo.SystemHealthSnapshots'))
  CREATE INDEX IX_SystemHealth_Company_Checked ON dbo.SystemHealthSnapshots(companyId,checkedAt DESC);
GO

IF OBJECT_ID('dbo.RestoreChecks','U') IS NULL
CREATE TABLE dbo.RestoreChecks (
  id NVARCHAR(80) NOT NULL CONSTRAINT PK_RestoreChecks PRIMARY KEY,
  companyId NVARCHAR(80) NULL,
  backupRunId NVARCHAR(80) NULL,
  status NVARCHAR(40) NOT NULL,
  checkedAt DATETIME2 NOT NULL CONSTRAINT DF_RestoreChecks_Checked DEFAULT SYSUTCDATETIME(),
  checkedBy NVARCHAR(120) NULL,
  validationJson NVARCHAR(MAX) NULL,
  errorMessage NVARCHAR(MAX) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_RestoreChecks_Company_Checked' AND object_id=OBJECT_ID('dbo.RestoreChecks'))
  CREATE INDEX IX_RestoreChecks_Company_Checked ON dbo.RestoreChecks(companyId,checkedAt DESC);
GO

CREATE OR ALTER VIEW dbo.vOperationsOverview AS
SELECT c.id AS companyId,
       c.name AS companyName,
       (SELECT COUNT(*) FROM dbo.Employees e WHERE e.companyId=c.id AND e.active=1) AS activeEmployees,
       (SELECT COUNT(*) FROM dbo.InstructionTypes t WHERE t.companyId=c.id AND t.active=1) AS activeInstructionTypes,
       (SELECT COUNT(*) FROM dbo.vInstructionStatus s WHERE s.companyId=c.id AND s.status='expired') AS expiredInstructions,
       (SELECT COUNT(*) FROM dbo.vInstructionStatus s WHERE s.companyId=c.id AND s.status='missing') AS missingInstructions,
       (SELECT COUNT(*) FROM dbo.ExternalInvitations i WHERE i.companyId=c.id AND i.status IN ('created','sent','opened')) AS openInvitations,
       (SELECT COUNT(*) FROM dbo.Files f WHERE f.companyId=c.id AND f.scanStatus IN ('pending','not_configured')) AS filesPendingScan,
       (SELECT MAX(startedAt) FROM dbo.BackupRuns b WHERE b.companyId=c.id AND b.status='completed') AS lastBackupAt,
       (SELECT TOP 1 status FROM dbo.SystemHealthSnapshots h WHERE h.companyId=c.id ORDER BY checkedAt DESC) AS lastHealthStatus,
       (SELECT MAX(checkedAt) FROM dbo.SystemHealthSnapshots h WHERE h.companyId=c.id) AS lastHealthAt
FROM dbo.Companies c;
GO
