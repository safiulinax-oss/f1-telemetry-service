const state = {
    seasons: [],
    races: [],
    sessions: [],
    drivers: [],
    laps: [],
    telemetry: [],
    summary: null,
    currentSeason: null,
    currentRace: null,
    currentSession: null,
    currentDriver: null,
    selectedLap: null,
    cursorIndex: 0,
    activeLapView: null,
    cache: {
        races: new Map(),
        sessions: new Map(),
        sessionDetails: new Map(),
        laps: new Map(),
        lapDetails: new Map(),
        preparedLapViews: new Map(),
        sessionMetadataWarmups: new Set(),
        telemetryWarmups: new Set(),
        realTrackLayouts: new Map(),
        referenceTrackLayouts: new Map(),
        referenceTrackRequests: new Map(),
        fallbackTrackLayouts: new Map(),
    },
};

// Monza circuit — wireframe: right-angle, diagonal, S-chicane, long straight, Parabolica U
const trackLayouts = {
    monza: {
        label: "Monza",
        viewBox: "30 30 550 140",
        pathPoints: [
            [45, 125], [45, 50], [90, 75], [150, 60], [195, 80], [250, 95], [530, 95], [560, 88],
            [540, 115], [470, 148], [350, 158], [220, 152], [120, 138], [45, 125],
        ],
    },
    "circuit de monaco": {
        label: "Circuit de Monaco",
        viewBox: "40 10 500 200",
        pathPoints: [
            [120, 50], [108, 24], [82, 28], [66, 56], [60, 92], [88, 116], [138, 120], [194, 110],
            [252, 100], [310, 90], [366, 82], [426, 78], [474, 84], [510, 104], [520, 132], [504, 160],
            [466, 176], [420, 186], [370, 190], [318, 184], [278, 170], [256, 148], [246, 122], [236, 98],
            [218, 78], [196, 70], [170, 76], [152, 96], [146, 130], [164, 160], [206, 176], [258, 180],
            [314, 170], [362, 154], [390, 130], [400, 104], [384, 86], [350, 78], [300, 82], [244, 90],
            [190, 98], [148, 92], [124, 76], [120, 50],
        ],
    },
    "autodromo enzo e dino ferrari": {
        label: "Autodromo Enzo e Dino Ferrari",
        viewBox: "25 15 560 230",
        pathPoints: [
            [72, 158], [100, 124], [150, 108], [212, 112], [276, 132], [338, 154], [408, 160],
            [482, 142], [538, 110], [552, 76], [526, 52], [470, 46], [398, 58], [326, 82],
            [268, 94], [218, 82], [180, 54], [140, 38], [96, 52], [74, 90], [82, 126],
            [122, 146], [184, 150], [248, 166], [304, 190], [260, 214], [184, 210], [112, 190],
            [72, 158],
        ],
    },
};

const genericTrackTemplates = [
    {
        viewBox: "40 25 520 170",
        pathPoints: [
            [90, 120], [70, 80], [90, 48], [142, 38], [212, 44], [286, 56], [372, 58], [450, 52],
            [500, 74], [514, 114], [492, 148], [440, 166], [362, 170], [286, 160], [232, 136], [204, 102],
            [184, 74], [150, 62], [116, 76], [100, 102], [90, 120],
        ],
    },
    {
        viewBox: "35 20 540 180",
        pathPoints: [
            [96, 138], [76, 104], [82, 62], [122, 36], [188, 28], [266, 38], [332, 60], [392, 70],
            [466, 66], [518, 84], [530, 120], [514, 150], [468, 172], [396, 178], [328, 170], [270, 154],
            [228, 126], [196, 92], [162, 72], [126, 82], [108, 110], [96, 138],
        ],
    },
    {
        viewBox: "30 20 560 180",
        pathPoints: [
            [84, 130], [62, 90], [76, 50], [126, 32], [200, 36], [280, 52], [332, 76], [382, 92],
            [458, 88], [522, 98], [542, 132], [526, 164], [470, 180], [390, 174], [318, 158], [268, 132],
            [240, 102], [214, 84], [172, 88], [132, 108], [112, 132], [84, 130],
        ],
    },
    {
        viewBox: "35 15 540 190",
        pathPoints: [
            [104, 144], [76, 112], [70, 70], [102, 40], [164, 28], [236, 36], [308, 54], [372, 78],
            [430, 92], [488, 88], [526, 108], [532, 146], [508, 174], [452, 186], [382, 182], [314, 168],
            [254, 146], [218, 118], [190, 92], [150, 88], [122, 108], [104, 144],
        ],
    },
];

const SESSION_TYPE_LABELS = {
    "Practice 1": "Практика 1",
    "Practice 2": "Практика 2",
    "Practice 3": "Практика 3",
    "Free Practice 1": "Свободная практика 1",
    "Free Practice 2": "Свободная практика 2",
    "Free Practice 3": "Свободная практика 3",
    Qualifying: "Квалификация",
    Race: "Гонка",
    Sprint: "Спринт",
    "Sprint Qualifying": "Спринт-квалификация",
    "Sprint Shootout": "Спринт-шут-аут",
    "Sprint Shootout Qualifying": "Спринт-шут-аут",
    "Sprint Race": "Спринт",
    Testing: "Тесты",
    "Pre-Season Test": "Предсезонные тесты",
};

const GRAND_PRIX_NAME_LABELS = {
    Bahrain: "Бахрейн",
    "Saudi Arabian": "Саудовская Аравия",
    Australian: "Австралия",
    Japanese: "Япония",
    Chinese: "Китай",
    Miami: "Майами",
    "Emilia Romagna": "Эмилия-Романья",
    Monaco: "Монако",
    Canadian: "Канада",
    Spanish: "Испания",
    Austrian: "Австрия",
    British: "Великобритания",
    Hungarian: "Венгрия",
    Belgian: "Бельгия",
    Dutch: "Нидерланды",
    Italian: "Италия",
    Azerbaijan: "Азербайджан",
    Singapore: "Сингапур",
    "United States": "США",
    "Mexico City": "Мехико",
    Mexican: "Мексика",
    "Sao Paulo": "Сан-Паулу",
    Brazilian: "Бразилия",
    "Las Vegas": "Лас-Вегас",
    Qatar: "Катар",
    "Abu Dhabi": "Абу-Даби",
    French: "Франция",
    Portuguese: "Португалия",
    Styrian: "Штирия",
    "70th Anniversary": "70-летие Формулы-1",
    Tuscan: "Тоскана",
    Eifel: "Айфель",
    Turkish: "Турция",
    Sakhir: "Сахир",
};

const DRIVER_NAME_LABELS = {
    "Max Verstappen": "Макс Ферстаппен",
    "Sergio Perez": "Серхио Перес",
    "Charles Leclerc": "Шарль Леклер",
    "Carlos Sainz": "Карлос Сайнс",
    "Lewis Hamilton": "Льюис Хэмилтон",
    "George Russell": "Джордж Расселл",
    "Lando Norris": "Ландо Норрис",
    "Oscar Piastri": "Оскар Пиастри",
    "Fernando Alonso": "Фернандо Алонсо",
    "Lance Stroll": "Лэнс Стролл",
    "Pierre Gasly": "Пьер Гасли",
    "Esteban Ocon": "Эстебан Окон",
    "Yuki Tsunoda": "Юки Цунода",
    "Daniel Ricciardo": "Даниэль Риккардо",
    "Alexander Albon": "Александр Албон",
    "Alex Albon": "Алекс Албон",
    "Logan Sargeant": "Логан Сарджент",
    "Valtteri Bottas": "Валттери Боттас",
    "Zhou Guanyu": "Чжоу Гуаньюй",
    "Guanyu Zhou": "Гуаньюй Чжоу",
    "Kevin Magnussen": "Кевин Магнуссен",
    "Nico Hulkenberg": "Нико Хюлькенберг",
    "Nico Hülkenberg": "Нико Хюлькенберг",
    "Oliver Bearman": "Оливер Берман",
    "Ollie Bearman": "Олли Берман",
    "Franco Colapinto": "Франко Колапинто",
    "Liam Lawson": "Лиам Лоусон",
    "Andrea Kimi Antonelli": "Андреа Кими Антонелли",
    "Kimi Antonelli": "Кими Антонелли",
    "Isack Hadjar": "Исаак Хаджар",
    "Gabriel Bortoleto": "Габриэл Бортолето",
    "Jack Doohan": "Джек Дуэн",
    "Nyck de Vries": "Ник де Врис",
    "Mick Schumacher": "Мик Шумахер",
    "Sebastian Vettel": "Себастьян Феттель",
    "Kimi Raikkonen": "Кими Райкконен",
    "Kimi Räikkönen": "Кими Райкконен",
    "Antonio Giovinazzi": "Антонио Джовинацци",
    "Robert Kubica": "Роберт Кубица",
    "Nicholas Latifi": "Николас Латифи",
};

const DRIVER_NAME_WORD_LABELS = {
    Charles: "Шарль",
    Lewis: "Льюис",
    George: "Джордж",
    Sergio: "Серхио",
    Fernando: "Фернандо",
    Pierre: "Пьер",
    Esteban: "Эстебан",
    Yuki: "Юки",
    Daniel: "Даниэль",
    Alexander: "Александр",
    Alex: "Алекс",
    Logan: "Логан",
    Valtteri: "Валттери",
    Zhou: "Чжоу",
    Guanyu: "Гуаньюй",
    Kevin: "Кевин",
    Nico: "Нико",
    Oliver: "Оливер",
    Ollie: "Олли",
    Franco: "Франко",
    Liam: "Лиам",
    Andrea: "Андреа",
    Isack: "Исаак",
    Gabriel: "Габриэл",
    Jack: "Джек",
    Nyck: "Ник",
    Mick: "Мик",
    Sebastian: "Себастьян",
    Antonio: "Антонио",
    Robert: "Роберт",
    Nicholas: "Николас",
    Verstappen: "Ферстаппен",
    Perez: "Перес",
    Leclerc: "Леклер",
    Sainz: "Сайнс",
    Hamilton: "Хэмилтон",
    Russell: "Расселл",
    Norris: "Норрис",
    Piastri: "Пиастри",
    Alonso: "Алонсо",
    Stroll: "Стролл",
    Gasly: "Гасли",
    Ocon: "Окон",
    Tsunoda: "Цунода",
    Ricciardo: "Риккардо",
    Albon: "Албон",
    Sargeant: "Сарджент",
    Bottas: "Боттас",
    Magnussen: "Магнуссен",
    Hulkenberg: "Хюлькенберг",
    Bearman: "Берман",
    Colapinto: "Колапинто",
    Lawson: "Лоусон",
    Antonelli: "Антонелли",
    Hadjar: "Хаджар",
    Bortoleto: "Бортолето",
    Doohan: "Дуэн",
    Vettel: "Феттель",
    Raikkonen: "Райкконен",
    Giovinazzi: "Джовинацци",
    Kubica: "Кубица",
    Latifi: "Латифи",
    Schumacher: "Шумахер",
    de: "де",
    van: "ван",
    der: "дер",
};

const elements = {
    seasonSelect: document.getElementById("season-select"),
    raceSelect: document.getElementById("race-select"),
    sessionSelect: document.getElementById("session-select"),
    driverSelect: document.getElementById("driver-select"),
    lapsTableHead: document.getElementById("laps-table-head"),
    lapsTableBody: document.getElementById("laps-table-body"),
    trackTemp: document.getElementById("track-temp"),
    airTemp: document.getElementById("air-temp"),
    windSpeed: document.getElementById("wind-speed"),
    speedChart: document.getElementById("speed-rpm-chart"),
    controlsChart: document.getElementById("throttle-brake-chart"),
    rpmChart: document.getElementById("rpm-chart"),
    timeSlider: document.querySelector(".dashboard-timeline #time-slider"),
    timeInput: document.querySelector(".dashboard-timeline #time-input"),
    sliderLapTime: document.querySelector(".dashboard-timeline #slider-lap-time"),
    chartCursorLabel: document.querySelector(".dashboard-timeline #chart-cursor-label"),
    speedCurrentValue: document.getElementById("speed-current-value"),
    controlsCurrentValue: document.getElementById("controls-current-value"),
    rpmCurrentValue: document.getElementById("rpm-current-value"),
    trackMap: document.getElementById("track-map"),
    lapStats: document.getElementById("lap-stats"),
    sectorStats: document.getElementById("sector-stats"),
    contentShell: document.getElementById("content-shell"),
    sessionOverviewCard: document.getElementById("session-overview-card"),
    lapsCard: document.getElementById("laps-card"),
    dashboardMain: document.getElementById("dashboard-main"),
    loadingOverlay: document.getElementById("loading-overlay"),
    loadingSpinner: document.getElementById("loading-spinner"),
    loadingLabel: document.getElementById("loading-label"),
};

const blockingLoadState = {
    pendingCount: 0,
    timerId: null,
    message: "",
};

const defaultPromptMessage = "Выберите сезон, гран-при, сессию и пилота, чтобы открыть телеметрию.";
const selectPlaceholders = {
    season: "Выберите сезон",
    race: "Выберите гран-при",
    session: "Выберите сессию",
    driver: "Выберите пилота",
};
const plotlyConfig = {
    responsive: true,
    displayModeBar: false,
    displaylogo: false,
};
let resizeFrameId = null;
let dashboardResizeObserver = null;
let cursorFrameId = null;
let pendingCursorIndex = null;

document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    setupLayoutObservers();
    resetDashboard();
    loadSeasons();
});

function bindEvents() {
    elements.seasonSelect.addEventListener("change", handleSeasonChange);
    elements.raceSelect.addEventListener("change", handleRaceChange);
    elements.sessionSelect.addEventListener("change", handleSessionChange);
    elements.driverSelect.addEventListener("mousedown", handleDriverSelectRetryPointerDown);
    elements.driverSelect.addEventListener("change", handleDriverChange);
    elements.lapsTableBody.addEventListener("click", handleLapRowClick);
    elements.timeSlider.addEventListener("input", handleTimeSliderInput);
    elements.timeInput.addEventListener("change", handleTimeInputChange);
    elements.timeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleTimeInputChange();
        }
    });
}

async function fetchJSON(path, { timeoutMs = 0, method = "GET" } = {}) {
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timeoutId = controller
        ? window.setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
        const response = await fetch(path, {
            method,
            signal: controller?.signal,
        });
        if (!response.ok) {
            throw new Error(`Request failed: ${path}`);
        }
        return response.json();
    } finally {
        if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
        }
    }
}

function fetchWithCache(cache, key, loader) {
    if (cache.has(key)) {
        return cache.get(key);
    }

    const request = Promise.resolve()
        .then(loader)
        .catch((error) => {
            cache.delete(key);
            throw error;
        });

    cache.set(key, request);
    return request;
}

function getRaces(seasonId) {
    return fetchWithCache(state.cache.races, seasonId, () => fetchJSON(`/races?season_id=${seasonId}`));
}

function getSessions(raceId) {
    return fetchWithCache(state.cache.sessions, raceId, () => fetchJSON(`/sessions?race_id=${raceId}`));
}

function getLaps(sessionId, driverId) {
    return fetchWithCache(
        state.cache.laps,
        `${sessionId}:${driverId}`,
        () => fetchJSON(`/laps?session_id=${sessionId}&driver_id=${driverId}`)
    );
}

function getLapDetail(lapId) {
    return fetchWithCache(state.cache.lapDetails, lapId, async () => {
        const maxAttempts = 25;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const detail = await fetchJSON(`/lap-detail?lap_id=${lapId}`);
            if (!detail.loading) {
                return detail;
            }
            if (attempt >= maxAttempts) {
                break;
            }
            // Poll more frequently during the cold FastF1 path so the UI can
            // pick up the ready result as soon as the background warmup
            // completes instead of waiting additional multi-second gaps.
            const waitMs = attempt <= 8 ? 350 : 600;
            await new Promise((resolve) => window.setTimeout(resolve, waitMs));
        }
        throw new Error(`Telemetry loading timed out for lap ${lapId}`);
    });
}

function setLoadingSelect(selectElement, placeholder) {
    selectElement.innerHTML = "";

    const option = document.createElement("option");
    option.textContent = placeholder;
    option.value = "";
    option.disabled = true;
    option.selected = true;

    selectElement.appendChild(option);
    selectElement.disabled = true;
}

function setRetrySelectMessage(selectElement, message) {
    selectElement.innerHTML = "";

    const option = document.createElement("option");
    option.textContent = message;
    option.value = "__retry__";
    option.selected = true;

    selectElement.appendChild(option);
    selectElement.disabled = false;
    selectElement.dataset.retryable = "true";
}

function setDisabledSelectMessage(selectElement, message) {
    selectElement.innerHTML = "";

    const option = document.createElement("option");
    option.textContent = message;
    option.value = "";
    option.disabled = true;
    option.selected = true;

    selectElement.appendChild(option);
    selectElement.disabled = true;
    delete selectElement.dataset.retryable;
}

async function triggerSessionMetadataWarmup(sessionId) {
    try {
        await fetchJSON(`/session-metadata-warmup?session_id=${sessionId}`, {
            method: "POST",
            timeoutMs: 4000,
        });
    } catch (error) {
        console.warn("Session metadata warmup failed", sessionId, error);
    }
}

async function loadSessionDetailWithRetry(sessionId, attempts = 20) {
    // Use pre-fetched result if available and valid
    const prefetched = state.cache.sessionDetails.get(sessionId);
    if (prefetched) {
        try {
            const cached = await prefetched;
            if (cached && Array.isArray(cached.drivers) && cached.drivers.length > 0) {
                return cached;
            }
        } catch {
            // fall through
        }
        state.cache.sessionDetails.delete(sessionId);
    }

    let lastError = null;
    await triggerSessionMetadataWarmup(sessionId);

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const detail = await fetchJSON(`/session-detail?session_id=${sessionId}`, {
                timeoutMs: 3500,
            });

            const hasDrivers = Array.isArray(detail?.drivers) && detail.drivers.length > 0;
            const isHydrated = Boolean(detail?.session?.laps_hydrated);
            if (hasDrivers || isHydrated) {
                state.cache.sessionDetails.set(sessionId, Promise.resolve(detail));
                return detail;
            }

            lastError = new Error(`Session detail is not ready yet: ${sessionId}`);
        } catch (error) {
            lastError = error;
        }

        state.cache.sessionDetails.delete(sessionId);
        if (attempt >= attempts) {
            break;
        }

        const waitMs = Math.min(400 + (attempt - 1) * 300, 1800);
        await new Promise((resolve) => window.setTimeout(resolve, waitMs));
    }

    throw lastError;
}

function handleDriverSelectRetryPointerDown(event) {
    if (elements.driverSelect.dataset.retryable !== "true" || !state.currentSession?.id) {
        return;
    }

    event.preventDefault();
    void handleSessionChange();
}

function getPromptOverlayMessage() {
    if (!state.currentSeason) {
        return "Выберите сезон, гран-при, сессию и пилота, чтобы открыть телеметрию.";
    }
    if (!state.currentRace) {
        return "Выберите гран-при, затем сессию и пилота, чтобы открыть телеметрию.";
    }
    if (!state.currentSession) {
        return "Выберите сессию, чтобы открыть пилотов и данные сессии.";
    }
    if (!state.currentDriver) {
        return "Выберите пилота, чтобы посмотреть его круги.";
    }
    if (!state.selectedLap) {
        return "Выберите круг в таблице, чтобы построить графики и карту трассы.";
    }
    return defaultPromptMessage;
}

function setPromptLockState(element, isLocked, message) {
    if (!element) {
        return;
    }

    element.classList.toggle("is-locked", isLocked);
    element.setAttribute("data-prompt-message", isLocked ? message : "");
}

function getLapsPromptMessage() {
    if (!state.currentSeason) {
        return "Выберите сезон, затем гран-при, сессию и пилота, чтобы открыть круги.";
    }
    if (!state.currentRace) {
        return "Выберите гран-при, чтобы продолжить выбор параметров.";
    }
    if (!state.currentSession) {
        return "Выберите сессию, чтобы открыть список пилотов.";
    }
    if (!state.currentDriver) {
        return "Выберите пилота, чтобы загрузить все его круги.";
    }
    return "";
}

function getTelemetryPromptMessage() {
    if (!state.currentSeason) {
        return "Выберите сезон, гран-при, сессию, пилота и круг, чтобы открыть телеметрию.";
    }
    if (!state.currentRace) {
        return "Выберите гран-при, чтобы продолжить настройку телеметрии.";
    }
    if (!state.currentSession) {
        return "Выберите сессию, чтобы загрузить пилотов и погодные данные.";
    }
    if (!state.currentDriver) {
        return "Выберите пилота, чтобы открыть круги и подготовить телеметрию.";
    }
    if (!state.selectedLap) {
        return "Выберите круг в таблице, чтобы построить графики, карту трассы и статистику.";
    }
    return "";
}

function syncPromptState() {
    const lapsLocked = !state.currentDriver;
    const telemetryLocked = !state.selectedLap;

    if (elements.contentShell) {
        elements.contentShell.classList.toggle(
            "is-prompt-mode",
            lapsLocked || telemetryLocked
        );
    }

    setPromptLockState(
        elements.lapsCard,
        lapsLocked,
        getLapsPromptMessage()
    );
    setPromptLockState(
        elements.dashboardMain,
        telemetryLocked,
        getTelemetryPromptMessage()
    );
}

function setOverlayMode(mode, message) {
    if (!elements.loadingOverlay) {
        return;
    }

    const isVisible = mode !== "hidden";
    elements.loadingOverlay.classList.toggle("is-visible", isVisible);
    elements.loadingOverlay.classList.toggle("is-loading", mode === "loading");
    elements.loadingOverlay.classList.toggle("is-prompt", mode === "prompt");
    elements.loadingOverlay.setAttribute("aria-hidden", isVisible ? "false" : "true");

    if (elements.loadingLabel) {
        elements.loadingLabel.textContent = message;
    }
    if (elements.loadingSpinner) {
        elements.loadingSpinner.setAttribute("aria-hidden", mode === "loading" ? "false" : "true");
    }
}

function syncOverlayState() {
    if (blockingLoadState.pendingCount > 0) {
        return;
    }

    setOverlayMode("hidden", "");
    syncPromptState();
}

function beginBlockingLoad(message) {
    blockingLoadState.pendingCount += 1;
    blockingLoadState.message = message;
    setOverlayMode("loading", message);

    if (blockingLoadState.pendingCount > 1) {
        return;
    }

    blockingLoadState.timerId = window.setTimeout(() => {
        if (blockingLoadState.pendingCount > 0) {
            setOverlayMode("loading", blockingLoadState.message);
        }
    }, 160);
}

function endBlockingLoad() {
    blockingLoadState.pendingCount = Math.max(0, blockingLoadState.pendingCount - 1);
    if (blockingLoadState.pendingCount > 0) {
        return;
    }

    if (blockingLoadState.timerId !== null) {
        window.clearTimeout(blockingLoadState.timerId);
        blockingLoadState.timerId = null;
    }

    blockingLoadState.message = "";
    syncOverlayState();
}

function scheduleBackgroundWork(task) {
    if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => void task());
        return;
    }

    window.setTimeout(() => void task(), 0);
}

function cancelPendingCursorUpdate() {
    pendingCursorIndex = null;
    if (cursorFrameId !== null) {
        cancelAnimationFrame(cursorFrameId);
        cursorFrameId = null;
    }
}

function scheduleCursorUpdate(index) {
    pendingCursorIndex = index;
    if (cursorFrameId !== null) {
        return;
    }

    cursorFrameId = requestAnimationFrame(() => {
        cursorFrameId = null;
        const nextIndex = pendingCursorIndex;
        pendingCursorIndex = null;
        if (Number.isFinite(nextIndex)) {
            updateCursor(nextIndex);
        }
    });
}

function handleTimeSliderInput() {
    if (!state.activeLapView?.telemetry?.length) {
        return;
    }

    const timestamp = Number(elements.timeSlider.value);
    if (!Number.isFinite(timestamp)) {
        return;
    }

    scheduleCursorUpdate(findClosestTelemetryIndex(timestamp));
}

function resizeTelemetryVisuals() {
    if (resizeFrameId !== null) {
        cancelAnimationFrame(resizeFrameId);
    }

    resizeFrameId = requestAnimationFrame(() => {
        resizeFrameId = null;

        [elements.speedChart, elements.controlsChart, elements.rpmChart].forEach((chartElement) => {
            if (!chartElement || !chartElement.data) {
                return;
            }

            Plotly.Plots.resize(chartElement);
        });

        if (state.telemetry.length) {
            renderTrackMap();
        }
    });
}

function setupLayoutObservers() {
    window.addEventListener("resize", resizeTelemetryVisuals);

    if (typeof ResizeObserver !== "function") {
        return;
    }

    const resizeTarget = document.querySelector(".dashboard-main");
    if (!resizeTarget) {
        return;
    }

    dashboardResizeObserver = new ResizeObserver(() => {
        resizeTelemetryVisuals();
    });
    dashboardResizeObserver.observe(resizeTarget);
}

function prewarmSessionMetadata(sessionIds) {
    const pendingIds = sessionIds.filter((sessionId) => (
        sessionId && !state.cache.sessionMetadataWarmups.has(sessionId)
    ));
    if (!pendingIds.length) {
        return;
    }

    pendingIds.forEach((sessionId) => state.cache.sessionMetadataWarmups.add(sessionId));
    scheduleBackgroundWork(async () => {
        await Promise.allSettled(pendingIds.map(async (sessionId) => {
            try {
                const response = await fetch(`/session-metadata-warmup?session_id=${sessionId}`, { method: "POST" });
                if (!response.ok) {
                    throw new Error(`Metadata warmup request failed: ${sessionId}`);
                }
            } catch (error) {
                state.cache.sessionMetadataWarmups.delete(sessionId);
                console.warn("Session metadata warmup failed", sessionId, error);
            }
        }));
    });
}

function prewarmSessionTelemetry(sessionId) {
    if (!sessionId || state.cache.telemetryWarmups.has(sessionId)) {
        return;
    }

    state.cache.telemetryWarmups.add(sessionId);
    scheduleBackgroundWork(async () => {
        try {
            const response = await fetch(`/session-telemetry-warmup?session_id=${sessionId}`, { method: "POST" });
            if (!response.ok) {
                throw new Error(`Warmup request failed: ${sessionId}`);
            }
        } catch (error) {
            state.cache.telemetryWarmups.delete(sessionId);
            console.warn("Session telemetry warmup failed", sessionId, error);
        }
    });
}

function getSessionTelemetryWarmupPriority(session) {
    const type = String(session?.session_type || "").toLowerCase();
    if (type.includes("race")) {
        return 0;
    }
    if (type.includes("qualifying")) {
        return 1;
    }
    if (type.includes("sprint")) {
        return 2;
    }
    if (type.includes("practice 3") || type.includes("free practice 3")) {
        return 3;
    }
    if (type.includes("practice 2") || type.includes("free practice 2")) {
        return 4;
    }
    if (type.includes("practice 1") || type.includes("free practice 1")) {
        return 5;
    }
    return 6;
}

function prewarmPrioritySessionTelemetry(sessions) {
    const warmCandidates = [...sessions]
        .sort((left, right) => {
            const priorityDelta = getSessionTelemetryWarmupPriority(left) - getSessionTelemetryWarmupPriority(right);
            if (priorityDelta !== 0) {
                return priorityDelta;
            }
            return Number(left?.session_index || 0) - Number(right?.session_index || 0);
        })
        .slice(0, 3);

    warmCandidates.forEach((session, index) => {
        window.setTimeout(() => {
            prewarmSessionTelemetry(session.id);
        }, index * 600);
    });
}

function prewarmSessionDetails(sessions) {
    // Pre-fetch session details in background after a short delay to let warmup start first.
    // For already-hydrated sessions this returns almost instantly (~100ms) and gets cached,
    // so when the user selects a session the driver list appears immediately.
    window.setTimeout(() => {
        sessions.forEach((session) => {
            if (state.cache.sessionDetails.has(session.id)) {
                return;
            }
            const promise = fetchJSON(`/session-detail?session_id=${session.id}`, { timeoutMs: 5000 })
                .then((detail) => {
                    const hasDrivers = Array.isArray(detail?.drivers) && detail.drivers.length > 0;
                    if (!hasDrivers) {
                        state.cache.sessionDetails.delete(session.id);
                        return null;
                    }
                    return detail;
                })
                .catch(() => {
                    state.cache.sessionDetails.delete(session.id);
                    return null;
                });
            state.cache.sessionDetails.set(session.id, promise);
        });
    }, 1500);
}

function formatRaceLabel(race) {
    return localizeGrandPrixName(race?.name);
}

function normalizeLatinText(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "");
}

function transliterateLatinWord(word) {
    const normalizedWord = normalizeLatinText(word);
    const exactWord = DRIVER_NAME_WORD_LABELS[normalizedWord];
    if (exactWord) {
        return exactWord;
    }

    let lower = normalizedWord.toLowerCase();
    const replacements = [
        ["shch", "щ"],
        ["sch", "ш"],
        ["yo", "ё"],
        ["yu", "ю"],
        ["ya", "я"],
        ["ye", "е"],
        ["zh", "ж"],
        ["kh", "х"],
        ["ts", "ц"],
        ["ch", "ч"],
        ["sh", "ш"],
        ["th", "т"],
        ["ph", "ф"],
        ["ck", "к"],
        ["qu", "кв"],
    ];

    replacements.forEach(([from, to]) => {
        lower = lower.replaceAll(from, to);
    });

    const charMap = {
        a: "а",
        b: "б",
        c: "к",
        d: "д",
        e: "е",
        f: "ф",
        g: "г",
        h: "х",
        i: "и",
        j: "дж",
        k: "к",
        l: "л",
        m: "м",
        n: "н",
        o: "о",
        p: "п",
        q: "к",
        r: "р",
        s: "с",
        t: "т",
        u: "у",
        v: "в",
        w: "в",
        x: "кс",
        y: "й",
        z: "з",
        "-": "-",
        "'": "'",
        " ": " ",
    };

    const transliterated = Array.from(lower)
        .map((char) => charMap[char] ?? char)
        .join("");

    return transliterated
        ? transliterated.charAt(0).toUpperCase() + transliterated.slice(1)
        : normalizedWord;
}

function localizePersonName(name) {
    const normalizedName = normalizeLatinText(name).trim();
    if (!normalizedName) {
        return "";
    }

    if (!/[A-Za-z]/.test(normalizedName)) {
        return normalizedName;
    }

    const exactName = DRIVER_NAME_LABELS[normalizedName];
    if (exactName) {
        return exactName;
    }

    return normalizedName
        .split(/(\s+|-)/)
        .map((part) => {
            if (/^\s+$/.test(part) || part === "-") {
                return part;
            }
            return transliterateLatinWord(part);
        })
        .join("");
}

function localizeSessionType(sessionType) {
    const normalizedType = String(sessionType || "").trim();
    return SESSION_TYPE_LABELS[normalizedType] || localizePersonName(normalizedType);
}

function localizeGrandPrixName(name) {
    const rawName = String(name || "").trim();
    const baseName = rawName.replace(/\s+Grand Prix$/i, "");
    return GRAND_PRIX_NAME_LABELS[baseName] || localizePersonName(baseName);
}

function formatDriverLabel(driver) {
    const code = String(driver?.code || "").trim();
    const localizedName = localizePersonName(driver?.name);
    if (!localizedName) {
        return code || "---";
    }
    if (!code) {
        return localizedName;
    }
    return `${code} - ${localizedName}`;
}

async function loadSeasons() {
    try {
        state.seasons = await fetchJSON("/seasons");
        populateSelect(elements.seasonSelect, state.seasons, selectPlaceholders.season, (item) => item.year);
        syncPromptState();
    } catch (error) {
        showDashboardMessage("Unable to load seasons.");
        console.error(error);
    }
}

async function handleSeasonChange() {
    beginBlockingLoad("Загрузка этапов...");
    try {
        resetSelection("season");
        const seasonId = Number(elements.seasonSelect.value);
        state.currentSeason = state.seasons.find((season) => season.id === seasonId) || null;
        syncPromptState();
        if (!state.currentSeason) {
            return;
        }

        state.races = await getRaces(seasonId);
        if (Number(elements.seasonSelect.value) !== seasonId) {
            return;
        }
        populateSelect(elements.raceSelect, state.races, selectPlaceholders.race, formatRaceLabel);
    } catch (error) {
        handleSelectionError("Unable to load races for the selected season.", error);
    } finally {
        endBlockingLoad();
    }
}

async function handleRaceChange() {
    beginBlockingLoad("Загрузка сессий...");
    try {
        resetSelection("race");
        const raceId = Number(elements.raceSelect.value);
        state.currentRace = state.races.find((race) => race.id === raceId) || null;
        syncPromptState();
        if (!state.currentRace) {
            return;
        }

        state.sessions = await getSessions(raceId);
        if (Number(elements.raceSelect.value) !== raceId) {
            return;
        }
        populateSelect(elements.sessionSelect, state.sessions, selectPlaceholders.session, (item) => localizeSessionType(item.session_type));
        prewarmSessionMetadata(state.sessions.map((session) => session.id));
        prewarmPrioritySessionTelemetry(state.sessions);
        prewarmSessionDetails(state.sessions);
    } catch (error) {
        handleSelectionError("Unable to load sessions for the selected race.", error);
    } finally {
        endBlockingLoad();
    }
}

async function handleSessionChange() {
    beginBlockingLoad("Загрузка пилотов и данных сессии...");
    try {
        resetSelection("session");
        const sessionId = Number(elements.sessionSelect.value);
        state.currentSession = state.sessions.find((session) => session.id === sessionId) || null;
        syncPromptState();
        if (!state.currentSession) {
            return;
        }

        prewarmSessionTelemetry(sessionId);
        setLoadingSelect(elements.driverSelect, "Загрузка пилотов...");
        const detail = await loadSessionDetailWithRetry(sessionId);
        if (Number(elements.sessionSelect.value) !== sessionId) {
            return;
        }

        state.currentSession = detail.session;
        state.sessions = state.sessions.map((session) => (
            session.id === detail.session.id ? detail.session : session
        ));
        state.drivers = detail.drivers;
        syncPromptState();
        updateWeather(detail.session);
        populateSelect(
            elements.driverSelect,
            state.drivers,
            selectPlaceholders.driver,
            (item) => formatDriverLabel(item)
        );
        delete elements.driverSelect.dataset.retryable;
        prewarmSessionTelemetry(sessionId);
    } catch (error) {
        setRetrySelectMessage(elements.driverSelect, "Нажмите, чтобы повторить загрузку пилотов");
        handleSelectionError("Unable to load drivers for the selected session.", error);
    } finally {
        endBlockingLoad();
    }
}

async function handleDriverChange() {
    beginBlockingLoad("Загрузка кругов...");
    try {
        resetSelection("driver");
        if (elements.driverSelect.value === "__retry__") {
            await handleSessionChange();
            return;
        }
        const driverId = Number(elements.driverSelect.value);
        const sessionId = state.currentSession?.id;
        state.currentDriver = state.drivers.find((driver) => driver.id === driverId) || null;
        syncPromptState();
        if (!state.currentDriver || !sessionId) {
            return;
        }

        renderLapTable("Загрузка кругов...");
        state.laps = await getLaps(sessionId, driverId);
        if (Number(elements.driverSelect.value) !== driverId || state.currentSession?.id !== sessionId) {
            return;
        }
        renderLapTable();

        const defaultLap = getFastestLap(state.laps) || state.laps[0] || null;
        if (!defaultLap) {
            clearTelemetryView();
            return;
        }

        const referenceLap = getReferenceLapCandidate(state.laps, defaultLap);
        const defaultDetailPromise = getLapDetail(defaultLap.id);
        const referenceDetailPromise = referenceLap && referenceLap.id !== defaultLap.id
            ? getLapDetail(referenceLap.id)
            : defaultDetailPromise;

        void defaultDetailPromise.catch((error) => {
            console.warn("Lap prefetch failed", defaultLap.id, error);
        });
        if (referenceLap && referenceLap.id !== defaultLap.id) {
            void referenceDetailPromise.catch((error) => {
                console.warn("Reference lap prefetch failed", referenceLap.id, error);
            });
        }

        await selectLap(defaultLap.id, {
            driverId,
            sessionId,
            detailPromise: defaultDetailPromise,
        });
    } catch (error) {
        handleSelectionError("Unable to load laps for the selected driver.", error);
    } finally {
        endBlockingLoad();
    }
}

function getFastestLap(laps) {
    const timedLaps = laps.filter((lap) => Number.isFinite(lap?.lap_time));
    if (!timedLaps.length) {
        return null;
    }

    return timedLaps.reduce(
        (bestLap, lap) => (lap.lap_time < bestLap.lap_time ? lap : bestLap),
        timedLaps[0]
    );
}

function hasCompleteLapMetrics(lap = state.selectedLap, summary = state.summary) {
    const lapType = getLapTypeValue(lap);
    const hasLapTime = Number.isFinite(summary?.lap_time ?? lap?.lap_time);
    const hasAllSectors = [
        summary?.sector1 ?? lap?.sector1,
        summary?.sector2 ?? lap?.sector2,
        summary?.sector3 ?? lap?.sector3,
    ].every((value) => Number.isFinite(value));

    return hasLapTime && hasAllSectors && !lapType.includes("out") && !lapType.includes("in");
}

function getReferenceLapCandidate(laps = state.laps, preferredLap = state.selectedLap, preferredSummary = state.summary) {
    if (preferredLap && hasCompleteLapMetrics(preferredLap, preferredSummary)) {
        return preferredLap;
    }

    const candidates = laps.filter((lap) => hasCompleteLapMetrics(lap));
    return getFastestLap(candidates) || candidates[0] || null;
}

function getLapTypeKey(laps) {
    const hasOwn = (item, key) => Object.prototype.hasOwnProperty.call(item, key);
    const lap = laps.find((item) => item && (hasOwn(item, "lap_type") || hasOwn(item, "type")));
    if (!lap) {
        return null;
    }

    if (hasOwn(lap, "lap_type")) {
        return "lap_type";
    }

    return "type";
}

function formatLapCellTime(value) {
    return Number.isFinite(value) ? formatLapTime(value) : "--";
}

function formatSectorCellTime(value) {
    return Number.isFinite(value) ? value.toFixed(3) : "--";
}

function getLapStatusText(lap, lapTypeKey, rowIndex) {
    const rawType = String(lap?.[lapTypeKey] || "").trim().toLowerCase();
    const hasLapTime = Number.isFinite(lap?.lap_time);
    const sectorValues = [lap?.sector1, lap?.sector2, lap?.sector3];
    const missingSectorCount = sectorValues.filter((value) => !Number.isFinite(value)).length;

    if (rawType.includes("out")) {
        return { isIncomplete: true, badge: "OUT", timeLabel: "Выезд" };
    }

    if (rawType.includes("in")) {
        return { isIncomplete: true, badge: "IN", timeLabel: "Заезд" };
    }

    if (rowIndex === 0) {
        return {
            isIncomplete: true,
            badge: "OUT",
            timeLabel: "Выезд",
        };
    }

    if (!hasLapTime || missingSectorCount > 0) {
        return { isIncomplete: true, badge: "INC", timeLabel: "Неполн." };
    }

    return { isIncomplete: false, badge: "", timeLabel: formatLapTime(lap.lap_time) };
}

function renderSectorCell(value) {
    if (Number.isFinite(value)) {
        return `<td>${formatSectorCellTime(value)}</td>`;
    }

    return `<td class="laps-cell-muted">—</td>`;
}

function renderLapTable(message = "") {
    const hasLapType = Boolean(getLapTypeKey(state.laps));
    const headers = ["Круг", "Время", "S1", "S2", "S3"];
    if (hasLapType) {
        headers.push("Тип круга");
    }

    elements.lapsTableHead.innerHTML = `
        <tr>${headers.map((label) => `<th scope="col">${label}</th>`).join("")}</tr>
    `;

    if (message) {
        elements.lapsTableBody.innerHTML = `
            <tr class="laps-empty-row">
                <td colspan="${headers.length}">${message}</td>
            </tr>
        `;
        return;
    }

    if (!state.laps.length) {
        elements.lapsTableBody.innerHTML = `
            <tr class="laps-empty-row">
                <td colspan="${headers.length}">Для выбранного пилота круги не найдены.</td>
            </tr>
        `;
        return;
    }

    const fastestLap = getFastestLap(state.laps);
    const lapTypeKey = getLapTypeKey(state.laps);

    elements.lapsTableBody.innerHTML = state.laps
        .map((lap, rowIndex) => {
            const isSelected = state.selectedLap?.id === lap.id;
            const isFastest = fastestLap?.id === lap.id;
            const displayState = getLapStatusText(lap, lapTypeKey, rowIndex);
            const statusBadge = displayState.badge
                ? `<span class="laps-status-badge">${displayState.badge}</span>`
                : "";
            const lapLabel = `${isFastest ? "★ " : ""}${lap.lap_number}${statusBadge}`;
            const typeCell = lapTypeKey ? `<td>${lap[lapTypeKey] || "--"}</td>` : "";
            const rowClass = [
                isSelected ? "is-selected" : "",
                isFastest ? "is-fastest" : "",
                displayState.isIncomplete ? "is-incomplete" : "",
            ]
                .filter(Boolean)
                .join(" ");

            return `
                <tr
                    class="${rowClass}"
                    data-lap-id="${lap.id}"
                >
                    <td>${lapLabel}</td>
                    <td class="${displayState.isIncomplete ? "laps-cell-status" : ""}">${displayState.timeLabel}</td>
                    ${renderSectorCell(lap.sector1)}
                    ${renderSectorCell(lap.sector2)}
                    ${renderSectorCell(lap.sector3)}
                    ${typeCell}
                </tr>
            `;
        })
        .join("");
}

function handleLapRowClick(event) {
    const row = event.target.closest("tr[data-lap-id]");
    if (!row) {
        return;
    }

    const lapId = Number(row.dataset.lapId);
    if (!lapId || state.selectedLap?.id === lapId) {
        return;
    }

    void selectLap(lapId, {
        driverId: state.currentDriver?.id,
        sessionId: state.currentSession?.id,
    });
}

async function selectLap(lapId, { driverId, sessionId, detailPromise = null } = {}) {
    beginBlockingLoad("Загрузка телеметрии...");

    const fastf1MessageTimer = window.setTimeout(() => {
        if (blockingLoadState.pendingCount > 0) {
            setOverlayMode("loading", "Загрузка данных FastF1... может занять до минуты при первом запросе");
        }
    }, 3500);

    try {
        const lap = state.laps.find((item) => item.id === lapId) || null;
        state.selectedLap = lap;
        syncPromptState();
        renderLapTable();

        if (!lap) {
            clearTelemetryView();
            return;
        }

        clearTelemetryView();
        renderEmptyCharts("Загрузка телеметрии...");
        const detail = await (detailPromise || getLapDetail(lapId));
        if (
            state.selectedLap?.id !== lapId ||
            (driverId && state.currentDriver?.id !== driverId) ||
            (sessionId && state.currentSession?.id !== sessionId)
        ) {
            return;
        }

        state.telemetry = detail.telemetry;
        state.summary = detail.summary;
        state.cursorIndex = 0;
        const activeTrackName = state.currentRace?.track_name || getCurrentTrackLayout().label;
        state.activeLapView = prepareTelemetryViewModel(
            detail.telemetry,
            detail.summary,
            lap.id,
            activeTrackName
        );
        syncPromptState();

        renderTelemetry();
        renderSummary();
        void ensureReferenceTrack({
            sessionId,
            trackName: activeTrackName,
            preferredLap: lap,
            preferredTelemetry: detail.telemetry,
            preferredSummary: detail.summary,
        }).then((referenceLayout) => {
            if (
                !referenceLayout ||
                state.selectedLap?.id !== lapId ||
                (driverId && state.currentDriver?.id !== driverId) ||
                (sessionId && state.currentSession?.id !== sessionId)
            ) {
                return;
            }

            state.cache.preparedLapViews.delete(getPreparedLapViewCacheKey(lap.id, state.telemetry, activeTrackName));
            state.activeLapView = prepareTelemetryViewModel(
                state.telemetry,
                state.summary,
                lap.id,
                activeTrackName
            );
            renderTrackMap();
        }).catch((error) => {
            console.warn("Reference track refresh failed", error);
        });
    } catch (error) {
        handleSelectionError("Unable to load telemetry for the selected lap.", error);
    } finally {
        window.clearTimeout(fastf1MessageTimer);
        endBlockingLoad();
    }
}

function populateSelect(selectElement, items, placeholder, labelFn) {
    selectElement.innerHTML = "";

    const placeholderOption = document.createElement("option");
    placeholderOption.textContent = placeholder;
    placeholderOption.value = "";
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    selectElement.appendChild(placeholderOption);

    items.forEach((item) => {
        const option = document.createElement("option");
        option.value = String(item.id);
        option.textContent = labelFn(item);
        selectElement.appendChild(option);
    });

    selectElement.disabled = items.length === 0;
    delete selectElement.dataset.retryable;
}

function resetSelection(level) {
    if (level === "season") {
        state.races = [];
        state.sessions = [];
        state.drivers = [];
        state.laps = [];
        state.currentRace = null;
        state.currentSession = null;
        state.currentDriver = null;
        state.selectedLap = null;
        populateSelect(elements.raceSelect, [], selectPlaceholders.race, (item) => localizeGrandPrixName(item.name));
        populateSelect(elements.sessionSelect, [], selectPlaceholders.session, (item) => localizeSessionType(item.session_type));
        populateSelect(elements.driverSelect, [], selectPlaceholders.driver, (item) => formatDriverLabel(item));
        renderLapTable("Выберите пилота, чтобы загрузить круги.");
        updateWeather(null);
    }

    if (level === "race") {
        state.sessions = [];
        state.drivers = [];
        state.laps = [];
        state.currentSession = null;
        state.currentDriver = null;
        state.selectedLap = null;
        populateSelect(elements.sessionSelect, [], selectPlaceholders.session, (item) => localizeSessionType(item.session_type));
        populateSelect(elements.driverSelect, [], selectPlaceholders.driver, (item) => formatDriverLabel(item));
        renderLapTable("Выберите пилота, чтобы загрузить круги.");
        updateWeather(null);
    }

    if (level === "session") {
        state.drivers = [];
        state.laps = [];
        state.currentDriver = null;
        state.selectedLap = null;
        populateSelect(elements.driverSelect, [], selectPlaceholders.driver, (item) => formatDriverLabel(item));
        renderLapTable("Выберите пилота, чтобы загрузить круги.");
        updateWeather(null);
    }

    if (level === "driver") {
        state.laps = [];
        state.selectedLap = null;
        renderLapTable("Загрузка кругов...");
    }

    clearTelemetryView();
}

function clearTelemetryView() {
    cancelPendingCursorUpdate();
    state.telemetry = [];
    state.summary = null;
    state.cursorIndex = 0;
    state.activeLapView = null;
    elements.timeSlider.disabled = true;
    elements.timeSlider.value = "0";
    elements.timeSlider.max = "0";
    if (elements.timeInput) {
        elements.timeInput.disabled = true;
        elements.timeInput.value = "";
    }
    if (elements.sliderLapTime) elements.sliderLapTime.textContent = "--";
    elements.chartCursorLabel.textContent = "-- с";
    renderCurrentTelemetryValues(null);
    renderEmptyCharts();
    renderTrackMap();
    renderSummary();
    syncPromptState();
    syncOverlayState();
}

function resetDashboard() {
    populateSelect(elements.seasonSelect, [], "Загрузка сезонов...", (item) => item.year);
    populateSelect(elements.raceSelect, [], selectPlaceholders.race, (item) => localizeGrandPrixName(item.name));
    populateSelect(elements.sessionSelect, [], selectPlaceholders.session, (item) => localizeSessionType(item.session_type));
    populateSelect(elements.driverSelect, [], selectPlaceholders.driver, (item) => formatDriverLabel(item));
    renderLapTable("Выберите пилота, чтобы загрузить круги.");
    updateWeather(null);
    clearTelemetryView();
    syncPromptState();
}

function renderEmptyCharts(message = "Выберите круг для отображения телеметрии") {
    const emptyLayout = {
        paper_bgcolor: "#000000",
        plot_bgcolor: "#000000",
        font: { color: "#b0b8c4", family: "Inter, Segoe UI, sans-serif" },
        margin: { l: 60, r: 60, t: 20, b: 50 },
        xaxis: { title: "Время (с)", gridcolor: "rgba(255,255,255,0.06)" },
        yaxis: { gridcolor: "rgba(255,255,255,0.06)" },
        annotations: [
            {
                text: message,
                xref: "paper",
                yref: "paper",
                x: 0.5,
                y: 0.5,
                showarrow: false,
                font: { color: "#6b7280", size: 14 },
            },
        ],
    };

    Plotly.react(
        elements.speedChart,
        [],
        { ...emptyLayout, yaxis: { title: "Скорость (км/ч)", gridcolor: "rgba(255,255,255,0.06)" } },
        plotlyConfig
    );
    Plotly.react(
        elements.controlsChart,
        [],
        { ...emptyLayout, yaxis: { title: "Процент (%)", gridcolor: "rgba(255,255,255,0.06)" } },
        plotlyConfig
    );
    Plotly.react(
        elements.rpmChart,
        [],
        { ...emptyLayout, yaxis: { title: "Обороты (RPM)", gridcolor: "rgba(255,255,255,0.06)" } },
        plotlyConfig
    );
}

function clampTelemetryPercent(value) {
    return Math.max(0, Math.min(value ?? 0, 100));
}

function normalizeBrakePercent(value) {
    const brake = Number(value ?? 0);
    if (brake >= 0 && brake <= 1) {
        return brake >= 0.5 ? 100 : 0;
    }
    return clampTelemetryPercent(brake);
}

function sanitizeTelemetryPoint(point) {
    const throttle = clampTelemetryPercent(point?.throttle);
    const brake = normalizeBrakePercent(point?.brake);
    const sanitizedThrottle = throttle >= 85 && brake >= 90 ? 0 : throttle;

    return {
        ...point,
        throttle: sanitizedThrottle,
        brake,
    };
}

const MIN_VALID_TELEMETRY_POINTS = 12;
const TELEMETRY_MAX_REASONABLE_LAP_TIME = 240;
const TELEMETRY_STATIONARY_SPLIT_SECONDS = 8;

function getTelemetryGapThreshold(points) {
    if (points.length < 3) {
        return 3;
    }

    const deltas = [];
    for (let i = 1; i < points.length; i++) {
        const delta = Number(points[i].timestamp) - Number(points[i - 1].timestamp);
        if (Number.isFinite(delta) && delta > 0) {
            deltas.push(delta);
        }
    }

    if (!deltas.length) {
        return 3;
    }

    const medianDelta = getPercentile(deltas, 0.5);
    const upperDelta = getPercentile(deltas, 0.9);
    return Math.max(2.5, medianDelta * 10, upperDelta * 4);
}

function isTelemetryPointMoving(point, previousPoint = null) {
    const speed = Number(point?.speed);
    if (Number.isFinite(speed) && speed > 12) {
        return true;
    }

    if (!previousPoint) {
        return false;
    }

    const deltaTime = Number(point?.timestamp) - Number(previousPoint?.timestamp);
    const deltaDistance = Number(point?.distance) - Number(previousPoint?.distance);
    if (!Number.isFinite(deltaTime) || deltaTime <= 0 || !Number.isFinite(deltaDistance)) {
        return false;
    }

    return deltaDistance / deltaTime > 1.5;
}

function trimTelemetrySegment(segment) {
    if (segment.length < 2) {
        return segment;
    }

    let startIndex = 0;
    for (let i = 1; i < segment.length; i++) {
        if (isTelemetryPointMoving(segment[i], segment[i - 1])) {
            startIndex = Math.max(0, i - 1);
            break;
        }
    }

    let endIndex = segment.length - 1;
    for (let i = segment.length - 1; i >= 1; i--) {
        if (isTelemetryPointMoving(segment[i], segment[i - 1])) {
            endIndex = Math.min(segment.length - 1, i);
            break;
        }
    }

    return segment.slice(startIndex, endIndex + 1);
}

function splitTelemetrySegmentOnStationaryRuns(segment) {
    if (segment.length < 2) {
        return [segment];
    }

    const parts = [];
    let partStart = 0;
    let stationaryStart = null;
    let stationaryDuration = 0;

    for (let i = 1; i < segment.length; i++) {
        const previousPoint = segment[i - 1];
        const currentPoint = segment[i];
        const deltaTime = Number(currentPoint.timestamp) - Number(previousPoint.timestamp);
        const isMoving = isTelemetryPointMoving(currentPoint, previousPoint);

        if (!isMoving && Number.isFinite(deltaTime) && deltaTime > 0) {
            stationaryStart ??= i - 1;
            stationaryDuration += deltaTime;
        } else {
            stationaryStart = null;
            stationaryDuration = 0;
        }

        if (stationaryStart !== null && stationaryDuration >= TELEMETRY_STATIONARY_SPLIT_SECONDS) {
            const segmentBeforePause = trimTelemetrySegment(segment.slice(partStart, stationaryStart + 1));
            if (segmentBeforePause.length >= MIN_VALID_TELEMETRY_POINTS) {
                parts.push(segmentBeforePause);
            }

            partStart = i;
            stationaryStart = null;
            stationaryDuration = 0;
        }
    }

    const tailSegment = trimTelemetrySegment(segment.slice(partStart));
    if (tailSegment.length >= MIN_VALID_TELEMETRY_POINTS) {
        parts.push(tailSegment);
    }

    return parts.length ? parts : [trimTelemetrySegment(segment)];
}

function splitTelemetryIntoValidSegments(points) {
    if (!points.length) {
        return [];
    }

    const gapThreshold = getTelemetryGapThreshold(points);
    const rawSegments = [];
    let segmentStart = 0;

    for (let i = 1; i < points.length; i++) {
        const previousPoint = points[i - 1];
        const currentPoint = points[i];
        const deltaTime = Number(currentPoint.timestamp) - Number(previousPoint.timestamp);
        const deltaDistance = Number(currentPoint.distance) - Number(previousPoint.distance);
        const shouldBreak =
            !Number.isFinite(deltaTime) ||
            deltaTime <= 0 ||
            deltaTime > gapThreshold ||
            (Number.isFinite(deltaDistance) && deltaDistance < -5);

        if (shouldBreak) {
            rawSegments.push(points.slice(segmentStart, i));
            segmentStart = i;
        }
    }

    rawSegments.push(points.slice(segmentStart));

    return rawSegments
        .flatMap((segment) => splitTelemetrySegmentOnStationaryRuns(segment))
        .map((segment) => trimTelemetrySegment(segment))
        .filter((segment) => segment.length >= MIN_VALID_TELEMETRY_POINTS);
}

function getTelemetrySegmentDuration(segment) {
    if (segment.length < 2) {
        return 0;
    }

    const startTime = Number(segment[0]?.timestamp);
    const endTime = Number(segment[segment.length - 1]?.timestamp);
    return Number.isFinite(startTime) && Number.isFinite(endTime)
        ? Math.max(0, endTime - startTime)
        : 0;
}

function chooseBestTelemetrySegment(segments, expectedLapTime = null) {
    if (!segments.length) {
        return [];
    }

    const expectedTime = Number(expectedLapTime);
    return segments.reduce((bestSegment, currentSegment) => {
        const bestDistance = (bestSegment[bestSegment.length - 1]?.distance ?? 0) - (bestSegment[0]?.distance ?? 0);
        const currentDistance = (currentSegment[currentSegment.length - 1]?.distance ?? 0) - (currentSegment[0]?.distance ?? 0);
        const bestDuration = getTelemetrySegmentDuration(bestSegment);
        const currentDuration = getTelemetrySegmentDuration(currentSegment);
        const bestPenalty = Number.isFinite(expectedTime) && expectedTime > 0
            ? Math.abs(bestDuration - expectedTime)
            : 0;
        const currentPenalty = Number.isFinite(expectedTime) && expectedTime > 0
            ? Math.abs(currentDuration - expectedTime)
            : 0;

        const currentScore = currentDistance * 1000 - currentPenalty * 25;
        const bestScore = bestDistance * 1000 - bestPenalty * 25;
        return currentScore > bestScore ? currentSegment : bestSegment;
    }, segments[0]);
}

function buildTelemetrySegment(points, summary, lap = state.selectedLap) {
    const validPoints = points.filter((point) => (
        Number.isFinite(point?.timestamp) &&
        Number.isFinite(point?.distance) &&
        Number.isFinite(point?.speed) &&
        Number.isFinite(point?.rpm)
    ));

    if (!validPoints.length) {
        return {
            telemetry: [],
            visibleDuration: 0,
            displayLapTime: null,
            isIncomplete: true,
        };
    }

    const segments = splitTelemetryIntoValidSegments(validPoints);
    const bestSegment = chooseBestTelemetrySegment(segments, summary?.lap_time);
    if (!bestSegment.length) {
        return {
            telemetry: [],
            visibleDuration: 0,
            displayLapTime: null,
            isIncomplete: true,
        };
    }

    const baseTimestamp = Number(bestSegment[0].timestamp) || 0;
    const baseDistance = Number(bestSegment[0].distance) || 0;
    const normalizedTelemetry = bestSegment.map((point) => ({
        ...point,
        timestamp: Math.max(0, Number(point.timestamp) - baseTimestamp),
        distance: Math.max(0, Number(point.distance) - baseDistance),
    }));
    const visibleDuration = getTelemetrySegmentDuration(normalizedTelemetry);
    const completeLap = hasCompleteLapMetrics(lap, summary);
    const summaryLapTime = Number(summary?.lap_time);
    const reasonableSummaryLapTime = Number.isFinite(summaryLapTime) &&
        summaryLapTime > 0 &&
        summaryLapTime <= TELEMETRY_MAX_REASONABLE_LAP_TIME;

    const displayLapTime = completeLap && reasonableSummaryLapTime
        ? summaryLapTime
        : visibleDuration > 0 && visibleDuration <= TELEMETRY_MAX_REASONABLE_LAP_TIME
            ? visibleDuration
            : null;

    return {
        telemetry: normalizedTelemetry,
        visibleDuration,
        displayLapTime,
        isIncomplete: !completeLap,
    };
}

function getActiveTrackReferenceName() {
    return state.currentRace?.track_name || getCurrentTrackLayout().label;
}

function getPreparedLapViewCacheKey(lapId = state.selectedLap?.id, telemetry = state.telemetry, trackName = getActiveTrackReferenceName()) {
    return `${lapId || "no-lap"}:${normalizeTrackNameKey(trackName)}:${telemetry.length}`;
}

function buildTrackMarkerPositionsFromReference(telemetry, referencePath, projectionDistance) {
    if (!referencePath?.length || !Number.isFinite(projectionDistance) || projectionDistance <= 0) {
        return [];
    }

    return telemetry.map((point) => {
        const distance = Number(point?.distance);
        if (!Number.isFinite(distance)) {
            return null;
        }

        const progress = Math.max(0, Math.min(distance / projectionDistance, 1));
        const [x, y] = getPointAtPathPosition(referencePath, progress);
        return { x, y };
    });
}

function buildTrackMapModel(preparedTelemetry, trackName = getActiveTrackReferenceName()) {
    const telemetry = preparedTelemetry.telemetry;
    const trackLayout = getCurrentTrackLayout();
    const trackAriaLabel = `Track map ${trackLayout.label}`;
    const realTrackLayout = getRealTrackLayoutFromTelemetry(telemetry, trackName);
    const fallbackTrackLayout = getFallbackTrackLayout(trackLayout.pathPoints, trackLayout.label);

    if (realTrackLayout) {
        const segments = [];
        const gradients = [];
        const outlines = [];
        const fallbackBasePath = (fallbackTrackLayout?.pathPoints ?? trackLayout.pathPoints);
        const baseSegments = realTrackLayout.baseSegments?.length
            ? realTrackLayout.baseSegments
            : [fallbackBasePath];

        baseSegments.forEach((segmentPoints) => {
            outlines.push(buildTrackPolylineMarkup(segmentPoints, 6, "rgba(60,60,80,0.4)"));
        });

        realTrackLayout.segments.forEach((segmentPoints, segmentIndex) => {
            for (let i = 1; i < segmentPoints.length; i++) {
                const prev = segmentPoints[i - 1];
                const curr = segmentPoints[i];
                const startColor = preparedTelemetry.smoothedColors[prev.sourceIndex] ?? preparedTelemetry.smoothedColors[0];
                const endColor = preparedTelemetry.smoothedColors[curr.sourceIndex] ?? preparedTelemetry.smoothedColors[0];
                const gradientId = `track-grad-real-${segmentIndex}-${i}`;
                const overlapped = getOverlappedTrackSegment(prev, curr);
                gradients.push(buildTrackGradient(gradientId, startColor, endColor, prev, curr));
                segments.push(buildTrackSegmentMarkup(
                    overlapped.startX,
                    overlapped.startY,
                    overlapped.endX,
                    overlapped.endY,
                    gradientId,
                    5.8
                ));
            }
        });

        if (segments.length) {
            return {
                markup: `
                    <svg viewBox="${realTrackLayout.viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${trackAriaLabel}">
                        <defs>${gradients.join("")}</defs>
                        ${outlines.join("")}
                        ${segments.join("")}
                        ${buildDriverMarkerMarkup(0, 0)}
                    </svg>
                `,
                markerPositions: realTrackLayout.markerPoints,
            };
        }
    }

    const pathPoints = fallbackTrackLayout?.pathPoints ?? trackLayout.pathPoints;
    const vb = fallbackTrackLayout?.viewBox ?? trackLayout.viewBox;

    if (!telemetry.length) {
        const basePath = pathPoints.map((p) => `${p[0]},${p[1]}`).join(" ");
        return {
            markup: `
                <svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${trackAriaLabel}">
                    <polyline points="${basePath}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `,
            markerPositions: [],
        };
    }

    const sampled = samplePathToPoints(pathPoints, telemetry.length);
    const segments = [];
    const gradients = [];
    for (let i = 1; i < sampled.length; i++) {
        const prev = sampled[i - 1];
        const curr = sampled[i];
        const startColor = preparedTelemetry.smoothedColors[i - 1] ?? preparedTelemetry.smoothedColors[0];
        const endColor = preparedTelemetry.smoothedColors[i] ?? preparedTelemetry.smoothedColors[0];
        const gradientId = `track-grad-fallback-${i}`;
        const overlapped = getOverlappedTrackSegment(
            { x: prev[0], y: prev[1] },
            { x: curr[0], y: curr[1] },
            1.8
        );
        gradients.push(buildTrackGradient(
            gradientId,
            startColor,
            endColor,
            { x: prev[0], y: prev[1] },
            { x: curr[0], y: curr[1] }
        ));
        segments.push(buildTrackSegmentMarkup(
            overlapped.startX,
            overlapped.startY,
            overlapped.endX,
            overlapped.endY,
            gradientId,
            6.4
        ));
    }

    const basePath = pathPoints.map((p) => `${p[0]},${p[1]}`).join(" ");
    return {
        markup: `
            <svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${trackAriaLabel}">
                <defs>${gradients.join("")}</defs>
                <polyline points="${basePath}" fill="none" stroke="rgba(60,60,80,0.4)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                ${segments.join("")}
                ${buildDriverMarkerMarkup(0, 0)}
            </svg>
        `,
        markerPositions: sampled.map(([x, y]) => ({ x, y })),
    };
}

function prepareTelemetryViewModel(telemetry, summary, lapId = state.selectedLap?.id, trackName = getActiveTrackReferenceName()) {
    const cacheKey = getPreparedLapViewCacheKey(lapId, telemetry, trackName);
    if (state.cache.preparedLapViews.has(cacheKey)) {
        return state.cache.preparedLapViews.get(cacheKey);
    }

    const telemetrySegment = buildTelemetrySegment(telemetry, summary, state.selectedLap);
    const sanitizedTelemetry = telemetrySegment.telemetry.map(sanitizeTelemetryPoint);
    const timestamps = sanitizedTelemetry.map((point) => point.timestamp);
    const preparedView = {
        telemetry: sanitizedTelemetry,
        timestamps,
        speedValues: sanitizedTelemetry.map((point) => point.speed),
        rpmValues: sanitizedTelemetry.map((point) => point.rpm),
        throttleValues: sanitizedTelemetry.map((point) => point.throttle),
        brakeValues: sanitizedTelemetry.map((point) => point.brake),
        smoothedColors: sanitizedTelemetry.map((_, index) => getSmoothedSegmentColor(sanitizedTelemetry, index)),
        visibleDuration: telemetrySegment.visibleDuration,
        displayLapTime: telemetrySegment.displayLapTime,
        isIncomplete: telemetrySegment.isIncomplete,
    };

    preparedView.xaxisRange = getTelemetryChartRange(sanitizedTelemetry, summary, preparedView.visibleDuration);
    try {
        preparedView.trackMap = buildTrackMapModel(preparedView, trackName);
    } catch (error) {
        console.warn("Track map model fallback activated", error);
        const trackLayout = getCurrentTrackLayout();
        const fallbackTrackLayout = getFallbackTrackLayout(trackLayout.pathPoints, trackLayout.label);
        const pathPoints = fallbackTrackLayout?.pathPoints ?? trackLayout.pathPoints;
        const viewBox = fallbackTrackLayout?.viewBox ?? trackLayout.viewBox;
        const basePath = pathPoints.map((point) => `${point[0]},${point[1]}`).join(" ");

        preparedView.trackMap = {
            markup: `
                <svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Track map ${trackLayout.label}">
                    <polyline points="${basePath}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `,
            markerPositions: [],
        };
    }

    state.cache.preparedLapViews.set(cacheKey, preparedView);
    return preparedView;
}

function renderTelemetry() {
    const telemetry = state.telemetry;
    if (!telemetry.length) {
        renderEmptyCharts();
        renderTrackMap();
        return;
    }

    const preparedTelemetry = state.activeLapView || prepareTelemetryViewModel(telemetry, state.summary);
    state.activeLapView = preparedTelemetry;
    if (!preparedTelemetry.telemetry.length) {
        renderEmptyCharts("Нет непрерывного телеметрического сегмента для выбранного круга");
        renderTrackMap();
        return;
    }

    state.cursorIndex = Math.max(0, Math.min(state.cursorIndex, preparedTelemetry.telemetry.length - 1));

    const cursorTime = preparedTelemetry.telemetry[state.cursorIndex].timestamp;
    const markerShape = buildVerticalMarker(cursorTime);
    const xaxisRange = preparedTelemetry.xaxisRange;

    Plotly.react(
        elements.speedChart,
        [
            {
                x: preparedTelemetry.timestamps,
                y: preparedTelemetry.speedValues,
                name: "Скорость (км/ч)",
                mode: "lines",
                line: { color: "#22c55e", width: 2.5 },
                hovertemplate: "Время %{x:.3f} с<br>Скорость %{y:.0f} км/ч<extra></extra>",
            },
        ],
        {
            paper_bgcolor: "#000000",
            plot_bgcolor: "#000000",
            font: { color: "#b0b8c4", family: "Inter, Segoe UI, sans-serif" },
            margin: { l: 64, r: 34, t: 24, b: 50 },
            hovermode: "x unified",
            legend: { orientation: "h", y: 1.1, x: 0 },
            xaxis: { title: "Время (с)", gridcolor: "rgba(255,255,255,0.06)", range: xaxisRange },
            yaxis: {
                title: "Скорость (км/ч)",
                gridcolor: "rgba(255,255,255,0.06)",
                rangemode: "tozero",
            },
            shapes: [markerShape],
        },
        plotlyConfig
    );

    Plotly.react(
        elements.controlsChart,
        [
            {
                x: preparedTelemetry.timestamps,
                y: preparedTelemetry.brakeValues,
                name: "Тормоз (%)",
                mode: "lines",
                fill: "tozeroy",
                fillcolor: "rgba(239, 68, 68, 0.22)",
                line: {
                    color: "rgba(239, 68, 68, 0.96)",
                    width: 3.8,
                    shape: "linear",
                },
                hovertemplate: "Время %{x:.3f} с<br>Тормоз %{y:.0f}%<extra></extra>",
            },
            {
                x: preparedTelemetry.timestamps,
                y: preparedTelemetry.throttleValues,
                name: "Газ (%)",
                mode: "lines",
                line: { color: "#22c55e", width: 2.6 },
                hovertemplate: "Время %{x:.3f} с<br>Газ %{y:.0f}%<extra></extra>",
            },
        ],
        {
            paper_bgcolor: "#000000",
            plot_bgcolor: "#000000",
            font: { color: "#b0b8c4", family: "Inter, Segoe UI, sans-serif" },
            margin: { l: 64, r: 34, t: 72, b: 50 },
            hovermode: "x unified",
            legend: {
                orientation: "h",
                traceorder: "reversed",
                x: 0,
                xanchor: "left",
                y: 1.18,
                yanchor: "bottom",
            },
            xaxis: { title: "Время (с)", gridcolor: "rgba(255,255,255,0.06)", range: xaxisRange },
            yaxis: {
                title: "Процент (%)",
                range: [0, 100],
                gridcolor: "rgba(255,255,255,0.06)",
            },
            shapes: [markerShape],
        },
        plotlyConfig
    );

    Plotly.react(
        elements.rpmChart,
        [
            {
                x: preparedTelemetry.timestamps,
                y: preparedTelemetry.rpmValues,
                name: "Обороты (RPM)",
                mode: "lines",
                line: { color: "#3b82f6", width: 2.2 },
                hovertemplate: "Время %{x:.3f} с<br>Обороты %{y:.0f} RPM<extra></extra>",
            },
        ],
        {
            paper_bgcolor: "#000000",
            plot_bgcolor: "#000000",
            font: { color: "#b0b8c4", family: "Inter, Segoe UI, sans-serif" },
            margin: { l: 64, r: 34, t: 24, b: 50 },
            hovermode: "x unified",
            legend: { orientation: "h", x: 0, y: 1.1 },
            xaxis: { title: "Время (с)", gridcolor: "rgba(255,255,255,0.06)", range: xaxisRange },
            yaxis: {
                title: "Обороты (RPM)",
                gridcolor: "rgba(255,255,255,0.06)",
                rangemode: "tozero",
            },
            shapes: [markerShape],
        },
        plotlyConfig
    );

    ensurePlotClickBinding(elements.speedChart);
    ensurePlotClickBinding(elements.controlsChart);
    ensurePlotClickBinding(elements.rpmChart);

    elements.timeSlider.disabled = false;
    elements.timeSlider.max = String(Math.max(getTelemetryVisibleEndTime(
        preparedTelemetry.telemetry,
        state.summary,
        preparedTelemetry.visibleDuration
    ), 0));
    elements.timeSlider.value = String(preparedTelemetry.telemetry[state.cursorIndex]?.timestamp ?? 0);
    if (elements.timeInput) {
        elements.timeInput.disabled = false;
    }
    if (elements.sliderLapTime && state.summary) {
        elements.sliderLapTime.textContent = preparedTelemetry.displayLapTime
            ? formatLapTime(preparedTelemetry.displayLapTime)
            : preparedTelemetry.isIncomplete
                ? "Неполный круг"
                : "--";
    }

    renderTrackMap();
    updateCursor(state.cursorIndex);
    resizeTelemetryVisuals();
}
function ensurePlotClickBinding(chartElement) {
    if (!chartElement.on || chartElement.dataset.bound === "true") {
        return;
    }

    chartElement.on("plotly_click", (event) => {
        const xValue = event?.points?.[0]?.x;
        if (typeof xValue === "number") {
            const closestIndex = findClosestTelemetryIndex(xValue);
            updateCursor(closestIndex);
        }
    });

    chartElement.dataset.bound = "true";
}

function buildVerticalMarker(cursorTime) {
    return {
        type: "line",
        x0: cursorTime,
        x1: cursorTime,
        y0: 0,
        y1: 1,
        yref: "paper",
        line: {
            color: "rgba(59, 130, 246, 0.8)",
            width: 2,
            dash: "dot",
        },
    };
}

const TELEMETRY_TIME_EPSILON = 0.05;

function getTelemetryVisibleEndTime(
    telemetry = state.telemetry,
    summary = state.summary,
    visibleDuration = state.activeLapView?.visibleDuration
) {
    if (Number.isFinite(visibleDuration) && visibleDuration > 0) {
        return visibleDuration;
    }

    const lastTimestamp = telemetry.length ? telemetry[telemetry.length - 1].timestamp : 0;
    const lapTime = Number.isFinite(summary?.lap_time) ? summary.lap_time : 0;
    return Math.max(lastTimestamp, lapTime, 0);
}

function getTelemetryChartRange(
    telemetry = state.telemetry,
    summary = state.summary,
    visibleDuration = state.activeLapView?.visibleDuration
) {
    const endTime = getTelemetryVisibleEndTime(telemetry, summary, visibleDuration);
    const rightPadding = Math.max(endTime * 0.008, TELEMETRY_TIME_EPSILON);
    return [0, endTime + rightPadding];
}

function handleTimeInputChange() {
    if (!state.telemetry.length || !elements.timeInput) return;
    const raw = elements.timeInput.value.trim().replace(",", ".");
    if (!raw) return;
    let seconds = parseFloat(raw);
    if (Number.isNaN(seconds)) return;
    const parts = raw.split(":");
    if (parts.length === 2) {
        const min = parseFloat(parts[0]);
        const sec = parseFloat(parts[1]);
        if (!Number.isNaN(min) && !Number.isNaN(sec)) {
            seconds = min * 60 + sec;
        }
    } else if (parts.length === 3) {
        // Allow input as HH:MM:SS.sss
        const hours = parseFloat(parts[0]);
        const min = parseFloat(parts[1]);
        const sec = parseFloat(parts[2]);
        if (!Number.isNaN(hours) && !Number.isNaN(min) && !Number.isNaN(sec)) {
            seconds = hours * 3600 + min * 60 + sec;
        }
    }
    const maxTime = getTelemetryVisibleEndTime(
        state.activeLapView?.telemetry || state.telemetry,
        state.summary,
        state.activeLapView?.visibleDuration
    );
    seconds = Math.max(0, Math.min(seconds, maxTime));
    const idx = findClosestTelemetryIndex(seconds);
    updateCursor(idx);
}

function formatTimeFull(seconds) {
    // Format to H:MM:SS.sss or M:SS.sss or S.sss
    seconds = Math.max(0, seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${secs.toFixed(3).padStart(6, "0")}`;
    } else if (minutes > 0) {
        return `${minutes}:${secs.toFixed(3).padStart(6, "0")}`;
    } else {
        return `${secs.toFixed(3)}`;
    }
}

function renderCurrentTelemetryValues(point) {
    const currentPoint = point || null;
    if (elements.speedCurrentValue) {
        elements.speedCurrentValue.textContent = Number.isFinite(currentPoint?.speed)
            ? `${Math.round(currentPoint.speed)} км/ч`
            : "--";
    }

    if (elements.controlsCurrentValue) {
        elements.controlsCurrentValue.textContent = currentPoint
            ? `Газ ${Math.round(currentPoint.throttle ?? 0)}% · Тормоз ${Math.round(currentPoint.brake ?? 0)}%`
            : "--";
    }

    if (elements.rpmCurrentValue) {
        elements.rpmCurrentValue.textContent = Number.isFinite(currentPoint?.rpm)
            ? `${Math.round(currentPoint.rpm)} RPM`
            : "--";
    }
}

function updateTrackMapMarker(index = state.cursorIndex) {
    const markerElement = elements.trackMap?.querySelector("#track-driver-marker");
    const markerPositions = state.activeLapView?.trackMap?.markerPositions;
    if (!markerElement || !markerPositions?.length) {
        return;
    }

    const clampedIndex = Math.max(0, Math.min(index, markerPositions.length - 1));
    const markerPoint = markerPositions[clampedIndex];
    if (!markerPoint) {
        return;
    }

    markerElement.setAttribute("transform", `translate(${markerPoint.x} ${markerPoint.y})`);
}

function updateCursor(index) {
    const preparedTelemetry = state.activeLapView;
    if (!preparedTelemetry?.telemetry?.length) {
        return;
    }

    state.cursorIndex = Math.max(0, Math.min(index, preparedTelemetry.telemetry.length - 1));
    const point = preparedTelemetry.telemetry[state.cursorIndex];

    elements.timeSlider.value = String(point.timestamp);
    if (elements.timeInput) {
        elements.timeInput.value = formatTimeFull(point.timestamp);
    }
    elements.chartCursorLabel.textContent = `${formatTimeFull(point.timestamp)} с`;
    renderCurrentTelemetryValues(point);

    Plotly.relayout(elements.speedChart, { shapes: [buildVerticalMarker(point.timestamp)] });
    Plotly.relayout(elements.controlsChart, { shapes: [buildVerticalMarker(point.timestamp)] });
    Plotly.relayout(elements.rpmChart, { shapes: [buildVerticalMarker(point.timestamp)] });
    updateTrackMapMarker(state.cursorIndex);
}

const TRACK_COLOR_NEUTRAL = { r: 234, g: 179, b: 8 };
const TRACK_COLOR_THROTTLE = { r: 34, g: 197, b: 94 };
const TRACK_COLOR_BRAKE = { r: 239, g: 68, b: 68 };

function clamp01(value) {
    return Math.max(0, Math.min(value, 1));
}

function mixTrackColors(from, to, amount) {
    const t = clamp01(amount);
    return {
        r: Math.round(from.r + (to.r - from.r) * t),
        g: Math.round(from.g + (to.g - from.g) * t),
        b: Math.round(from.b + (to.b - from.b) * t),
    };
}

function toTrackColorString(color) {
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function getSegmentColor(point) {
    const sanitizedPoint = sanitizeTelemetryPoint(point);
    const throttle = clamp01((sanitizedPoint?.throttle ?? 0) / 100);
    const brake = clamp01((sanitizedPoint?.brake ?? 0) / 100);
    const throttleInfluence = Math.pow(throttle, 0.9) * (1 - brake * 0.55);
    const brakeInfluence = Math.pow(brake, 0.78);

    let color = TRACK_COLOR_NEUTRAL;
    color = mixTrackColors(color, TRACK_COLOR_THROTTLE, throttleInfluence);
    color = mixTrackColors(color, TRACK_COLOR_BRAKE, brakeInfluence);

    return toTrackColorString(color);
}

function getSmoothedSegmentColor(telemetry, index, radius = 4) {
    if (!telemetry.length) {
        return toTrackColorString(TRACK_COLOR_NEUTRAL);
    }

    let weightedThrottle = 0;
    let weightedBrake = 0;
    let totalWeight = 0;

    for (let offset = -radius; offset <= radius; offset++) {
        const point = telemetry[index + offset];
        if (!point) {
            continue;
        }

        const weight = radius + 1 - Math.abs(offset);
        weightedThrottle += (point.throttle ?? 0) * weight;
        weightedBrake += (point.brake ?? 0) * weight;
        totalWeight += weight;
    }

    if (!totalWeight) {
        return getSegmentColor(telemetry[index]);
    }

    return getSegmentColor({
        throttle: clampTelemetryPercent(weightedThrottle / totalWeight),
        brake: normalizeBrakePercent(weightedBrake / totalWeight),
    });
}

function buildTrackGradient(id, startColor, endColor, startPoint, endPoint) {
    return `
        <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${startPoint.x}" y1="${startPoint.y}" x2="${endPoint.x}" y2="${endPoint.y}">
            <stop offset="0%" stop-color="${startColor}"/>
            <stop offset="100%" stop-color="${endColor}"/>
        </linearGradient>
    `;
}

function buildTrackSegmentMarkup(x1, y1, x2, y2, gradientId, width) {
    return `
        <line
            x1="${x1}"
            y1="${y1}"
            x2="${x2}"
            y2="${y2}"
            stroke="url(#${gradientId})"
            stroke-width="${width}"
            stroke-linecap="round"
            stroke-opacity="0.98"
            vector-effect="non-scaling-stroke"
            shape-rendering="geometricPrecision"
        />
    `;
}

function getOverlappedTrackSegment(startPoint, endPoint, overlap = 0.8) {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (!Number.isFinite(length) || length <= 0.001) {
        return {
            startX: startPoint.x,
            startY: startPoint.y,
            endX: endPoint.x,
            endY: endPoint.y,
        };
    }

    const extension = Math.min(overlap, length * 0.18);
    const unitX = dx / length;
    const unitY = dy / length;

    return {
        startX: startPoint.x - unitX * extension,
        startY: startPoint.y - unitY * extension,
        endX: endPoint.x + unitX * extension,
        endY: endPoint.y + unitY * extension,
    };
}

function buildTrackPolylineMarkup(points, width, stroke) {
    const polyline = points
        .map((point) => Array.isArray(point) ? `${point[0]},${point[1]}` : `${point.x},${point.y}`)
        .join(" ");
    return `
        <polyline
            points="${polyline}"
            fill="none"
            stroke="${stroke}"
            stroke-width="${width}"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
            shape-rendering="geometricPrecision"
        />
    `;
}

function buildDriverMarkerMarkup(x, y) {
    return `
        <g id="track-driver-marker" transform="translate(${x} ${y})">
            <circle cx="0" cy="0" r="11" fill="rgba(3, 7, 18, 0.86)" stroke="rgba(255,255,255,0.9)" stroke-width="1.4"/>
            <circle cx="0" cy="0" r="7" fill="#ffffff" stroke="#0f172a" stroke-width="1.8"/>
            <circle cx="0" cy="0" r="3.2" fill="#2563eb"/>
        </g>
    `;
}

function getPathLength(pathPoints) {
    let total = 0;
    for (let i = 1; i < pathPoints.length; i++) {
        const dx = pathPoints[i][0] - pathPoints[i - 1][0];
        const dy = pathPoints[i][1] - pathPoints[i - 1][1];
        total += Math.sqrt(dx * dx + dy * dy);
    }
    return total;
}

function getPointAtPathPosition(pathPoints, t) {
    const totalLen = getPathLength(pathPoints);
    let target = t * totalLen;
    let acc = 0;
    for (let i = 1; i < pathPoints.length; i++) {
        const dx = pathPoints[i][0] - pathPoints[i - 1][0];
        const dy = pathPoints[i][1] - pathPoints[i - 1][1];
        const segLen = Math.sqrt(dx * dx + dy * dy);
        if (acc + segLen >= target) {
            const r = (target - acc) / segLen;
            return [
                pathPoints[i - 1][0] + (pathPoints[i][0] - pathPoints[i - 1][0]) * r,
                pathPoints[i - 1][1] + (pathPoints[i][1] - pathPoints[i - 1][1]) * r,
            ];
        }
        acc += segLen;
    }
    return pathPoints[pathPoints.length - 1];
}

function samplePathToPoints(pathPoints, count) {
    const sampled = [];
    for (let i = 0; i < count; i++) {
        sampled.push(getPointAtPathPosition(pathPoints, i / Math.max(count - 1, 1)));
    }
    return sampled;
}

function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function buildGenericTrackLayout(trackName) {
    const template = genericTrackTemplates[hashString(trackName) % genericTrackTemplates.length];
    return {
        label: trackName,
        viewBox: template.viewBox,
        pathPoints: template.pathPoints,
    };
}

function getCurrentTrackLayout() {
    const rawTrackName = state.currentRace?.track_name?.trim();
    if (!rawTrackName) {
        return trackLayouts.monza;
    }

    const trackName = rawTrackName.toLowerCase();
    if (trackLayouts[trackName]) {
        return trackLayouts[trackName];
    }

    return buildGenericTrackLayout(rawTrackName);
}

function normalizeTrackNameKey(trackName) {
    return String(trackName || "").trim().toLowerCase();
}

function getReferenceTrackCacheKey(trackName = state.currentRace?.track_name) {
    return normalizeTrackNameKey(trackName);
}

function getTrackBounds(samples) {
    if (!samples.length) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }

    const xs = samples.map((point) => point.x);
    const ys = samples.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
        minX,
        maxX,
        minY,
        maxY,
        width: Math.max(maxX - minX, 1),
        height: Math.max(maxY - minY, 1),
    };
}

function centerTrackSamples(samples) {
    const bounds = getTrackBounds(samples);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    return samples.map((point) => ({
        ...point,
        x: point.x - centerX,
        y: point.y - centerY,
    }));
}

function rotateTrackSamples(samples, angleDegrees) {
    const angle = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return samples.map((point) => ({
        ...point,
        x: point.x * cos - point.y * sin,
        y: point.x * sin + point.y * cos,
    }));
}

function findPosterTrackOrientation(samples) {
    if (samples.length < 2) {
        return {
            angle: 0,
            centerX: 0,
            centerY: 0,
            samples,
        };
    }

    const bounds = getTrackBounds(samples);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const centeredSamples = samples.map((point) => ({
        ...point,
        x: point.x - centerX,
        y: point.y - centerY,
    }));
    let bestSamples = centeredSamples;
    let bestScore = -Infinity;
    let bestAngle = 0;

    for (let angle = 0; angle < 180; angle += 5) {
        const rotatedSamples = rotateTrackSamples(centeredSamples, angle);
        const bounds = getTrackBounds(rotatedSamples);
        const maxDimension = Math.max(bounds.width, bounds.height, 1);
        const minDimension = Math.max(Math.min(bounds.width, bounds.height), 1);
        const fitScore = 1 / maxDimension;
        const balanceScore = minDimension / maxDimension;
        const angleOffset = angle % 90;
        const quarterTurnDistance = Math.min(angleOffset, 90 - angleOffset);
        const angleBias = 1 - (quarterTurnDistance / 45);
        const score = fitScore * 10000 + balanceScore * 0.08 + angleBias * 0.01;

        if (score > bestScore) {
            bestScore = score;
            bestSamples = rotatedSamples;
            bestAngle = angle;
        }
    }

    return {
        angle: bestAngle,
        centerX,
        centerY,
        samples: bestSamples,
    };
}

function choosePosterTrackOrientation(samples) {
    return findPosterTrackOrientation(samples).samples;
}

function getPercentile(values, percentile) {
    if (!values.length) {
        return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const rawIndex = (sorted.length - 1) * percentile;
    const lowerIndex = Math.floor(rawIndex);
    const upperIndex = Math.ceil(rawIndex);

    if (lowerIndex === upperIndex) {
        return sorted[lowerIndex];
    }

    const weight = rawIndex - lowerIndex;
    return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

function trimTrackSamples(samples) {
    if (samples.length < 40) {
        return samples;
    }

    const xs = samples.map((point) => point.x);
    const ys = samples.map((point) => point.y);
    const minX = getPercentile(xs, 0.02);
    const maxX = getPercentile(xs, 0.98);
    const minY = getPercentile(ys, 0.02);
    const maxY = getPercentile(ys, 0.98);
    const marginX = Math.max((maxX - minX) * 0.08, 1);
    const marginY = Math.max((maxY - minY) * 0.08, 1);

    const filtered = samples.filter((point) => (
        point.x >= minX - marginX &&
        point.x <= maxX + marginX &&
        point.y >= minY - marginY &&
        point.y <= maxY + marginY
    ));

    return filtered.length >= Math.max(Math.floor(samples.length * 0.75), 30)
        ? filtered
        : samples;
}

function chooseTrackOrderingField(telemetry) {
    const fields = ["distance", "timestamp"];

    const getScore = (field) => {
        const values = telemetry
            .map((point) => Number(point?.[field]))
            .filter((value) => Number.isFinite(value));

        if (values.length < 2) {
            return -Infinity;
        }

        let monotonicPairs = 0;
        for (let i = 1; i < values.length; i++) {
            if (values[i] >= values[i - 1]) {
                monotonicPairs += 1;
            }
        }

        return monotonicPairs / Math.max(values.length - 1, 1);
    };

    const bestField = fields.reduce(
        (best, field) => {
            const score = getScore(field);
            return score > best.score ? { field, score } : best;
        },
        { field: "index", score: -Infinity }
    );

    return bestField.score >= 0.6 ? bestField.field : "index";
}

function buildTrackSamplesFromTelemetry(telemetry) {
    const orderField = chooseTrackOrderingField(telemetry);
    const sortedSamples = telemetry
        .map((point, sourceIndex) => {
            const x = Number(point?.x);
            const y = Number(point?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                return null;
            }

            let orderValue = sourceIndex;
            if (orderField !== "index") {
                const candidate = Number(point?.[orderField]);
                if (!Number.isFinite(candidate)) {
                    return null;
                }
                orderValue = candidate;
            }

            return {
                sourceIndex,
                orderValue,
                x,
                y,
            };
        })
        .filter(Boolean)
        .sort((left, right) => (
            left.orderValue - right.orderValue ||
            left.sourceIndex - right.sourceIndex
        ));

    return sortedSamples.map((sample, trackIndex) => ({
        ...sample,
        trackIndex,
    }));
}

function getTrackPointDistance(left, right) {
    if (!left || !right) {
        return Infinity;
    }

    const dx = right.x - left.x;
    const dy = right.y - left.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function closeTrackLoopIfNeeded(samples) {
    if (samples.length < 4) {
        return samples;
    }

    const firstPoint = samples[0];
    const lastPoint = samples[samples.length - 1];
    const endGap = getTrackPointDistance(firstPoint, lastPoint);
    if (!Number.isFinite(endGap) || endGap <= 0) {
        return samples;
    }

    const bounds = getTrackBounds(samples);
    const diagonal = Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height);
    const stepDistances = [];
    for (let i = 1; i < samples.length; i++) {
        const distance = getTrackPointDistance(samples[i - 1], samples[i]);
        if (Number.isFinite(distance) && distance > 0) {
            stepDistances.push(distance);
        }
    }

    const medianStep = stepDistances.length ? getPercentile(stepDistances, 0.5) : 0;
    const closeThreshold = Math.max(medianStep * 18, diagonal * 0.12);
    if (Number.isFinite(closeThreshold) && endGap <= closeThreshold) {
        return [...samples, { ...firstPoint, trackIndex: samples.length }];
    }

    return samples;
}

function getTrackJumpThreshold(samples) {
    if (samples.length < 3) {
        return Infinity;
    }

    const stepDistances = [];
    for (let i = 1; i < samples.length; i++) {
        const distance = getTrackPointDistance(samples[i - 1], samples[i]);
        if (Number.isFinite(distance) && distance > 0) {
            stepDistances.push(distance);
        }
    }

    if (!stepDistances.length) {
        return Infinity;
    }

    const medianStep = getPercentile(stepDistances, 0.5);
    const upperStep = getPercentile(stepDistances, 0.9);
    return Math.max(medianStep * 10, upperStep * 4, 1);
}

function removeTrackOutliers(samples, jumpThreshold) {
    if (samples.length < 3 || !Number.isFinite(jumpThreshold)) {
        return samples;
    }

    const filtered = [samples[0]];

    for (let i = 1; i < samples.length - 1; i++) {
        const prev = filtered[filtered.length - 1];
        const current = samples[i];
        const next = samples[i + 1];
        const prevJump = getTrackPointDistance(prev, current) > jumpThreshold;
        const nextJump = getTrackPointDistance(current, next) > jumpThreshold;
        const bridgeDistance = getTrackPointDistance(prev, next);

        if (prevJump && nextJump && bridgeDistance <= jumpThreshold * 1.2) {
            continue;
        }

        filtered.push(current);
    }

    filtered.push(samples[samples.length - 1]);

    while (filtered.length > 3 && getTrackPointDistance(filtered[0], filtered[1]) > jumpThreshold) {
        filtered.shift();
    }
    while (filtered.length > 3 && getTrackPointDistance(filtered[filtered.length - 2], filtered[filtered.length - 1]) > jumpThreshold) {
        filtered.pop();
    }

    return filtered.length >= 2 ? filtered : samples;
}

function splitTrackSegments(samples, jumpThreshold, { isCompleteLap = false } = {}) {
    if (samples.length < 2) {
        return [];
    }

    const segments = [];
    let currentSegment = [samples[0]];
    const breakMultiplier = isCompleteLap ? 1.35 : 1;

    for (let i = 1; i < samples.length; i++) {
        const prev = samples[i - 1];
        const current = samples[i];
        const shouldBreak = Number.isFinite(jumpThreshold) &&
            getTrackPointDistance(prev, current) > jumpThreshold * breakMultiplier;

        if (shouldBreak) {
            if (currentSegment.length >= 2) {
                segments.push(currentSegment);
            }
            currentSegment = [current];
            continue;
        }

        currentSegment.push(current);
    }

    if (currentSegment.length >= 2) {
        segments.push(currentSegment);
    }

    return segments.length ? segments : [samples];
}

function getLapTypeValue(lap = state.selectedLap) {
    return String(lap?.lap_type ?? lap?.type ?? "").trim().toLowerCase();
}

function isLapLikelyIncomplete(lap = state.selectedLap, summary = state.summary) {
    const lapType = getLapTypeValue(lap);
    const hasLapTime = Number.isFinite(summary?.lap_time ?? lap?.lap_time);
    const hasAllSectors = [
        summary?.sector1 ?? lap?.sector1,
        summary?.sector2 ?? lap?.sector2,
        summary?.sector3 ?? lap?.sector3,
    ].every((value) => Number.isFinite(value));

    return !hasLapTime || !hasAllSectors || lapType.includes("out") || lapType.includes("in");
}

function getMaxTelemetryDistance(telemetry) {
    const distances = telemetry
        .map((point) => Number(point?.distance))
        .filter((value) => Number.isFinite(value));

    return distances.length ? Math.max(...distances) : 0;
}

function getReferencePathPoints(referenceLayout) {
    if (!referenceLayout?.points?.length) {
        return [];
    }

    return referenceLayout.points.map((point) => [point.x, point.y]);
}

function buildTrackReferenceLayout(samples, telemetry, trackName = "") {
    if (samples.length < 2) {
        return null;
    }

    const orientation = findPosterTrackOrientation(samples);
    const normalized = normalizeTrackPoints(orientation.samples, { invertY: true });
    if (!normalized) {
        return null;
    }

    return {
        key: normalizeTrackNameKey(trackName),
        viewBox: normalized.viewBox,
        points: normalized.points,
        segments: [normalized.points],
        angle: orientation.angle,
        centerX: orientation.centerX,
        centerY: orientation.centerY,
        bounds: getTrackBounds(orientation.samples),
        maxDistance: getMaxTelemetryDistance(telemetry),
    };
}

function buildReferenceTrackLayoutFromTelemetry(telemetry, trackName = "", sourceLapId = null) {
    const samples = trimTrackSamples(buildTrackSamplesFromTelemetry(telemetry));
    if (samples.length < 2) {
        return null;
    }

    const jumpThreshold = getTrackJumpThreshold(samples);
    const cleanedSamples = removeTrackOutliers(samples, jumpThreshold);
    const skipCount = Math.min(5, Math.floor(cleanedSamples.length * 0.005));
    const trimmedSamples = cleanedSamples.length > skipCount * 2 + 4
        ? cleanedSamples.slice(skipCount, cleanedSamples.length - skipCount)
        : cleanedSamples;
    const closedSamples = closeTrackLoopIfNeeded(trimmedSamples);
    const referenceLayout = buildTrackReferenceLayout(closedSamples, telemetry, trackName);
    if (!referenceLayout) {
        return null;
    }

    return {
        ...referenceLayout,
        sourceLapId,
        renderSegments: buildTrackRenderSegments(referenceLayout.points, { isCompleteLap: true }),
    };
}

async function ensureReferenceTrack({
    sessionId = state.currentSession?.id,
    trackName = state.currentRace?.track_name || getCurrentTrackLayout().label,
    preferredLap = state.selectedLap,
    preferredTelemetry = state.telemetry,
    preferredSummary = state.summary,
} = {}) {
    const cacheKey = getReferenceTrackCacheKey(trackName, sessionId);
    if (state.cache.referenceTrackLayouts.has(cacheKey)) {
        return state.cache.referenceTrackLayouts.get(cacheKey);
    }

    if (state.cache.referenceTrackRequests.has(cacheKey)) {
        return state.cache.referenceTrackRequests.get(cacheKey);
    }

    const request = (async () => {
        let referenceLayout = null;

        if (preferredLap && preferredTelemetry?.length && hasCompleteLapMetrics(preferredLap, preferredSummary)) {
            referenceLayout = buildReferenceTrackLayoutFromTelemetry(preferredTelemetry, trackName, preferredLap.id);
        }

        if (!referenceLayout) {
            const candidateLap = getReferenceLapCandidate(state.laps, preferredLap, preferredSummary);
            if (candidateLap) {
                const candidateDetail = candidateLap.id === preferredLap?.id && preferredTelemetry?.length
                    ? { telemetry: preferredTelemetry, summary: preferredSummary }
                    : await getLapDetail(candidateLap.id);

                referenceLayout = buildReferenceTrackLayoutFromTelemetry(
                    candidateDetail.telemetry,
                    trackName,
                    candidateLap.id
                );
            }
        }

        if (!referenceLayout) {
            return null;
        }

        state.cache.referenceTrackLayouts.set(cacheKey, referenceLayout);
        state.cache.realTrackLayouts.clear();
        return referenceLayout;
    })().finally(() => {
        state.cache.referenceTrackRequests.delete(cacheKey);
    });

    state.cache.referenceTrackRequests.set(cacheKey, request);
    return request;
}

function buildTrackRenderSegments(points, { isCompleteLap = false } = {}) {
    if (!points?.length) {
        return [];
    }

    const jumpThreshold = getTrackJumpThreshold(points);
    const segments = splitTrackSegments(points, jumpThreshold, { isCompleteLap })
        .filter((segment) => segment.length >= 2);

    return segments.length ? segments : [points];
}

function getProjectedProgressGapThreshold(projectedPoints) {
    if (projectedPoints.length < 3) {
        return 0.04;
    }

    const deltas = [];
    for (let i = 1; i < projectedPoints.length; i++) {
        const delta = Number(projectedPoints[i].progress) - Number(projectedPoints[i - 1].progress);
        if (Number.isFinite(delta) && delta > 0) {
            deltas.push(delta);
        }
    }

    if (!deltas.length) {
        return 0.04;
    }

    const medianDelta = getPercentile(deltas, 0.5);
    const upperDelta = getPercentile(deltas, 0.9);
    return Math.max(0.025, medianDelta * 10, upperDelta * 4);
}

function getReferencePathJumpProgressValues(referencePath) {
    if (referencePath.length < 3) {
        return [];
    }

    const steps = [];
    for (let i = 1; i < referencePath.length; i++) {
        const dx = referencePath[i][0] - referencePath[i - 1][0];
        const dy = referencePath[i][1] - referencePath[i - 1][1];
        steps.push(Math.sqrt(dx * dx + dy * dy));
    }

    const medianStep = getPercentile(steps, 0.5);
    const upperStep = getPercentile(steps, 0.9);
    const jumpThreshold = Math.max(medianStep * 8, upperStep * 3, 1);

    let accLen = 0;
    const totalLen = steps.reduce((a, b) => a + b, 0);
    if (totalLen <= 0) {
        return [];
    }

    const jumpProgressValues = [];
    for (let i = 0; i < steps.length; i++) {
        if (steps[i] > jumpThreshold) {
            jumpProgressValues.push((accLen + steps[i] / 2) / totalLen);
        }
        accLen += steps[i];
    }

    return jumpProgressValues;
}

function splitProjectedTrackSegments(projectedPoints, referenceJumpProgress = []) {
    if (projectedPoints.length < 2) {
        return [];
    }

    const sequentialSegments = buildTrackRenderSegments(projectedPoints, { isCompleteLap: false });
    const projectedSegments = [];
    const progressGapThreshold = getProjectedProgressGapThreshold(projectedPoints);

    sequentialSegments.forEach((segment) => {
        let currentSegment = [segment[0]];

        for (let i = 1; i < segment.length; i++) {
            const prev = segment[i - 1];
            const current = segment[i];
            const progressDelta = current.progress - prev.progress;
            const distanceDelta = Number(current.distance) - Number(prev.distance);
            const crossesReferenceJump = referenceJumpProgress.some(
                (jp) => jp > prev.progress && jp < current.progress
            );

            if (
                progressDelta < -0.02 ||
                distanceDelta < -5 ||
                progressDelta > progressGapThreshold ||
                crossesReferenceJump
            ) {
                if (currentSegment.length >= 2) {
                    projectedSegments.push(currentSegment);
                }
                currentSegment = [current];
                continue;
            }

            currentSegment.push(current);
        }

        if (currentSegment.length >= 2) {
            projectedSegments.push(currentSegment);
        }
    });

    return projectedSegments;
}

function trimProjectedEdgeArtifacts(segments, referencePath) {
    if (segments.length <= 1) {
        return segments;
    }

    const progressSpanThreshold = Math.max(0.004, 2 / Math.max(referencePath.length, 2));

    return segments.filter((segment, segmentIndex) => {
        const isEdgeSegment = segmentIndex === 0 || segmentIndex === segments.length - 1;
        const progressSpan = Number(segment[segment.length - 1]?.progress) - Number(segment[0]?.progress);
        if (!isEdgeSegment) {
            return true;
        }
        if (segment.length > 3) {
            return true;
        }
        return progressSpan >= progressSpanThreshold;
    });
}

function buildReferenceOverlaySegment(segment, referencePath) {
    if (segment.length < 2) {
        return [];
    }

    const overlayPoints = [{
        x: segment[0].x,
        y: segment[0].y,
        sourceIndex: segment[0].sourceIndex,
    }];

    for (let i = 1; i < segment.length; i++) {
        const previousPoint = segment[i - 1];
        const currentPoint = segment[i];
        const progressDelta = currentPoint.progress - previousPoint.progress;
        if (!Number.isFinite(progressDelta) || progressDelta <= 0) {
            continue;
        }

        const subdivisions = Math.max(1, Math.ceil(progressDelta * 140));
        for (let step = 1; step <= subdivisions; step++) {
            const t = previousPoint.progress + (progressDelta * step) / subdivisions;
            const [x, y] = getPointAtPathPosition(referencePath, t);
            overlayPoints.push({
                x,
                y,
                sourceIndex: step === subdivisions ? currentPoint.sourceIndex : previousPoint.sourceIndex,
            });
        }
    }

    return overlayPoints.length >= 2 ? overlayPoints : [];
}

function findNearestTelemetrySourceIndexByDistance(distanceOrderedTelemetry, targetDistance) {
    if (!distanceOrderedTelemetry.length) {
        return 0;
    }

    let left = 0;
    let right = distanceOrderedTelemetry.length - 1;

    while (left < right) {
        const middle = Math.floor((left + right) / 2);
        if (distanceOrderedTelemetry[middle].distance < targetDistance) {
            left = middle + 1;
        } else {
            right = middle;
        }
    }

    const current = distanceOrderedTelemetry[left];
    const previous = distanceOrderedTelemetry[left - 1];
    if (
        previous &&
        Math.abs(previous.distance - targetDistance) < Math.abs(current.distance - targetDistance)
    ) {
        return previous.sourceIndex;
    }

    return current.sourceIndex;
}

function buildContinuousReferenceOverlaySegment(referencePath, orderedTelemetry, totalDistance) {
    const distanceOrderedTelemetry = orderedTelemetry
        .filter((point) => Number.isFinite(point.distance))
        .sort((left, right) => (
            left.distance - right.distance ||
            left.sourceIndex - right.sourceIndex
        ));

    if (referencePath.length < 2 || distanceOrderedTelemetry.length < 2) {
        return [];
    }

    const sampleCount = Math.max(
        220,
        Math.min(760, Math.max(referencePath.length * 2, distanceOrderedTelemetry.length))
    );
    const overlayPoints = [];

    for (let i = 0; i <= sampleCount; i++) {
        const progress = i / sampleCount;
        const [x, y] = getPointAtPathPosition(referencePath, progress);
        overlayPoints.push({
            x,
            y,
            sourceIndex: findNearestTelemetrySourceIndexByDistance(
                distanceOrderedTelemetry,
                progress * totalDistance
            ),
        });
    }

    return overlayPoints.length >= 2 ? overlayPoints : [];
}

function getTelemetryProjectionDistance(telemetry, referenceLayout, lapIsIncomplete) {
    const telemetryDistance = getMaxTelemetryDistance(telemetry);
    const referenceDistance = Number(referenceLayout?.maxDistance);

    if (!lapIsIncomplete && Number.isFinite(telemetryDistance) && telemetryDistance > 0) {
        return telemetryDistance;
    }

    if (Number.isFinite(referenceDistance) && referenceDistance > 0) {
        return referenceDistance;
    }

    return telemetryDistance;
}

function buildProjectedTrackLayout(telemetry, referenceLayout, { lapIsIncomplete = false } = {}) {
    const referencePath = getReferencePathPoints(referenceLayout);
    if (!referencePath.length || !referenceLayout?.viewBox) {
        return null;
    }

    const orderField = chooseTrackOrderingField(telemetry);
    const orderedTelemetry = telemetry
        .map((point, sourceIndex) => {
            const distance = Number(point?.distance);
            if (!Number.isFinite(distance)) {
                return null;
            }

            let orderValue = sourceIndex;
            if (orderField !== "index") {
                const candidate = Number(point?.[orderField]);
                if (!Number.isFinite(candidate)) {
                    return null;
                }
                orderValue = candidate;
            }

            return {
                sourceIndex,
                orderValue,
                distance,
            };
        })
        .filter(Boolean)
        .sort((left, right) => (
            left.orderValue - right.orderValue ||
            left.sourceIndex - right.sourceIndex
        ));

    const totalDistance = getTelemetryProjectionDistance(orderedTelemetry, referenceLayout, lapIsIncomplete);

    if (!Number.isFinite(totalDistance) || totalDistance <= 0) {
        return null;
    }

    const projectedPoints = orderedTelemetry
        .map((point) => {
            const clampedProgress = Math.max(0, Math.min(point.distance / totalDistance, 1));
            const [x, y] = getPointAtPathPosition(referencePath, clampedProgress);

            return {
                sourceIndex: point.sourceIndex,
                distance: point.distance,
                orderValue: point.orderValue,
                progress: clampedProgress,
                x,
                y,
            };
        })
        .filter(Boolean);

    if (projectedPoints.length < 2) {
        return null;
    }

    let renderSegments = [];
    if (!lapIsIncomplete) {
        const continuousSegment = buildContinuousReferenceOverlaySegment(referencePath, orderedTelemetry, totalDistance);
        renderSegments = continuousSegment.length >= 2 ? [continuousSegment] : [];
    }

    if (!renderSegments.length) {
        const referenceJumpProgress = getReferencePathJumpProgressValues(referencePath);
        const overlaySegments = trimProjectedEdgeArtifacts(
            splitProjectedTrackSegments(projectedPoints, referenceJumpProgress),
            referencePath
        );
        renderSegments = overlaySegments
            .map((segment) => buildReferenceOverlaySegment(segment, referencePath))
            .filter((segment) => segment.length >= 2);
    }

    if (!renderSegments.length) {
        return null;
    }

    return {
        viewBox: referenceLayout.viewBox,
        points: projectedPoints,
        markerPoints: buildTrackMarkerPositionsFromReference(telemetry, referencePath, totalDistance),
        segments: renderSegments,
        baseSegments: referenceLayout.renderSegments?.length
            ? referenceLayout.renderSegments
            : [referencePath],
        referencePath,
        projectionDistance: totalDistance,
    };
}

function getRealTrackLayoutFromTelemetry(telemetry, trackName = "") {
    const referenceKey = getReferenceTrackCacheKey(trackName);
    let trackReference = state.cache.referenceTrackLayouts.get(referenceKey) || null;

    if (!trackReference && telemetry.length && hasCompleteLapMetrics()) {
        trackReference = buildReferenceTrackLayoutFromTelemetry(telemetry, trackName, state.selectedLap?.id || null);
        if (trackReference) {
            state.cache.referenceTrackLayouts.set(referenceKey, trackReference);
        }
    }

    if (!trackReference) {
        return null;
    }

    const cacheKey = `${state.selectedLap?.id || "no-lap"}:${referenceKey}:${telemetry.length}:${trackReference.sourceLapId || "none"}`;
    if (state.cache.realTrackLayouts.has(cacheKey)) {
        return state.cache.realTrackLayouts.get(cacheKey);
    }

    const lapIsIncomplete = isLapLikelyIncomplete();
    const layout = buildProjectedTrackLayout(telemetry, trackReference, { lapIsIncomplete });

    if (!layout) {
        return null;
    }

    state.cache.realTrackLayouts.set(cacheKey, layout);
    return layout;
}

function normalizeTrackPoints(samples, { invertY = false, boundsOverride = null } = {}) {
    if (samples.length < 2) {
        return null;
    }

    const bounds = boundsOverride || getTrackBounds(samples);
    const { minX, maxX, minY, maxY } = bounds;
    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);
    const viewSize = 520;
    const padding = 10;
    const scale = Math.min(
        (viewSize - padding * 2) / width,
        (viewSize - padding * 2) / height
    );
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const offsetX = (viewSize - scaledWidth) / 2;
    const offsetY = (viewSize - scaledHeight) / 2;

    return {
        viewBox: `0 0 ${viewSize} ${viewSize}`,
        points: samples.map((point) => ({
            ...point,
            x: offsetX + (point.x - minX) * scale,
            y: offsetY + ((invertY ? maxY - point.y : point.y - minY) * scale),
        })),
    };
}

function getFallbackTrackLayout(pathPoints, trackName = "") {
    const cacheKey = `${normalizeTrackNameKey(trackName)}:${pathPoints.length}`;
    if (state.cache.fallbackTrackLayouts.has(cacheKey)) {
        return state.cache.fallbackTrackLayouts.get(cacheKey);
    }

    const orientedSamples = choosePosterTrackOrientation(
        pathPoints.map(([x, y], index) => ({ index, x, y }))
    );
    const normalized = normalizeTrackPoints(
        orientedSamples,
        { invertY: false }
    );
    if (!normalized) {
        return null;
    }

    const layout = {
        viewBox: normalized.viewBox,
        pathPoints: normalized.points.map((point) => [point.x, point.y]),
    };
    state.cache.fallbackTrackLayouts.set(cacheKey, layout);
    return layout;
}

function renderTrackMap() {
    const preparedTelemetry = state.activeLapView;
    if (preparedTelemetry?.trackMap?.markup) {
        elements.trackMap.innerHTML = preparedTelemetry.trackMap.markup;
        updateTrackMapMarker(state.cursorIndex);
        return;
    }

    const telemetry = state.telemetry;
    const trackLayout = getCurrentTrackLayout();
    const trackAriaLabel = `Track map ${trackLayout.label}`;
    const fallbackTrackLayout = getFallbackTrackLayout(trackLayout.pathPoints, trackLayout.label);

    const pathPoints = fallbackTrackLayout?.pathPoints ?? trackLayout.pathPoints;
    const vb = fallbackTrackLayout?.viewBox ?? trackLayout.viewBox;

    if (!telemetry.length) {
        const basePath = pathPoints.map((p) => `${p[0]},${p[1]}`).join(" ");
        elements.trackMap.innerHTML = `
            <svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Карта трассы Монца">
                <polyline points="${basePath}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `.replace(/aria-label="[^"]+"/, `aria-label="${trackAriaLabel}"`);
        return;
    }

    const sampled = samplePathToPoints(pathPoints, telemetry.length);
    const segments = [];
    const gradients = [];
    for (let i = 1; i < sampled.length; i++) {
        const prev = sampled[i - 1];
        const curr = sampled[i];
        const startColor = getSmoothedSegmentColor(telemetry, i - 1);
        const endColor = getSmoothedSegmentColor(telemetry, i);
        const gradientId = `track-grad-fallback-${i}`;
        const overlapped = getOverlappedTrackSegment(
            { x: prev[0], y: prev[1] },
            { x: curr[0], y: curr[1] },
            1.8
        );
        gradients.push(buildTrackGradient(
            gradientId,
            startColor,
            endColor,
            { x: prev[0], y: prev[1] },
            { x: curr[0], y: curr[1] }
        ));
        segments.push(buildTrackSegmentMarkup(
            overlapped.startX,
            overlapped.startY,
            overlapped.endX,
            overlapped.endY,
            gradientId,
            6.4
        ));
    }
    const basePath = pathPoints.map((p) => `${p[0]},${p[1]}`).join(" ");
    const driverPos = getPointAtPathPosition(
        pathPoints,
        state.cursorIndex / Math.max(telemetry.length - 1, 1)
    );

    elements.trackMap.innerHTML = `
        <svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Карта трассы Монца">
            <defs>${gradients.join("")}</defs>
            <polyline points="${basePath}" fill="none" stroke="rgba(60,60,80,0.4)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
            ${segments.join("")}
            ${buildDriverMarkerMarkup(driverPos[0], driverPos[1])}
        </svg>
    `.replace(/aria-label="[^"]+"/, `aria-label="${trackAriaLabel}"`);
}

function renderSummary() {
    const summary = state.summary;
    const displayLapTime = state.activeLapView?.displayLapTime;
    const stats = [
        ["Время круга", displayLapTime ? formatLapTime(displayLapTime) : "--"],
        ["Средняя скорость", summary ? `${summary.average_speed.toFixed(2)} км/ч` : "--"],
        ["Максимальная скорость", summary ? `${summary.maximum_speed.toFixed(2)} км/ч` : "--"],
        ["Средние обороты", summary ? `${Math.round(summary.average_rpm)} RPM` : "--"],
        ["Средний газ", summary ? `${summary.average_throttle.toFixed(2)} %` : "--"],
        ["Средний тормоз", summary ? `${summary.average_brake.toFixed(2)} %` : "--"],
    ];

    elements.lapStats.innerHTML = stats
        .map(
            ([label, value]) => `
                <div class="stat-item">
                    <span>${label}</span>
                    <strong>${value}</strong>
                </div>
            `
        )
        .join("");
}

function setWeatherGaugeValue(element, value, unit) {
    if (!element) {
        return;
    }

    if (!Number.isFinite(value)) {
        element.innerHTML = '<span class="weather-value-number">--</span>';
        return;
    }

    element.innerHTML = `
        <span class="weather-value-number">${value.toFixed(1)}</span>
        <span class="weather-value-unit">${unit}</span>
    `;
}

function updateWeather(session) {
    setWeatherGaugeValue(elements.trackTemp, session?.track_temp, "°C");
    setWeatherGaugeValue(elements.airTemp, session?.air_temp, "°C");
    setWeatherGaugeValue(elements.windSpeed, session?.wind_speed, "м/с");
}

function findClosestTelemetryIndex(timestamp) {
    const timestamps = state.activeLapView?.timestamps;
    if (!timestamps?.length) {
        return 0;
    }

    const lastIndex = timestamps.length - 1;
    const firstTimestamp = timestamps[0];
    const lastTimestamp = timestamps[lastIndex];

    if (timestamp <= firstTimestamp + TELEMETRY_TIME_EPSILON) {
        return 0;
    }

    if (timestamp >= lastTimestamp - TELEMETRY_TIME_EPSILON) {
        return lastIndex;
    }

    let left = 0;
    let right = lastIndex;

    while (left <= right) {
        const middle = Math.floor((left + right) / 2);
        const currentValue = timestamps[middle];

        if (currentValue < timestamp) {
            left = middle + 1;
        } else if (currentValue > timestamp) {
            right = middle - 1;
        } else {
            return middle;
        }
    }

    const leftIndex = Math.min(left, lastIndex);
    const rightIndex = Math.max(right, 0);
    return Math.abs(timestamps[leftIndex] - timestamp) < Math.abs(timestamps[rightIndex] - timestamp)
        ? leftIndex
        : rightIndex;
}

// Переводит число секунд в H:MM:SS.sss если больше 1 часа,
// M:SS.sss если больше 1 минуты, иначе S.sss
function formatLapTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds)) {
        return "--";
    }
    totalSeconds = Math.max(0, totalSeconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${seconds.toFixed(3).padStart(6, "0")}`;
    } else if (minutes > 0) {
        return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
    } else {
        return `${seconds.toFixed(3)}`;
    }
}

function showDashboardMessage(message) {
    console.warn("Dashboard:", message);
}

function handleSelectionError(message, error) {
    clearTelemetryView();
    showDashboardMessage(message);
    console.error(error);
}
