IF OBJECT_ID('dbo.InstructionAnalyses','U') IS NULL
BEGIN
 CREATE TABLE dbo.InstructionAnalyses(
  id NVARCHAR(80) NOT NULL PRIMARY KEY,companyId NVARCHAR(80) NOT NULL,
  templateId NVARCHAR(80) NOT NULL,instructionTypeId NVARCHAR(80) NOT NULL,
  sourceSha256 NVARCHAR(128) NOT NULL,sourceBlobPath NVARCHAR(500) NOT NULL,
  fileName NVARCHAR(260) NOT NULL,contentType NVARCHAR(120) NOT NULL,title NVARCHAR(240) NOT NULL,
  language NVARCHAR(10) NOT NULL,pageCount INT NULL,status NVARCHAR(40) NOT NULL,
  providerResponseId NVARCHAR(200) NULL,resultJson NVARCHAR(MAX) NULL,errorCode NVARCHAR(80) NULL,errorMessage NVARCHAR(1200) NULL,
  expectedTypeUpdatedAt DATETIME2 NULL,createdBy NVARCHAR(120) NOT NULL,
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  startedAt DATETIME2 NULL,lastPolledAt DATETIME2 NULL,publishedAt DATETIME2 NULL,publishedBy NVARCHAR(120) NULL,
  CONSTRAINT FK_Analysis_Company FOREIGN KEY(companyId) REFERENCES dbo.Companies(id),
  CONSTRAINT FK_Analysis_Template FOREIGN KEY(templateId) REFERENCES dbo.Templates(id),
  CONSTRAINT FK_Analysis_Type FOREIGN KEY(instructionTypeId) REFERENCES dbo.InstructionTypes(id)
 );
 CREATE INDEX IX_Analysis_Company_Type ON dbo.InstructionAnalyses(companyId,instructionTypeId,createdAt);
END;
IF COL_LENGTH('dbo.TestQuestions','sourceAnalysisId') IS NULL ALTER TABLE dbo.TestQuestions ADD sourceAnalysisId NVARCHAR(80) NULL;
IF COL_LENGTH('dbo.TestQuestions','sourceAspectId') IS NULL ALTER TABLE dbo.TestQuestions ADD sourceAspectId NVARCHAR(80) NULL;
IF COL_LENGTH('dbo.TestQuestions','explanation') IS NULL ALTER TABLE dbo.TestQuestions ADD explanation NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.TestQuestions','sourceEvidenceJson') IS NULL ALTER TABLE dbo.TestQuestions ADD sourceEvidenceJson NVARCHAR(MAX) NULL;

IF COL_LENGTH('dbo.ExternalInvitations','testQuestionIdsJson') IS NULL ALTER TABLE dbo.ExternalInvitations ADD testQuestionIdsJson NVARCHAR(MAX) NULL;

IF COL_LENGTH('dbo.ExternalInvitations','testInstructionSnapshotJson') IS NULL ALTER TABLE dbo.ExternalInvitations ADD testInstructionSnapshotJson NVARCHAR(MAX) NULL;
-- Nullable default applies to new invitations; already-started legacy tests remain gradable.
IF COL_LENGTH('dbo.ExternalInvitations','testSnapshotRequired') IS NULL ALTER TABLE dbo.ExternalInvitations ADD testSnapshotRequired BIT NULL CONSTRAINT DF_External_TestSnapshotRequired DEFAULT 1;
IF COL_LENGTH('dbo.InstructionAnalyses','attemptToken') IS NULL ALTER TABLE dbo.InstructionAnalyses ADD attemptToken NVARCHAR(80) NULL;
-- Grandfather only tests already started when this schema was installed.
EXEC(N'UPDATE dbo.ExternalInvitations SET testSnapshotRequired=1 WHERE testSnapshotRequired IS NULL AND startedAt IS NULL');
