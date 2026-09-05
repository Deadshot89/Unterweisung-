-- Additive, idempotente Passwort-Authentifizierung und Setup-Token-Persistenz.

IF COL_LENGTH('dbo.Users','passwordHash') IS NULL
  ALTER TABLE dbo.Users ADD passwordHash NVARCHAR(600) NULL;
GO
IF COL_LENGTH('dbo.Users','passwordSetAt') IS NULL
  ALTER TABLE dbo.Users ADD passwordSetAt DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.Users','failedLoginCount') IS NULL
  ALTER TABLE dbo.Users ADD failedLoginCount INT NOT NULL CONSTRAINT DF_Users_FailedLoginCount DEFAULT 0;
GO
IF COL_LENGTH('dbo.Users','lockedUntil') IS NULL
  ALTER TABLE dbo.Users ADD lockedUntil DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.Users','sessionVersion') IS NULL
  ALTER TABLE dbo.Users ADD sessionVersion INT NOT NULL CONSTRAINT DF_Users_SessionVersion DEFAULT 1;
GO

IF OBJECT_ID('dbo.PasswordSetupTokens','U') IS NULL
BEGIN
  CREATE TABLE dbo.PasswordSetupTokens(
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    userId NVARCHAR(120) NOT NULL,
    companyId NVARCHAR(80) NOT NULL,
    tokenHash NVARCHAR(128) NOT NULL,
    purpose NVARCHAR(30) NOT NULL,
    expiresAt DATETIME2 NOT NULL,
    usedAt DATETIME2 NULL,
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_PasswordSetupTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_PasswordSetupTokens_TokenHash UNIQUE(tokenHash),
    CONSTRAINT CK_PasswordSetupTokens_Purpose CHECK(purpose IN ('initial_password','password_reset')),
    CONSTRAINT FK_PasswordSetupTokens_User FOREIGN KEY(userId) REFERENCES dbo.Users(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PasswordSetupTokens_User' AND object_id=OBJECT_ID('dbo.PasswordSetupTokens'))
  CREATE INDEX IX_PasswordSetupTokens_User ON dbo.PasswordSetupTokens(companyId,userId,usedAt,expiresAt);
GO
