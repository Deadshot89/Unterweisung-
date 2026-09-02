import { readFileSync } from 'node:fs';
import { getPool,sql } from '../api/src/lib/db.js';
let pool,tx,open=false;
try {
 pool=await getPool();tx=new sql.Transaction(pool);await tx.begin();open=true;
 await new sql.Request(tx).query(readFileSync('database/migrations/010_instruction_analysis.sql','utf8'));
 const result=await new sql.Request(tx).query("SELECT CASE WHEN OBJECT_ID('dbo.InstructionAnalyses','U') IS NOT NULL AND COL_LENGTH('dbo.TestQuestions','sourceAspectId') IS NOT NULL AND COL_LENGTH('dbo.TestQuestions','sourceEvidenceJson') IS NOT NULL AND COL_LENGTH('dbo.ExternalInvitations','testInstructionSnapshotJson') IS NOT NULL AND COL_LENGTH('dbo.ExternalInvitations','testSnapshotRequired') IS NOT NULL AND COL_LENGTH('dbo.InstructionAnalyses','attemptToken') IS NOT NULL THEN 1 ELSE 0 END AS ready");
 if(result.recordset[0].ready!==1) throw new Error('schema_not_ready');
 await tx.commit();open=false;console.log('Instruction analysis schema ready; existing content preserved.');
} catch(error){if(open) await tx.rollback().catch(()=>{});console.error(`Instruction analysis schema failed (${error.code||error.name}).`);process.exitCode=1;}
finally {if(pool) await pool.close();}
