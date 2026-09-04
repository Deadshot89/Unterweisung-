import { sql } from './db.js';

export async function learningContentSchemaReady(pool) {
  const result = await pool.request().query(`SELECT
    COL_LENGTH('dbo.InstructionTypes','learningGoal') AS learningGoalColumn,
    COL_LENGTH('dbo.InstructionTypes','learningIntro') AS learningIntroColumn,
    COL_LENGTH('dbo.InstructionTypes','keyPointsJson') AS keyPointsJsonColumn,
    COL_LENGTH('dbo.InstructionLearningSteps','imageCaption') AS imageCaptionColumn,
    COL_LENGTH('dbo.InstructionLearningSteps','calloutTitle') AS calloutTitleColumn,
    COL_LENGTH('dbo.InstructionLearningSteps','calloutText') AS calloutTextColumn`);
  const row = result.recordset[0] || {};
  return ['learningGoalColumn','learningIntroColumn','keyPointsJsonColumn','imageCaptionColumn','calloutTitleColumn','calloutTextColumn']
    .every(key => row[key] != null);
}

export function parseKeyPoints(value) {
  let items = value;
  if (typeof items === 'string') {
    const text = items.trim();
    if (!text) return [];
    try { items = JSON.parse(text); }
    catch { items = text.split(/\r?\n/); }
  }
  if (!Array.isArray(items)) return [];
  return items.map(item => String(item ?? '').trim().slice(0, 500)).filter(Boolean).slice(0, 12);
}

export function serialiseKeyPoints(value) {
  return JSON.stringify(parseKeyPoints(value));
}

export function professionalContentRequested(body = {}) {
  return ['learningGoal','learningIntro','keyPoints','imageCaption','calloutTitle','calloutText']
    .some(key => body[key] !== undefined);
}

export async function requireLearningContentSchema(pool) {
  if (await learningContentSchemaReady(pool)) return;
  const error = new Error('Professionelle Lerninhalte benötigen noch die freizugebende Datenbankmigration 012.');
  error.status = 503;
  throw error;
}

export async function loadPublishedLearningContent(pool, { companyId, instructionTypeId, language = 'de' }) {
  const rich = await learningContentSchemaReady(pool);
  let typeResult;
  let stepsResult;
  if (rich) {
    typeResult = await pool.request()
      .input('companyId', sql.NVarChar(80), companyId)
      .input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
      .query(`SELECT TOP 1 learningGoal,learningIntro,keyPointsJson
              FROM InstructionTypes WHERE companyId=@companyId AND id=@instructionTypeId`);
    stepsResult = await pool.request()
      .input('companyId', sql.NVarChar(80), companyId)
      .input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
      .input('language', sql.NVarChar(10), language)
      .query(`SELECT s.id,s.sortOrder,s.title,s.body,s.imageFileId,s.imageCaption,s.calloutTitle,s.calloutText,
                     f.blobPath AS imageBlobPath,f.fileName AS imageFileName
              FROM InstructionLearningSteps s
              LEFT JOIN Files f ON f.companyId=s.companyId AND f.id=s.imageFileId
              WHERE s.companyId=@companyId AND s.instructionTypeId=@instructionTypeId AND s.language=@language AND s.status='published'
              ORDER BY s.sortOrder,s.createdAt`);
  } else {
    typeResult = { recordset: [{}] };
    stepsResult = await pool.request()
      .input('companyId', sql.NVarChar(80), companyId)
      .input('instructionTypeId', sql.NVarChar(80), instructionTypeId)
      .input('language', sql.NVarChar(10), language)
      .query(`SELECT s.id,s.sortOrder,s.title,s.body,s.imageFileId,f.blobPath AS imageBlobPath,f.fileName AS imageFileName
              FROM InstructionLearningSteps s
              LEFT JOIN Files f ON f.companyId=s.companyId AND f.id=s.imageFileId
              WHERE s.companyId=@companyId AND s.instructionTypeId=@instructionTypeId AND s.language=@language AND s.status='published'
              ORDER BY s.sortOrder,s.createdAt`);
  }
  const type = typeResult.recordset[0] || {};
  return {
    learningGoal: rich ? String(type.learningGoal || '') : '',
    learningIntro: rich ? String(type.learningIntro || '') : '',
    keyPoints: rich ? parseKeyPoints(type.keyPointsJson) : [],
    steps: stepsResult.recordset.map(step => ({
      ...step,
      imageCaption: rich ? String(step.imageCaption || '') : '',
      calloutTitle: rich ? String(step.calloutTitle || '') : '',
      calloutText: rich ? String(step.calloutText || '') : ''
    }))
  };
}
