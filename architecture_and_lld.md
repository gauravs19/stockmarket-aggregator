# Stock Market Aggregator Architecture & Low-Level Design (LLD)

This document provides a comprehensive overview of the system architecture and low-level functioning of the Stock Market Aggregator application.

## 1. System Overview

The application is a Next.js-based web platform designed to aggregate global financial news, perform real-time AI sentiment analysis, and generate executive summaries entirely on the client-side. It prioritizes data privacy and edge-compute efficiency by running Machine Learning models directly in the user's browser, while relying on lightweight Node.js Server Actions to securely bypass CORS and scraping barriers.

### Key Technologies
*   **Framework**: Next.js 15 (React 19)
*   **Language**: TypeScript
*   **AI Engine**: Transformers.js (`@xenova/transformers`)
*   **Scraping**: `jsdom` + `@mozilla/readability`
*   **Feed Processing**: `rss-parser`

---

## 2. Component Architecture

### 2.1 The Data Pipeline (Server-Side)

**File:** `lib/feed.ts`
The data ingestion layer is completely decentralized, pulling live unstructured RSS data from Bing News Search.

*   **Bing URL Assembly**: Constructs dynamic queries based on User selections (Country, Timeframe). It utilizes Bing's `qft=interval` parameters to fetch time-bracketed results (Today, Week, Month).
*   **Transformation**: The raw XML feed is parsed via `rss-parser` and mapped into standardized `Story` objects.
*   **Initial Tagging Strategy**: Articles are assigned an initial `sentiment` state of `"untagged"`. A basic regex heuristic assesses if the headline contains macro keywords (e.g., 'inflation', 'fed') to assign a `factor` of 'macro' or 'micro'.

### 2.2 The Article Scraper (Edge / Server Action)

**File:** `app/actions.ts`
Scraping full article content is required for the summarizer model. This is executed securely as a Next.js Server Action to bypass browser CORS restrictions and utilize Node.js native heavy DOM libraries.

*   **`resolveJumpPages(url)` - The Redirect Engine**: Aggregators like Bing wrap outbound links in tracking endpoints (`apiclick.aspx`). Standard fetching libraries hit these pages and stall because the redirects are often handled via JavaScript or HTML Meta tags rather than HTTP 301 statuses.
    *   This function fetches the HTML, uses Regular Expressions to hunt for `<meta http-equiv="refresh">` and `window.location.replace()` tags, recursively extracts the real publisher URL, and loops until it lands on the final destination.
*   **`fetchArticleContent(url)` - The Extraction Engine**: 
    *   Constructs a virtual DOM of the publisher's raw HTML using `JSDOM`.
    *   Passes the virtual DOM into `@mozilla/readability` (the exact engine powering Firefox's "Reader View"). This strips out all advertisements, navbars, and sidebars, returning pure textual content.
    *   The output is truncated to 4000 characters to prevent crashing the client-side NLP tokenizers with max-sequence-length errors.

### 2.3 The Processing Engine (Client-Side Web Worker)

**File:** `app/worker.ts`
To prevent the React UI from completely freezing during heavy Matrix multiplications, all ML inference is offloaded to a dedicated Web Worker thread.

*   **Transformers.js Integration**: Compiles PyTorch/TensorFlow models into WebAssembly (WASM) to run locally in the browser cache.
*   **`PipelineFactory` Singleton**: Ensures models are only downloaded once into browser storage. It lazily initializes specific pipelines on demand.
    1.  **Sentiment Classifier**: Lazily loads `Xenova/distilbert-base-uncased-finetuned-sst-2-english`.
    2.  **Summarizer**: Lazily loads `Xenova/distilbart-cnn-6-6`.
*   **Asynchronous Message Bus**: Listens for `{ action: 'classify' | 'summarize', text, id? }` payloads. It continually posts `status: 'progress'` events back to the main thread during the multi-megabyte model download phase, and fires `status: 'complete'` upon successful inference.

### 2.4 The UI Orchestrator (Client-Side Component)

**File:** `app/FeedClient.tsx`
The primary interactive interface connecting the user to the Web Worker and Server Actions.

*   **Progressive Enhancement**: Stories render immediately via Server-Side Rendering (SSR) from `app/page.tsx` showing an `"✧ Awaiting Analysis"` badge.
*   **Staggered Animation Queue**: When the user triggers Sentiment Analysis, `FeedClient` does not bombard the Web Worker simultaneously. It loops through the `stories` state and sequentially dispatches them using a `setTimeout` of 2000ms. This prevents memory spikes and provides a visually satisfying "radar scanning" effect on the UI.
*   **Granular State Management**: Uses dictionary tracking (`Record<string, boolean>`) for `loadingArticleSummaries` and `articleSummaries`. This allows simultaneous, non-blocking requests to summarize multiple different articles gracefully without shared state collision.

---

## 3. Data Flow Diagram

1.  **User Request**: Navigates to `/`
2.  **SSR Fetch**: `app/page.tsx` calls `lib/feed.ts` -> Returns 30 untagged Bingo News items.
3.  **Client Mount**: `app/FeedClient.tsx` renders feed and instantiates Web Worker (`worker.ts`).
4.  **Action: Tag Sentiment**:
    *   `FeedClient` pipelines titles to Worker via `.postMessage()`.
    *   Worker downloads DistilBERT via CDN (cached).
    *   Worker computes `POSITIVE/NEGATIVE` logits and returns them.
    *   UI dynamically replaces `"Awaiting Analysis"` with `"↑ Bullish"` or `"↓ Bearish"`.
5.  **Action: Summarize Article**:
    *   User clicks "Summarize" on a specific article.
    *   `FeedClient` invokes `fetchArticleContent(url)` (Server Action).
    *   Server acts as a stealth proxy, bypassing Bing Jump Pages, scraping via `Mozilla Readability`, and returning clean text.
    *   `FeedClient` dispatches text to Worker for `summarize` action.
    *   Worker executes `BART` summarization matrix.
    *   Worker posts summary string back to main thread to populate the UI.
