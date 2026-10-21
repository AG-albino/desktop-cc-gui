/**
 * Login launch for CodeBuddy: the CLI owns the interactive OAuth/login flow,
 * so the app drives its built-in terminal: open the dock on a fresh tab,
 * wait for the PTY, then run codebuddy and trigger /login.
 */
import { ipc } from "@/lib/ipc";
import { useChatStore } from "@/features/chat/store";
import { hasTerminalSession } from "@/features/terminal/sessions";
import { useTerminalStore } from "@/features/terminal/store";

const ENTER = "\r";

function shellQuote(bin: string): string {
  return bin.includes(" ") ? `"${bin}"` : bin;
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

/** Poll until TerminalView has spawned the backend PTY for `id`. */
async function waitForSession(id: string, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (hasTerminalSession(id)) return true;
    await delay(100);
  }
  return false;
}

/**
 * Open the terminal dock on a fresh tab and start CodeBuddy login flow.
 * Returns false when there is no active workspace to host the terminal.
 */
export async function launchCodeBuddyLogin(): Promise<boolean> {
  const workspacePath = useChatStore.getState().active?.workspacePath;
  if (!workspacePath) return false;

  const term = useTerminalStore.getState();
  if (!term.open) term.toggle(workspacePath);
  useTerminalStore.getState().newTab(workspacePath);
  const id = useTerminalStore.getState().activeByWorkspace[workspacePath];
  if (!id) return false;

  const settings = await ipc.getAppSettings().catch(() => null);
  const customBin = settings?.codebuddyBin?.trim();
  const bin = shellQuote(customBin || "codebuddy");

  if (!(await waitForSession(id))) return false;

  void ipc.terminalWrite(id, `${bin}${ENTER}`).catch(() => {});
  window.setTimeout(() => {
    void ipc.terminalWrite(id, `/login${ENTER}`).catch(() => {});
  }, 1500);
  return true;
}
