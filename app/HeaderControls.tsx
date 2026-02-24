'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function HeaderControls() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLightMode, setIsLightMode] = useState(false);
    const country = searchParams.get('country') || 'us';

    useEffect(() => {
        // Check local storage or system preference on mount
        const saved = localStorage.getItem('theme');
        if (saved === 'light') {
            setIsLightMode(true);
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    }, []);

    const toggleTheme = () => {
        if (isLightMode) {
            document.body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
            setIsLightMode(false);
        } else {
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
            setIsLightMode(true);
        }
    };

    const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCountry = e.target.value;
        router.push(`/?country=${newCountry}`);
    };

    return (
        <div className="header-controls">
            <select value={country} onChange={handleCountryChange} className="country-select">
                <option value="us">United States (Top Market)</option>
                <option value="cn">China</option>
                <option value="jp">Japan</option>
                <option value="de">Germany</option>
                <option value="in">India</option>
            </select>
            <button onClick={toggleTheme} className="theme-toggle">
                {isLightMode ? '🌙 Dark' : '☀️ Light'}
            </button>
        </div>
    );
}
