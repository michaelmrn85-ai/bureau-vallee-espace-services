const station = window.location.pathname.includes("poste-2") ? "poste-2" : "poste-1";
const brandTitle = document.getElementById("brand-title");
const stationLabel = document.getElementById("station-label");
const digitalClock = document.getElementById("digital-clock");
const languageButtons = document.querySelectorAll("[data-lang]");
const homeScreen = document.getElementById("home-screen");
const printScreen = document.getElementById("print-screen");
const usbButton = document.getElementById("usb-button");
const qrButton = document.getElementById("qr-button");
const mailButton = document.getElementById("mail-button");
const usbFiles = document.getElementById("usb-files");
const usbExplorerModal = document.getElementById("usb-explorer-modal");
const closeUsbExplorer = document.getElementById("close-usb-explorer");
const usbRootSelect = document.getElementById("usb-root-select");
const usbUp = document.getElementById("usb-up");
const usbRefresh = document.getElementById("usb-refresh");
const usbCurrentPath = document.getElementById("usb-current-path");
const usbEntryList = document.getElementById("usb-entry-list");
const usbSelectedCount = document.getElementById("usb-selected-count");
const usbConfirmSelection = document.getElementById("usb-confirm-selection");
const statusMessage = document.getElementById("status-message");
const jobCode = document.getElementById("job-code");
const documentCount = document.getElementById("document-count");
const documentList = document.getElementById("document-list");
const previewBox = document.getElementById("preview-box");
const previewPages = document.getElementById("preview-pages");
const printButton = document.getElementById("print-button");
const printStatus = document.getElementById("print-status");
const printModal = document.getElementById("print-modal");
const printSteps = document.getElementById("print-steps");
const printProgressText = document.getElementById("print-progress-text");
const loadingModal = document.getElementById("loading-modal");
const loadingTitle = document.getElementById("loading-title");
const loadingText = document.getElementById("loading-text");
const infoModal = document.getElementById("info-modal");
const infoTitle = document.getElementById("info-title");
const infoText = document.getElementById("info-text");
const closeInfo = document.getElementById("close-info");
const infoOk = document.getElementById("info-ok");
const backHome = document.getElementById("back-home");
const addMoreFiles = document.getElementById("add-more-files");
const ejectUsbButton = document.getElementById("eject-usb");
const endSessionButton = document.getElementById("end-session");
const copiesInput = document.getElementById("copies");
const pageRangeInput = document.getElementById("page-range");
const orientationGroup = document.getElementById("orientation-group");
const qrModal = document.getElementById("qr-modal");
const qrImage = document.getElementById("qr-image");
const uploadUrl = document.getElementById("upload-url");
const qrCodeInput = document.getElementById("qr-code-input");
const loadCode = document.getElementById("load-code");
const closeQr = document.getElementById("close-qr");
const copyUrl = document.getElementById("copy-url");
const mailModal = document.getElementById("mail-modal");
const closeMail = document.getElementById("close-mail");
const mailAddress = document.getElementById("mail-address");
const copyMail = document.getElementById("copy-mail");
const mailCodeInput = document.getElementById("mail-code-input");
const loadMailCode = document.getElementById("load-mail-code");
const mailWaitTimer = document.getElementById("mail-wait-timer");
const mailRecentList = document.getElementById("mail-recent-list");
const mailSelectStep = document.getElementById("mail-select-step");
const mailSelectTitle = document.getElementById("mail-select-title");
const mailSelectText = document.getElementById("mail-select-text");

const MAX_TOTAL_UPLOAD_SIZE_MB = 500;
const MAX_TOTAL_UPLOAD_SIZE = MAX_TOTAL_UPLOAD_SIZE_MB * 1024 * 1024;
const MAIL_WAIT_DURATION_MS = 2 * 60 * 1000;

let currentJob = null;
let selectedFileId = "";
let selectedFileIds = new Set();
let filePrintSettings = new Map();
let inactivityTimer = null;
let sessionCloseTimer = null;
let jobRefreshTimer = null;
let inactivityVisible = false;
let clockInterval = null;
let mailWaitInterval = null;
let mailWaitStartedAt = 0;
let mailRecentInterval = null;
let usbExplorerPath = "";
let usbExplorerParentPath = "";
let usbSelectedPaths = new Set();

const LANGUAGE_STORAGE_KEY = "bv-espace-services-language";
let currentLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || "fr";
const I18N = {
  fr: {
    station1: "Poste 1",
    station2: "Poste 2",
    brandTitle: "{station} - Espace Services",
    stationPrint: "Poste d'impression",
    welcomeTitle: "Comment souhaitez-vous envoyer vos documents ?",
    welcomeLead: "Choisissez une option pour commencer. Vos fichiers seront préparés avant impression afin d'éviter les erreurs.",
    wordWarning: "Les fichiers Word, DOC et DOCX ne sont pas acceptés sur les postes. Merci de vous rapprocher d'un vendeur ou d'une vendeuse.",
    usbTitle: "Impression via clé USB",
    usbSmall: "Insérez votre clé USB puis sélectionnez vos fichiers.",
    qrTitle: "Impression via QR Code",
    qrSmall: "Scannez le QR code avec votre téléphone pour envoyer vos fichiers.",
    mailTitle: "Envoi de fichiers par mail",
    mailSmall: "Envoyez vos pièces jointes à l'adresse du poste, puis ouvrez le dossier reçu.",
    home: "< Accueil",
    jobCode: "Code dossier",
    preparePrint: "Préparer l'impression",
    addFiles: "+ Ajouter des fichiers",
    ejectUsb: "Éjecter clé USB",
    endSession: "Fin de session",
    documents: "Documents",
    settings: "Configuration",
    paper: "Format papier",
    color: "Couleur",
    bw: "Noir et blanc",
    duplex: "Recto / verso",
    photoOrientation: "Orientation photo",
    orientationHelp: "Choisissez le sens d'impression du document.",
    orientationAuto: "Auto",
    orientationPortrait: "Portrait",
    orientationLandscape: "Paysage",
    simplex: "Recto",
    duplexLong: "Recto verso bord long",
    duplexShort: "Recto verso bord court",
    orientation: "Orientation",
    copies: "Nombre d'exemplaires",
    pages: "Pages à imprimer",
    allPages: "Toutes les pages",
    printSelection: "Imprimer la sélection",
    preview: "Aperçu",
    selectDocument: "Sélectionnez un document.",
    qrModalTitle: "Envoyer depuis votre téléphone",
    qrModalText: "Scannez ce QR code avec votre téléphone, puis ajoutez vos fichiers. Les gros envois peuvent prendre plus de temps. Les exports Canva en PDF, PNG ou JPEG sont acceptés.",
    codePhone: "Code reçu sur le téléphone",
    open: "Ouvrir",
    copy: "Copier",
    mailModalTitle: "Envoyer par mail",
    mailIntro: "Suivez les 3 étapes. Le code arrive dans votre boîte mail après réception des pièces jointes.",
    stepSend: "Envoyez vos fichiers",
    stepSendText: "Envoyez ou transférez vos fichiers en pièce jointe à cette adresse.",
    address: "Adresse du poste",
    stepWait: "Patientez",
    stepWaitText: "Le serveur récupère le mail et prépare le dossier d'impression.",
    advisedTime: "Temps conseillé",
    stepWaitSmall: "Vous pouvez saisir le code dès que vous le recevez.",
    stepCode: "Saisissez le code",
    stepCodeText: "Entrez le code reçu dans votre boîte mail pour ouvrir vos fichiers sur ce poste.",
    codeMail: "Code reçu par mail",
    mailLimit: "Les gros fichiers peuvent prendre plus de temps. Les exports Canva en PDF, PNG ou JPEG sont acceptés.",
    printInProgress: "Impression en cours",
    printWait: "Restez devant le poste : nous préparons et lançons vos documents au copieur.",
    stepPrepare: "Préparation du document",
    stepServer: "Envoi au serveur",
    stepQueue: "Mise en file d'attente",
    stepAgent: "Prise en charge par le poste",
    stepPrinter: "Impression lancée au copieur",
    loadingTitle: "Recherche en cours",
    loadingText: "Le serveur prépare votre demande.",
    information: "Information",
    ok: "OK"
  },
  en: {
    station1: "Station 1",
    station2: "Station 2",
    brandTitle: "{station} - Service Desk",
    stationPrint: "Print station",
    welcomeTitle: "How would you like to send your documents?",
    welcomeLead: "Choose an option to start. Your files will be prepared before printing to avoid mistakes.",
    wordWarning: "Word, DOC and DOCX files are not accepted on these stations. Please ask a sales assistant.",
    usbTitle: "Print from USB key",
    usbSmall: "Insert your USB key, then select your files.",
    qrTitle: "Print via QR Code",
    qrSmall: "Scan the QR code with your phone to send your files.",
    mailTitle: "Send files by email",
    mailSmall: "Send your attachments to the station address, then open the received folder.",
    home: "< Home",
    jobCode: "Folder code",
    preparePrint: "Prepare printing",
    addFiles: "+ Add files",
    ejectUsb: "Eject USB key",
    endSession: "End session",
    documents: "Documents",
    settings: "Settings",
    paper: "Paper size",
    color: "Color",
    bw: "Black and white",
    duplex: "Single / double-sided",
    photoOrientation: "Photo orientation",
    orientationHelp: "Choose the document print direction.",
    orientationAuto: "Auto",
    orientationPortrait: "Portrait",
    orientationLandscape: "Landscape",
    simplex: "Single-sided",
    duplexLong: "Double-sided long edge",
    duplexShort: "Double-sided short edge",
    orientation: "Orientation",
    copies: "Number of copies",
    pages: "Pages to print",
    allPages: "All pages",
    printSelection: "Print selection",
    preview: "Preview",
    selectDocument: "Select a document.",
    qrModalTitle: "Send from your phone",
    qrModalText: "Scan this QR code with your phone, then add your files. Large uploads may take longer. Canva exports in PDF, PNG or JPEG are accepted.",
    codePhone: "Code received on your phone",
    open: "Open",
    copy: "Copy",
    mailModalTitle: "Send by email",
    mailIntro: "Follow the 3 steps. The code arrives in your mailbox after the attachments are received.",
    stepSend: "Send your files",
    stepSendText: "Send or forward your files as attachments to this address.",
    address: "Station address",
    stepWait: "Please wait",
    stepWaitText: "The server retrieves the email and prepares the print folder.",
    advisedTime: "Suggested time",
    stepWaitSmall: "You can enter the code as soon as you receive it.",
    stepCode: "Enter the code",
    stepCodeText: "Enter the code received in your mailbox to open your files on this station.",
    codeMail: "Code received by email",
    mailLimit: "Large files may take longer. Canva exports in PDF, PNG or JPEG are accepted.",
    printInProgress: "Printing in progress",
    printWait: "Please stay near the station: your documents are being prepared and sent to the copier.",
    stepPrepare: "Preparing document",
    stepServer: "Sending to server",
    stepQueue: "Adding to queue",
    stepAgent: "Station is taking over",
    stepPrinter: "Printing started on copier",
    loadingTitle: "Searching",
    loadingText: "The server is preparing your request.",
    information: "Information",
    ok: "OK"
  },
  es: {
    station1: "Puesto 1",
    station2: "Puesto 2",
    brandTitle: "{station} - Servicios",
    stationPrint: "Puesto de impresión",
    welcomeTitle: "¿Cómo desea enviar sus documentos?",
    welcomeLead: "Elija una opción para empezar. Sus archivos se prepararán antes de imprimir para evitar errores.",
    wordWarning: "Los archivos Word, DOC y DOCX no se aceptan en estos puestos. Consulte a un vendedor o vendedora.",
    usbTitle: "Imprimir desde USB",
    usbSmall: "Inserte su memoria USB y seleccione sus archivos.",
    qrTitle: "Imprimir con código QR",
    qrSmall: "Escanee el código QR con su teléfono para enviar sus archivos.",
    mailTitle: "Enviar archivos por email",
    mailSmall: "Envíe sus adjuntos a la dirección del puesto y abra la carpeta recibida.",
    home: "< Inicio",
    jobCode: "Código de carpeta",
    preparePrint: "Preparar impresión",
    addFiles: "+ Añadir archivos",
    ejectUsb: "Expulsar USB",
    endSession: "Finalizar sesión",
    documents: "Documentos",
    settings: "Configuración",
    paper: "Tamaño de papel",
    color: "Color",
    bw: "Blanco y negro",
    duplex: "Una / doble cara",
    photoOrientation: "Orientación de foto",
    orientationHelp: "Elija el sentido de impresión del documento.",
    orientationAuto: "Auto",
    orientationPortrait: "Vertical",
    orientationLandscape: "Horizontal",
    simplex: "Una cara",
    duplexLong: "Doble cara borde largo",
    duplexShort: "Doble cara borde corto",
    orientation: "Orientación",
    copies: "Número de copias",
    pages: "Páginas a imprimir",
    allPages: "Todas las páginas",
    printSelection: "Imprimir selección",
    preview: "Vista previa",
    selectDocument: "Seleccione un documento.",
    qrModalTitle: "Enviar desde su teléfono",
    qrModalText: "Escanee este código QR con su teléfono y añada sus archivos. Los envíos pesados pueden tardar más. Se aceptan exportaciones Canva en PDF, PNG o JPEG.",
    codePhone: "Código recibido en el teléfono",
    open: "Abrir",
    copy: "Copiar",
    mailModalTitle: "Enviar por email",
    mailIntro: "Siga los 3 pasos. El código llega a su correo después de recibir los adjuntos.",
    stepSend: "Envíe sus archivos",
    stepSendText: "Envíe o reenvíe sus archivos adjuntos a esta dirección.",
    address: "Dirección del puesto",
    stepWait: "Espere",
    stepWaitText: "El servidor recupera el email y prepara la carpeta de impresión.",
    advisedTime: "Tiempo recomendado",
    stepWaitSmall: "Puede introducir el código en cuanto lo reciba.",
    stepCode: "Introduzca el código",
    stepCodeText: "Introduzca el código recibido por email para abrir sus archivos en este puesto.",
    codeMail: "Código recibido por email",
    mailLimit: "Los archivos pesados pueden tardar más. Se aceptan exportaciones Canva en PDF, PNG o JPEG.",
    printInProgress: "Impresión en curso",
    printWait: "Espere junto al puesto: sus documentos se preparan y se envían a la copiadora.",
    stepPrepare: "Preparando documento",
    stepServer: "Enviando al servidor",
    stepQueue: "Añadiendo a la cola",
    stepAgent: "El puesto toma el relevo",
    stepPrinter: "Impresión iniciada en la copiadora",
    loadingTitle: "Buscando",
    loadingText: "El servidor está preparando su solicitud.",
    information: "Información",
    ok: "OK"
  },
  de: {
    station1: "Station 1",
    station2: "Station 2",
    brandTitle: "{station} - Servicebereich",
    stationPrint: "Druckstation",
    welcomeTitle: "Wie möchten Sie Ihre Dokumente senden?",
    welcomeLead: "Wählen Sie eine Option. Ihre Dateien werden vor dem Drucken vorbereitet, um Fehler zu vermeiden.",
    wordWarning: "Word-, DOC- und DOCX-Dateien werden an diesen Stationen nicht akzeptiert. Bitte wenden Sie sich an das Verkaufsteam.",
    usbTitle: "Von USB-Stick drucken",
    usbSmall: "Stecken Sie Ihren USB-Stick ein und wählen Sie Ihre Dateien.",
    qrTitle: "Per QR-Code drucken",
    qrSmall: "Scannen Sie den QR-Code mit Ihrem Telefon, um Ihre Dateien zu senden.",
    mailTitle: "Dateien per E-Mail senden",
    mailSmall: "Senden Sie Ihre Anhänge an die Adresse der Station und öffnen Sie den erhaltenen Ordner.",
    home: "< Start",
    jobCode: "Ordnercode",
    preparePrint: "Druck vorbereiten",
    addFiles: "+ Dateien hinzufügen",
    ejectUsb: "USB-Stick auswerfen",
    endSession: "Sitzung beenden",
    documents: "Dokumente",
    settings: "Einstellungen",
    paper: "Papierformat",
    color: "Farbe",
    bw: "Schwarzweiß",
    duplex: "Einseitig / doppelseitig",
    photoOrientation: "Fotoausrichtung",
    orientationHelp: "Wählen Sie die Druckrichtung des Dokuments.",
    orientationAuto: "Auto",
    orientationPortrait: "Hochformat",
    orientationLandscape: "Querformat",
    simplex: "Einseitig",
    duplexLong: "Doppelseitig lange Kante",
    duplexShort: "Doppelseitig kurze Kante",
    orientation: "Ausrichtung",
    copies: "Anzahl Kopien",
    pages: "Zu druckende Seiten",
    allPages: "Alle Seiten",
    printSelection: "Auswahl drucken",
    preview: "Vorschau",
    selectDocument: "Wählen Sie ein Dokument.",
    qrModalTitle: "Vom Telefon senden",
    qrModalText: "Scannen Sie diesen QR-Code mit Ihrem Telefon und fügen Sie Ihre Dateien hinzu. Große Uploads können länger dauern. Canva-Exporte als PDF, PNG oder JPEG werden akzeptiert.",
    codePhone: "Code auf dem Telefon erhalten",
    open: "Öffnen",
    copy: "Kopieren",
    mailModalTitle: "Per E-Mail senden",
    mailIntro: "Folgen Sie den 3 Schritten. Der Code kommt nach Eingang der Anhänge in Ihrem Postfach an.",
    stepSend: "Dateien senden",
    stepSendText: "Senden oder leiten Sie Ihre Dateien als Anhänge an diese Adresse weiter.",
    address: "Adresse der Station",
    stepWait: "Bitte warten",
    stepWaitText: "Der Server ruft die E-Mail ab und bereitet den Druckordner vor.",
    advisedTime: "Empfohlene Zeit",
    stepWaitSmall: "Sie können den Code eingeben, sobald Sie ihn erhalten.",
    stepCode: "Code eingeben",
    stepCodeText: "Geben Sie den per E-Mail erhaltenen Code ein, um Ihre Dateien an dieser Station zu öffnen.",
    codeMail: "Code per E-Mail erhalten",
    mailLimit: "Große Dateien können länger dauern. Canva-Exporte als PDF, PNG oder JPEG werden akzeptiert.",
    printInProgress: "Druck läuft",
    printWait: "Bitte bleiben Sie an der Station: Ihre Dokumente werden vorbereitet und an den Kopierer gesendet.",
    stepPrepare: "Dokument vorbereiten",
    stepServer: "An Server senden",
    stepQueue: "In Warteschlange stellen",
    stepAgent: "Station übernimmt",
    stepPrinter: "Druck am Kopierer gestartet",
    loadingTitle: "Suche läuft",
    loadingText: "Der Server bereitet Ihre Anfrage vor.",
    information: "Information",
    ok: "OK"
  }
};

function t(key, values = {}) {
  const dictionary = I18N[currentLanguage] || I18N.fr;
  let text = dictionary[key] || I18N.fr[key] || key;
  Object.entries(values).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, value);
  });
  return text;
}

function setText(selector, key) {
  const element = document.querySelector(selector);
  if (element) element.textContent = t(key);
}

function setAllText(selector, keys) {
  document.querySelectorAll(selector).forEach((element, index) => {
    if (keys[index]) element.textContent = t(keys[index]);
  });
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  languageButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === currentLanguage);
  });
  const currentStation = stationName();
  brandTitle.textContent = t("brandTitle", { station: currentStation });
  stationLabel.textContent = currentStation;
  setText(".welcome-panel .station", station === "poste-2" ? "station2" : "station1");
  setText(".welcome-panel h2", "welcomeTitle");
  setText(".lead", "welcomeLead");
  setText(".home-warning", "wordWarning");
  setText("#usb-button strong", "usbTitle");
  setText("#usb-button small", "usbSmall");
  setText("#qr-button strong", "qrTitle");
  setText("#qr-button small", "qrSmall");
  setText("#mail-button strong", "mailTitle");
  setText("#mail-button small", "mailSmall");
  backHome.textContent = t("home");
  jobCode.textContent = t("jobCode");
  setText(".print-header h1", "preparePrint");
  addMoreFiles.textContent = t("addFiles");
  ejectUsbButton.textContent = t("ejectUsb");
  endSessionButton.textContent = t("endSession");
  setText(".doc-panel .panel-title h2", "documents");
  setText(".settings-panel h2", "settings");
  setAllText(".setting-group > strong", ["paper", "color", "duplex", "orientation"]);
  setAllText(".setting-group label", ["", "", "", ""]);
  document.querySelectorAll(".setting-group")[1]?.querySelectorAll("label").forEach((label, index) => {
    label.childNodes[label.childNodes.length - 1].textContent = index === 0 ? ` ${t("bw")}` : ` ${t("color")}`;
  });
  document.querySelectorAll(".setting-group")[2]?.querySelectorAll("label").forEach((label, index) => {
    const keys = ["simplex", "duplexLong", "duplexShort"];
    label.childNodes[label.childNodes.length - 1].textContent = ` ${t(keys[index])}`;
  });
  const translationOrientationGroup = document.getElementById("orientation-group");
  if (translationOrientationGroup) {
    const help = translationOrientationGroup.querySelector("p");
    if (help) help.textContent = t("orientationHelp");
    translationOrientationGroup.querySelectorAll("label").forEach((label, index) => {
      const keys = ["orientationAuto", "orientationPortrait", "orientationLandscape"];
      label.childNodes[label.childNodes.length - 1].textContent = ` ${t(keys[index])}`;
    });
  }
  copiesInput.closest("label").childNodes[0].textContent = t("copies") + " ";
  pageRangeInput.closest("label").childNodes[0].textContent = t("pages") + " ";
  pageRangeInput.placeholder = t("allPages");
  printButton.textContent = t("printSelection");
  setText(".preview-panel .panel-title h2", "preview");
  if (!currentJob) renderPreview(null);
  setText("#qr-modal h2", "qrModalTitle");
  setText("#qr-modal .modal-card > p", "qrModalText");
  setText("label[for='qr-code-input']", "codePhone");
  loadCode.textContent = t("open");
  copyUrl.textContent = t("copy");
  setText("#mail-modal h2", "mailModalTitle");
  setText(".mail-intro", "mailIntro");
  setAllText(".mail-step-card h3", ["stepSend", "stepWait", "stepCode"]);
  setAllText(".mail-step-card > p", ["stepSendText", "stepWaitText", "stepCodeText"]);
  setText(".mail-address-box span", "address");
  copyMail.textContent = t("copy");
  setText(".mail-countdown span", "advisedTime");
  setText(".mail-step-wait small", "stepWaitSmall");
  setText("label[for='mail-code-input']", "codeMail");
  loadMailCode.textContent = t("open");
  setText(".mail-limit-note", "mailLimit");
  setText("#print-modal h2", "printInProgress");
  setText("#print-modal p", "printWait");
  setAllText("#print-steps li", ["stepPrepare", "stepServer", "stepQueue", "stepAgent", "stepPrinter"]);
  loadingTitle.textContent = t("loadingTitle");
  loadingText.textContent = t("loadingText");
  infoOk.textContent = t("ok");
}

function stationName() {
  return station === "poste-2" ? t("station2") : t("station1");
}

function formatClock(date = new Date()) {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function startDigitalClock() {
  if (!digitalClock || clockInterval) return;
  digitalClock.textContent = formatClock();
  checkClosingNotice();
  clockInterval = setInterval(() => {
    digitalClock.textContent = formatClock();
    checkClosingNotice();
  }, 1000);
}

function startMailWaitTimer() {
  if (!mailWaitTimer) return;
  mailWaitTimer.classList.remove("is-done");
}

function stopMailWaitTimer() {
  clearInterval(mailWaitInterval);
  mailWaitInterval = null;
}

function setStatus(message, tone = "") {
  statusMessage.textContent = message;
  statusMessage.dataset.tone = tone;
}

function setPrintStatus(message, tone = "") {
  printStatus.textContent = message;
  printStatus.dataset.tone = tone;
}

function showPrintModal(active) {
  printModal.classList.toggle("hidden", !active);
}

function setPrintProgressText(text) {
  if (printProgressText) printProgressText.textContent = text;
}

function totalFileSize(files) {
  return [...files].reduce((total, file) => total + (file.size || 0), 0);
}

function validateRemoteUploadWeight(files, targetStatus = setStatus) {
  const totalSize = totalFileSize(files);
  if (totalSize <= MAX_TOTAL_UPLOAD_SIZE) return true;
  const message = `Fichiers trop lourds. Limite conseillée : ${MAX_TOTAL_UPLOAD_SIZE_MB} Mo par envoi QR Code ou mail. Pour un gros dossier, utilisez une clé USB ou demandez de l'aide à un vendeur.`;
  showInfo("Envoi trop lourd", message);
  targetStatus(message, "error");
  return false;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function requestStatusLabel(printRequests, requestIds) {
  const tracked = printRequests.filter((request) => requestIds.includes(request.id));
  if (tracked.some((request) => request.status === "failed")) return "failed";
  if (tracked.length && tracked.every((request) => request.status === "done")) return "done";
  if (tracked.some((request) => request.status === "printing")) return "printing";
  return "queued";
}

async function waitForPrintConfirmation(requestIds) {
  const startedAt = Date.now();
  let lastStatus = "queued";
  while (Date.now() - startedAt < 120000) {
    const response = await fetch(`/api/jobs/${currentJob.code}?station=${station}`);
    const payload = await response.json();
    if (response.ok) currentJob = payload;
    const status = requestStatusLabel(payload.printRequests || [], requestIds);

    if (status !== lastStatus) {
      lastStatus = status;
      if (status === "queued") {
        setPrintStep("queue");
        setPrintProgressText("Vos documents attendent le poste d'impression. Merci de patienter quelques instants.");
      }
      if (status === "printing") {
        setPrintStep("agent");
        setPrintProgressText("Le poste d'impression a pris en charge vos documents. Le copieur va démarrer.");
      }
    }

    if (status === "done") {
      setPrintStep("printer");
      setPrintProgressText("Impression lancée et confirmée. Récupérez vos documents au copieur.");
      return payload;
    }
    if (status === "failed") throw new Error("Le poste n'a pas pu lancer l'impression. Merci de contacter un vendeur.");
    await wait(1400);
  }
  throw new Error("Le poste n'a pas confirmé le lancement dans les temps. Merci de contacter un vendeur avant de relancer.");
}

function setPrintStep(step) {
  if (!printSteps) return;
  const order = ["prepare", "server", "queue", "agent", "printer"];
  const activeIndex = order.indexOf(step);
  printSteps.querySelectorAll("li").forEach((item) => {
    const itemIndex = order.indexOf(item.dataset.step);
    item.classList.toggle("done", activeIndex > itemIndex);
    item.classList.toggle("active", activeIndex === itemIndex);
  });
}

function showLoading(active, title = "Recherche en cours", text = "Le serveur prepare votre demande.") {
  loadingTitle.textContent = title;
  loadingText.textContent = text;
  loadingModal.classList.toggle("hidden", !active);
}

function showInfo(title, text) {
  infoTitle.textContent = title;
  infoText.textContent = text;
  infoModal.classList.remove("hidden");
}

function closingWindowKey(date) {
  const day = date.getDay();
  const minutes = date.getHours() * 60 + date.getMinutes();
  const stamp = date.toISOString().slice(0, 10);

  if (minutes >= 12 * 60 + 20 && minutes < 12 * 60 + 30) return stamp + "-1220";
  if (day === 6 && minutes >= 17 * 60 + 50 && minutes < 18 * 60) return stamp + "-1750-samedi";
  if (day >= 1 && day <= 5 && minutes >= 18 * 60 + 50 && minutes < 19 * 60) return stamp + "-1850";
  return "";
}

function checkClosingNotice() {
  const key = closingWindowKey(new Date());
  if (!key || closingNoticeKey === key) return;
  closingNoticeKey = key;
  showInfo("Information magasin", "Votre magasin va bientôt fermer ses portes. Merci de vous rapprocher des caisses.");
}

function hideInfo() {
  infoModal.classList.add("hidden");
}

function resetInactivityTimer() {
  window.clearTimeout(inactivityTimer);
  window.clearTimeout(sessionCloseTimer);
  if (printScreen.classList.contains("hidden")) return;
  inactivityTimer = window.setTimeout(() => {
    if (printScreen.classList.contains("hidden") || inactivityVisible) return;
    inactivityVisible = true;
    showInfo("Session inactive", "Touchez l'ecran ou bougez la souris pour continuer. Sans action, la session sera fermee automatiquement.");
  }, 30000);
  sessionCloseTimer = window.setTimeout(() => {
    if (printScreen.classList.contains("hidden")) return;
    endSession(true);
  }, 180000);
}

function wakeSession() {
  if (inactivityVisible) {
    inactivityVisible = false;
    hideInfo();
  }
  resetInactivityTimer();
}

function showPrintScreen() {
  homeScreen.classList.add("hidden");
  printScreen.classList.remove("hidden");
  startJobRefresh();
  resetInactivityTimer();
}

function showHomeScreen() {
  printScreen.classList.add("hidden");
  homeScreen.classList.remove("hidden");
  stopJobRefresh();
  window.clearTimeout(inactivityTimer);
  window.clearTimeout(sessionCloseTimer);
}

function jobFileSignature(job) {
  return (job?.files || []).map((file) => `${file.id}:${file.originalName}:${file.size}`).join("|");
}

async function refreshCurrentJob() {
  if (!currentJob?.code || printScreen.classList.contains("hidden")) return;
  try {
    const beforeIds = new Set(currentJob.files.map((file) => file.id));
    const beforeSignature = jobFileSignature(currentJob);
    const response = await fetch(`/api/jobs/${currentJob.code}?station=${station}`);
    const payload = await response.json();
    if (!response.ok) return;
    const afterSignature = jobFileSignature(payload);
    if (beforeSignature === afterSignature) return;
    payload.files.forEach((file) => {
      if (!beforeIds.has(file.id)) selectedFileIds.add(file.id);
    });
    selectedFileId = payload.files.find((file) => !beforeIds.has(file.id))?.id || selectedFileId;
    renderJob(payload);
    setPrintStatus("Nouveaux fichiers ajoutes a la session.", "success");
  } catch (error) {
    // Le rafraichissement est silencieux pour ne pas deranger le client.
  }
}

function startJobRefresh() {
  window.clearInterval(jobRefreshTimer);
  jobRefreshTimer = window.setInterval(refreshCurrentJob, 3000);
}

function stopJobRefresh() {
  window.clearInterval(jobRefreshTimer);
}
function extension(file) {
  const value = String(file?.extension || "").toLowerCase();
  return value.startsWith(".") ? value : `.${value}`;
}

function fileLabel(file) {
  return extension(file).replace(".", "").toUpperCase() || "DOC";
}

function isPhotoFile(file) {
  return [".png", ".jpg", ".jpeg", ".webp", ".heic", ".heif"].includes(extension(file));
}

function defaultSettingsForFile(file = null) {
  const base = currentJob?.printSettings || {};
  return {
    colorMode: base.colorMode || "noir-blanc",
    duplex: base.duplex || "recto",
    paperSize: base.paperSize || "A4",
    scaling: base.scaling || "ajuster",
    orientation: base.orientation || "auto",
    pageRange: base.pageRange || "",
    pagesPerSheet: Number(base.pagesPerSheet || 1),
    copies: Math.max(1, Number.parseInt(base.copies, 10) || 1),
  };
}

function settingsForFile(fileId) {
  const file = currentJob?.files?.find((item) => item.id === fileId) || null;
  if (!fileId) return defaultSettingsForFile(file);
  if (!filePrintSettings.has(fileId)) filePrintSettings.set(fileId, defaultSettingsForFile(file));
  return filePrintSettings.get(fileId);
}

function applySettingsToControls(settings = defaultSettingsForFile()) {
  ["colorMode", "duplex", "paperSize", "orientation"].forEach((name) => {
    const input = document.querySelector(`input[name='${name}'][value='${settings[name]}']`);
    if (input) input.checked = true;
  });
  pageRangeInput.value = settings.pageRange || "";
  copiesInput.value = Math.max(1, Number.parseInt(settings.copies, 10) || 1);
}

function saveActiveSettings() {
  const settings = printSettings();
  const targets = selectedFileIds.size ? [...selectedFileIds] : (selectedFileId ? [selectedFileId] : []);
  targets.forEach((fileId) => filePrintSettings.set(fileId, { ...settings }));
}

function settingsForPrint(fileId) {
  const file = currentJob?.files?.find((item) => item.id === fileId) || null;
  const settings = { ...settingsForFile(fileId) };
  if (!isPhotoFile(file)) settings.orientation = "auto";
  return settings;
}

function syncSettingsForJob(job) {
  const validFileIds = new Set((job?.files || []).map((file) => file.id));
  filePrintSettings = new Map([...filePrintSettings].filter(([fileId]) => validFileIds.has(fileId)));
  (job?.files || []).forEach((file) => settingsForFile(file.id));
}

function settingsSummary(settings = {}) {
  const duplexLabels = { recto: "Recto", "recto-verso-long": "R/V long", "recto-verso-court": "R/V court" };
  const parts = [settings.paperSize || "A4", settings.colorMode === "couleur" ? "Couleur" : "N&B", duplexLabels[settings.duplex] || "Recto"];
  if (settings.orientation && settings.orientation !== "auto") parts.push(settings.orientation === "paysage" ? "Paysage" : "Portrait");
  if (settings.copies && Number(settings.copies) > 1) parts.push(`${settings.copies} ex.`);
  if (settings.pageRange) parts.push(`p. ${settings.pageRange}`);
  return parts.join(" - ");
}

function updateSettingsPanelTitle() {
  const title = document.querySelector(".settings-panel h2");
  if (!title) return;
  if (selectedFileIds.size > 1) title.textContent = `Configuration - ${selectedFileIds.size} fichiers cochés`;
  else if (selectedFileIds.size === 1) title.textContent = "Configuration du fichier coché";
  else title.textContent = t("settings");
}
function selectedPreviewFile() {
  return currentJob?.files?.find((file) => file.id === selectedFileId) || null;
}

function updateSessionControls() {
  const source = String(currentJob?.source || "").toLowerCase();
  ejectUsbButton.classList.toggle("hidden", source !== "usb");
}

function updatePhotoOrientationControls(file) {
  const isPhoto = isPhotoFile(file);
  orientationGroup?.classList.toggle("is-photo-selected", isPhoto);
  if (!isPhoto) {
    const autoInput = document.querySelector("input[name='orientation'][value='auto']");
    if (autoInput) autoInput.checked = true;
  }
}

function renderPreview(file) {
  updateSettingsPanelTitle();
  updatePhotoOrientationControls(file);
  previewBox.classList.remove("is-photo", "is-pdf", "is-portrait", "is-landscape");
  if (!file) {
    previewPages.textContent = "1 / 1";
    previewBox.innerHTML = `<p>${t("selectDocument")}</p>`;
    return;
  }

  previewPages.textContent = `1 / ${file.pages || 1}`;
  const ext = extension(file);
  if (ext === ".pdf") {
    previewBox.classList.add("is-pdf");
    previewBox.innerHTML = `<iframe class="pdf-preview-frame" src="${file.viewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH" title="${file.originalName}"></iframe>`;
  } else if (isPhotoFile(file)) {
    previewBox.classList.add("is-photo");
    previewBox.innerHTML = `<img class="preview-photo" src="${file.viewUrl}" alt="${file.originalName}">`;
    const image = previewBox.querySelector("img");
    image.addEventListener("load", () => {
      previewBox.classList.toggle("is-portrait", image.naturalHeight >= image.naturalWidth);
      previewBox.classList.toggle("is-landscape", image.naturalWidth > image.naturalHeight);
    }, { once: true });
  } else {
    previewBox.innerHTML = `
      <div class="preview-fallback">
        <strong>${file.originalName}</strong>
        <p>Ce format ne peut pas etre previsualise ici. Il reste dans la liste pour traitement.</p>
      </div>
    `;
  }
}

function renderJob(job) {
  currentJob = job;
  syncSettingsForJob(job);
  selectedFileId = job.files.some((file) => file.id === selectedFileId) ? selectedFileId : job.files[0]?.id || "";
  const validFileIds = new Set(job.files.map((file) => file.id));
  selectedFileIds = new Set([...selectedFileIds].filter((fileId) => validFileIds.has(fileId)));
  jobCode.textContent = `Code dossier ${job.code}`;
  documentCount.textContent = `${selectedFileIds.size}/${job.files.length} à imprimer`;
  documentList.innerHTML = job.files.length ? job.files.map((file) => {
    const isActive = file.id === selectedFileId;
    const isSelected = selectedFileIds.has(file.id);
    const summary = settingsSummary(settingsForPrint(file.id));
    return `
    <article class="document-item ${isActive ? "active" : ""} ${isSelected ? "selected" : "not-selected"}" data-file-id="${file.id}">
      <input class="select-file" type="checkbox" data-select-file="${file.id}" ${isSelected ? "checked" : ""} aria-label="Selectionner ${file.originalName}">
      <span>${fileLabel(file)}</span>
      <strong>${file.originalName}</strong>
      <small>${(file.size / 1024 / 1024).toFixed(1)} Mo - ${file.pages || 1} page(s)</small>
      <em class="document-print-state">${isSelected ? "À imprimer" : "Non imprimé"}${isActive ? " - réglages affichés" : ""}</em>
      <em class="document-settings-summary">${summary}</em>
      <button class="delete-file" type="button" data-delete-file="${file.id}" aria-label="Supprimer ${file.originalName}">x</button>
    </article>`;
  }).join("") : `<p class="empty-documents">Aucun document dans cette session.</p>`;
  applySettingsToControls(settingsForFile(selectedFileId));
  renderPreview(selectedPreviewFile());
  updateSessionControls();
  showPrintScreen();
}

function printSettings() {
  return {
    colorMode: document.querySelector("input[name='colorMode']:checked")?.value || "noir-blanc",
    duplex: document.querySelector("input[name='duplex']:checked")?.value || "recto",
    paperSize: document.querySelector("input[name='paperSize']:checked")?.value || "A4",
    scaling: "ajuster",
    orientation: document.querySelector("input[name='orientation']:checked")?.value || "auto",
    pageRange: pageRangeInput.value.trim(),
    pagesPerSheet: 1,
    copies: Math.max(1, Number.parseInt(copiesInput.value, 10) || 1),
  };
}

function qrParams(source = "qr") {
  const params = new URLSearchParams({ station, source });
  if (currentJob?.code) params.set("code", currentJob.code);
  return params.toString();
}

async function openQrModal() {
  const params = qrParams("qr");
  qrImage.src = `/qr.svg?${params}&t=${Date.now()}`;
  uploadUrl.value = "Preparation du lien...";
  qrCodeInput.value = "";
  qrModal.classList.remove("hidden");
  try {
    const response = await fetch(`/api/config?${params}`);
    const payload = await response.json();
    uploadUrl.value = payload.uploadUrl || `${window.location.origin}/upload?${params}`;
  } catch (error) {
    uploadUrl.value = `${window.location.origin}/upload?${params}`;
  }
}

async function openMailModal() {
  if (mailCodeInput) mailCodeInput.value = "";
  mailAddress.textContent = "kiosk.es@zohomail.eu";
  mailModal.classList.remove("hidden");
  startMailWaitTimer();
  stopMailRecentRefresh();
  await loadRecentMailJobs();
  mailRecentInterval = window.setInterval(loadRecentMailJobs, 5000);
  try {
    const params = qrParams("mail");
    const response = await fetch(`/api/config?${params}`);
    const payload = await response.json();
    if (payload.mailAddress) mailAddress.textContent = payload.mailAddress;
  } catch (error) {
    // L'adresse locale par defaut reste affichee.
  }
}

function stopMailRecentRefresh() {
  window.clearInterval(mailRecentInterval);
  mailRecentInterval = null;
}

function mailSenderLabel(job) {
  return job.senderEmail || job.customerName || "Client mail";
}

async function loadRecentMailJobs() {
  if (!mailRecentList) return;
  try {
    const response = await fetch("/api/jobs");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Recherche impossible.");
    const now = Date.now();
    const mailJobs = (payload.jobs || [])
      .filter((job) => job.source === "mail" && job.status !== "termine")
      .filter((job) => new Date(job.expiresAt || job.createdAt).getTime() > now)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);

    if (!mailJobs.length) {
      mailSelectStep?.classList.remove("is-ready");
      mailSelectStep?.classList.add("is-waiting");
      if (mailSelectTitle) mailSelectTitle.textContent = "Merci de patienter";
      if (mailSelectText) mailSelectText.textContent = "Le serveur recherche votre mail. Dès qu'il le reçoit, votre adresse apparaîtra ici.";
      mailRecentList.innerHTML = `<p class="mail-recent-empty">Aucun mail reçu pour le moment. Gardez cette fenêtre ouverte.</p>`;
      return;
    }

    mailSelectStep?.classList.add("is-ready");
    mailSelectStep?.classList.remove("is-waiting");
    if (mailSelectTitle) mailSelectTitle.textContent = "Sélectionnez votre adresse mail";
    if (mailSelectText) mailSelectText.textContent = "Cliquez sur votre adresse pour découvrir vos fichiers.";
    mailRecentList.innerHTML = mailJobs.map((job) => {
      const sender = mailSenderLabel(job);
      const fileCount = (job.files || []).length;
      const disabled = job.counterOnly ? " disabled" : "";
      const action = job.counterOnly ? "À traiter au comptoir" : "Voir mes fichiers";
      return `<button class="mail-recent-job${disabled}" type="button" data-mail-code="${job.code}"${disabled ? " disabled aria-disabled=\"true\"" : ""}>
        <strong>${sender}</strong>
        <span>${fileCount} fichier${fileCount > 1 ? "s" : ""} reçu${fileCount > 1 ? "s" : ""}</span>
        <em>${action}</em>
      </button>`;
    }).join("");
  } catch (error) {
    mailSelectStep?.classList.remove("is-ready");
    mailSelectStep?.classList.add("is-waiting");
    mailRecentList.innerHTML = `<p class="mail-recent-empty">Recherche des mails en cours...</p>`;
  }
}
async function openJobByCode(codeValue) {
  const code = String(codeValue || "").replace(/\D/g, "").slice(0, 4);
  if (code.length !== 4) {
    showInfo(t("information"), currentLanguage === "fr" ? "Dossier introuvable." : "Folder not found.");
    return;
  }

  showLoading(true, t("loadingTitle"), "Le serveur ouvre les fichiers reçus.");
  try {
    const response = await fetch(`/api/jobs/${code}?station=${station}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Dossier introuvable.");
    selectedFileId = payload.files[0]?.id || "";
    selectedFileIds = new Set(payload.files.map((file) => file.id));
    qrModal.classList.add("hidden");
    mailModal.classList.add("hidden");
    stopMailRecentRefresh();
    renderJob(payload);
    showInfo("Dossier ouvert", "Vos fichiers sont disponibles sur le poste.");
  } catch (error) {
    showInfo("Dossier introuvable", error.message);
  } finally {
    showLoading(false);
  }
}

async function loadJobFromCode(inputElement = qrCodeInput) {
  await openJobByCode(inputElement?.value || "");
}
function formatUsbSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024 * 1024) return Math.max(1, Math.round(value / 1024)) + " Ko";
  return (value / 1024 / 1024).toFixed(1).replace(".", ",") + " Mo";
}

function renderUsbExplorer(payload) {
  const roots = payload.roots || [];
  usbExplorerPath = payload.path || "";
  usbExplorerParentPath = payload.parentPath || "";
  usbRootSelect.innerHTML = roots.length
    ? roots.map((root) => `<option value="${root.path}" ${root.path === usbExplorerPath ? "selected" : ""}>${root.name}</option>`).join("")
    : `<option value="">Aucune cle USB detectee</option>`;
  usbCurrentPath.textContent = usbExplorerPath || "Inserez une cle USB puis actualisez.";
  usbUp.disabled = !usbExplorerParentPath;
  usbEntryList.innerHTML = (payload.entries || []).length ? payload.entries.map((entry) => {
    if (entry.type === "directory") {
      return `<button class="usb-entry directory" type="button" data-usb-open="${entry.path}"><strong>${entry.name}</strong><span>Dossier</span></button>`;
    }
    const checked = usbSelectedPaths.has(entry.path) ? "checked" : "";
    return `
      <label class="usb-entry file">
        <input type="checkbox" data-usb-file="${entry.path}" ${checked}>
        <strong>${entry.name}</strong>
        <span>${String(entry.extension || "").toUpperCase()} - ${formatUsbSize(entry.size)}</span>
      </label>
    `;
  }).join("") : `<p class="usb-empty">Aucun fichier compatible dans ce dossier.</p>`;
  usbSelectedCount.textContent = `${usbSelectedPaths.size} fichier${usbSelectedPaths.size > 1 ? "s" : ""} selectionne${usbSelectedPaths.size > 1 ? "s" : ""}`;
}

async function loadUsbExplorer(targetPath = "") {
  if (!targetPath) usbSelectedPaths = new Set();
  showLoading(true, "Lecture de la cle USB", "Le kiosk charge le contenu autorise.");
  try {
    const params = new URLSearchParams({ station });
    if (targetPath) params.set("path", targetPath);
    if (!targetPath) params.set("refresh", "1");
    const response = await fetch(`/api/usb/browse?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Lecture USB impossible.");
    renderUsbExplorer(payload);
  } catch (error) {
    usbSelectedPaths = new Set();
    renderUsbExplorer({ roots: [], path: "", parentPath: "", entries: [] });
    showInfo("Cle USB", error.message || "Impossible de lire la cle USB.");
  } finally {
    showLoading(false);
  }
}

function openWindowsUsbPicker() {
  usbFiles.value = "";
  usbFiles.click();
}

async function openUsbExplorer() {
  openWindowsUsbPicker();
}

async function submitUsbExplorerSelection() {
  const paths = [...usbSelectedPaths];
  if (!paths.length) {
    showInfo("Aucun fichier", "Selectionnez au moins un fichier sur la cle USB.");
    return;
  }
  const body = {
    station,
    customerName: `Client ${stationName()}`,
    printMode: "noir-blanc",
    paths,
  };
  const isAdding = Boolean(currentJob?.code && !printScreen.classList.contains("hidden"));
  const url = isAdding ? `/api/jobs/${currentJob.code}/files-from-usb-paths` : "/api/jobs/from-usb-paths";
  showLoading(true, "Chargement en cours", "Le kiosk copie les fichiers selectionnes.");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
    const previousFileIds = new Set(currentJob?.files?.map((file) => file.id) || []);
    selectedFileId = payload.files.find((file) => !previousFileIds.has(file.id))?.id || payload.files[0]?.id || "";
    payload.files.forEach((file) => selectedFileIds.add(file.id));
    usbExplorerModal.classList.add("hidden");
    renderJob(payload);
    showInfo("Fichiers recus", "Vos documents sont prets. Verifiez l'apercu et les options avant d'imprimer.");
  } catch (error) {
    showInfo("Erreur", error.message);
  } finally {
    showLoading(false);
  }
}

async function uploadUsbFiles(files) {
  if (!files.length) return;
  const formData = new FormData();
  formData.set("station", station);
  formData.set("customerName", `Client ${stationName()}`);
  formData.set("source", "usb");
  formData.set("printMode", "noir-blanc");
  files.forEach((file) => formData.append("files", file));

  setStatus("Chargement des fichiers de la cle USB...");
  showLoading(true, "Chargement en cours", "Le serveur recupere vos fichiers.");
  usbButton.disabled = true;
  qrButton.disabled = true;

  try {
    const response = await fetch("/api/jobs", { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
    selectedFileId = payload.files[0]?.id || "";
    selectedFileIds = new Set(payload.files.map((file) => file.id));
    renderJob(payload);
    showInfo("Fichiers recus", "Vos documents sont prets. Verifiez l'apercu et les options avant d'imprimer.");
  } catch (error) {
    setStatus(error.message, "error");
    showInfo("Erreur", error.message);
  } finally {
    showLoading(false);
    usbButton.disabled = false;
    qrButton.disabled = false;
    mailButton.disabled = false;
    usbFiles.value = "";
  }
}

async function addFilesToCurrentJob(files) {
  if (!currentJob?.code) {
    await uploadUsbFiles(files);
    return;
  }
  if (!files.length) return;
  if (!validateRemoteUploadWeight(files, setPrintStatus)) return;

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  setPrintStatus("Ajout des fichiers...");
  showLoading(true, "Ajout en cours", "Le serveur ajoute vos documents a la session.");

  try {
    const response = await fetch(`/api/jobs/${currentJob.code}/files`, { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Ajout impossible.");
    const previousFileIds = new Set(currentJob.files.map((file) => file.id));
    selectedFileId = payload.files[payload.files.length - 1]?.id || selectedFileId;
    payload.files.forEach((file) => {
      if (!previousFileIds.has(file.id)) selectedFileIds.add(file.id);
    });
    setPrintStatus("Fichiers ajoutes.", "success");
    renderJob(payload);
    showInfo("Fichiers ajoutes", "Les nouveaux documents sont disponibles dans la liste.");
  } catch (error) {
    setPrintStatus(error.message, "error");
    showInfo("Erreur", error.message);
  } finally {
    showLoading(false);
  }
}

async function deleteFile(fileId) {
  if (!currentJob?.code || !fileId) return;
  showLoading(true, "Suppression en cours", "Le serveur supprime le fichier de la session.");
  try {
    const response = await fetch(`/api/jobs/${currentJob.code}/files/${fileId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Suppression impossible.");
    selectedFileIds.delete(fileId);
    if (selectedFileId === fileId) selectedFileId = payload.files[0]?.id || "";
    renderJob(payload);
    showInfo("Fichier supprime", "Le document a ete retire de la session.");
  } catch (error) {
    showInfo("Erreur", error.message);
  } finally {
    showLoading(false);
  }
}

async function waitForUsbEject(commandId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 12000) {
    const response = await fetch(`/api/stations/${station}/commands/${commandId}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Commande introuvable.");
    if (payload.command?.status === "done") return;
    if (payload.command?.status === "failed") throw new Error(payload.command.error || "Ejection impossible.");
    await new Promise((resolve) => window.setTimeout(resolve, 900));
  }
  throw new Error("La confirmation de l'ejection prend plus de temps que prevu.");
}

async function ejectUsb() {
  showLoading(true, "Ejection de la cle USB", "Le poste demande a Windows d'ejecter la cle en securite.");
  ejectUsbButton.disabled = true;
  try {
    const response = await fetch(`/api/stations/${station}/eject`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Ejection impossible.");
    await waitForUsbEject(payload.command.id);
    showInfo("Cle USB ejectee", "Ejection confirmee. Vous pouvez retirer la cle USB.");
  } catch (error) {
    showInfo("Ejection USB", error.message || "Impossible de confirmer l'ejection de la cle USB.");
  } finally {
    ejectUsbButton.disabled = false;
    showLoading(false);
  }
}

async function printSelectedFiles() {
  const fileIds = [...selectedFileIds].filter((fileId) => currentJob?.files?.some((file) => file.id === fileId));
  if (!currentJob?.code || !fileIds.length) {
    setPrintStatus("Selectionnez au moins un document.", "error");
    showInfo("Aucun document", "Selectionnez au moins un document avant d'imprimer.");
    return;
  }

  saveActiveSettings();
  const requestIds = [];
  setPrintStatus("Préparation de l'impression...");
  showPrintModal(true);
  setPrintStep("prepare");
  setPrintProgressText("Nous vérifions les documents sélectionnés et vos options d'impression.");

  try {
    await wait(300);
    setPrintStep("server");
    setPrintProgressText("Le serveur prépare les fichiers dans le bon format pour le copieur.");

    let payload = null;
    for (const fileId of fileIds) {
      const response = await fetch(`/api/jobs/${currentJob.code}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, settings: settingsForPrint(fileId) }),
      });
      payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impression impossible.");
      if (payload.printRequest?.id) requestIds.push(payload.printRequest.id);
    }

    currentJob = payload.job;
    setPrintStep("queue");
    setPrintProgressText("Vos documents sont dans la file d'attente du poste. Ne fermez pas la session.");
    const confirmedJob = await waitForPrintConfirmation(requestIds);
    currentJob = confirmedJob;
    setPrintStatus(`${fileIds.length} document(s) lancé(s) au copieur.`, "success");
    await wait(2200);
    showPrintModal(false);
    showInfo("Impression lancée", "Le copieur a reçu la demande. Récupérez vos documents au bac de sortie.");
  } catch (error) {
    setPrintStatus(error.message || "Impression impossible.", "error");
    setPrintStep("queue");
    setPrintProgressText(error.message || "Une erreur bloque l'impression.");
    await wait(900);
    showPrintModal(false);
    showInfo("Erreur", error.message || "Impression impossible.");
  }
}

async function endSession(isAutomatic = false) {
  window.clearTimeout(inactivityTimer);
  window.clearTimeout(sessionCloseTimer);
  showLoading(true, "Fin de session", isAutomatic ? "La session inactive est fermee automatiquement." : "Nettoyage du dossier en cours.");
  try {
    if (currentJob?.code) await fetch(`/api/jobs/${currentJob.code}`, { method: "DELETE" });
    currentJob = null;
    selectedFileId = "";
    selectedFileIds = new Set();
    renderPreview(null);
    updateSessionControls();
    documentList.innerHTML = "";
    documentCount.textContent = "0";
    showHomeScreen();
    showInfo("Session terminee", isAutomatic ? "La session a ete fermee apres inactivite." : "Merci. Vous pouvez retirer vos documents et votre cle USB si vous en avez utilise une.");
  } catch (error) {
    showInfo("Erreur", "Impossible de terminer la session pour le moment.");
  } finally {
    showLoading(false);
  }
}

applyTranslations();
startDigitalClock();

usbButton.addEventListener("click", openWindowsUsbPicker);
qrButton.addEventListener("click", openQrModal);
mailButton.addEventListener("click", openMailModal);
languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentLanguage = button.dataset.lang || "fr";
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    applyTranslations();
  });
});

closeUsbExplorer.addEventListener("click", () => usbExplorerModal.classList.add("hidden"));
usbRefresh.addEventListener("click", () => loadUsbExplorer(""));
usbUp.addEventListener("click", () => {
  if (usbExplorerParentPath) loadUsbExplorer(usbExplorerParentPath);
});
usbRootSelect.addEventListener("change", () => {
  if (usbRootSelect.value) loadUsbExplorer(usbRootSelect.value);
});
usbEntryList.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-usb-open]");
  if (openButton) {
    loadUsbExplorer(openButton.dataset.usbOpen);
    return;
  }
  const checkbox = event.target.closest("[data-usb-file]");
  if (!checkbox) return;
  if (checkbox.checked) usbSelectedPaths.add(checkbox.dataset.usbFile);
  else usbSelectedPaths.delete(checkbox.dataset.usbFile);
  usbSelectedCount.textContent = `${usbSelectedPaths.size} fichier${usbSelectedPaths.size > 1 ? "s" : ""} selectionne${usbSelectedPaths.size > 1 ? "s" : ""}`;
});
usbConfirmSelection.addEventListener("click", submitUsbExplorerSelection);

usbFiles.addEventListener("change", () => {
  if (currentJob?.code && !printScreen.classList.contains("hidden")) addFilesToCurrentJob([...usbFiles.files]);
  else uploadUsbFiles([...usbFiles.files]);
});

documentList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-file]");
  if (deleteButton) {
    deleteFile(deleteButton.dataset.deleteFile);
    return;
  }
  const selectInput = event.target.closest("[data-select-file]");
  if (selectInput) {
    saveActiveSettings();
    const fileId = selectInput.dataset.selectFile;
    if (selectInput.checked) selectedFileIds.add(fileId);
    else selectedFileIds.delete(fileId);
    selectedFileId = fileId;
    renderJob(currentJob);
    return;
  }
  const item = event.target.closest("[data-file-id]");
  if (!item || !currentJob) return;
  saveActiveSettings();
  selectedFileId = item.dataset.fileId;
  selectedFileIds.add(selectedFileId);
  renderJob(currentJob);
});


document.querySelectorAll("input[name='paperSize'], input[name='colorMode'], input[name='duplex'], input[name='orientation'], #copies, #page-range").forEach((input) => {
  input.addEventListener("change", () => {
    saveActiveSettings();
    renderJob(currentJob);
  });
  input.addEventListener("input", () => {
    if (input.id === "copies" || input.id === "page-range") saveActiveSettings();
  });
});
printButton.addEventListener("click", printSelectedFiles);
backHome.addEventListener("click", showHomeScreen);
addMoreFiles.addEventListener("click", () => {
  if (String(currentJob?.source || "").toLowerCase() === "usb") openWindowsUsbPicker();
  else usbFiles.click();
});
ejectUsbButton.addEventListener("click", ejectUsb);
closeQr.addEventListener("click", () => qrModal.classList.add("hidden"));
loadCode.addEventListener("click", () => loadJobFromCode(qrCodeInput));
qrCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadJobFromCode(qrCodeInput);
});

closeMail.addEventListener("click", () => {
  mailModal.classList.add("hidden");
  stopMailWaitTimer();
});
loadMailCode?.addEventListener("click", () => loadJobFromCode(mailCodeInput));
mailRecentList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mail-code]");
  if (!button || button.disabled) return;
  openJobByCode(button.dataset.mailCode || "");
});
mailCodeInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadJobFromCode(mailCodeInput);
});
copyMail.addEventListener("click", async () => {
  await navigator.clipboard?.writeText(mailAddress.textContent);
  showInfo("Adresse copiee", "L adresse mail du poste a ete copiee.");
});

copyUrl.addEventListener("click", async () => {
  await navigator.clipboard?.writeText(uploadUrl.value);
  showInfo("Lien copie", "Le lien d'envoi a ete copie.");
});

closeInfo.addEventListener("click", () => {
  inactivityVisible = false;
  hideInfo();
  resetInactivityTimer();
});

infoOk.addEventListener("click", () => {
  inactivityVisible = false;
  hideInfo();
  resetInactivityTimer();
});

endSessionButton.addEventListener("click", endSession);

["mousemove", "mousedown", "keydown", "touchstart", "scroll"].forEach((eventName) => {
  window.addEventListener(eventName, wakeSession, { passive: true });
});












