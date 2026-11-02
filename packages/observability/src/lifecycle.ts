import type { Server } from "node:http";
import { logger } from "./http.ts";
export function graceful(
  server: Server,
  close: () => Promise<void> = async () => {},
) {
  process.once("SIGTERM", () => {
    const deadline = setTimeout(() => process.exit(1), 25000).unref();
    server.close(() => {
      void close()
        .then(() => {
          clearTimeout(deadline);
          process.exit(0);
        })
        .catch((error) => {
          logger.error({ error: String(error) }, "shutdown_failed");
          process.exit(1);
        });
    });
  });
}
