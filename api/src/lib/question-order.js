import { createHash } from 'node:crypto';

export function balancedQuestionId(originalId) {
  return `qb1-${createHash('sha256').update(String(originalId)).digest('hex').slice(0,40)}`;
}

export function shuffleAnswers(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Keep the database answer index attached to its text through every permutation.
export function placeCorrectAnswer(options, correctIndex, targetIndex, random = Math.random) {
  if (!Array.isArray(options) || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length ||
      !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= options.length) throw new Error('Invalid answer positions');
  const indexed = options.map((text, originalIndex) => ({ text, answerIndex: originalIndex }));
  const correct = indexed.splice(correctIndex, 1)[0];
  const reordered = shuffleAnswers(indexed, random);
  reordered.splice(targetIndex, 0, correct);
  return reordered;
}

export function balancedPositions(count, optionCount, random = Math.random) {
  // Shuffle a balanced multiset, rather than repeating a predictable A/B/C/D cycle.
  const letters = shuffleAnswers(Array.from({length:optionCount}, (_,i)=>i), random);
  return shuffleAnswers(Array.from({length:count}, (_,i)=>letters[i % optionCount]), random);
}

// Replaced question versions remain in SQL for already-open tests and historical results.
export function currentQuestionVersions(rows) {
  const byId = new Map(rows.map(row=>[row.id,row]));
  return rows.filter(row=>{
    const replacement = byId.get(balancedQuestionId(row.id));
    return !(replacement && replacement.companyId === row.companyId && (row.active === false || row.active === 0));
  });
}
