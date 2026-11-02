# Personal Portfolio

Independent React frontend for `phanhoaithu.io.vn`, with a public portfolio and a private `/admin` content studio. Its backend is `services/portfolio`, not the DailyPick gateway or order service. See [Portfolio Guide](../../docs/portfolio.md) for local preview, administrator setup, database ownership and same-server deployment.

```sh
npm run portfolio:preview
```

This explicit development mode uses an ignored local JSON content file and in-memory sessions, binds the API to loopback, and cannot run in production. Admin sign-in is disabled until a password hash is configured. Kubernetes uses a separate PostgreSQL database/role and durable sessions.
