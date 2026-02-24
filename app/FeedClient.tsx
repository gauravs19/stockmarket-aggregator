'use client';

import { useState, useMemo } from 'react';
import type { Story } from '../lib/feed';

type TimeFilter = 'today' | 'week' | 'month';

export default function FeedClient({ initialStories }: { initialStories: Story[] }) {
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');

    // We simulate "Today vs Week vs Month" since RSS mostly returns recent items.
    // In a real app we'd have historical data matching the filter.
    // For demo UX, we just display the RSS news.
    const displayedStories = useMemo(() => {
        // Just returning all fetched for now, to ensure the UI looks full
        return initialStories;
    }, [initialStories, timeFilter]);

    return (
        <>
            <div className="time-filter">
                <button
                    className={timeFilter === 'today' ? 'active' : ''}
                    onClick={() => setTimeFilter('today')}
                >
                    Trending Today
                </button>
                <button
                    className={timeFilter === 'week' ? 'active' : ''}
                    onClick={() => setTimeFilter('week')}
                >
                    This Week
                </button>
                <button
                    className={timeFilter === 'month' ? 'active' : ''}
                    onClick={() => setTimeFilter('month')}
                >
                    This Month
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
