-- Unterweisungsmanager Online v0.3
-- Einstellungen und Auswertungs-View.

IF OBJECT_ID('dbo.CompanySettings','U') IS NULL
BEGIN
  CREATE TABLE dbo.CompanySettings (
    companyId NVARCHAR(80) NOT NULL PRIMARY KEY,
    yellowWarningDays INT NOT NULL DEFAULT 60,
    orangeCriticalDays INT NOT NULL DEFAULT 30,
    defaultResponsibleEmail NVARCHAR(254) NULL,
    hseEmail NVARCHAR(254) NULL,
    dataRetentionMonths INT NOT NULL DEFAULT 120,
    updatedAt DATETIME2 NULL,
    CONSTRAINT FK_CompanySettings_Companies FOREIGN KEY(companyId) REFERENCES dbo.Companies(id)
  );
END
GO

CREATE OR ALTER VIEW dbo.vInstructionStatus AS
WITH latest AS (
  SELECT r.*, ROW_NUMBER() OVER(PARTITION BY r.companyId, r.employeeId, r.typeId ORDER BY r.conductedAt DESC, r.createdAt DESC) rn
  FROM dbo.InstructionRecords r
)
SELECT e.companyId,
       e.id AS employeeId,
       e.name AS employeeName,
       e.email,
       e.department,
       e.role,
       e.lineManagerId,
       lm.name AS lineManagerName,
       lm.email AS lineManagerEmail,
       t.id AS typeId,
       t.name AS instructionName,
       t.category,
       t.intervalMonths,
       t.templateId,
       l.id AS recordId,
       l.conductedAt,
       l.validUntil,
       l.status AS recordStatus,
       l.source,
       l.instructorId,
       l.durationMinutes,
       ex.id AS exclusionId,
       ex.reason AS exclusionReason,
       CASE
         WHEN ex.id IS NOT NULL THEN 'not_required'
         WHEN l.id IS NULL THEN 'missing'
         WHEN l.validUntil IS NOT NULL AND l.validUntil < SYSUTCDATETIME() THEN 'expired'
         WHEN l.validUntil IS NOT NULL AND l.validUntil <= DATEADD(day,COALESCE(cs.orangeCriticalDays,30),SYSUTCDATETIME()) THEN 'critical'
         WHEN l.validUntil IS NOT NULL AND l.validUntil <= DATEADD(day,COALESCE(cs.yellowWarningDays,60),SYSUTCDATETIME()) THEN 'soon'
         ELSE 'valid'
       END AS status
FROM dbo.Employees e
CROSS JOIN dbo.InstructionTypes t
LEFT JOIN dbo.Employees lm ON lm.id=e.lineManagerId AND lm.companyId=e.companyId
LEFT JOIN latest l ON l.companyId=e.companyId AND l.employeeId=e.id AND l.typeId=t.id AND l.rn=1
LEFT JOIN dbo.EmployeeInstructionExclusions ex ON ex.companyId=e.companyId AND ex.employeeId=e.id AND ex.instructionTypeId=t.id AND ex.active=1
LEFT JOIN dbo.CompanySettings cs ON cs.companyId=e.companyId
WHERE e.active=1 AND t.active=1 AND e.companyId=t.companyId;
GO

CREATE OR ALTER VIEW dbo.vManagerTrainingTimeMonthly AS
SELECT r.companyId,
       DATEFROMPARTS(YEAR(r.conductedAt), MONTH(r.conductedAt), 1) AS monthStart,
       FORMAT(r.conductedAt, 'yyyy-MM') AS monthKey,
       COALESCE(lm.id, r.instructorId) AS responsibleId,
       COALESCE(lm.name, ins.name, 'Unbekannt') AS responsibleName,
       t.id AS instructionTypeId,
       t.name AS instructionName,
       COUNT(*) AS participantRecords,
       COUNT(DISTINCT COALESCE(r.groupId, r.id)) AS trainingEvents,
       SUM(COALESCE(r.durationMinutes,0)) AS participantMinutes,
       SUM(CASE WHEN r.groupId IS NULL THEN COALESCE(r.durationMinutes,0) ELSE 0 END) +
       SUM(CASE WHEN r.groupId IS NOT NULL THEN 0 ELSE 0 END) AS directMinutesOnly
FROM dbo.InstructionRecords r
JOIN dbo.InstructionTypes t ON t.companyId=r.companyId AND t.id=r.typeId
LEFT JOIN dbo.Employees e ON e.companyId=r.companyId AND e.id=r.employeeId
LEFT JOIN dbo.Employees lm ON lm.companyId=r.companyId AND lm.id=e.lineManagerId
LEFT JOIN dbo.Employees ins ON ins.companyId=r.companyId AND ins.id=r.instructorId
WHERE r.status='completed'
GROUP BY r.companyId, DATEFROMPARTS(YEAR(r.conductedAt), MONTH(r.conductedAt), 1), FORMAT(r.conductedAt, 'yyyy-MM'),
         COALESCE(lm.id, r.instructorId), COALESCE(lm.name, ins.name, 'Unbekannt'), t.id, t.name;
GO
