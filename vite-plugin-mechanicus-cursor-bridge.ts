import type { Connect } from "vite";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

import { isValidCursorTtsProfileId } from "./src/lib/cursorTtsProfileId.js";

const DEFAULT_PROFILE = "mechanicus-voice";

/** Cursor after-reply TTS: mute flag + Samus voice profile (Cyberdeck UI in dev / preview). */
export function mechanicusCursorBridge(rootDir: string): Plugin {
  const hooksDir = path.join(rootDir, ".cursor/hooks");
  const mutedFile = path.join(hooksDir, "mechanicus-cursor.muted");
  const voiceFile = path.join(hooksDir, "cursor-tts-voice.txt");
  const route = "/__cyberdeck/mechanicus-cursor";

  function isMuted(): boolean {
    try {
      if (!fs.existsSync(mutedFile)) return false;
      return fs.readFileSync(mutedFile, "utf8").trim() === "1";
    } catch {
      return false;
    }
  }

  function setMuted(m: boolean): void {
    fs.mkdirSync(path.dirname(mutedFile), { recursive: true });
    if (m) fs.writeFileSync(mutedFile, "1\n", "utf8");
    else {
      try {
        fs.unlinkSync(mutedFile);
      } catch {
        /* absent */
      }
    }
  }

  function readProfile(): string {
    try {
      if (!fs.existsSync(voiceFile)) return DEFAULT_PROFILE;
      const raw = fs.readFileSync(voiceFile, "utf8").trim();
      if (isValidCursorTtsProfileId(raw)) return raw;
    } catch {
      /* fall through */
    }
    return DEFAULT_PROFILE;
  }

  function setProfile(id: string): void {
    const next = isValidCursorTtsProfileId(id) ? id.trim() : DEFAULT_PROFILE;
    fs.mkdirSync(path.dirname(voiceFile), { recursive: true });
    fs.writeFileSync(voiceFile, `${next}\n`, "utf8");
  }

  function attach(server: { middlewares: Connect.Server }): void {
    server.middlewares.use((req, res, next) => {
      const url = (req.url ?? "").split("?")[0];
      if (url !== route) {
        next();
        return;
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }
      if (req.method === "GET") {
        res.end(
          JSON.stringify({
            muted: isMuted(),
            profile: readProfile(),
            bridge: true,
          }),
        );
        return;
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => {
          body += c;
        });
        req.on("end", () => {
          try {
            const j = JSON.parse(body || "{}") as { muted?: boolean; profile?: string };
            if (typeof j.muted === "boolean") setMuted(j.muted);
            if (typeof j.profile === "string") setProfile(j.profile);
            res.end(
              JSON.stringify({
                ok: true,
                muted: isMuted(),
                profile: readProfile(),
              }),
            );
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
        return;
      }
      res.statusCode = 405;
      res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    });
  }

  return {
    name: "mechanicus-cursor-bridge",
    configureServer(server) {
      attach(server);
    },
    configurePreviewServer(server) {
      attach(server);
    },
  };
}
