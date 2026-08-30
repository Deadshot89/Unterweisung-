-- Unterweisungsmanager Online - Azure SQL Schema v0.1
-- Ziel: mandantenfähige Datenhaltung. Jede fachliche Tabelle hat companyId.

CREATE TABLE Companies (
  id NVARCHAR(80) NOT NULL PRIMARY KEY,
  name NVARCHAR(200) NOT NULL,
  legalName NVARCHAR(240) NULL,
  addressLine NVARCHAR(300) NULL,
  defaultLanguage NVARCHAR(10) NOT NULL DEFAULT 'de',
  active BIT NOT NULL DEFAULT 1,
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt DATETIME2 NULL
);

CREATE TABLE Users (
  id NVARCHAR(120) NOT NULL PRIMARY KEY,
  companyId NVARCHAR(80) NOT NULL,
  email NVARCHAR(254) NOT NULL,
  displayName NVARCHAR(200) NOT NULL,
  role NVARCHAR(60) NOT NULL,
  active BIT NOT NULL DEFAULT 1,
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt DATETIME2 NULL,
  CONSTRAINT FK_Users_Companies FOREIGN KEY(companyId) REFERENCES Companies(id)
);
CREATE UNIQUE INDEX UX_Users_Company_Email ON Users(companyId,email);

CREATE TABLE Employees (
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
  CONSTRAINT FK_Employees_Companies FOREIGN KEY(companyId) REFERENCES Companies(id),
  CONSTRAINT FK_Employees_LineManager FOREIGN KEY(lineManagerId) REFERENCES Employees(id)
);
CREATE INDEX IX_Employees_Company_Active ON Employees(companyId,active);
CREATE INDEX IX_Employees_Company_LineManager ON Employees(companyId,lineManagerId);

CREATE TABLE Templates (
  id NVARCHAR(80) NOT NULL PRIMARY KEY,
  companyId NVARCHAR(80) NOT NULL,
  title NVARCHAR(240) NOT NULL,
  fileName NVARCHAR(260) NOT NULL,
  blobPath NVARCHAR(500) NOT NULL,
  category NVARCHAR(120) NULL,
  description NVARCHAR(MAX) NULL,
  active BIT NOT NULL DEFAULT 1,
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Templates_Companies FOREIGN KEY(companyId) REFERENCES Companies(id)
);
CREATE INDEX IX_Templates_Company ON Templates(companyId,active);

CREATE TABLE InstructionTypes (
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
  CONSTRAINT FK_InstructionTypes_Companies FOREIGN KEY(companyId) REFERENCES Companies(id),
  CONSTRAINT FK_InstructionTypes_Templates FOREIGN KEY(templateId) REFERENCES Templates(id)
);
CREATE INDEX IX_InstructionTypes_Company ON InstructionTypes(companyId,active,category);

CREATE TABLE EmployeeInstructionExclusions (
  id NVARCHAR(80) NOT NULL PRIMARY KEY,
  companyId NVARCHAR(80) NOT NULL,
  employeeId NVARCHAR(80) NOT NULL,
  instructionTypeId NVARCHAR(80) NOT NULL,
  reason NVARCHAR(500) NULL,
  active BIT NOT NULL DEFAULT 1,
  createdBy NVARCHAR(120) NULL,
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Excl_Company FOREIGN KEY(companyId) REFERENCES Companies(id),
  CONSTRAINT FK_Excl_Employee FOREIGN KEY(employeeId) REFERENCES Employees(id),
  CONSTRAINT FK_Excl_Type FOREIGN KEY(instructionTypeId) REFERENCES InstructionTypes(id)
);
CREATE UNIQUE INDEX UX_Excl_Company_Emp_Type ON EmployeeInstructionExclusions(companyId,employeeId,instructionTypeId);

CREATE TABLE InstructionRecords (
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
  CONSTRAINT FK_Records_Company FOREIGN KEY(companyId) REFERENCES Companies(id),
  CONSTRAINT FK_Records_Employee FOREIGN KEY(employeeId) REFERENCES Employees(id),
  CONSTRAINT FK_Records_Type FOREIGN KEY(typeId) REFERENCES InstructionTypes(id),
  CONSTRAINT FK_Records_Instructor FOREIGN KEY(instructorId) REFERENCES Employees(id)
);
CREATE INDEX IX_Records_Company_Emp_Type ON InstructionRecords(companyId,employeeId,typeId,conductedAt DESC);
CREATE INDEX IX_Records_Company_Due ON InstructionRecords(companyId,validUntil,status);

CREATE TABLE PlannedTrainings (
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
  CONSTRAINT FK_Planned_Company FOREIGN KEY(companyId) REFERENCES Companies(id),
  CONSTRAINT FK_Planned_Type FOREIGN KEY(instructionTypeId) REFERENCES InstructionTypes(id),
  CONSTRAINT FK_Planned_LineManager FOREIGN KEY(lineManagerId) REFERENCES Employees(id)
);

CREATE TABLE TrainingParticipants (
  id NVARCHAR(80) NOT NULL PRIMARY KEY,
  companyId NVARCHAR(80) NOT NULL,
  plannedTrainingId NVARCHAR(80) NOT NULL,
  employeeId NVARCHAR(80) NULL,
  externalEmail NVARCHAR(254) NULL,
  status NVARCHAR(40) NOT NULL DEFAULT 'invited',
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_TP_Company FOREIGN KEY(companyId) REFERENCES Companies(id),
  CONSTRAINT FK_TP_Planned FOREIGN KEY(plannedTrainingId) REFERENCES PlannedTrainings(id),
  CONSTRAINT FK_TP_Employee FOREIGN KEY(employeeId) REFERENCES Employees(id)
);

CREATE TABLE ExternalInvitations (
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
  CONSTRAINT FK_Inv_Company FOREIGN KEY(companyId) REFERENCES Companies(id),
  CONSTRAINT FK_Inv_Employee FOREIGN KEY(employeeId) REFERENCES Employees(id),
  CONSTRAINT FK_Inv_Type FOREIGN KEY(instructionTypeId) REFERENCES InstructionTypes(id)
);
CREATE UNIQUE INDEX UX_Inv_TokenHash ON ExternalInvitations(tokenHash);
CREATE INDEX IX_Inv_Company_Status ON ExternalInvitations(companyId,status,expiresAt);

CREATE TABLE TestQuestions (
  id NVARCHAR(80) NOT NULL PRIMARY KEY,
  companyId NVARCHAR(80) NOT NULL,
  instructionTypeId NVARCHAR(80) NOT NULL,
  language NVARCHAR(10) NOT NULL,
  question NVARCHAR(MAX) NOT NULL,
  optionsJson NVARCHAR(MAX) NOT NULL,
  correctIndex INT NOT NULL,
  active BIT NOT NULL DEFAULT 1,
  CONSTRAINT FK_Q_Company FOREIGN KEY(companyId) REFERENCES Companies(id),
  CONSTRAINT FK_Q_Type FOREIGN KEY(instructionTypeId) REFERENCES InstructionTypes(id)
);
CREATE INDEX IX_Q_Company_Type_Lang ON TestQuestions(companyId,instructionTypeId,language,active);

CREATE TABLE TestResults (
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
  CONSTRAINT FK_TR_Company FOREIGN KEY(companyId) REFERENCES Companies(id),
  CONSTRAINT FK_TR_Employee FOREIGN KEY(employeeId) REFERENCES Employees(id),
  CONSTRAINT FK_TR_Type FOREIGN KEY(instructionTypeId) REFERENCES InstructionTypes(id)
);

CREATE TABLE Files (
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
  CONSTRAINT FK_Files_Company FOREIGN KEY(companyId) REFERENCES Companies(id)
);
CREATE INDEX IX_Files_Company_Kind ON Files(companyId,kind,createdAt DESC);

CREATE TABLE AuditLog (
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
CREATE INDEX IX_Audit_Company_Date ON AuditLog(companyId,createdAt DESC);
GO
