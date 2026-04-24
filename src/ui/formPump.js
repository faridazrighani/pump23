export function parsePumpCandidatesJson(text) {
  if (!text || !text.trim()) {
    return [];
  }
  return JSON.parse(text);
}
