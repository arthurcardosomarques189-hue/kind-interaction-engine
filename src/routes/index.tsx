import { createFileRoute } from '@tanstack/react-router';
import { AdminWorkspace } from '@/components/admin-workspace';
import { pageHead } from '@/lib/metadata';

export const Route = createFileRoute('/')({ head: () => pageHead('Central de controle', 'CORTES AI: acesso seguro à central de administração do proprietário.'), component: () => <AdminWorkspace/> });
