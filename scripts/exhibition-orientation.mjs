export function webpDimensions(bytes) {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('Invalid WebP thumbnail.');
  }

  const format = bytes.toString('ascii', 12, 16);
  if (format === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (format === 'VP8X') {
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  if (format === 'VP8L') {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10)),
    };
  }
  throw new Error(`Unsupported WebP format: ${format}`);
}

function orientationRank(size) {
  if (!size) return 3;
  const ratio = size.width / size.height;
  if (ratio > 1.1) return 0; // landscape
  if (ratio >= 0.9) return 1; // square or nearly square
  return 2; // portrait
}

export function sortArtworksByOrientation(artworks, dimensions) {
  return artworks
    .map((artwork, index) => ({ artwork, index, rank: orientationRank(dimensions[index]) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ artwork }) => artwork);
}
