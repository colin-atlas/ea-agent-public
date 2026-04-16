import { execSync } from "child_process";

const DOCKER_COMPOSE_DIR = process.env.DOCKER_COMPOSE_DIR || "";

const CLI_ENV = {
  ...process.env,
  HOME: process.env.HOME || "/root",
  PATH:
    "/usr/local/bin:/usr/bin:/bin:" +
    (process.env.HOME || "/root") +
    "/.npm-global/bin",
};

/**
 * Run an openclaw CLI command. When DOCKER_COMPOSE_DIR is set, the command
 * executes inside the client's Docker container via `docker compose exec`.
 * Otherwise it runs directly on the host (bare-metal install).
 */
export function openclawExec(
  args: string,
  { timeout = 8000 }: { timeout?: number } = {}
): string {
  const cmd = DOCKER_COMPOSE_DIR
    ? `docker compose -f ${DOCKER_COMPOSE_DIR}/docker-compose.yml exec -T openclaw-gateway openclaw ${args}`
    : `openclaw ${args}`;

  return execSync(cmd, { env: CLI_ENV, timeout, encoding: "utf-8" }).trim();
}

/**
 * Run a shell command on the host. When DOCKER_COMPOSE_DIR is set, some
 * commands may need to target the container instead — use openclawExec for
 * openclaw-specific commands and this for host-level system checks.
 */
export function hostExec(
  cmd: string,
  { timeout = 5000 }: { timeout?: number } = {}
): string {
  try {
    return execSync(cmd, { timeout, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

/**
 * Check if the dashboard is running against a Docker-deployed client.
 */
export function isDockerClient(): boolean {
  return !!DOCKER_COMPOSE_DIR;
}

/**
 * Get the Docker Compose project directory for the current client.
 * Returns empty string for bare-metal installs.
 */
export function getComposeDir(): string {
  return DOCKER_COMPOSE_DIR;
}

/**
 * List cron jobs from the openclaw gateway. Returns parsed JSON array.
 */
export function getCronJobs(): Array<Record<string, unknown>> {
  try {
    const raw = openclawExec("cron list --json");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed.jobs || [];
  } catch {
    return [];
  }
}
