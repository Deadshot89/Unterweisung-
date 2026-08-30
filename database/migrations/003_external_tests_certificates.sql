-- Unterweisungsmanager Online v0.4
-- Erweiterung externe Unterweisung: Tests, Abschlussdaten, Zertifikatsdatei, Einladungsauswertung.

IF COL_LENGTH('dbo.ExternalInvitations','recipientName') IS NULL
  ALTER TABLE dbo.ExternalInvitations ADD recipientName NVARCHAR(200) NULL;
GO
IF COL_LENGTH('dbo.ExternalInvitations','startedAt') IS NULL
  ALTER TABLE dbo.ExternalInvitations ADD startedAt DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.ExternalInvitations','lastAccessedAt') IS NULL
  ALTER TABLE dbo.ExternalInvitations ADD lastAccessedAt DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.ExternalInvitations','completedIp') IS NULL
  ALTER TABLE dbo.ExternalInvitations ADD completedIp NVARCHAR(80) NULL;
GO
IF COL_LENGTH('dbo.ExternalInvitations','completedUserAgent') IS NULL
  ALTER TABLE dbo.ExternalInvitations ADD completedUserAgent NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.ExternalInvitations','testRequired') IS NULL
  ALTER TABLE dbo.ExternalInvitations ADD testRequired BIT NOT NULL CONSTRAINT DF_ExternalInvitations_TestRequired DEFAULT 1;
GO
IF COL_LENGTH('dbo.ExternalInvitations','passPercent') IS NULL
  ALTER TABLE dbo.ExternalInvitations ADD passPercent INT NOT NULL CONSTRAINT DF_ExternalInvitations_PassPercent DEFAULT 80;
GO
IF COL_LENGTH('dbo.ExternalInvitations','certificateFileId') IS NULL
  ALTER TABLE dbo.ExternalInvitations ADD certificateFileId NVARCHAR(80) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_Inv_CertificateFile')
  ALTER TABLE dbo.ExternalInvitations ADD CONSTRAINT FK_Inv_CertificateFile FOREIGN KEY(certificateFileId) REFERENCES dbo.Files(id);
GO

IF COL_LENGTH('dbo.TestResults','externalInvitationId') IS NULL
  ALTER TABLE dbo.TestResults ADD externalInvitationId NVARCHAR(80) NULL;
GO
IF COL_LENGTH('dbo.TestResults','createdBy') IS NULL
  ALTER TABLE dbo.TestResults ADD createdBy NVARCHAR(120) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_TR_ExternalInvitation')
  ALTER TABLE dbo.TestResults ADD CONSTRAINT FK_TR_ExternalInvitation FOREIGN KEY(externalInvitationId) REFERENCES dbo.ExternalInvitations(id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_TR_Company_Invitation' AND object_id=OBJECT_ID('dbo.TestResults'))
  CREATE INDEX IX_TR_Company_Invitation ON dbo.TestResults(companyId,externalInvitationId,createdAt DESC);
GO

CREATE OR ALTER VIEW dbo.vExternalInvitations AS
SELECT i.companyId,
       i.id,
       i.email,
       COALESCE(i.recipientName,e.name,i.email) AS recipientName,
       i.employeeId,
       e.name AS employeeName,
       i.instructionTypeId,
       t.name AS instructionName,
       t.category,
       i.language,
       i.status,
       i.expiresAt,
       i.startedAt,
       i.completedAt,
       i.testRequired,
       i.passPercent,
       i.certificateFileId,
       f.fileName AS certificateFileName,
       f.blobPath AS certificateBlobPath,
       i.createdBy,
       i.createdAt
FROM dbo.ExternalInvitations i
JOIN dbo.InstructionTypes t ON t.companyId=i.companyId AND t.id=i.instructionTypeId
LEFT JOIN dbo.Employees e ON e.companyId=i.companyId AND e.id=i.employeeId
LEFT JOIN dbo.Files f ON f.companyId=i.companyId AND f.id=i.certificateFileId;
GO
