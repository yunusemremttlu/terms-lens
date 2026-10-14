import cypress from "cypress";
import { createServer } from "vite";

const server = await createServer({
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  }
});

await server.listen();

try {
  const result = await cypress.run({
    browser: "chrome",
    headless: true,
    project: process.cwd()
  });

  if ("status" in result) {
    console.error(result.message);
    process.exitCode = 1;
  } else if (result.totalFailed > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error("Cypress demo failed to run:", error);
  process.exitCode = 1;
} finally {
  await server.close();
}
