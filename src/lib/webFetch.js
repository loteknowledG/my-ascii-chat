import { Effect } from "effect";

const isElectron = typeof window !== 'undefined' && window.electron && window.electron.invoke;

const httpFetch = (target) =>
  isElectron
    ? window.electron.invoke('api-request', { url: target, method: 'GET', headers: {} })
    : fetch(target).then(r => r.ok ? r.text().then(t => ({ success: true, text: t, status: r.status })) : { success: false, status: r.status });

export const fetchWeb = (query, numResults = 5) =>
  Effect.tryPromise({
    try: async () => {
      const target = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${numResults}`;
      const result = await httpFetch(target);
      if (!result.success) throw new Error(`HTTP_${result.status}`);
      const html = result.text || result;
      const urls = [];
      const linkRegex = /href="(\/url\?q=https?:\/\/[^"&]+)"/g;
      let match;
      while ((match = linkRegex.exec(html)) !== null && urls.length < numResults) {
        const url = decodeURIComponent(match[1]);
        if (url.startsWith("http") && !url.includes("google.com") && !url.includes("corsproxy")) {
          urls.push(url);
        }
      }
      return { success: true, urls, query };
    },
    catch: (err) => ({ success: false, error: String(err), query }),
  });

export const fetchUrl = (url) =>
  Effect.tryPromise({
    try: async () => {
      const result = isElectron
        ? await window.electron.invoke('api-request', { url, method: 'GET', headers: {} })
        : await fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`).then(r => r.ok ? r.text().then(t => ({ success: true, text: t })) : { success: false });
      
      if (!result.success) throw new Error(`HTTP_${result.status || 500}`);
      let text = result.text || result;
      
      try {
        const json = JSON.parse(text);
        if (json.data) text = json.data;
      } catch {}
      
      const titleMatch = text.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : url;
      text = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const slice = text.slice(0, 1500);
      return {
        success: true,
        content: `[${title}]\n${slice}${text.length > 1500 ? "..." : ""}`,
        url,
        truncated: text.length > 1500,
      };
    },
    catch: (err) => ({ success: false, error: String(err.message || err), url }),
  });