import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

// Map of package name → directory path
const PACKAGES: Record<string, string> = {
  "@foundry/cli": "packages/cli",
  "@foundry/tasks": "packages/tasks",
};

// Reverse lookup: directory → package name
function findPackage(cwd: string): string | undefined {
  for (const [name, dir] of Object.entries(PACKAGES)) {
    if (cwd.includes(`/${dir}/`)) return name;
  }
  return undefined;
}

export default function lintFormatter(pi: ExtensionAPI): void {
  pi.on("tool_result", async (event, ctx) => {
    if (event.isError) return;
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    // Determine what file was written
    let filePath: string | undefined;
    if (event.toolName === "write") {
      filePath = String(event.input.path ?? "");
    } else {
      // edit tool: input is the patch string, first line is [PATH#TAG]
      const firstLine = String(event.input.input).split("\n")[0];
      filePath = firstLine.replace(/^\[([^\]]+)\].*$/, "$1");
    }

    if (!filePath || !filePath.endsWith(".ts")) return;

    // Find which package owns this file
    const pkg = findPackage(filePath);
    if (!pkg) return;

    const formatScript = `pnpm --filter '${pkg}' run format`;
    const lintScript = `pnpm --filter '${pkg}' run lint`;

    try {
      await pi.exec(formatScript);
      await pi.exec(lintScript);
    } catch {
      // Non-fatal: lint/format warnings don't block tool results
    }
  });
}
