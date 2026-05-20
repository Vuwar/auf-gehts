# auf-gehts
Website for learning german in easier way

## Deployment

Backend deploys on Railway with the root `Dockerfile`. Configure either:

- `DATABASE_URL` from the Railway Postgres service, or
- `ConnectionStrings__DefaultConnection` with an Npgsql connection string.

Optional backend variables:

- `MIGRATION_DATABASE_URL` or `ConnectionStrings__MigrationConnection` for a separate session-mode migration connection.
- `SKIP_MIGRATIONS=true` to start without running EF migrations.
- `Cors__AllowedOrigins=https://your-frontend-domain` for the deployed client.
- `Groq__ApiKey`, `Azure__Speech__Key`, `Azure__Speech__Region`, and `Supabase__ServiceRoleKey` for AI/audio features.

Frontend deploys from `client` on Vercel. Required variables:

- `VITE_API_URL=https://your-railway-api-domain`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
