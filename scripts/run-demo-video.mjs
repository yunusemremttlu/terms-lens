import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
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
  const cli = fileURLToPath(new URL("../node_modules/cypress/bin/cypress", import.meta.url));
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [cli, "run", "--browser", "chrome", "--headless"],
      { cwd: process.cwd(), stdio: "inherit", windowsHide: true }
    );

    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });

  process.exitCode = exitCode;
} catch (error) {
  console.error("Cypress demo failed to run:", error);
  process.exitCode = 1;
} finally {
  await server.close();
}
