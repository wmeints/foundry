import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export default function markdownFormatter(pi: ExtensionAPI): void {
  pi.on("tool_result", async (event) => {
    if (event.isError) return;
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    // Determine what file was edited
    let filePath: string | undefined;
    if (event.toolName === "write") {
      filePath = String(event.input.path ?? "");
    } else {
      // edit tool: input is the patch string, first line is [PATH#TAG]
      const firstLine = String(event.input.input).split("\n")[0];
      filePath = firstLine.replace(/^\[([^\]]+)\].*$/, "$1");
    }

    if (!filePath || !filePath.endsWith(".md")) return;

    // Skip vendor files
    if (filePath.includes("/vendor/")) return;

    try {
      await pi.exec(`pnpm exec prettier --write "${filePath}"`);
    } catch {
      // Non-fatal: prettier formatting errors don't block tool results
    }
  });
}
