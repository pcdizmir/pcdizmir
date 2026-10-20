# PCD İzmir

Event website: https://pcdizmir.kodart.xyz/

## Development

Run `npm install` and `npm run dev`. Run `npm run build` to generate the production site in `dist/`.

## Search indexing

The production build includes a canonical URL, Turkish search metadata, event JSON-LD, `robots.txt`, and a single-page sitemap. Page sections are anchors, so they do not need separate sitemap entries. The English toggle shares the same URL and does not represent a separate indexable page.

After deploying:

1. Check that the homepage, `/robots.txt`, and `/sitemap.xml` return HTTP 200 without authentication or an `X-Robots-Tag: noindex` response header.
2. Add `https://pcdizmir.kodart.xyz/` to [Google Search Console](https://search.google.com/search-console) and complete ownership verification using a method available to you.
3. Submit `https://pcdizmir.kodart.xyz/sitemap.xml` in Search Console, then inspect the homepage URL and select **Request indexing**.
4. Add the site and submit the same sitemap in [Bing Webmaster Tools](https://www.bing.com/webmasters/).

Search engines decide whether and when to index the page. A sitemap and indexing request help discovery but do not guarantee inclusion. See [Google's indexing guidance](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).

If the public domain changes, update the canonical URL, Open Graph URLs, event JSON-LD URLs, `public/robots.txt`, and `public/sitemap.xml` together.
