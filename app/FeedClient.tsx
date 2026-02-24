'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { Story, Sentiment } from '../lib/feed';

type TimeFilter = 'today' | 'week' | 'month';

export default function FeedClient({ initialStories }: { initialStories: Story[] }) {
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
    const [stories, setStories] = useState<Story[]>(initialStories);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiProgress, setAiProgress] = useState<string>('');
    const processedCount = useRef<number>(0);

    // Create a reference to the worker object.
    const worker = useRef<Worker | null>(null);

    useEffect(() => {
        // Update local state when server data changes (e.g. new country selected)
        setStories(initialStories);

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
            const { status, id, label, data } = e.data;

            if (status === 'progress') {
                if (data.status === 'initiate') {
                    setAiProgress('Initiating AI Model download...');
                } else if (data.status === 'download') {
                    setAiProgress(`Downloading ${data.file}...`);
                } else if (data.status === 'progress') {
                    setAiProgress(`Downloading... (${Math.round(data.progress || 0)}%)`);
                } else if (data.status === 'done') {
                    setAiProgress('Download complete! Loading into memory...');
                } else if (data.status === 'ready') {
                    setAiProgress('AI Model Ready. Processing Feed...');
                }
                setAiLoading(true);
            } else if (status === 'complete') {
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
            } else if (status === 'error') {
                console.error("AI Error:", e.data.error);
                setAiLoading(false);
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
                worker.current?.postMessage({ id: story.id, text: story.title });
            });
        } else {
            console.error('Worker not initialized!');
            setAiLoading(true);
            setAiProgress('Error: AI environment failed to boot.');
            setTimeout(() => setAiLoading(false), 3000);
        }
    };

    const displayedStories = useMemo(() => {
        return stories;
    }, [stories, timeFilter]);

    return (
        <>
            <div className="time-filter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <button className={timeFilter === 'today' ? 'active' : ''} onClick={() => setTimeFilter('today')}>Trending Today</button>
                    <button className={timeFilter === 'week' ? 'active' : ''} onClick={() => setTimeFilter('week')}>This Week</button>
                    <button className={timeFilter === 'month' ? 'active' : ''} onClick={() => setTimeFilter('month')}>This Month</button>
                </div>

                <button
                    onClick={runAITagging}
                    disabled={aiLoading}
                    style={{
                        backgroundColor: aiLoading ? '#30363d' : '#8957e5',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: aiLoading ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        transition: 'background-color 0.2s',
                        minWidth: '320px',
                        textAlign: 'center'
                    }}
                >
                    {aiLoading ? (aiProgress || 'AI Processing...') : '✨ Run AI Sentiment Analysis (Free)'}
                </button>
            </div>

            <ol className="news-list">
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
                        <div className="item-vote">▲</div>
                        <div className="item-content">
                            <div>
                                <a href={story.link} target="_blank" rel="noopener noreferrer" className="item-title">{story.title}</a>
                                <a href={story.link} target="_blank" rel="noopener noreferrer" className="item-domain">({story.domain})</a>
                            </div>
                            <div className="item-meta">
                                <span>{story.points} points</span>
                                <span>•</span>
                                <span>{story.timeAgo}</span>
                                <span>•</span>
                                <span className={`tag ${story.factor}`}>{story.factor.toUpperCase()}</span>
                                <span>•</span>
                                <span className={`sentiment ${story.sentiment}`}>
                                    {story.sentiment === 'bullish' ? '↑ Bullish' : story.sentiment === 'bearish' ? '↓ Bearish' : '→ Neutral'}
                                    {' '}({story.impactLabel})
                                </span>
                                <span>•</span>
                                <a href="#">{story.commentsInt} comments</a>
                            </div>
                        </div>
                    </li>
                ))}
            </ol>
        </>
    );
}
