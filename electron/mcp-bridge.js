// stdio-мост: агент (Claude Desktop, Cursor…) запускает этот скрипт как
// MCP-сервер со stdio-транспортом, а мост пересылает JSON-RPC в Волну
// по http://127.0.0.1:<порт>/mcp. Зависимостей нет — запускается системным node.
//
// Порт берётся из переменной окружения VOLNA_MCP_PORT, иначе ищется файл
// %APPDATA%/<Волна|volna-player>/mcp.json, куда плеер пишет фактический порт.
const http = require("http");
const path = require("path");
const fs = require("fs");

function findPort() {
  if (process.env.VOLNA_MCP_PORT) return Number(process.env.VOLNA_MCP_PORT);
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming");
  const candidates = [process.env.VOLNA_MCP_FILE, path.join(appData, "Волна", "mcp.json"), path.join(appData, "volna-player", "mcp.json")];
  for (const file of candidates) {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Number.isFinite(data.port)) return data.port;
    } catch {
      /* следующая попытка */
    }
  }
  return null;
}

const PORT = findPort();
if (!PORT) {
  process.stderr.write(
    "[volna-mcp] Не удалось найти порт Волны.\n" +
      "Запустите плеер Волна, либо укажите порт вручную:\n  set VOLNA_MCP_PORT=57624\n"
  );
  process.exit(1);
}

function postMcp(body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body), "utf8");
    const req = http.request(
      { host: "127.0.0.1", port: PORT, path: "/mcp", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": data.length } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
            return;
          }
          resolve(text);
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(120000, () => req.destroy(new Error("timeout")));
    req.end(data);
  });
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (line) dispatch(line);
  }
});
process.stdin.on("end", () => process.exit(0));

async function dispatch(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return; // мусорную строку молча игнорируем
  }
  try {
    const reply = await postMcp(msg);
    if (reply && reply !== "null") process.stdout.write(reply.trim() + "\n");
  } catch (err) {
    // Плеер не запущен / перезапускается — отвечаем JSON-RPC-ошибкой по каждому запросу
    const requests = Array.isArray(msg) ? msg : [msg];
    for (const m of requests) {
      if (m && m.id !== undefined && m.id !== null) {
        process.stdout.write(
          JSON.stringify({ jsonrpc: "2.0", id: m.id, error: { code: -32000, message: `Volna is not reachable on port ${PORT}: ${(err && err.message) || err}. Is the player running?` } }) + "\n"
        );
      }
    }
    process.stderr.write(`[volna-mcp] ${err}\n`);
  }
}
