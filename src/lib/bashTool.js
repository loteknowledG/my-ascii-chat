import { Effect } from "effect";
import { Bash } from "just-bash";

let bashInstance = null;

export function getBash() {
  if (!bashInstance) {
    bashInstance = new Bash({ timeout: 10000 });
  }
  return bashInstance;
}

export const runBashCommand = (command) =>
  Effect.tryPromise({
    try: async () => {
      const bash = getBash();
      const result = await bash.exec(command);
      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    },
    catch: (err) => ({
      success: false,
      error: String(err.message || err),
      stdout: "",
      stderr: "",
      exitCode: -1,
    }),
  });

export const resetBash = () => {
  bashInstance = null;
};