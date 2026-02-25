import Parser from 'rss-parser';

export type TimeFilter = 'today' | 'week' | 'month';
export type FactorType = 'macro' | 'micro';
export type Sentiment = 'bullish' | 'bearish' | 'neutral';

export interface Story {
    id: string;
    title: string;
    link: string;
    domain: string;
    timeAgo: string;
    factor: FactorType;
    sentiment: Sentiment;
    impactLabel: string;
    isoDate: string;
}

const parser = new Parser();

function getDomain(url: string) {
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch {
        return 'unknown';
    }
}

function timeSince(dateString: string) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = Math.floor(seconds / 31536000);

    if (interval >= 1) return interval + "y ago";
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + "mo ago";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + "d ago";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + "h ago";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + "m ago";
    return Math.floor(seconds) + "s ago";
}

function classifyStory(title: string): { factor: FactorType, sentiment: Sentiment, impactLabel: string } {
    const text = title.toLowerCase();

    // Basic heuristic classification
    const macroKeywords = ['fed', 'inflation', 'cpi', 'rate', 'rates', 'economy', 'gdp', 'job', 'unemployment', 'bank', 'treasury', 'yield', 'macro', 'china', 'global'];
    const bullishKeywords = ['surge', 'jump', 'rise', 'beat', 'up', 'grow', 'rally', 'high', 'gain', 'buy', 'upgrade', 'record'];
    const bearishKeywords = ['drop', 'fall', 'miss', 'down', 'shrink', 'plunge', 'low', 'sink', 'sell', 'downgrade', 'fear', 'crash', 'loss'];

    let factor: FactorType = 'micro';
    let sentiment: Sentiment = 'neutral';

    if (macroKeywords.some(kw => text.includes(kw))) {
        factor = 'macro';
    }

    const isBullish = bullishKeywords.some(kw => text.includes(kw));
    const isBearish = bearishKeywords.some(kw => text.includes(kw));

    if (isBullish && !isBearish) sentiment = 'bullish';
    if (isBearish && !isBullish) sentiment = 'bearish';

    // Generate impact label based on basic rules
    let impactLabel = 'Market Mover';
    if (factor === 'macro') {
        if (sentiment === 'bearish') impactLabel = 'Economic Headwind';
        if (sentiment === 'bullish') impactLabel = 'Broad Market Catalyst';
        if (sentiment === 'neutral') impactLabel = 'Macro Indicator';
    } else {
        // micro
        if (sentiment === 'bearish') impactLabel = 'Company Pressure';
        if (sentiment === 'bullish') impactLabel = 'Sector Upside';
        if (sentiment === 'neutral') impactLabel = 'Corporate News';
    }

    return { factor, sentiment, impactLabel };
}

export type Country = 'us' | 'cn' | 'jp' | 'de' | 'in';

export async function fetchFinanceNews(country: Country = 'us', time: TimeFilter = 'today'): Promise<Story[]> {
    try {
        // We use Bing News Search RSS, which provides direct links (bypassing Google News bot protections)
        let timeQuery = '';
        // Bing uses the parameters:
        // qft=interval="4" (Past 24 hours)
        // qft=interval="7" (Past 7 days)
        // qft=interval="8" (Past 30 days)
        if (time === 'today') timeQuery = '&qft=interval%3D"4"';
        if (time === 'week') timeQuery = '&qft=interval%3D"7"';
        if (time === 'month') timeQuery = '&qft=interval%3D"8"';

        let url = `https://www.bing.com/news/search?q=US+economy+finance+market&format=rss${timeQuery}&setmkt=en-US`;
        if (country === 'cn') url = `https://www.bing.com/news/search?q=china+economy+finance+market&format=rss${timeQuery}&setmkt=en-US`;
        if (country === 'jp') url = `https://www.bing.com/news/search?q=japan+economy+finance+market&format=rss${timeQuery}&setmkt=en-US`;
        if (country === 'de') url = `https://www.bing.com/news/search?q=germany+economy+finance+market&format=rss${timeQuery}&setmkt=en-US`;
        if (country === 'in') url = `https://www.bing.com/news/search?q=india+economy+finance+market&format=rss${timeQuery}&setmkt=en-US`;

        const feed = await parser.parseURL(url);

        // We will parse, then map
        const stories: Story[] = feed.items.slice(0, 30).map((item, index) => {
            const cls = classifyStory(item.title || '');

            return {
                id: item.guid ? `${item.guid}-${index}` : String(index),
                title: item.title || 'Untitled',
                link: item.link || '#',
                domain: getDomain(item.link || '#'),
                timeAgo: item.isoDate ? timeSince(item.isoDate) : 'recently',
                factor: cls.factor,
                sentiment: cls.sentiment,
                impactLabel: cls.impactLabel,
                isoDate: item.isoDate || new Date().toISOString()
            };
        });

        return stories;
    } catch (err) {
        console.error("Failed to fetch RSS feed:", err);
        return [];
    }
}
