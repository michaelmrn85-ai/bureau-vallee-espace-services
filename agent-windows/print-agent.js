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

function powerShellString(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function webmailProfileDir(config) {
  return path.join(os.tmpdir(), "bureau-vallee-webmail", config.station);
}

function runPowerCommand(mode) {
  return new Promise((resolve, reject) => {
    const args = mode === "restart-station" ? ["/r", "/t", "0"] : ["/s", "/t", "0"];
    const child = spawn("shutdown.exe", args, { windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`shutdown.exe a retourne le code ${code}`));
    });
  });
}

function isBlackAndWhite(settings = {}) {
  const colorMode = String(settings.colorMode || settings.color || settings.modeCouleur || "auto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    colorMode.includes("noir") ||
    colorMode.includes("black") ||
    colorMode.includes("mono") ||
    colorMode.includes("gris") ||
    colorMode.includes("gray") ||
    colorMode === "nb" ||
    colorMode === "n&b" ||
    colorMode === "bw"
  );
}

function duplexMode(settings = {}) {
  if (settings.duplex === "recto-verso-long") return "TwoSidedLongEdge";
  if (settings.duplex === "recto-verso-court") return "TwoSidedShortEdge";
  return "OneSided";
}

function printerNameForRequest(config, settings = {}) {
  if (settings.paperSize === "A3") {
    return config.station === "poste-2" ? "Copieur 2 A3" : "Copieur 1 A3";
  }
  return config.printerName;
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
    const printerName = printerNameForRequest(config, settings);
    const args = [
      "-silent",
      "-print-settings",
      printSettings(settings),
      "-print-to",
      printerName,
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

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `PowerShell a retourne le code ${code}`));
    });
  });
}

async function ejectUsbDrives() {
  const script = `
    $shell = New-Object -ComObject Shell.Application
    $drives = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=2"
    foreach ($drive in $drives) {
      $item = $shell.Namespace(17).ParseName($drive.DeviceID + "\\")
      if ($item -ne $null) { $item.InvokeVerb("Eject") }
    }
  `;
  await runPowerShell(script);
}

async function cleanupBrowserSession(config) {
  const profileDir = webmailProfileDir(config);
  const script = `
    $profile = ${powerShellString(profileDir)}
    Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" |
      Where-Object { $_.CommandLine -like "*$profile*" } |
      ForEach-Object {
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
      }
    Start-Sleep -Milliseconds 500
    if (Test-Path $profile) {
      Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue
    }
  `;
  await runPowerShell(script);
}

async function openWebmail(config, url) {
  await cleanupBrowserSession(config);
  const profileDir = webmailProfileDir(config);
  const chromePath = config.chromePath || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const fallbackChromePath = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
  const script = `
    $chrome = ${powerShellString(chromePath)}
    if (!(Test-Path $chrome)) { $chrome = ${powerShellString(fallbackChromePath)} }
    if (!(Test-Path $chrome)) { throw "Chrome introuvable" }
    $profile = ${powerShellString(profileDir)}
    New-Item -ItemType Directory -Force -Path $profile | Out-Null
    Start-Process -FilePath $chrome -ArgumentList @(
      "--app=${url}",
      "--user-data-dir=$profile",
      "--no-first-run",
      "--disable-sync",
      "--disable-translate",
      "--disable-features=Translate"
    )
  `;
  await runPowerShell(script);
}

async function applyPrinterConfiguration(config, settings = {}) {
  const paperSize = ["A3", "A4", "A5"].includes(settings.paperSize) ? settings.paperSize : "A4";
  const color = isBlackAndWhite(settings) ? "$false" : "$true";
  const duplex = duplexMode(settings);
  const printerName = printerNameForRequest(config, settings);
  const script = `
    try {
      Set-PrintConfiguration -PrinterName ${powerShellString(printerName)} -PaperSize ${paperSize} -Color ${color} -DuplexingMode ${duplex} -ErrorAction Stop
    } catch {
      Write-Error $_.Exception.Message
      exit 1
    }
  `;
  await runPowerShell(script);
}

async function markStatus(config, requestId, status, error = "") {
  await api(config, `/api/print-agent/requests/${requestId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ station: config.station, status, error }),
  });
}

async function markCommandStatus(config, commandId, status, error = "") {
  await api(config, `/api/print-agent/commands/${commandId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ station: config.station, status, error }),
  });
}

async function handleCommand(config, command) {
  if (!command) return;
  console.log(`[${new Date().toLocaleTimeString()}] Commande ${command.type}.`);
  try {
    if (command.type === "eject-usb") await ejectUsbDrives();
    else if (command.type === "open-webmail") await openWebmail(config, command.url);
    else if (command.type === "cleanup-browser") await cleanupBrowserSession(config);
    else if (command.type === "shutdown-station" || command.type === "restart-station") await runPowerCommand(command.type);
    else return;
    await markCommandStatus(config, command.id, "done");
    console.log("Commande terminee.");
  } catch (error) {
    await markCommandStatus(config, command.id, "failed", error.message).catch(() => {});
    console.error(`Erreur commande: ${error.message}`);
  }
}

async function handleRequest(config, request) {
  const workDir = path.join(os.tmpdir(), "bureau-vallee-print-agent", config.station);
  fs.mkdirSync(workDir, { recursive: true });
  const filePath = path.join(workDir, `${request.code}-${request.requestId}-${safeName(request.printFileName || request.fileName)}`);
  console.log(`[${new Date().toLocaleTimeString()}] Impression ${request.code} - ${request.fileName}`);
  console.log(`Reglages: ${request.settingsLabel}`);
  console.log(`Copieur cible: ${printerNameForRequest(config, request.settings)}`);
  try {
    await downloadFile(request.fileUrl, filePath);
    try {
      await applyPrinterConfiguration(config, request.settings);
      console.log(`Configuration pilote: ${request.settings.paperSize || "A4"} / ${duplexMode(request.settings)}`);
    } catch (error) {
      if (request.settings?.paperSize === "A3") {
        throw new Error(`Configuration A3 impossible dans le pilote Windows: ${error.message}`);
      }
      console.warn(`Configuration pilote ignoree: ${error.message}`);
    }
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
      const commandPayload = await api(config, `/api/print-agent/commands/next?station=${encodeURIComponent(config.station)}`);
      if (commandPayload.command) await handleCommand(config, commandPayload.command);
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
