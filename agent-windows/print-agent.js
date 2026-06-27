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

function selectedPages(totalPages, pageRange = "") {
  const total = Math.max(1, Number(totalPages) || 1);
  const cleanedRange = String(pageRange || "").trim();
  if (!cleanedRange) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = [];
  const seen = new Set();
  for (const segment of cleanedRange.split(",")) {
    const value = segment.trim();
    if (!value) continue;
    const match = value.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) continue;
    const start = Math.min(total, Math.max(1, Number.parseInt(match[1], 10)));
    const end = Math.min(total, Math.max(start, Number.parseInt(match[2] || match[1], 10)));
    for (let page = start; page <= end; page += 1) {
      if (!seen.has(page)) {
        seen.add(page);
        pages.push(page);
      }
    }
  }
  return pages.length ? pages : Array.from({ length: total }, (_, index) => index + 1);
}

function pagesToRange(pages) {
  const values = [...new Set((pages || []).map((page) => Number(page)).filter(Boolean))].sort((a, b) => a - b);
  const ranges = [];
  for (let index = 0; index < values.length; index += 1) {
    const start = values[index];
    let end = start;
    while (index + 1 < values.length && values[index + 1] === end + 1) {
      index += 1;
      end = values[index];
    }
    ranges.push(start === end ? String(start) : `${start}-${end}`);
  }
  return ranges.join(",");
}

function splitPrintSettingsForLargeJob(config, request) {
  const settings = request.settings || {};
  const pageCount = Number(request.pageCount) || 1;
  const chunkSize = Math.max(20, Number(config.largeJobChunkPages) || 50);
  const pages = selectedPages(pageCount, settings.pageRange);
  if (pages.length <= chunkSize || Number(settings.pagesPerSheet || 1) !== 1) return [settings];

  const chunks = [];
  for (let index = 0; index < pages.length; index += chunkSize) {
    chunks.push({
      ...settings,
      pageRange: pagesToRange(pages.slice(index, index + chunkSize)),
    });
  }
  return chunks;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    if (config.a3PrinterName) return config.a3PrinterName;
    return config.station === "poste-2" ? "Copieur 2 A3" : "Copieur 1 A3";
  }
  return config.printerName;
}

function existingFile(filePath) {
  return Boolean(filePath) && fs.existsSync(filePath);
}

function resolveSumatraPath(config) {
  const localAppData = process.env.LOCALAPPDATA || "";
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const userProfile = process.env.USERPROFILE || os.homedir();
  const candidates = [
    config.sumatraPath,
    path.join(localAppData, "SumatraPDF", "SumatraPDF.exe"),
    path.join(userProfile, "AppData", "Local", "SumatraPDF", "SumatraPDF.exe"),
    path.join(programFiles, "SumatraPDF", "SumatraPDF.exe"),
    path.join(programFilesX86, "SumatraPDF", "SumatraPDF.exe"),
  ];
  const foundPath = candidates.find(existingFile);
  if (foundPath) return foundPath;
  return config.sumatraPath || "SumatraPDF.exe";
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
    const sumatraPath = resolveSumatraPath(config);
    const args = [
      "-silent",
      "-print-settings",
      printSettings(settings),
      "-print-to",
      printerName,
      filePath,
    ];
    const child = spawn(sumatraPath, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(new Error(`SumatraPDF introuvable. Chemin teste: ${sumatraPath}. Installez SumatraPDF ou corrigez sumatraPath dans la configuration du poste.`));
        return;
      }
      reject(error);
    });
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

function extensionFromPath(filePath) {
  return path.extname(String(filePath || "")).toLowerCase();
}

function isAllowedUsbFile(filePath) {
  return [".pdf", ".png", ".jpg", ".jpeg", ".heic", ".heif", ".webp"].includes(extensionFromPath(filePath));
}

function pathIsInside(parent, child) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function listUsbRoots() {
  const roots = [];
  if (process.platform !== "win32") return roots;
  for (let code = 68; code <= 90; code += 1) {
    const rootPath = String.fromCharCode(code) + ":\\";
    try {
      if (!fs.existsSync(rootPath)) continue;
      const driveLetter = rootPath.slice(0, 2);
      roots.push({ name: "Cle USB " + driveLetter, path: rootPath });
    } catch (error) {}
  }
  return roots;
}

async function getUsbRoots() {
  if (process.platform !== "win32") return [];
  const script = `
    $logicalById = @{}
    Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } | ForEach-Object {
      $logicalById[$_.DeviceID] = $_
    }
    Get-CimInstance Win32_DiskDrive | Where-Object { $_.InterfaceType -eq "USB" -or $_.PNPDeviceID -like "USBSTOR*" } | ForEach-Object {
      $disk = $_
      Get-CimAssociatedInstance -InputObject $disk -Association Win32_DiskDriveToDiskPartition -ErrorAction SilentlyContinue | ForEach-Object {
        Get-CimAssociatedInstance -InputObject $_ -Association Win32_LogicalDiskToPartition -ErrorAction SilentlyContinue | ForEach-Object {
          $logicalById[$_.DeviceID] = $_
        }
      }
    }
    $logicalById.Values |
      Where-Object { $_.DeviceID -and (Test-Path ($_.DeviceID + "\\")) } |
      Sort-Object DeviceID |
      Select-Object DeviceID,VolumeName,VolumeSerialNumber,FileSystem,Size,FreeSpace,DriveType |
      ConvertTo-Json -Compress
  `;
  try {
    const output = await runPowerShellOutput(script);
    if (!output.trim() || output.trim() === "null") return [];
    const parsed = JSON.parse(output);
    const drives = Array.isArray(parsed) ? parsed : [parsed];
    const roots = drives
      .filter((drive) => drive && drive.DeviceID)
      .map((drive) => {
        const driveId = String(drive.DeviceID);
        const rootPath = driveId.endsWith("\\") ? driveId : driveId + "\\";
        const label = String(drive.VolumeName || "").trim();
        const identity = [drive.VolumeSerialNumber, drive.FileSystem, drive.Size].filter(Boolean).join("|");
        return {
          name: label ? label + " (" + rootPath + ")" : "Cle USB " + rootPath,
          path: rootPath,
          identity,
        };
      });
    return roots;
  } catch (error) {
    return listUsbRoots();
  }
}
function scanDirectory(rootPath, currentPath, rootName, tree, depth, maxDepth, maxEntries) {
  if (tree.length >= maxEntries || depth > maxDepth) return;
  let entries = [];
  try {
    entries = fs.readdirSync(currentPath, { withFileTypes: true });
  } catch (error) {
    return;
  }
  for (const entry of entries) {
    if (tree.length >= maxEntries) return;
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, entryPath);
    if (!relativePath || relativePath.startsWith("..")) continue;
    if (entry.isDirectory()) {
      tree.push({
        rootPath,
        rootName,
        parentPath: currentPath,
        relativePath,
        path: entryPath,
        name: entry.name,
        type: "directory",
        extension: "",
        size: 0,
      });
      scanDirectory(rootPath, entryPath, rootName, tree, depth + 1, maxDepth, maxEntries);
      continue;
    }
    if (!entry.isFile() || !isAllowedUsbFile(entryPath)) continue;
    let size = 0;
    try {
      size = fs.statSync(entryPath).size;
    } catch (error) {}
    tree.push({
      rootPath,
      rootName,
      parentPath: currentPath,
      relativePath,
      path: entryPath,
      name: entry.name,
      type: "file",
      extension: extensionFromPath(entry.name).replace(".", ""),
      size,
    });
  }
}

async function scanUsbDrives(config) {
  const roots = await getUsbRoots();
  const tree = [];
  const maxDepth = Math.max(2, Number(config.usbScanMaxDepth) || 8);
  const maxEntries = Math.max(100, Number(config.usbScanMaxEntries) || 2500);
  for (const root of roots) {
    scanDirectory(root.path, root.path, root.name, tree, 0, maxDepth, maxEntries);
  }
  return { roots, tree };
}

function resolveUsbEntry(rootPath, relativePath) {
  const root = path.resolve(rootPath);
  const target = path.resolve(rootPath, relativePath);
  if (target !== root && !pathIsInside(root, target)) {
    throw new Error("Chemin USB non autorise.");
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error("Fichier USB introuvable.");
  }
  if (!isAllowedUsbFile(target)) {
    throw new Error("Format USB non accepte.");
  }
  return target;
}

async function uploadUsbSelection(config, command) {
  const formData = new FormData();
  const fields = command.fields || {};
  Object.entries(fields).forEach(([key, value]) => formData.set(key, String(value ?? "")));
  formData.set("station", fields.station || config.station);
  formData.set("source", "usb");

  for (const entry of command.entries || []) {
    const filePath = resolveUsbEntry(entry.rootPath, entry.relativePath);
    const bytes = fs.readFileSync(filePath);
    formData.append("files", new Blob([bytes]), path.basename(filePath));
  }

  const route = command.code ? `/api/jobs/${command.code}/files` : "/api/jobs";
  const response = await fetch(`${config.baseUrl}${route}`, {
    method: "POST",
    headers: { "x-print-agent-token": config.token },
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Import USB impossible: ${response.status}`);
  return payload;
}

function runPowerShellOutput(script) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
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


function encodeSnmpLength(length) {
  if (length < 128) return Buffer.from([length]);
  const bytes = [];
  let value = length;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function encodeSnmpTlv(type, value) {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return Buffer.concat([Buffer.from([type]), encodeSnmpLength(body.length), body]);
}

function encodeSnmpInteger(value) {
  let number = Math.max(0, Number(value) || 0);
  const bytes = [];
  do {
    bytes.unshift(number & 0xff);
    number >>= 8;
  } while (number > 0);
  if (bytes[0] & 0x80) bytes.unshift(0);
  return encodeSnmpTlv(0x02, Buffer.from(bytes));
}

function encodeSnmpOid(oid) {
  const parts = String(oid || "").split(".").filter(Boolean).map((part) => Number(part));
  if (parts.length < 2) throw new Error(`OID invalide: ${oid}`);
  const bytes = [parts[0] * 40 + parts[1]];
  for (const part of parts.slice(2)) {
    const stack = [part & 0x7f];
    let value = part >> 7;
    while (value > 0) {
      stack.unshift((value & 0x7f) | 0x80);
      value >>= 7;
    }
    bytes.push(...stack);
  }
  return encodeSnmpTlv(0x06, Buffer.from(bytes));
}

function readSnmpLength(buffer, offset) {
  let length = buffer[offset++];
  if (length & 0x80) {
    const count = length & 0x7f;
    length = 0;
    for (let index = 0; index < count; index += 1) length = (length << 8) | buffer[offset++];
  }
  return { length, offset };
}

function readSnmpIntegerValue(buffer, offset, length) {
  let value = 0;
  for (let index = 0; index < length; index += 1) value = (value << 8) | buffer[offset + index];
  return value >>> 0;
}

function decodeSnmpFirstInteger(buffer) {
  for (let offset = 0; offset < buffer.length - 2; offset += 1) {
    const type = buffer[offset];
    if (![0x02, 0x41, 0x42, 0x43, 0x46].includes(type)) continue;
    const lengthInfo = readSnmpLength(buffer, offset + 1);
    if (lengthInfo.length <= 0 || lengthInfo.length > 8) continue;
    if (lengthInfo.offset + lengthInfo.length > buffer.length) continue;
    const value = readSnmpIntegerValue(buffer, lengthInfo.offset, lengthInfo.length);
    if (value > 0) return value;
  }
  return null;
}

function snmpGet(host, oid, options = {}) {
  if (!host || !oid) return Promise.resolve(null);
  const dgram = require("dgram");
  const community = options.community || "public";
  const timeoutMs = Math.max(500, Number(options.timeoutMs) || 2500);
  const port = Math.max(1, Number(options.port) || 161);
  const requestId = Math.floor(Math.random() * 0x7fffffff);
  const varBind = encodeSnmpTlv(0x30, Buffer.concat([encodeSnmpOid(oid), encodeSnmpTlv(0x05, Buffer.alloc(0))]));
  const varBindList = encodeSnmpTlv(0x30, varBind);
  const pdu = encodeSnmpTlv(0xa0, Buffer.concat([
    encodeSnmpInteger(requestId),
    encodeSnmpInteger(0),
    encodeSnmpInteger(0),
    varBindList,
  ]));
  const packet = encodeSnmpTlv(0x30, Buffer.concat([
    encodeSnmpInteger(1),
    encodeSnmpTlv(0x04, Buffer.from(community)),
    pdu,
  ]));

  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      socket.close();
      resolve(null);
    }, timeoutMs);
    socket.on("message", (message) => {
      clearTimeout(timer);
      socket.close();
      resolve(decodeSnmpFirstInteger(message));
    });
    socket.on("error", () => {
      clearTimeout(timer);
      socket.close();
      resolve(null);
    });
    socket.send(packet, port, host, (error) => {
      if (error) {
        clearTimeout(timer);
        socket.close();
        resolve(null);
      }
    });
  });
}

function printerCounterHost(config, settings = {}) {
  if (settings.paperSize === "A3" && config.a3PrinterCounterHost) return config.a3PrinterCounterHost;
  return config.printerCounterHost || config.printerIp || "";
}

async function readPrinterCounters(config, settings = {}) {
  const counterConfig = config.printerCounters || {};
  if (counterConfig.enabled === false) return null;
  const host = printerCounterHost(config, settings);
  if (!host) return null;
  const options = {
    community: counterConfig.community || config.snmpCommunity || "public",
    timeoutMs: counterConfig.timeoutMs || 2500,
    port: counterConfig.port || 161,
  };
  const oids = {
    total: counterConfig.totalOid || "1.3.6.1.2.1.43.10.2.1.4.1.1",
    bw: counterConfig.bwOid || "",
    color: counterConfig.colorOid || "",
  };
  const [total, bw, color] = await Promise.all([
    snmpGet(host, oids.total, options),
    oids.bw ? snmpGet(host, oids.bw, options) : Promise.resolve(null),
    oids.color ? snmpGet(host, oids.color, options) : Promise.resolve(null),
  ]);
  return { host, total, bw, color, capturedAt: new Date().toISOString() };
}

function counterDelta(before, after, settings = {}) {
  if (!before || !after) return null;
  const totalDelta = Math.max(0, Number(after.total || 0) - Number(before.total || 0));
  const bwDelta = before.bw != null && after.bw != null ? Math.max(0, Number(after.bw) - Number(before.bw)) : null;
  const colorDelta = before.color != null && after.color != null ? Math.max(0, Number(after.color) - Number(before.color)) : null;
    const hasSplit = bwDelta != null || colorDelta != null;
  return {
    host: after.host || before.host,
    before,
    after,
    totalPages: totalDelta,
    bwPages: hasSplit ? (bwDelta || 0) : 0,
    colorPages: hasSplit ? (colorDelta || 0) : 0,
    mode: hasSplit ? "snmp-color-split" : "snmp-total-only",
  };
}

async function capturePrinterCounterDelta(config, settings, before) {
  if (!before) return null;
  const waitMs = Math.max(0, Number(config.printerCounterSettleMs ?? config.printerCounters?.settleMs ?? 15000));
  const maxWaitMs = Math.max(waitMs, Number(config.printerCounterMaxWaitMs ?? config.printerCounters?.maxWaitMs ?? 120000));
  const pollMs = Math.max(1000, Number(config.printerCounterPollMs ?? config.printerCounters?.pollMs ?? 5000));
  if (waitMs) await wait(waitMs);
  const deadline = Date.now() + maxWaitMs;
  let best = null;
  while (Date.now() <= deadline) {
    const after = await readPrinterCounters(config, settings);
    const delta = counterDelta(before, after, settings);
    if (delta) {
      best = delta;
      if (delta.totalPages > 0 || delta.bwPages > 0 || delta.colorPages > 0) return delta;
    }
    await wait(pollMs);
  }
  return best;
}
async function markStatus(config, requestId, status, error = "", actualCounters = null) {
  await api(config, `/api/print-agent/requests/${requestId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ station: config.station, status, error, actualCounters }),
  });
}

async function markCommandStatus(config, commandId, status, error = "", result = undefined) {
  await api(config, `/api/print-agent/commands/${commandId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ station: config.station, status, error, result }),
  });
}

async function handleCommand(config, command) {
  if (!command) return;
  console.log(`[${new Date().toLocaleTimeString()}] Commande ${command.type}.`);
  try {
    let result;
    if (command.type === "eject-usb") await ejectUsbDrives();
    else if (command.type === "usb-scan") result = await scanUsbDrives(config);
    else if (command.type === "usb-import") result = { job: await uploadUsbSelection(config, command) };
    else if (command.type === "open-webmail") await openWebmail(config, command.url);
    else if (command.type === "cleanup-browser") await cleanupBrowserSession(config);
    else if (command.type === "shutdown-station" || command.type === "restart-station") await runPowerCommand(command.type);
    else return;
    await markCommandStatus(config, command.id, "done", "", result);
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
  let printerCounterBefore = null;
  let actualCounters = null;
  try {
    printerCounterBefore = await readPrinterCounters(config, request.settings);
    if (printerCounterBefore?.total != null) console.log(`Compteur copieur avant: ${printerCounterBefore.total}`);
  } catch (error) {
    console.warn(`Compteur copieur indisponible avant impression: ${error.message}`);
  }
  try {
    await downloadFile(request.fileUrl, filePath);
    try {
      await applyPrinterConfiguration(config, request.settings);
      console.log(`Configuration pilote: ${request.settings.paperSize || "A4"} / ${duplexMode(request.settings)}`);
    } catch (error) {
      console.warn(`Configuration pilote ignoree: ${error.message}`);
    }
    const chunks = splitPrintSettingsForLargeJob(config, request);
    if (chunks.length > 1) {
      console.log(`Grande impression detectee: decoupage en ${chunks.length} lots.`);
    }
    for (let index = 0; index < chunks.length; index += 1) {
      const chunkSettings = chunks[index];
      if (chunks.length > 1) {
        console.log(`Lot ${index + 1}/${chunks.length}: pages ${chunkSettings.pageRange}`);
      }
      await runSumatra(config, filePath, chunkSettings);
      if (index + 1 < chunks.length) {
        await wait(Math.max(1000, Number(config.largeJobDelayMs) || 8000));
      }
    }
    actualCounters = await capturePrinterCounterDelta(config, request.settings, printerCounterBefore);
    if (actualCounters?.totalPages != null) console.log(`Sortie reelle copieur: ${actualCounters.totalPages} page(s).`);
    await markStatus(config, request.requestId, "done", "", actualCounters);
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




