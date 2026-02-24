'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function TopNav() {
    const searchParams = useSearchParams();
    const currentType = searchParams.get('type') || 'all';
    // Maintain other search params like 'country' if present
    const country = searchParams.get('country') || 'us';

    return (
        <nav>
            <Link href={`/?country=${country}&type=all`} className={currentType === 'all' ? 'active' : ''}>Trending</Link>
            <Link href={`/?country=${country}&type=macro`} className={currentType === 'macro' ? 'active' : ''}>Macro Insights</Link>
            <Link href={`/?country=${country}&type=micro`} className={currentType === 'micro' ? 'active' : ''}>Micro Catalysts</Link>
        </nav>
    );
}
