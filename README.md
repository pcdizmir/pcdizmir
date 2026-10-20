# PCD İzmir

Event website: https://pcdizmir.kodart.xyz/

## Development

Run `npm install` and `npm run dev`. Run `npm run build` to generate the production site in `dist/`.

## Exhibition content

The exhibition is at `/exhibition.html`. Edit `src/data/exhibition.csv` to add or
reorder artworks; each row is one artwork, in display order. This is the public
content list, with submission emails, timestamps, and Drive links removed.

| Columns | Content |
| --- | --- |
| `id` | Permanent URL identifier; keep it unchanged after QR codes are printed |
| `title`, `artist` | Original artwork title and artist name |
| `thumbnail` | Filename under `public/assets/exhibition/` |
| `description_tr`, `description_en` | Artwork descriptions in both languages |
| `artist_bio_tr`, `artist_bio_en` | Artist biographies in both languages |
| `algorithm_notes_tr`, `algorithm_notes_en` | Algorithm and process explanations |
| `medium_tr`, `medium_en` | Tools and medium in each language |
| `year` | Optional year |
| `project_links` | Optional public project/source URLs, separated by newlines |
| `artist_url` | Optional artist website |

Keep the headers and save as UTF-8 CSV. Quoted commas and multiline paragraphs
are supported; content is plain text. Blank artist names show a translated
placeholder, blank biographies are omitted, and missing thumbnails use
`placeholder.svg`. Thumbnail filenames may contain spaces. Images retain their
full proportions without cropping on both pages. Keep the supplied image names
or update the CSV if you rename a file.

Both language versions are now in the CSV. Explicit translations take priority
over the fallback Turkish copy in `src/data/exhibition-tr.js`. English mode uses
`*_en`, Turkish mode uses `*_tr`. Original Turkish text remains in both columns
where an English translation has not been supplied. The loader also accepts the
original Google Forms question headers for future imports, but administrative
fields are never included in the browser bundle.

The homepage displays three random artwork previews every eight seconds,
pausing during hover, keyboard focus, touch interaction, and while the tab is
hidden. Adjust `rotationInterval` in `src/exhibition-preview.js` to change this.
Each preview opens the selected artwork with its information expanded.

Each artwork has a direct link at `/exhibition.html#artwork-id`. An `id` must use
lowercase letters, numbers, and hyphens; duplicate IDs stop the build. Keep the
existing IDs when changing titles or reordering artworks so printed QR links
continue to work. Run `npm run exhibition:links` to regenerate
`exhibition-links.md`. There are no QR or copy-link controls on the page.

Run `npm run test:exhibition` and `npm run build` after content updates. Invalid
CSV stops the production build rather than publishing a broken exhibition.

## Search indexing

The production build includes canonical URLs, Turkish search metadata, event JSON-LD, `robots.txt`, and a sitemap for the homepage, FAQ, and exhibition. Page sections are anchors, so they do not need separate sitemap entries. The English toggle shares the same URL and does not represent a separate indexable page.

After deploying:

1. Check that the homepage, `/robots.txt`, and `/sitemap.xml` return HTTP 200 without authentication or an `X-Robots-Tag: noindex` response header.
2. Add `https://pcdizmir.kodart.xyz/` to [Google Search Console](https://search.google.com/search-console) and complete ownership verification using a method available to you.
3. Submit `https://pcdizmir.kodart.xyz/sitemap.xml` in Search Console, then inspect the homepage URL and select **Request indexing**.
4. Add the site and submit the same sitemap in [Bing Webmaster Tools](https://www.bing.com/webmasters/).

Search engines decide whether and when to index the page. A sitemap and indexing request help discovery but do not guarantee inclusion. See [Google's indexing guidance](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).

If the public domain changes, update the canonical URL, Open Graph URLs, event JSON-LD URLs, `public/robots.txt`, and `public/sitemap.xml` together.
