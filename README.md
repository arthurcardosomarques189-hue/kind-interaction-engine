# ClipForge AI

Plataforma SaaS para transformar vídeos longos em cortes verticais para TikTok, YouTube Shorts e Instagram Reels.

O projeto usa TanStack Start, React, TypeScript e Supabase. A interface existente inclui envio de vídeo, importação por link do YouTube, biblioteca de projetos e fluxo de exportação. Esses fluxos dependem da configuração do Supabase e das Edge Functions/serviços externos.

## Rodar localmente

Requisitos: Node.js e npm.

```sh
git clone https://github.com/arthurcardosomarques189-hue/kind-interaction-engine.git
cd kind-interaction-engine
npm install
cp .env.example .env.local
npm run dev
```

Preencha `.env.local` com as credenciais do seu projeto Supabase antes de iniciar a aplicação. Nunca publique `.env.local` nem coloque chaves secretas em variáveis `VITE_*`.

## Configuração necessária

### Variáveis de ambiente

- `VITE_SUPABASE_URL`: URL do projeto Supabase usada pelo navegador.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: chave pública/publishable do Supabase.
- `SUPABASE_URL`: URL do Supabase usada no servidor.
- `SUPABASE_PUBLISHABLE_KEY`: chave publishable usada nas chamadas server-side.
- `SUPABASE_SERVICE_ROLE_KEY`: chave privilegiada, somente no servidor.
- `ASSEMBLYAI_API_KEY`: necessária para iniciar a transcrição de vídeos enviados.

Use os nomes e valores fornecidos pelo seu projeto/ambiente. Não compartilhe chaves secretas no GitHub ou no navegador.

### Serviços que precisam estar configurados

O fluxo de upload consulta as tabelas e o storage do Supabase e chama a função de transcrição. A importação do YouTube e a exportação dependem de Edge Functions específicas. Antes de considerar o SaaS pronto para produção, confirme no projeto Supabase que as migrations, políticas RLS, buckets e funções usadas pelo código estão implantados e que as chaves necessárias estão definidas.

## Verificações locais

```sh
npm run lint
npm test
npm run build
```

Faça as verificações depois de configurar o ambiente; a compilação isolada não confirma que os serviços externos e as Edge Functions estão operacionais.

## Desenvolvimento seguro

- Trabalhe em branches para preservar o estado funcional de `main`.
- Não exponha `SUPABASE_SERVICE_ROLE_KEY` no cliente.
- Teste upload, importação, geração de cortes e exportação separadamente com um vídeo autorizado.
