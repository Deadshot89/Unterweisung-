-- v0.40: Arbeitsportal – strukturierter Inhalt und persistente interne Unterweisungszuweisungen.
-- Additiv/idempotent. Eine Assignment wird ausschließlich durch einen echten InstructionRecord abgeschlossen.

IF COL_LENGTH('dbo.InstructionTypes','contentJson') IS NULL
BEGIN
  ALTER TABLE dbo.InstructionTypes ADD contentJson NVARCHAR(MAX) NULL;
END
GO

IF OBJECT_ID('dbo.TrainingAssignments','U') IS NULL
BEGIN
  CREATE TABLE dbo.TrainingAssignments (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    employeeId NVARCHAR(80) NOT NULL,
    instructionTypeId NVARCHAR(80) NOT NULL,
    assignedByUserId NVARCHAR(120) NULL,
    assignedAt DATETIME2 NOT NULL CONSTRAINT DF_TrainingAssignments_AssignedAt DEFAULT SYSUTCDATETIME(),
    dueAt DATETIME2 NULL,
    status NVARCHAR(40) NOT NULL CONSTRAINT DF_TrainingAssignments_Status DEFAULT 'assigned',
    testRequired BIT NOT NULL CONSTRAINT DF_TrainingAssignments_TestRequired DEFAULT 1,
    passPercent INT NOT NULL CONSTRAINT DF_TrainingAssignments_PassPercent DEFAULT 80,
    startedAt DATETIME2 NULL,
    completedAt DATETIME2 NULL,
    linkedRecordId NVARCHAR(80) NULL,
    lastReminderAt DATETIME2 NULL,
    reminderCount INT NOT NULL CONSTRAINT DF_TrainingAssignments_ReminderCount DEFAULT 0,
    source NVARCHAR(40) NOT NULL CONSTRAINT DF_TrainingAssignments_Source DEFAULT 'manual',
    note NVARCHAR(1000) NULL,
    plannedTrainingId NVARCHAR(80) NULL,
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_TrainingAssignments_CreatedAt DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_TrainingAssignments_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_TrainingAssignments_Status CHECK (status IN ('assigned','in_progress','completed','cancelled')),
    CONSTRAINT CK_TrainingAssignments_PassPercent CHECK (passPercent BETWEEN 0 AND 100),
    CONSTRAINT FK_TrainingAssignments_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_TrainingAssignments_Employee FOREIGN KEY(employeeId) REFERENCES dbo.Employees(id),
    CONSTRAINT FK_TrainingAssignments_Type FOREIGN KEY(instructionTypeId) REFERENCES dbo.InstructionTypes(id),
    CONSTRAINT FK_TrainingAssignments_LinkedRecord FOREIGN KEY(linkedRecordId) REFERENCES dbo.InstructionRecords(id)
  );
END
GO

-- Defensive additive upgrades if an earlier v0.40 preview created a partial table.
IF COL_LENGTH('dbo.TrainingAssignments','assignedByUserId') IS NULL ALTER TABLE dbo.TrainingAssignments ADD assignedByUserId NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.TrainingAssignments','testRequired') IS NULL ALTER TABLE dbo.TrainingAssignments ADD testRequired BIT NOT NULL CONSTRAINT DF_TrainingAssignments_TestRequired_Upgrade DEFAULT 1 WITH VALUES;
IF COL_LENGTH('dbo.TrainingAssignments','passPercent') IS NULL ALTER TABLE dbo.TrainingAssignments ADD passPercent INT NOT NULL CONSTRAINT DF_TrainingAssignments_PassPercent_Upgrade DEFAULT 80 WITH VALUES;
IF COL_LENGTH('dbo.TrainingAssignments','startedAt') IS NULL ALTER TABLE dbo.TrainingAssignments ADD startedAt DATETIME2 NULL;
IF COL_LENGTH('dbo.TrainingAssignments','linkedRecordId') IS NULL ALTER TABLE dbo.TrainingAssignments ADD linkedRecordId NVARCHAR(80) NULL;
IF COL_LENGTH('dbo.TrainingAssignments','lastReminderAt') IS NULL ALTER TABLE dbo.TrainingAssignments ADD lastReminderAt DATETIME2 NULL;
IF COL_LENGTH('dbo.TrainingAssignments','reminderCount') IS NULL ALTER TABLE dbo.TrainingAssignments ADD reminderCount INT NOT NULL CONSTRAINT DF_TrainingAssignments_ReminderCount_Upgrade DEFAULT 0 WITH VALUES;
IF COL_LENGTH('dbo.TrainingAssignments','updatedAt') IS NULL ALTER TABLE dbo.TrainingAssignments ADD updatedAt DATETIME2 NOT NULL CONSTRAINT DF_TrainingAssignments_UpdatedAt_Upgrade DEFAULT SYSUTCDATETIME() WITH VALUES;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.TrainingAssignments') AND name='CK_TrainingAssignments_PassPercent')
BEGIN
  ALTER TABLE dbo.TrainingAssignments WITH CHECK
    ADD CONSTRAINT CK_TrainingAssignments_PassPercent CHECK (passPercent BETWEEN 0 AND 100);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID('dbo.TrainingAssignments') AND name='FK_TrainingAssignments_LinkedRecord')
BEGIN
  ALTER TABLE dbo.TrainingAssignments WITH CHECK
    ADD CONSTRAINT FK_TrainingAssignments_LinkedRecord FOREIGN KEY(linkedRecordId) REFERENCES dbo.InstructionRecords(id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.TrainingAssignments') AND name='UX_TrainingAssignments_Active')
BEGIN
  CREATE UNIQUE INDEX UX_TrainingAssignments_Active
    ON dbo.TrainingAssignments(companyId, employeeId, instructionTypeId)
    WHERE status IN ('assigned','in_progress');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.TrainingAssignments') AND name='IX_TrainingAssignments_Company_Employee_Status')
BEGIN
  CREATE INDEX IX_TrainingAssignments_Company_Employee_Status
    ON dbo.TrainingAssignments(companyId, employeeId, status, dueAt)
    INCLUDE(instructionTypeId, assignedAt, startedAt, completedAt, linkedRecordId, lastReminderAt, reminderCount);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.TrainingAssignments') AND name='IX_TrainingAssignments_Company_Type_Status')
BEGIN
  CREATE INDEX IX_TrainingAssignments_Company_Type_Status
    ON dbo.TrainingAssignments(companyId, instructionTypeId, status)
    INCLUDE(employeeId, dueAt, assignedAt, startedAt, completedAt);
END
GO
