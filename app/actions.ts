'use server';

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

/**
 * Manually follow JS & Meta Refresh redirects (often used by Bing/Google News)
 * Returns the final resolved HTML string
 */
async function resolveJumpPages(initialUrl: string, maxRedirects = 3): Promise<string> {
    let currentUrl = initialUrl;
    let finalHtml = '';

    for (let i = 0; i < maxRedirects; i++) {
        try {
            const response = await fetch(currentUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
                redirect: 'follow', // Native fetch handles standard HTTP 301s
            });

            if (!response.ok) {
                // If we already had good HTML from a previous traversal step, return it safely.
                if (finalHtml) break;
                throw new Error(`Failed to fetch: ${response.statusText}`);
            }

            // Sync the URL in case fetch natively followed an HTTP redirect
            currentUrl = response.url;
            finalHtml = await response.text();

            // Look for <meta http-equiv="refresh" content="0;URL='https://...'">
            const metaRefreshMatch = finalHtml.match(/content=["']\d+; *url=['"]?([^"'>]+)['"]?["']/i) ||
                finalHtml.match(/URL=['"]?([^"'>]+)['"]?/i);

            // Look for <script>window.location.replace("https://...")</script>
            const jsRedirectMatch = finalHtml.match(/window\.location\.replace\(["']([^"']+)["']\)/i) ||
                finalHtml.match(/window\.location\.href\s*=\s*["']([^"']+)["']/i);

            let nextUrl = null;
            if (metaRefreshMatch && metaRefreshMatch[1]) {
                nextUrl = metaRefreshMatch[1];
            } else if (jsRedirectMatch && jsRedirectMatch[1]) {
                nextUrl = jsRedirectMatch[1];
            }

            if (nextUrl && nextUrl !== currentUrl) {
                // Clean up any HTML entities inside the URL (e.g. &amp; -> &)
                nextUrl = nextUrl.replace(/&amp;/g, '&');

                // If Bing returns a relative URL, make it absolute again
                if (nextUrl.startsWith('/')) {
                    const urlObj = new URL(currentUrl);
                    nextUrl = `${urlObj.protocol}//${urlObj.host}${nextUrl}`;
                }

                currentUrl = nextUrl;
                // LOOP AGAIN with the successfully discovered URL!
            } else {
                // No more sneaky JS/Meta redirects found, we've successfully hit the news publisher's real page.
                break;
            }
        } catch (e) {
            console.error(`Jump-page follow error at ${currentUrl}:`, e);
            break;
        }
    }

    return finalHtml;
}

export async function fetchArticleContent(url: string): Promise<string> {
    try {
        // Step 1: Extract HTML resolving any jump pages (like Bing link click tracking pages)
        const html = await resolveJumpPages(url);

        if (!html || html.trim() === '') {
            throw new Error('Received empty HTML from the final destination.');
        }

        // Step 2: Feed the raw HTML into JSDOM to simulate a DOM tree
        const doc = new JSDOM(html, { url });

        // Step 3: Use Mozilla's Readability to rip out ads, navbars, and extract clean text
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        if (!article || !article.textContent) {
            throw new Error('Readability could not extract content');
        }

        // Limit the length so we don't overwhelm the local summarizer model
        // Xenova/distilbart-cnn-6-6 has a max sequence length (usually 1024 tokens)
        // We will restrict text to about 4000 characters to be safe.
        let safeText = article.textContent.trim();

        if (safeText.length > 4000) {
            safeText = safeText.slice(0, 4000) + '...';
        }

        return safeText;
    } catch (err) {
        console.error("Error extracting article text via Readability:", err);
        return "Failed to extract article text.";
    }
}
