import { getGobierno } from '@/services';
import GobiernoClient from './GobiernoClient';

export const dynamic = 'force-dynamic';

// Server Component: fetches data, passes to Client Component for interactivity
export default async function GobiernoPage() {
  const data = getGobierno();
  return <GobiernoClient data={data} />;
}
