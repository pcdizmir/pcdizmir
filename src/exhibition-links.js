export function artworkId(title) {
  return title.toLowerCase().replace(/ı/g, 'i').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function artworkIndexForHash(artworks, hash) {
  try {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    return artworks.findIndex(artwork => artwork.id === id);
  } catch {
    return -1;
  }
}

export function artworkUrl(artwork) {
  return `https://pcdizmir.kodart.xyz/exhibition.html#${artwork.id}`;
}
