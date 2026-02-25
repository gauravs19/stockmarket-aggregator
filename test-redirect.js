const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

async function resolveJumpPages(initialUrl, maxRedirects = 3) {
    let currentUrl = initialUrl;
    let finalHtml = '';
    for (let i = 0; i < maxRedirects; i++) {
        try {
            console.log("Fetching:", currentUrl);
            const response = await fetch(currentUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
                redirect: 'follow'
            });

            if (!response.ok) {
                if (finalHtml) break;
                throw new Error('Fetch failed: ' + response.statusText);
            }

            currentUrl = response.url;
            finalHtml = await response.text();

            // Only log if it's the second page
            if (i > 0) {
                console.log(`[HTML DUMP from ${currentUrl}]:\n${finalHtml}`);
            }

            const metaRefreshMatch = finalHtml.match(/content=["']\d+; *url=['"]?([^"'>]+)['"]?["']/i) ||
                finalHtml.match(/URL=['"]?([^"'>]+)['"]?/i);

            const jsRedirectMatch = finalHtml.match(/window\.location\.replace\(["']([^"']+)["']\)/i) ||
                finalHtml.match(/window\.location\.href\s*=\s*["']([^"']+)["']/i);

            let nextUrl = null;
            if (metaRefreshMatch && metaRefreshMatch[1]) {
                nextUrl = metaRefreshMatch[1];
            } else if (jsRedirectMatch && jsRedirectMatch[1]) {
                nextUrl = jsRedirectMatch[1];
            }

            if (nextUrl && nextUrl !== currentUrl) {
                nextUrl = nextUrl.replace(/&amp;/g, '&');
                if (nextUrl.startsWith('/')) {
                    const urlObj = new URL(currentUrl);
                    nextUrl = urlObj.protocol + '//' + urlObj.host + nextUrl;
                }
                currentUrl = nextUrl;
            } else {
                break;
            }
        } catch (e) {
            console.error("Error:", currentUrl, e);
            break;
        }
    }
    return finalHtml;
}

resolveJumpPages('http://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=&tid=1047079786967422928&mkt=en-in').catch(console.error);
