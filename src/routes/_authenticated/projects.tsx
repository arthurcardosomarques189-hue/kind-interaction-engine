import { createFileRoute } from '@tanstack/react-router';
import { CortesHistory } from '@/components/cortes-history';
import { pageHead } from '@/lib/metadata';

export const Route = createFileRoute('/_authenticated/projects')({
  head: () => pageHead('Meus projetos', 'Histórico e biblioteca de vídeos exportados do CORTES AI.'),
  component: CortesHistory,
});
