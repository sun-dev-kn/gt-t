/**
 * Safe validator — parses only known-safe validate_js patterns.
 * Never calls eval or new Function.
 *
 * Accepted forms:
 *   return /pattern/flags.test(text)
 *   return text.includes("string")
 *   return text.startsWith("string")
 *   return true / return false
 *
 * Any unrecognised pattern → false (safe default).
 */
export function safeValidate(validateJs, text) {
  if (!validateJs || typeof validateJs !== 'string') return true;
  const src = validateJs.trim();

  if (src === 'return true' || src === 'return true;') return true;
  if (src === 'return false' || src === 'return false;') return false;

  // return /pattern/flags.test(text)
  const regexMatch = src.match(/^return\s+\/(.+?)\/([gimsuy]*)\s*\.test\(text\)\s*;?$/);
  if (regexMatch) {
    try { return new RegExp(regexMatch[1], regexMatch[2]).test(text); }
    catch { return false; }
  }

  // return text.includes("string") or text.includes('string')
  const includesMatch = src.match(/^return\s+text\.includes\((['"])(.+?)\1\)\s*;?$/);
  if (includesMatch) return text.includes(includesMatch[2]);

  // return text.startsWith("string") or text.startsWith('string')
  const startsMatch = src.match(/^return\s+text\.startsWith\((['"])(.+?)\1\)\s*;?$/);
  if (startsMatch) return text.startsWith(startsMatch[2]);

  // Unrecognised pattern — safe default
  return false;
}
