-- Unterweisungsmanager Online RC991
-- Additive Vorbereitung fuer professionelle Lerninhalte.
-- Diese Migration wird durch RC991 NICHT automatisch ausgefuehrt.

IF COL_LENGTH('dbo.InstructionTypes','learningGoal') IS NULL
  ALTER TABLE dbo.InstructionTypes ADD learningGoal NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('dbo.InstructionTypes','learningIntro') IS NULL
  ALTER TABLE dbo.InstructionTypes ADD learningIntro NVARCHAR(4000) NULL;
GO
IF COL_LENGTH('dbo.InstructionTypes','keyPointsJson') IS NULL
  ALTER TABLE dbo.InstructionTypes ADD keyPointsJson NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.InstructionLearningSteps','imageCaption') IS NULL
  ALTER TABLE dbo.InstructionLearningSteps ADD imageCaption NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('dbo.InstructionLearningSteps','calloutTitle') IS NULL
  ALTER TABLE dbo.InstructionLearningSteps ADD calloutTitle NVARCHAR(120) NULL;
GO
IF COL_LENGTH('dbo.InstructionLearningSteps','calloutText') IS NULL
  ALTER TABLE dbo.InstructionLearningSteps ADD calloutText NVARCHAR(2000) NULL;
GO
