const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = Number(process.env.PORT) || 3100;
const DATA_DIR = path.join(__dirname, "data");
const JOBS_DIR = path.join(DATA_DIR, "jobs");
const STATIONS_FILE = path.join(DATA_DIR, "stations.json");
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const JOB_TTL_MS = 60 * 60 * 1000;

const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"]);

fs.mkdirSync(JOBS_DIR, { recursive: true });

const upload = multer({
  dest: path.join(DATA_DIR, "tmp"),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
  },
  fileFilter: (request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      callback(new Error("Format de fichier non accepte."));
      return;
    }
    callback(null, true);
  },
});

app.use(express.json());
app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }
  next();
});
app.get("/", (request, response) => {
  response.sendFile(path.join(__dirname, "portal.html"));
});

app.get("/admin", (request, response) => {
  response.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/sessions", (request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

app.get("/upload", (request, response) => {
  response.sendFile(path.join(__dirname, "upload.html"));
});

app.get("/poste-1", (request, response) => {
  response.sendFile(path.join(__dirname, "windows-builds", "POSTE-COPIEUR-1", "index.html"));
});

app.get("/poste-2", (request, response) => {
  response.sendFile(path.join(__dirname, "windows-builds", "POSTE-COPIEUR-2", "index.html"));
});

app.use(express.static(__dirname));

function readStations() {
  if (!fs.existsSync(STATIONS_FILE)) {
    return { stations: {}, commands: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(STATIONS_FILE, "utf8"));
  } catch (error) {
    return { stations: {}, commands: {} };
  }
}

function writeStations(data) {
  fs.writeFileSync(STATIONS_FILE, JSON.stringify(data, null, 2));
}

function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function metadataPath(code) {
  return path.join(JOBS_DIR, code, "job.json");
}

function readJob(code) {
  const filePath = metadataPath(code);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJob(job) {
  fs.writeFileSync(metadataPath(job.code), JSON.stringify(job, null, 2));
}

function deleteJob(code) {
  const directory = path.join(JOBS_DIR, code);
  if (fs.existsSync(directory)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function publicJob(job) {
  return {
    code: job.code,
    customerName: job.customerName,
    createdAt: job.createdAt,
    expiresAt: job.expiresAt,
    files: job.files.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      extension: file.extension.replace(".", ""),
      size: file.size,
      downloadUrl: `/api/jobs/${job.code}/files/${file.id}`,
    })),
  };
}

function cleanupExpiredJobs() {
  const now = Date.now();
  for (const code of fs.readdirSync(JOBS_DIR)) {
    const job = readJob(code);
    if (!job || new Date(job.expiresAt).getTime() <= now) {
      deleteJob(code);
    }
  }
}

function reserveCode() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = generateCode();
    const directory = path.join(JOBS_DIR, code);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
      return code;
    }
  }
  throw new Error("Impossible de creer un code disponible.");
}

app.get("/health", (request, response) => {
  response.json({ ok: true });
});

app.get("/api/stations", (request, response) => {
  const data = readStations();
  response.json({
    stations: Object.values(data.stations || {}),
  });
});

app.post("/api/stations/:stationId/session", (request, response) => {
  const data = readStations();
  data.stations = data.stations || {};
  data.stations[request.params.stationId] = {
    ...request.body,
    stationId: request.params.stationId,
    updatedAt: new Date().toISOString(),
  };
  writeStations(data);
  response.json({ ok: true });
});

app.get("/api/stations/:stationId/command", (request, response) => {
  const data = readStations();
  response.json((data.commands || {})[request.params.stationId] || null);
});

app.post("/api/stations/:stationId/command", (request, response) => {
  const data = readStations();
  data.commands = data.commands || {};
  data.commands[request.params.stationId] = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: request.body.type,
    stationId: request.params.stationId,
    createdAt: new Date().toISOString(),
  };
  writeStations(data);
  response.json(data.commands[request.params.stationId]);
});

app.post("/api/jobs", upload.array("files", 10), (request, response, next) => {
  try {
    if (!request.files?.length) {
      response.status(400).json({ error: "Ajoutez au moins un fichier." });
      return;
    }

    const code = reserveCode();
    const directory = path.join(JOBS_DIR, code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + JOB_TTL_MS);

    const files = request.files.map((file, index) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const id = `${Date.now()}-${index}`;
      const storedName = `${id}${extension}`;
      fs.renameSync(file.path, path.join(directory, storedName));
      return {
        id,
        originalName: file.originalname,
        storedName,
        extension,
        size: file.size,
      };
    });

    const job = {
      code,
      customerName: String(request.body.customerName || "").trim(),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      files,
    };

    writeJob(job);
    response.status(201).json(publicJob(job));
  } catch (error) {
    next(error);
  }
});

app.get("/api/jobs/:code", (request, response) => {
  const code = request.params.code;
  const job = readJob(code);
  if (!job) {
    response.status(404).json({ error: "Code introuvable ou expire." });
    return;
  }

  if (new Date(job.expiresAt).getTime() <= Date.now()) {
    deleteJob(code);
    response.status(404).json({ error: "Code expire." });
    return;
  }

  response.json(publicJob(job));
});

app.get("/api/jobs/:code/files/:fileId", (request, response) => {
  const job = readJob(request.params.code);
  if (!job) {
    response.status(404).json({ error: "Code introuvable." });
    return;
  }

  const file = job.files.find((item) => item.id === request.params.fileId);
  if (!file) {
    response.status(404).json({ error: "Fichier introuvable." });
    return;
  }

  response.download(path.join(JOBS_DIR, job.code, file.storedName), file.originalName);
});

app.delete("/api/jobs/:code", (request, response) => {
  deleteJob(request.params.code);
  response.json({ ok: true });
});

app.use((error, request, response, next) => {
  for (const file of request.files || []) {
    if (file.path && fs.existsSync(file.path)) fs.rmSync(file.path, { force: true });
  }
  response.status(400).json({ error: error.message || "Operation impossible." });
});

cleanupExpiredJobs();
setInterval(cleanupExpiredJobs, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Bureau Vallee Espace Services pret sur le port ${PORT}`);
});
