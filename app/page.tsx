import FeedClient from './FeedClient';
import { fetchFinanceNews, Country, TimeFilter } from '../lib/feed';

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
  const time = (sp?.time as TimeFilter) || 'today';

  const stories = await fetchFinanceNews(country, time);

  return (
    <>
      <FeedClient key={`${country}-${time}`} initialStories={stories} />
    </>
  );
}
