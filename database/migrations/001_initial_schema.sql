-- Unterweisungsmanager Online v0.3
-- Idempotente Initial-Migration für Azure SQL.
-- Kann mehrfach ausgeführt werden, ohne bestehende Tabellen zu löschen.

IF OBJECT_ID('dbo.DbMigrations','U') IS NULL
BEGIN
  CREATE TABLE dbo.DbMigrations (
    id NVARCHAR(180) NOT NULL PRIMARY KEY,
    appliedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    checksum NVARCHAR(128) NULL
  );
END
GO

IF OBJECT_ID('dbo.Companies','U') IS NULL
BEGIN
  CREATE TABLE dbo.Companies (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    legalName NVARCHAR(240) NULL,
    addressLine NVARCHAR(300) NULL,
    defaultLanguage NVARCHAR(10) NOT NULL DEFAULT 'de',
    active BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NULL
  );
END
GO

IF OBJECT_ID('dbo.Users','U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    id NVARCHAR(120) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    email NVARCHAR(254) NOT NULL,
    displayName NVARCHAR(200) NOT NULL,
    role NVARCHAR(60) NOT NULL,
    active BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NULL,
    CONSTRAINT FK_Users_Companies FOREIGN KEY(companyId) REFERENCES dbo.Companies(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_Users_Company_Email' AND object_id=OBJECT_ID('dbo.Users'))
  CREATE UNIQUE INDEX UX_Users_Company_Email ON dbo.Users(companyId,email);
GO

IF OBJECT_ID('dbo.Employees','U') IS NULL
BEGIN
  CREATE TABLE dbo.Employees (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    name NVARCHAR(200) NOT NULL,
    chipNr NVARCHAR(80) NULL,
    email NVARCHAR(254) NULL,
    department NVARCHAR(120) NULL,
    active BIT NOT NULL DEFAULT 1,
    role NVARCHAR(60) NOT NULL DEFAULT 'Mitarbeiter',
    lineManagerId NVARCHAR(80) NULL,
    title NVARCHAR(200) NULL,
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NULL,
    CONSTRAINT FK_Employees_Companies FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_Employees_LineManager FOREIGN KEY(lineManagerId) REFERENCES dbo.Employees(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Employees_Company_Active' AND object_id=OBJECT_ID('dbo.Employees'))
  CREATE INDEX IX_Employees_Company_Active ON dbo.Employees(companyId,active);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Employees_Company_LineManager' AND object_id=OBJECT_ID('dbo.Employees'))
  CREATE INDEX IX_Employees_Company_LineManager ON dbo.Employees(companyId,lineManagerId);
GO

IF OBJECT_ID('dbo.Templates','U') IS NULL
BEGIN
  CREATE TABLE dbo.Templates (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    title NVARCHAR(240) NOT NULL,
    fileName NVARCHAR(260) NOT NULL,
    blobPath NVARCHAR(500) NOT NULL,
    category NVARCHAR(120) NULL,
    description NVARCHAR(MAX) NULL,
    active BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Templates_Companies FOREIGN KEY(companyId) REFERENCES dbo.Companies(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Templates_Company' AND object_id=OBJECT_ID('dbo.Templates'))
  CREATE INDEX IX_Templates_Company ON dbo.Templates(companyId,active);
GO

IF OBJECT_ID('dbo.InstructionTypes','U') IS NULL
BEGIN
  CREATE TABLE dbo.InstructionTypes (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    name NVARCHAR(200) NOT NULL,
    category NVARCHAR(120) NOT NULL,
    intervalMonths INT NOT NULL DEFAULT 12,
    description NVARCHAR(MAX) NULL,
    templateId NVARCHAR(80) NULL,
    active BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NULL,
    CONSTRAINT FK_InstructionTypes_Companies FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_InstructionTypes_Templates FOREIGN KEY(templateId) REFERENCES dbo.Templates(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_InstructionTypes_Company' AND object_id=OBJECT_ID('dbo.InstructionTypes'))
  CREATE INDEX IX_InstructionTypes_Company ON dbo.InstructionTypes(companyId,active,category);
GO

IF OBJECT_ID('dbo.EmployeeInstructionExclusions','U') IS NULL
BEGIN
  CREATE TABLE dbo.EmployeeInstructionExclusions (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    employeeId NVARCHAR(80) NOT NULL,
    instructionTypeId NVARCHAR(80) NOT NULL,
    reason NVARCHAR(500) NULL,
    active BIT NOT NULL DEFAULT 1,
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Excl_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_Excl_Employee FOREIGN KEY(employeeId) REFERENCES dbo.Employees(id),
    CONSTRAINT FK_Excl_Type FOREIGN KEY(instructionTypeId) REFERENCES dbo.InstructionTypes(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_Excl_Company_Emp_Type' AND object_id=OBJECT_ID('dbo.EmployeeInstructionExclusions'))
  CREATE UNIQUE INDEX UX_Excl_Company_Emp_Type ON dbo.EmployeeInstructionExclusions(companyId,employeeId,instructionTypeId);
GO

IF OBJECT_ID('dbo.Files','U') IS NULL
BEGIN
  CREATE TABLE dbo.Files (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    kind NVARCHAR(60) NOT NULL,
    fileName NVARCHAR(260) NOT NULL,
    blobPath NVARCHAR(500) NOT NULL,
    contentType NVARCHAR(120) NULL,
    sizeBytes BIGINT NULL,
    sha256 NVARCHAR(128) NULL,
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Files_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Files_Company_Kind' AND object_id=OBJECT_ID('dbo.Files'))
  CREATE INDEX IX_Files_Company_Kind ON dbo.Files(companyId,kind,createdAt DESC);
GO

IF OBJECT_ID('dbo.InstructionRecords','U') IS NULL
BEGIN
  CREATE TABLE dbo.InstructionRecords (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    employeeId NVARCHAR(80) NULL,
    typeId NVARCHAR(80) NOT NULL,
    conductedAt DATETIME2 NOT NULL,
    validUntil DATETIME2 NULL,
    status NVARCHAR(40) NOT NULL DEFAULT 'completed',
    source NVARCHAR(40) NOT NULL DEFAULT 'manual',
    instructorId NVARCHAR(80) NULL,
    durationMinutes INT NULL,
    groupId NVARCHAR(80) NULL,
    confirmationText NVARCHAR(MAX) NULL,
    certificateFileId NVARCHAR(80) NULL,
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Records_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_Records_Employee FOREIGN KEY(employeeId) REFERENCES dbo.Employees(id),
    CONSTRAINT FK_Records_Type FOREIGN KEY(typeId) REFERENCES dbo.InstructionTypes(id),
    CONSTRAINT FK_Records_Instructor FOREIGN KEY(instructorId) REFERENCES dbo.Employees(id),
    CONSTRAINT FK_Records_Certificate FOREIGN KEY(certificateFileId) REFERENCES dbo.Files(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Records_Company_Emp_Type' AND object_id=OBJECT_ID('dbo.InstructionRecords'))
  CREATE INDEX IX_Records_Company_Emp_Type ON dbo.InstructionRecords(companyId,employeeId,typeId,conductedAt DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Records_Company_Due' AND object_id=OBJECT_ID('dbo.InstructionRecords'))
  CREATE INDEX IX_Records_Company_Due ON dbo.InstructionRecords(companyId,validUntil,status);
GO

IF OBJECT_ID('dbo.PlannedTrainings','U') IS NULL
BEGIN
  CREATE TABLE dbo.PlannedTrainings (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    instructionTypeId NVARCHAR(80) NOT NULL,
    plannedAt DATETIME2 NOT NULL,
    durationMinutes INT NULL,
    location NVARCHAR(200) NULL,
    lineManagerId NVARCHAR(80) NULL,
    status NVARCHAR(40) NOT NULL DEFAULT 'planned',
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Planned_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_Planned_Type FOREIGN KEY(instructionTypeId) REFERENCES dbo.InstructionTypes(id),
    CONSTRAINT FK_Planned_LineManager FOREIGN KEY(lineManagerId) REFERENCES dbo.Employees(id)
  );
END
GO

IF OBJECT_ID('dbo.TrainingParticipants','U') IS NULL
BEGIN
  CREATE TABLE dbo.TrainingParticipants (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    plannedTrainingId NVARCHAR(80) NOT NULL,
    employeeId NVARCHAR(80) NULL,
    externalEmail NVARCHAR(254) NULL,
    status NVARCHAR(40) NOT NULL DEFAULT 'invited',
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_TP_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_TP_Planned FOREIGN KEY(plannedTrainingId) REFERENCES dbo.PlannedTrainings(id),
    CONSTRAINT FK_TP_Employee FOREIGN KEY(employeeId) REFERENCES dbo.Employees(id)
  );
END
GO

IF OBJECT_ID('dbo.ExternalInvitations','U') IS NULL
BEGIN
  CREATE TABLE dbo.ExternalInvitations (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    tokenHash NVARCHAR(128) NOT NULL,
    email NVARCHAR(254) NOT NULL,
    employeeId NVARCHAR(80) NULL,
    instructionTypeId NVARCHAR(80) NOT NULL,
    language NVARCHAR(10) NOT NULL DEFAULT 'de',
    status NVARCHAR(40) NOT NULL DEFAULT 'sent',
    expiresAt DATETIME2 NOT NULL,
    completedAt DATETIME2 NULL,
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Inv_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_Inv_Employee FOREIGN KEY(employeeId) REFERENCES dbo.Employees(id),
    CONSTRAINT FK_Inv_Type FOREIGN KEY(instructionTypeId) REFERENCES dbo.InstructionTypes(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_Inv_TokenHash' AND object_id=OBJECT_ID('dbo.ExternalInvitations'))
  CREATE UNIQUE INDEX UX_Inv_TokenHash ON dbo.ExternalInvitations(tokenHash);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Inv_Company_Status' AND object_id=OBJECT_ID('dbo.ExternalInvitations'))
  CREATE INDEX IX_Inv_Company_Status ON dbo.ExternalInvitations(companyId,status,expiresAt);
GO

IF OBJECT_ID('dbo.TestQuestions','U') IS NULL
BEGIN
  CREATE TABLE dbo.TestQuestions (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    instructionTypeId NVARCHAR(80) NOT NULL,
    language NVARCHAR(10) NOT NULL,
    question NVARCHAR(MAX) NOT NULL,
    optionsJson NVARCHAR(MAX) NOT NULL,
    correctIndex INT NOT NULL,
    active BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_Q_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_Q_Type FOREIGN KEY(instructionTypeId) REFERENCES dbo.InstructionTypes(id)
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Q_Company_Type_Lang' AND object_id=OBJECT_ID('dbo.TestQuestions'))
  CREATE INDEX IX_Q_Company_Type_Lang ON dbo.TestQuestions(companyId,instructionTypeId,language,active);
GO

IF OBJECT_ID('dbo.TestResults','U') IS NULL
BEGIN
  CREATE TABLE dbo.TestResults (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    employeeId NVARCHAR(80) NULL,
    instructionTypeId NVARCHAR(80) NOT NULL,
    language NVARCHAR(10) NOT NULL,
    scorePercent DECIMAL(5,2) NOT NULL,
    passed BIT NOT NULL,
    answersJson NVARCHAR(MAX) NOT NULL,
    linkedRecordId NVARCHAR(80) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_TR_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_TR_Employee FOREIGN KEY(employeeId) REFERENCES dbo.Employees(id),
    CONSTRAINT FK_TR_Type FOREIGN KEY(instructionTypeId) REFERENCES dbo.InstructionTypes(id),
    CONSTRAINT FK_TR_Record FOREIGN KEY(linkedRecordId) REFERENCES dbo.InstructionRecords(id)
  );
END
GO

IF OBJECT_ID('dbo.AuditLog','U') IS NULL
BEGIN
  CREATE TABLE dbo.AuditLog (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    companyId NVARCHAR(80) NULL,
    actorUserId NVARCHAR(120) NULL,
    action NVARCHAR(120) NOT NULL,
    entityType NVARCHAR(80) NULL,
    entityId NVARCHAR(80) NULL,
    ipAddress NVARCHAR(80) NULL,
    userAgent NVARCHAR(500) NULL,
    detailsJson NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Audit_Company_Date' AND object_id=OBJECT_ID('dbo.AuditLog'))
  CREATE INDEX IX_Audit_Company_Date ON dbo.AuditLog(companyId,createdAt DESC);
GO
