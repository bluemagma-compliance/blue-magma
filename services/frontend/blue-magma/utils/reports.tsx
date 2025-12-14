"use client";

import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

export function getStatusIcon(status: string) {
  switch (status) {
    case "Completed":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "Failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "Running":
      return <Clock className="h-5 w-5 text-blue-500" />;
    case "Pending":
      return <Clock className="h-5 w-5 text-yellow-500" />;
    default:
      return <AlertTriangle className="h-5 w-5 text-gray-500" />;
  }
}

/** Try to unwrap a double-encoded JSON string (at most twice). */
function unwrapIfDoubleEncoded(raw: string): string {
  let s = raw.trim();
  for (let i = 0; i < 2; i++) {
    // If it looks like a quoted JSON blob (lots of `\"`), try to parse once
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.includes('\\"') && (s.includes("{") || s.includes("[")))
    ) {
      try {
        const parsed = JSON.parse(s);
        if (typeof parsed === "string") {
          s = parsed.trim();
          continue;
        }
      } catch {
        /* ignore */
      }
    }
    break;
  }
  return s;
}

/** Escape nested quotes only inside "value": "..." fields for an entire array/object text. */
function escapeNestedQuotesInValue(jsonLike: string): string {
  // We’ll scan and rebuild so we respect strings and escapes.
  const s = jsonLike;
  let out = "";
  let i = 0;
  // helper to peek substring
  const peek = (idx: number, len: number) => s.slice(idx, idx + len);

  while (i < s.length) {
    // Look for `"value"` key start
    if (peek(i, 8) === '"value"') {
      out += '"value"';
      i += 8;

      // skip spaces and colon to the opening quote
      while (i < s.length && /\s|:/.test(s[i])) {
        out += s[i];
        i++;
      }

      if (s[i] === '"') {
        // enter value string, but we’ll escape inner " until we detect the end of this value
        out += '"';
        i++;

        let buf = "";
        let inEscape = false;

        // Read until we hit the END of value string,
        // which is a quote that is NOT escaped and is followed by
        //   , "<nextKey>":
        // or   } (end of object)
        while (i < s.length) {
          const ch = s[i];

          if (inEscape) {
            buf += ch;
            inEscape = false;
            i++;
            continue;
          }
          if (ch === "\\") {
            buf += ch;
            inEscape = true;
            i++;
            continue;
          }

          if (ch === '"') {
            // Tentatively an end. Look ahead to see if it’s followed by , "<key>": or } or ]
            // (allow whitespace)
            let j = i + 1;
            while (j < s.length && /\s/.test(s[j])) j++;
            const next = s[j];

            if (next === "," || next === "}" || next === "]") {
              // This is the end of the value string.
              // Escape any unescaped " and backslashes inside buf
              const escaped = buf.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
              out += escaped + '"';
              i++; // consume closing quote
              break;
            }
            // Otherwise it's an inner quote—keep it
            buf += ch;
            i++;
            continue;
          }

          buf += ch;
          i++;
        }
        continue;
      }
    }

    // default: copy through
    out += s[i];
    i++;
  }
  return out;
}

/** Join `{...}{...}` → `[ {...}, {...} ]` and convert single quotes to double if present. */
function normalizeContainers(raw: string): string {
  let s = raw.trim();

  // If it’s Python-ish single-quoted json, best-effort convert.
  if (s.includes(`'{`) || s.startsWith(`{'`) || /:\s*'/.test(s)) {
    s = s.replace(/'/g, `"`);
  }

  // If not array, but multiple objects back-to-back, join them.
  // (Only if we see at least two top-level object starts)
  const countTopLevelBraces = (t: string) => (t.match(/{/g) || []).length;
  if (!s.startsWith("[") && countTopLevelBraces(s) > 1) {
    s = s.replace(/}\s*{/g, "},{");
    s = `[${s}]`;
  }

  // If it’s single object, still OK to wrap to unify handling.
  if (!s.startsWith("[") && s.startsWith("{") && s.endsWith("}")) {
    s = `[${s}]`;
  }

  return s;
}

/** Extract `type:key=` prefix from value, if present. */
export function extractTypeKeyFromValue(value: string) {
  // Accept letters/underscore for type; key is up to '=' and not whitespace
  const m = value.match(/^\s*([A-Za-z_]+)\s*:\s*([^=\s]+)\s*=\s*([\s\S]*)$/);
  if (!m) return null;
  const [, typeRaw, keyRaw, rest] = m;
  return { type: typeRaw.trim(), key: keyRaw.trim(), value: rest.trim() };
}

/** Fix paths like `//app` → `/app` but leave `http://` alone. */
export function tidyPath(p?: string) {
  if (!p) return p;
  // collapse leading '//' not preceded by protocol
  if (/^\/\//.test(p) && !/^https?:\/\//i.test(p))
    return p.replace(/^\/+/, "/");
  return p;
}

export function parseAnswers(raw: string) {
  // 1) unwrap double-encoded if needed
  let s = unwrapIfDoubleEncoded(raw);

  // 2) container normalize
  s = normalizeContainers(s);

  // 3) escape nested quotes inside "value"
  s = escapeNestedQuotesInValue(s);

  // 4) parse JSON
  const parsed = JSON.parse(s);
  const arr = Array.isArray(parsed) ? parsed : [parsed];

  // 5) enrich & clean
  return arr.map(
    (item: { type?: string; key?: string; value?: string; path?: string }) => {
      let { type, key, value, path } = item ?? {};

      // recover from value prefix "type:key="
      if ((!type || !key) && typeof value === "string") {
        const tk = extractTypeKeyFromValue(value);
        if (tk) {
          type = type ?? tk.type;
          key = key ?? tk.key;
          value = tk.value;
        }
      }

      // Final fallbacks
      if (!type) type = "text";
      if (!key) key = "unknown";
      if (typeof value !== "string") value = String(value ?? "");

      // path cleanup
      path = tidyPath(path ?? "");

      return { type, key, value, path };
    }
  );
}

export function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "Completed":
      return "default";
    case "Failed":
      return "destructive";
    case "Running":
      return "secondary";
    case "Pending":
      return "outline";
    default:
      return "outline";
  }
}
