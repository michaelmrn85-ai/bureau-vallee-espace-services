const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const configPath = process.argv[2] || path.join(__dirname, "config.json");

function readConfig() {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration introuvable: ${configPath}`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!config.baseUrl) throw new Error("baseUrl manquant dans la configuration.");
  if (!config.station) throw new Error("station manquant dans la configuration.");
  if (!config.token) throw new Error("token manquant dans la configuration.");
  if (!config.printerName) throw new Error("printerName manquant dans la configuration.");
  if (!config.sumatraPath) throw new Error("sumatraPath manquant dans la configuration.");
  return {
    pollMs: 2500,
    keepPrintedFiles: false,
    ...config,
    baseUrl: config.baseUrl.replace(/\/$/, ""),
  };
}

function safeName(name) {
  return String(name || "document.pdf").replace(/[\\/:*?"<>|]/g, "-");
}

function printSettings(settings = {}) {
  const parts = [];

  // Canon imageFORCE C5140 : en mode couleur/auto, on laisse le pilote decider.
  // Si on envoie "color", le pilote peut forcer une sortie couleur.
  const colorMode = String(settings.colorMode || settings.color || settings.modeCouleur || "auto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const forceNoirEtBlanc =
    colorMode.includes("noir") ||
    colorMode.includes("black") ||
    colorMode.includes("mono") ||
    colorMode.includes("gris") ||
    colorMode.includes("gray") ||
    colorMode === "nb" ||
    colorMode === "n&b" ||
    colorMode === "bw";
  if (forceNoirEtBlanc) parts.push("monochrome");

  if (settings.duplex === "recto-verso-long") parts.push("duplexlong");
  else if (settings.duplex === "recto-verso-court") parts.push("duplexshort");
  else parts.push("simplex");
  parts.push(`paper=${settings.paperSize || "A4"}`);
  parts.push(settings.scaling === "taille-reelle" ? "noscale" : "fit");
  if (settings.orientation === "portrait") parts.push("portrait");
  if (settings.orientation === "paysage") parts.push("landscape");
  if (settings.pageRange) parts.push(settings.pageRange);
  parts.push(`${Math.max(1, Number.parseInt(settings.copies, 10) || 1)}x`);
  return parts.join(",");
}

async function api(config, route, options = {}) {
  const response = await fetch(`${config.baseUrl}${route}`, {
    ...options,
    headers: {
      "x-print-agent-token": config.token,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Erreur serveur ${response.status}`);
  return payload;
}

async function downloadFile(url, targetPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Telechargement impossible: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(targetPath, bytes);
}

function runSumatra(config, filePath, settings) {
  return new Promise((resolve, reject) => {
    const args = [
      "-print-to",
      config.printerName,
      "-silent",
      "-print-settings",
      printSettings(settings),
      filePath,
    ];
    const child = spawn(config.sumatraPath, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `SumatraPDF a retourne le code ${code}`));
    });
  });
}

async function markStatus(config, requestId, status, error = "") {
  await api(config, `/api/print-agent/requests/${requestId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ station: config.station, status, error }),
  });
}

async function handleRequest(config, request) {
  const workDir = path.join(os.tmpdir(), "bureau-vallee-print-agent", config.station);
  fs.mkdirSync(workDir, { recursive: true });
  const filePath = path.join(workDir, `${request.code}-${request.requestId}-${safeName(request.fileName)}`);
  console.log(`[${new Date().toLocaleTimeString()}] Impression ${request.code} - ${request.fileName}`);
  console.log(`Reglages: ${request.settingsLabel}`);
  try {
    await downloadFile(request.fileUrl, filePath);
    await runSumatra(config, filePath, request.settings);
    await markStatus(config, request.requestId, "done");
    if (!config.keepPrintedFiles) fs.rmSync(filePath, { force: true });
    console.log("Impression envoyee au copieur.");
  } catch (error) {
    await markStatus(config, request.requestId, "failed", error.message).catch(() => {});
    console.error(`Erreur impression: ${error.message}`);
  }
}

async function loop() {
  const config = readConfig();
  console.log(`Agent Bureau Vallee demarre pour ${config.station}`);
  console.log(`Copieur Windows: ${config.printerName}`);
  for (;;) {
    try {
      const payload = await api(config, `/api/print-agent/next?station=${encodeURIComponent(config.station)}`);
      if (payload.requestId) await handleRequest(config, payload);
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollMs));
  }
}

loop().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
