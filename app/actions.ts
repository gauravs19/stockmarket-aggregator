'use server';

export async function fetchArticleContent(url: string): Promise<string> {
    try {
        // News.google.com links are just trackers that redirect to the actual article.
        // We need to fetch the redirect target first, because Jina might fail on the google jump page.
        const redirectRes = await fetch(url, { redirect: 'follow' });
        const finalUrl = redirectRes.url;

        // Use Jina Reader to bypass bot protection and return clean markdown
        const jinaUrl = `https://r.jina.ai/${finalUrl}`;

        const response = await fetch(jinaUrl, {
            headers: {
                // Jina allows returning just the cleaned text
                'Accept': 'text/plain',
                // Adding an arbitrary API key override if needed later, but it works without one for low volume.
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch article via Jina: ${response.statusText}`);
        }

        const fullText = await response.text();

        // Limit the length so we don't overwhelm the local summarizer model
        // Xenova/distilbart-cnn-6-6 has a max sequence length (usually 1024 tokens)
        // We will restrict text to about 4000 characters to be safe.
        let safeText = fullText.trim();

        if (safeText.length > 4000) {
            safeText = safeText.slice(0, 4000) + '...';
        }

        return safeText;
    } catch (err) {
        console.error("Error fetching article content via proxy:", err);
        return "Failed to extract article text.";
    }
}
