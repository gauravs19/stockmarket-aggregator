'use server';

import * as cheerio from 'cheerio';

export async function fetchArticleContent(url: string): Promise<string> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch article: ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove scripts, styles, and other non-content tags
        $('script, style, nav, header, footer, aside, iframe, noscript').remove();

        // Extract text from paragraphs
        const paragraphs: string[] = [];
        $('p').each((_, element) => {
            const text = $(element).text().trim();
            if (text.length > 50) { // Filter out very short UI fragments
                paragraphs.push(text);
            }
        });

        // Join paragraphs and limit the length so we don't overwhelm the local summarizer model
        // Xenova/distilbart-cnn-6-6 has a max sequence length (usually 1024 tokens)
        // We will restrict text to about 4000 characters to be safe.
        let fullText = paragraphs.join('\n\n');

        if (fullText.length > 4000) {
            fullText = fullText.slice(0, 4000) + '...';
        }

        return fullText;
    } catch (err) {
        console.error("Error fetching article content:", err);
        return "Failed to extract article text.";
    }
}
