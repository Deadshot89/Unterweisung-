-- Unterweisungsmanager Online v0.36.3
-- Additive Vorbereitung für Mitarbeiterportal, E-Mail/Passwort und bildgestützte Lernschritte.
-- Diese Migration wird durch das Vorschau-Update NICHT automatisch ausgeführt.

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

IF COL_LENGTH('dbo.InstructionTypes','deliveryMode') IS NULL
  ALTER TABLE dbo.InstructionTypes ADD deliveryMode NVARCHAR(20) NOT NULL CONSTRAINT DF_InstructionTypes_DeliveryMode DEFAULT 'practical';
GO
IF COL_LENGTH('dbo.InstructionTypes','testRequired') IS NULL
  ALTER TABLE dbo.InstructionTypes ADD testRequired BIT NOT NULL CONSTRAINT DF_InstructionTypes_TestRequired DEFAULT 0;
GO
IF COL_LENGTH('dbo.InstructionTypes','passPercent') IS NULL
  ALTER TABLE dbo.InstructionTypes ADD passPercent INT NOT NULL CONSTRAINT DF_InstructionTypes_PassPercent DEFAULT 80;
GO

IF OBJECT_ID('dbo.InstructionLearningSteps','U') IS NULL
BEGIN
  CREATE TABLE dbo.InstructionLearningSteps (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    instructionTypeId NVARCHAR(80) NOT NULL,
    language NVARCHAR(10) NOT NULL DEFAULT 'de',
    sortOrder INT NOT NULL DEFAULT 10,
    title NVARCHAR(240) NOT NULL,
    body NVARCHAR(MAX) NULL,
    imageFileId NVARCHAR(80) NULL,
    status NVARCHAR(30) NOT NULL DEFAULT 'draft',
    reviewedBy NVARCHAR(120) NULL,
    reviewedAt DATETIME2 NULL,
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NULL,
    CONSTRAINT FK_LearningSteps_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_LearningSteps_Type FOREIGN KEY(instructionTypeId) REFERENCES dbo.InstructionTypes(id),
    CONSTRAINT FK_LearningSteps_Image FOREIGN KEY(imageFileId) REFERENCES dbo.Files(id),
    CONSTRAINT CK_LearningSteps_Status CHECK(status IN ('draft','published'))
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_LearningSteps_Company_Type_Lang' AND object_id=OBJECT_ID('dbo.InstructionLearningSteps'))
  CREATE INDEX IX_LearningSteps_Company_Type_Lang ON dbo.InstructionLearningSteps(companyId,instructionTypeId,language,status,sortOrder);
GO

IF OBJECT_ID('dbo.InternalTrainingAttempts','U') IS NULL
BEGIN
  CREATE TABLE dbo.InternalTrainingAttempts (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    employeeId NVARCHAR(80) NOT NULL,
    instructionTypeId NVARCHAR(80) NOT NULL,
    language NVARCHAR(10) NOT NULL DEFAULT 'de',
    status NVARCHAR(30) NOT NULL DEFAULT 'started',
    currentStep INT NOT NULL DEFAULT 0,
    questionSnapshotJson NVARCHAR(MAX) NULL,
    answersJson NVARCHAR(MAX) NULL,
    scorePercent DECIMAL(5,2) NULL,
    passed BIT NULL,
    recordId NVARCHAR(80) NULL,
    startedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    completedAt DATETIME2 NULL,
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NULL,
    CONSTRAINT FK_InternalAttempts_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_InternalAttempts_Employee FOREIGN KEY(employeeId) REFERENCES dbo.Employees(id),
    CONSTRAINT FK_InternalAttempts_Type FOREIGN KEY(instructionTypeId) REFERENCES dbo.InstructionTypes(id),
    CONSTRAINT FK_InternalAttempts_Record FOREIGN KEY(recordId) REFERENCES dbo.InstructionRecords(id),
    CONSTRAINT CK_InternalAttempts_Status CHECK(status IN ('started','failed','completed'))
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_InternalAttempts_Employee_Type' AND object_id=OBJECT_ID('dbo.InternalTrainingAttempts'))
  CREATE INDEX IX_InternalAttempts_Employee_Type ON dbo.InternalTrainingAttempts(companyId,employeeId,instructionTypeId,status,startedAt DESC);
GO
