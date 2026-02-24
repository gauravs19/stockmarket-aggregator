import FeedClient from './FeedClient';
import { fetchFinanceNews, Country } from '../lib/feed';

// This is required to make Next.js run this component on the server for each request
// or revalidate at intervals so news is fresh.
export const revalidate = 60; // revalidate every 60 seconds

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}) {
  const sp = await searchParams;
  const country = (sp?.country as Country) || 'us';
  const stories = await fetchFinanceNews(country);

  return (
    <>
      <FeedClient initialStories={stories} />
    </>
  );
}
