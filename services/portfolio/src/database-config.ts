export function assertPortfolioDatabaseHost(
  connectionString: string,
  expectedHost?: string,
) {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("Portfolio database URL is invalid");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol))
    throw new Error("Portfolio requires a PostgreSQL connection URL");
  if (
    expectedHost &&
    parsed.hostname.toLowerCase() !== expectedHost.toLowerCase()
  )
    throw new Error(
      "Portfolio database hostname does not match its dedicated PostgreSQL host",
    );
}
