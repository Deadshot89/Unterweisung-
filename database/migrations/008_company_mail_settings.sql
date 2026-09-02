-- Unterweisungsmanager Online v0.15
-- Mail-Einstellungen pro Firma/Mandant.

IF COL_LENGTH('dbo.CompanySettings', 'mailMode') IS NULL
BEGIN
  ALTER TABLE dbo.CompanySettings ADD mailMode NVARCHAR(40) NOT NULL CONSTRAINT DF_CompanySettings_mailMode DEFAULT 'manual';
END
GO

IF COL_LENGTH('dbo.CompanySettings', 'mailFromName') IS NULL
BEGIN
  ALTER TABLE dbo.CompanySettings ADD mailFromName NVARCHAR(200) NULL;
END
GO

IF COL_LENGTH('dbo.CompanySettings', 'mailFromEmail') IS NULL
BEGIN
  ALTER TABLE dbo.CompanySettings ADD mailFromEmail NVARCHAR(254) NULL;
END
GO

IF COL_LENGTH('dbo.CompanySettings', 'replyToEmail') IS NULL
BEGIN
  ALTER TABLE dbo.CompanySettings ADD replyToEmail NVARCHAR(254) NULL;
END
GO

IF COL_LENGTH('dbo.CompanySettings', 'mailSubjectPrefix') IS NULL
BEGIN
  ALTER TABLE dbo.CompanySettings ADD mailSubjectPrefix NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.CompanySettings', 'mailSignature') IS NULL
BEGIN
  ALTER TABLE dbo.CompanySettings ADD mailSignature NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.CompanySettings', 'mailUpdatedAt') IS NULL
BEGIN
  ALTER TABLE dbo.CompanySettings ADD mailUpdatedAt DATETIME2 NULL;
END
GO

UPDATE dbo.CompanySettings
SET mailMode = COALESCE(NULLIF(mailMode, ''), 'manual'),
    mailFromName = COALESCE(mailFromName, 'Unterweisungsmanager'),
    mailSubjectPrefix = COALESCE(mailSubjectPrefix, 'Unterweisung'),
    mailSignature = COALESCE(mailSignature, 'Vielen Dank.'),
    mailUpdatedAt = COALESCE(mailUpdatedAt, SYSUTCDATETIME())
WHERE mailUpdatedAt IS NULL OR mailFromName IS NULL OR mailSubjectPrefix IS NULL OR mailSignature IS NULL;
GO
