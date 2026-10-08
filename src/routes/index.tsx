import { createFileRoute } from '@tanstack/react-router';
import { CortesDashboard } from '@/components/cortes-dashboard';
import { pageHead } from '@/lib/metadata';

export const Route = createFileRoute('/')({
  head: () => pageHead('CORTES AI', 'Transforme vídeos longos em cortes que prendem atenção.'),
  component: CortesDashboard,
});
