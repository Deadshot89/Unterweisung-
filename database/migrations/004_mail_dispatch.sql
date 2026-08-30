-- Unterweisungsmanager Online v0.5
-- Microsoft Graph Mailversand: Mail-Status, Mail-Log und Erinnerungen.

IF COL_LENGTH('dbo.ExternalInvitations','mailSentAt') IS NULL
  ALTER TABLE dbo.ExternalInvitations ADD mailSentAt DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.ExternalInvitations','lastReminderAt') IS NULL
  ALTER TABLE dbo.ExternalInvitations ADD lastReminderAt DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.ExternalInvitations','reminderCount') IS NULL
  ALTER TABLE dbo.ExternalInvitations ADD reminderCount INT NOT NULL CONSTRAINT DF_ExternalInvitations_ReminderCount DEFAULT 0;
GO
IF COL_LENGTH('dbo.ExternalInvitations','mailError') IS NULL
  ALTER TABLE dbo.ExternalInvitations ADD mailError NVARCHAR(1000) NULL;
GO

IF COL_LENGTH('dbo.TrainingParticipants','mailSentAt') IS NULL
  ALTER TABLE dbo.TrainingParticipants ADD mailSentAt DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.TrainingParticipants','mailError') IS NULL
  ALTER TABLE dbo.TrainingParticipants ADD mailError NVARCHAR(1000) NULL;
GO

IF OBJECT_ID('dbo.MailLog','U') IS NULL
BEGIN
  CREATE TABLE dbo.MailLog (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    relatedEntityType NVARCHAR(80) NULL,
    relatedEntityId NVARCHAR(80) NULL,
    provider NVARCHAR(80) NOT NULL DEFAULT 'microsoft-graph',
    fromEmail NVARCHAR(254) NULL,
    toEmail NVARCHAR(MAX) NOT NULL,
    ccEmail NVARCHAR(MAX) NULL,
    subject NVARCHAR(300) NOT NULL,
    bodyPreview NVARCHAR(1000) NULL,
    providerMessageId NVARCHAR(200) NULL,
    status NVARCHAR(40) NOT NULL,
    errorMessage NVARCHAR(MAX) NULL,
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_MailLog_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_MailLog_Company_Date' AND object_id=OBJECT_ID('dbo.MailLog'))
  CREATE INDEX IX_MailLog_Company_Date ON dbo.MailLog(companyId,createdAt DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_MailLog_Company_Entity' AND object_id=OBJECT_ID('dbo.MailLog'))
  CREATE INDEX IX_MailLog_Company_Entity ON dbo.MailLog(companyId,relatedEntityType,relatedEntityId,createdAt DESC);
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
       i.mailSentAt,
       i.lastReminderAt,
       i.reminderCount,
       i.mailError,
       i.createdBy,
       i.createdAt
FROM dbo.ExternalInvitations i
JOIN dbo.InstructionTypes t ON t.companyId=i.companyId AND t.id=i.instructionTypeId
LEFT JOIN dbo.Employees e ON e.companyId=i.companyId AND e.id=i.employeeId
LEFT JOIN dbo.Files f ON f.companyId=i.companyId AND f.id=i.certificateFileId;
GO
