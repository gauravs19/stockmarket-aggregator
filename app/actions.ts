'use server';

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export async function fetchArticleContent(url: string): Promise<string> {
    try {
        // Fetch raw HTML of the article with a browser-like User Agent
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch article: ${response.statusText}`);
        }

        const html = await response.text();

        // Feed the raw HTML into JSDOM to simulate a DOM tree
        const doc = new JSDOM(html, { url });

        // Use Mozilla's Readability to rip out ads, navbars, and extract clean text
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
