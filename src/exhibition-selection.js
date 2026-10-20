export function selectPreviewArtworks(artworks, previousIds = [], count = 3, random = Math.random) {
  const previous = new Set(previousIds);
  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  return [
    ...shuffle(artworks.filter(work => !previous.has(work.id))),
    ...shuffle(artworks.filter(work => previous.has(work.id))),
  ].slice(0, count);
}
