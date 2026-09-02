-- Unterweisungsmanager Online v0.22
-- Änderungszeit für Testfragen-Verwaltung.

IF COL_LENGTH('dbo.TestQuestions', 'updatedAt') IS NULL
BEGIN
  ALTER TABLE dbo.TestQuestions ADD updatedAt DATETIME2 NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_TestQuestions_Company_Type_Lang_Active' AND object_id=OBJECT_ID('dbo.TestQuestions'))
BEGIN
  CREATE INDEX IX_TestQuestions_Company_Type_Lang_Active ON dbo.TestQuestions(companyId,instructionTypeId,language,active);
END
GO
