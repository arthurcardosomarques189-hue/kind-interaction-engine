import { createFileRoute } from '@tanstack/react-router';
import { AdminWorkspace } from '@/components/admin-workspace';
import { pageHead } from '@/lib/metadata';
export const Route = createFileRoute('/_authenticated/admin')({ head: () => pageHead('Administração', 'Painel exclusivo do proprietário CORTES AI: usuários, créditos e consumo.'), component: () => <AdminWorkspace authenticated/> });