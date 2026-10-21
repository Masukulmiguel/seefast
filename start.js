import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(name, args) {
  const child = spawn(npm, args, { stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    console.log(`[start] child "${name}" exited with code ${code}`);
    // Do NOT shutdown here — a child exiting does not mean the parent must die.
    // Parent is killed only via SIGINT/SIGTERM below, which kills remaining children.
  });
  return child;
}

const children = [];
let shuttingDown = false;

function killChild(child) {
  if (child.exitCode !== null || child.killed) return;
  if (process.platform === "win32" && child.pid) {
    // child.kill() só mata o wrapper (npm.cmd); /T mata a árvore inteira
    // (node server/api.js, vite) para não deixar processos órfãos.
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    child.kill();
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    killChild(child);
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

children.push(run("server", ["run", "server"]));
children.push(run("vite", ["run", "dev"]));
