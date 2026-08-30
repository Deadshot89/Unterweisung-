-- Unterweisungsmanager Online v0.7
-- Sicherer Nachweis-Upload: zusätzliche Metadaten, Scanstatus, Link zu Fachobjekten und erweiterte Status-Views.

IF COL_LENGTH('dbo.Files','originalFileName') IS NULL
  ALTER TABLE dbo.Files ADD originalFileName NVARCHAR(260) NULL;
GO
IF COL_LENGTH('dbo.Files','extension') IS NULL
  ALTER TABLE dbo.Files ADD extension NVARCHAR(20) NULL;
GO
IF COL_LENGTH('dbo.Files','status') IS NULL
  ALTER TABLE dbo.Files ADD status NVARCHAR(40) NOT NULL CONSTRAINT DF_Files_Status DEFAULT 'active';
GO
IF COL_LENGTH('dbo.Files','scanStatus') IS NULL
  ALTER TABLE dbo.Files ADD scanStatus NVARCHAR(40) NOT NULL CONSTRAINT DF_Files_ScanStatus DEFAULT 'pending';
GO
IF COL_LENGTH('dbo.Files','scanCheckedAt') IS NULL
  ALTER TABLE dbo.Files ADD scanCheckedAt DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.Files','scanProvider') IS NULL
  ALTER TABLE dbo.Files ADD scanProvider NVARCHAR(120) NULL;
GO
IF COL_LENGTH('dbo.Files','uploadedIp') IS NULL
  ALTER TABLE dbo.Files ADD uploadedIp NVARCHAR(80) NULL;
GO
IF COL_LENGTH('dbo.Files','uploadedUserAgent') IS NULL
  ALTER TABLE dbo.Files ADD uploadedUserAgent NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.Files','linkedEntityType') IS NULL
  ALTER TABLE dbo.Files ADD linkedEntityType NVARCHAR(80) NULL;
GO
IF COL_LENGTH('dbo.Files','linkedEntityId') IS NULL
  ALTER TABLE dbo.Files ADD linkedEntityId NVARCHAR(80) NULL;
GO
IF COL_LENGTH('dbo.Files','metadataJson') IS NULL
  ALTER TABLE dbo.Files ADD metadataJson NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Files_Company_Linked' AND object_id=OBJECT_ID('dbo.Files'))
  CREATE INDEX IX_Files_Company_Linked ON dbo.Files(companyId,linkedEntityType,linkedEntityId,createdAt DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Files_Company_Scan' AND object_id=OBJECT_ID('dbo.Files'))
  CREATE INDEX IX_Files_Company_Scan ON dbo.Files(companyId,scanStatus,status,createdAt DESC);
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
       l.groupId,
       l.certificateFileId,
       f.fileName AS certificateFileName,
       f.scanStatus AS certificateScanStatus,
       f.status AS certificateStatus,
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
LEFT JOIN dbo.Files f ON f.companyId=l.companyId AND f.id=l.certificateFileId
LEFT JOIN dbo.EmployeeInstructionExclusions ex ON ex.companyId=e.companyId AND ex.employeeId=e.id AND ex.instructionTypeId=t.id AND ex.active=1
LEFT JOIN dbo.CompanySettings cs ON cs.companyId=e.companyId
WHERE e.active=1 AND t.active=1 AND e.companyId=t.companyId;
GO

CREATE OR ALTER VIEW dbo.vFilesSecure AS
SELECT companyId,id,kind,fileName,originalFileName,blobPath,contentType,sizeBytes,sha256,extension,status,scanStatus,scanCheckedAt,scanProvider,linkedEntityType,linkedEntityId,createdBy,createdAt
FROM dbo.Files;
GO
