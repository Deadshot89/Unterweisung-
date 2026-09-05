IF COL_LENGTH('dbo.PushSubscriptions','deviceLabel') IS NULL
BEGIN
  ALTER TABLE dbo.PushSubscriptions ADD deviceLabel NVARCHAR(160) NULL;
END
GO

IF COL_LENGTH('dbo.PushSubscriptions','deviceName') IS NULL
BEGIN
  ALTER TABLE dbo.PushSubscriptions ADD deviceName NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.PushSubscriptions','userAgent') IS NULL
BEGIN
  ALTER TABLE dbo.PushSubscriptions ADD userAgent NVARCHAR(1000) NULL;
END
GO
