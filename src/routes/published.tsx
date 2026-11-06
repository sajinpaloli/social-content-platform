import { createFileRoute } from '@tanstack/react-router';
import { PublishedPage } from '@/features/published';
export const Route = createFileRoute('/published')({
  head: () => ({ meta: [{ title: 'Published posts | Postly' }, { name: 'description', content: 'Review posts published to connected social accounts.' }] }),
  component: PublishedPage,
});