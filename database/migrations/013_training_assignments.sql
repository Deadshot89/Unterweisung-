-- v0.40: Persistente interne Unterweisungszuweisungen / Arbeitsaufgaben.
-- Eine aktive Aufgabe wird ausschließlich durch einen echten InstructionRecord abgeschlossen.

IF OBJECT_ID('dbo.TrainingAssignments','U') IS NULL
BEGIN
  CREATE TABLE dbo.TrainingAssignments (
    id NVARCHAR(80) NOT NULL PRIMARY KEY,
    companyId NVARCHAR(80) NOT NULL,
    employeeId NVARCHAR(80) NOT NULL,
    instructionTypeId NVARCHAR(80) NOT NULL,
    assignedAt DATETIME2 NOT NULL CONSTRAINT DF_TrainingAssignments_AssignedAt DEFAULT SYSUTCDATETIME(),
    dueAt DATETIME2 NULL,
    status NVARCHAR(40) NOT NULL CONSTRAINT DF_TrainingAssignments_Status DEFAULT 'assigned',
    source NVARCHAR(40) NOT NULL CONSTRAINT DF_TrainingAssignments_Source DEFAULT 'manual',
    note NVARCHAR(1000) NULL,
    plannedTrainingId NVARCHAR(80) NULL,
    completedAt DATETIME2 NULL,
    completedRecordId NVARCHAR(80) NULL,
    createdBy NVARCHAR(120) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_TrainingAssignments_CreatedAt DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NULL,
    CONSTRAINT CK_TrainingAssignments_Status CHECK (status IN ('assigned','in_progress','completed','cancelled')),
    CONSTRAINT FK_TrainingAssignments_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
    CONSTRAINT FK_TrainingAssignments_Employee FOREIGN KEY(employeeId) REFERENCES dbo.Employees(id),
    CONSTRAINT FK_TrainingAssignments_Type FOREIGN KEY(instructionTypeId) REFERENCES dbo.InstructionTypes(id),
    CONSTRAINT FK_TrainingAssignments_CompletedRecord FOREIGN KEY(completedRecordId) REFERENCES dbo.InstructionRecords(id)
  );
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
    ON dbo.TrainingAssignments(companyId, employeeId, status)
    INCLUDE(instructionTypeId, dueAt, assignedAt, completedAt, completedRecordId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.TrainingAssignments') AND name='IX_TrainingAssignments_Company_Due_Status')
BEGIN
  CREATE INDEX IX_TrainingAssignments_Company_Due_Status
    ON dbo.TrainingAssignments(companyId, status, dueAt)
    INCLUDE(employeeId, instructionTypeId, assignedAt);
END
GO
