# Personal Portfolio

React frontend for `phanhoaithu.io.vn`, with a public portfolio and a private `/admin` content studio. Its backend is `services/portfolio`, with SQLite persistence. See [Portfolio Guide](../../docs/portfolio.md) for local development, administrator setup and deployment.

```sh
npm run portfolio:preview
```

This explicit development mode uses an ignored local JSON content file and in-memory sessions, binds the API to loopback, and cannot run in production. Admin sign-in is disabled until a password hash is configured. The normal runtime uses SQLite for durable content and sessions; run `npm run portfolio:migrate` before `npm run dev` from the repository root.
