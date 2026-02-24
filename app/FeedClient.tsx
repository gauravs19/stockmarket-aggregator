'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Story, Sentiment, TimeFilter } from '../lib/feed';
import { fetchArticleContent } from './actions';

export default function FeedClient({ initialStories }: { initialStories: Story[] }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const typeFilter = searchParams.get('type') || 'all';
    const timeFilter = searchParams.get('time') || 'today';
    const currentCountry = searchParams.get('country') || 'us';

    const [stories, setStories] = useState<Story[]>(initialStories);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiProgress, setAiProgress] = useState<string>('');
    const [briefing, setBriefing] = useState<string>('');
    const [generatingBriefing, setGeneratingBriefing] = useState<boolean>(false);
    const [articleSummaries, setArticleSummaries] = useState<Record<string, string>>({});
    const [loadingArticleSummaries, setLoadingArticleSummaries] = useState<Record<string, boolean>>({});
    const processedCount = useRef<number>(0);

    // Create a reference to the worker object.
    const worker = useRef<Worker | null>(null);

    useEffect(() => {
        // We only initiate the worker on the client side
        if (!worker.current) {
            worker.current = new Worker(new URL('./worker.ts', import.meta.url), {
                type: 'module'
            });

            worker.current.onerror = (e) => {
                console.error("Worker Fatal Error:", e);
                setAiProgress('AI Engine Error: Check console for blocks.');
                setTimeout(() => setAiLoading(false), 5000);
            };
        }

        const onMessageReceived = (e: MessageEvent) => {
            const { status, action, id, label, data, summary } = e.data;

            if (status === 'progress') {
                if (action === 'classify') {
                    if (data.status === 'initiate') {
                        setAiProgress('Initiating Classifier download...');
                    } else if (data.status === 'download') {
                        setAiProgress(`Downloading ${data.file}...`);
                    } else if (data.status === 'progress') {
                        setAiProgress(`Downloading Classifier... (${Math.round(data.progress || 0)}%)`);
                    } else if (data.status === 'done') {
                        setAiProgress('Download complete! Loading into memory...');
                    } else if (data.status === 'ready') {
                        setAiProgress('Classifier Ready. Processing Feed...');
                    }
                    setAiLoading(true);
                } else if (action === 'summarize') {
                    if (data.status === 'initiate') {
                        setAiProgress('Initiating Summarization Model...');
                    } else if (data.status === 'download') {
                        setAiProgress(`Downloading ${data.file}...`);
                    } else if (data.status === 'progress') {
                        setAiProgress(`Downloading Summarizer... (${Math.round(data.progress || 0)}%)`);
                    } else if (data.status === 'done') {
                        setAiProgress('Summarizer loaded!');
                    } else if (data.status === 'ready') {
                        setAiProgress('Drafting Executive Brief...');
                    }
                    setGeneratingBriefing(true);
                }
            } else if (status === 'complete') {
                if (action === 'classify') {
                    // Output from Xenova/distilbert-base-uncased-finetuned-sst-2-english is "POSITIVE" or "NEGATIVE"
                    setStories(prev => {
                        const newStories = prev.map(s => {
                            if (s.id === id) {
                                // Map standard sentiment logic to AI Output
                                let newSentiment: Sentiment = 'neutral';
                                if (label === 'POSITIVE') newSentiment = 'bullish';
                                if (label === 'NEGATIVE') newSentiment = 'bearish';

                                return {
                                    ...s,
                                    sentiment: newSentiment,
                                    impactLabel: 'AI Tagged: ' + label
                                };
                            }
                            return s;
                        });

                        return newStories;
                    });

                    processedCount.current += 1;

                    if (processedCount.current >= initialStories.length) {
                        setAiProgress('✨ All Stories Analyzed!');
                        setTimeout(() => {
                            setAiLoading(false);
                            setAiProgress('');
                        }, 3000);
                    } else {
                        setAiProgress(`Analyzing Feed... (${processedCount.current}/${initialStories.length})`);
                    }
                } else if (action === 'summarize') {
                    if (id) {
                        setArticleSummaries(prev => ({ ...prev, [id]: summary }));
                        setLoadingArticleSummaries(prev => ({ ...prev, [id]: false }));
                    } else {
                        setBriefing(summary);
                        setGeneratingBriefing(false);
                        setAiProgress('');
                    }
                }
            } else if (status === 'error') {
                console.error("AI Error:", e.data.error);
                if (action === 'classify') setAiLoading(false);
                if (action === 'summarize') {
                    if (id) {
                        setLoadingArticleSummaries(prev => ({ ...prev, [id]: false }));
                    } else {
                        setGeneratingBriefing(false);
                    }
                }
                setAiProgress('');
            }
        };

        worker.current.addEventListener('message', onMessageReceived);

        return () => {
            worker.current?.removeEventListener('message', onMessageReceived);
        };
    }, [initialStories]);

    const runAITagging = () => {
        if (worker.current) {
            console.log('Dispatching stories to Web Worker...');
            setAiLoading(true);
            setAiProgress('Waking up AI Engine...');
            processedCount.current = 0;
            stories.forEach(story => {
                worker.current?.postMessage({ action: 'classify', id: story.id, text: story.title });
            });
        }
    };

    const runAISummary = () => {
        if (worker.current) {
            console.log('Dispatching feed string to Web Worker for summarization...');
            setGeneratingBriefing(true);
            setAiProgress('Waking up AI Summarizer...');

            // We only summarize top 10 items to save memory/speed, and concat their titles
            const contextText = stories.slice(0, 10).map(s => s.title).join(". ");
            worker.current.postMessage({ action: 'summarize', text: contextText });
        }
    };

    const summarizeArticle = async (id: string, url: string) => {
        if (!worker.current) return;
        setLoadingArticleSummaries(prev => ({ ...prev, [id]: true }));
        try {
            const articleText = await fetchArticleContent(url);
            if (articleText.length < 100) {
                setArticleSummaries(prev => ({ ...prev, [id]: "Unable to extract enough readable content. This link might be unreadable." }));
                setLoadingArticleSummaries(prev => ({ ...prev, [id]: false }));
                return;
            }
            worker.current.postMessage({ action: 'summarize', id, text: articleText });
        } catch (error) {
            console.error(error);
            setLoadingArticleSummaries(prev => ({ ...prev, [id]: false }));
        }
    };

    const displayedStories = useMemo(() => {
        let filtered = stories;
        if (typeFilter === 'macro') {
            filtered = filtered.filter(s => s.factor === 'macro');
        } else if (typeFilter === 'micro') {
            filtered = filtered.filter(s => s.factor === 'micro');
        }
        return filtered;
    }, [stories, timeFilter, typeFilter]);

    return (
        <>
            <div className="time-filter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <button className={timeFilter === 'today' ? 'active' : ''} onClick={() => router.push(`/?country=${currentCountry}&type=${typeFilter}&time=today`)}>Trending Today</button>
                    <button className={timeFilter === 'week' ? 'active' : ''} onClick={() => router.push(`/?country=${currentCountry}&type=${typeFilter}&time=week`)}>This Week</button>
                    <button className={timeFilter === 'month' ? 'active' : ''} onClick={() => router.push(`/?country=${currentCountry}&type=${typeFilter}&time=month`)}>This Month</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {aiProgress && (
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {aiProgress}
                        </span>
                    )}
                    <button
                        onClick={runAISummary}
                        disabled={generatingBriefing || aiLoading}
                        title="Draft Executive Brief (Free)"
                        style={{
                            backgroundColor: generatingBriefing ? '#30363d' : '#0ea5e9', // Sky blue for summary
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            cursor: (generatingBriefing || aiLoading) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            width: '38px',
                            height: '38px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            boxShadow: '0 2px 8px rgba(14, 165, 233, 0.4)'
                        }}
                    >
                        {generatingBriefing ? '⏳' : '📝'}
                    </button>
                    <button
                        onClick={runAITagging}
                        disabled={aiLoading || generatingBriefing}
                        title="Run AI Sentiment Analysis (Free)"
                        style={{
                            backgroundColor: aiLoading ? '#30363d' : '#8957e5',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            cursor: aiLoading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            width: '38px',
                            height: '38px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            boxShadow: '0 2px 8px rgba(137, 87, 229, 0.4)'
                        }}
                    >
                        {aiLoading ? '🧠' : '✨'}
                    </button>
                </div>
            </div>

            <ol className="news-list">
                {briefing && (
                    <li className="news-item" style={{ backgroundColor: 'var(--macro-tag-bg)', border: '1px solid var(--macro-tag-border)', padding: '16px', marginBottom: '16px' }}>
                        <div className="item-content">
                            <h3 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                ✨ AI Executive Briefing
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {briefing}
                            </p>
                        </div>
                    </li>
                )}

                {displayedStories.length === 0 && (
                    <li className="news-item">
                        <div className="item-content">
                            <span className="item-domain">Loading signals or no news found...</span>
                        </div>
                    </li>
                )}

                {displayedStories.map((story) => (
                    <li className="news-item" key={story.id}>
                        <div className="item-rank"></div>
                        <div className="item-content">
                            <div>
                                <a href={story.link} target="_blank" rel="noopener noreferrer" className="item-title">{story.title}</a>
                                <a href={story.link} target="_blank" rel="noopener noreferrer" className="item-domain">({story.domain})</a>
                            </div>
                            <div className="item-meta">
                                <span>{story.timeAgo}</span>
                                <span>•</span>
                                <span className={`tag ${story.factor}`}>{story.factor.toUpperCase()}</span>
                                <span>•</span>
                                <span className={`sentiment ${story.sentiment}`}>
                                    {story.sentiment === 'bullish' ? '↑ Bullish' : story.sentiment === 'bearish' ? '↓ Bearish' : '→ Neutral'}
                                    {' '}({story.impactLabel})
                                </span>
                                <span>•</span>
                                <button
                                    onClick={() => summarizeArticle(story.id, story.link)}
                                    disabled={loadingArticleSummaries[story.id]}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: loadingArticleSummaries[story.id] ? 'not-allowed' : 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    {loadingArticleSummaries[story.id] ? '⏳ Reading...' : '📝 Summarize'}
                                </button>
                            </div>

                            {articleSummaries[story.id] && (
                                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-color)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-primary)', borderLeft: '3px solid #0ea5e9' }}>
                                    <strong style={{ display: 'block', marginBottom: '4px', color: '#0ea5e9' }}>AI Article Summary</strong>
                                    {articleSummaries[story.id]}
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ol>
        </>
    );
}
