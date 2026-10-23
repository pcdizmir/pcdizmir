# PCD İzmir

Event website: https://pcdizmir.kodart.xyz/

## Development

Run `npm install` and `npm run dev`. Run `npm run build` to generate the production site in `dist/`.

## Exhibition content

The exhibition is at `/exhibition.html`. Edit `src/data/exhibition.json` to change
artwork content. Each object in the top-level array is one artwork. The homepage
preview and exhibition page both read this file. The exhibition page groups
images by orientation: landscape, square, then portrait; JSON order is retained
within each group.

| JSON field | Content |
| --- | --- |
| `id` | Permanent URL identifier; keep it unchanged after QR codes are printed |
| `title`, `artist` | Original artwork title and artist name |
| `thumbnail` | `/assets/exhibition/filename.webp` for a file under `public/assets/exhibition/` |
| `descriptionTr`, `descriptionEn` | Artwork descriptions in Turkish and English |
| `bioTr`, `bioEn` | Artist biographies in Turkish and English |
| `algorithmsTr`, `algorithmsEn` | Algorithm and process explanations |
| `mediumTr`, `mediumEn` | Tools and medium in each language |
| `year` | Optional year |
| `projectLinks` | Optional array of public project/source URLs |
| `artistUrl` | Optional artist website URL |

Keep JSON syntax valid: quote keys and text, separate fields and objects with commas,
and write paragraph breaks as `\n`. Omit fields you have not filled in yet. Blank
artist names show a translated placeholder, blank biographies are omitted, and
missing thumbnails use an image coming soon message. Images retain their full
proportions without cropping. If you rename an image, update its `thumbnail` path.
The original `exhibition.csv` and translation/thumbnail mapping files are retained
as source records; edits to them no longer affect the site.

The homepage displays three random artworks with thumbnails every eight seconds,
pausing during hover, keyboard focus, touch interaction, and while the tab is
hidden. Adjust `rotationInterval` in `src/exhibition-preview.js` to change this.
Each preview opens the selected artwork with its information expanded when available.

Each artwork has a direct link at `/exhibition.html#artwork-id`. An `id` must use
lowercase letters, numbers, and hyphens; duplicate IDs stop the build. Keep the
existing IDs when changing titles or reordering artworks so printed QR links
continue to work. Run `npm run exhibition:links` to regenerate
`exhibition-links.md`. There are no QR or copy-link controls on the page.

Run `npm run test:exhibition` and `npm run build` after content updates. Invalid
JSON stops the production build rather than publishing a broken exhibition.

## Search indexing

The production build includes canonical URLs, Turkish search metadata, event JSON-LD, `robots.txt`, and a sitemap for the homepage, FAQ, and exhibition. Page sections are anchors, so they do not need separate sitemap entries. The English toggle shares the same URL and does not represent a separate indexable page.

After deploying:

1. Check that the homepage, `/robots.txt`, and `/sitemap.xml` return HTTP 200 without authentication or an `X-Robots-Tag: noindex` response header.
2. Add `https://pcdizmir.kodart.xyz/` to [Google Search Console](https://search.google.com/search-console) and complete ownership verification using a method available to you.
3. Submit `https://pcdizmir.kodart.xyz/sitemap.xml` in Search Console, then inspect the homepage URL and select **Request indexing**.
4. Add the site and submit the same sitemap in [Bing Webmaster Tools](https://www.bing.com/webmasters/).

Search engines decide whether and when to index the page. A sitemap and indexing request help discovery but do not guarantee inclusion. See [Google's indexing guidance](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).

If the public domain changes, update the canonical URL, Open Graph URLs, event JSON-LD URLs, `public/robots.txt`, and `public/sitemap.xml` together.
