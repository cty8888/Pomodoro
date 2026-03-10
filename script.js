(() => {
  const MODES = {
    work: 'work',
    shortBreak: 'short-break',
    longBreak: 'long-break',
  };

  const DEFAULTS = {
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 4,
    autoStartNext: true,
    soundEnabled: true,
    theme: 'dark',
  };

  const STORAGE_KEY = 'pomodoro-settings-v1';
  const THEME_CLASS_LIGHT = 'theme-light';

  const $ = (id) => document.getElementById(id);

  const timerDisplay = $('timerDisplay');
  const timerSubtitle = $('timerSubtitle');
  const startPauseBtn = $('startPauseBtn');
  const resetBtn = $('resetBtn');
  const workInput = $('workMinutes');
  const shortBreakInput = $('shortBreakMinutes');
  const longBreakInput = $('longBreakMinutes');
  const sessionsBeforeLongBreakInput = $('sessionsBeforeLongBreak');
  const autoStartNextInput = $('autoStartNext');
  const soundEnabledInput = $('soundEnabled');
  const sessionCircles = $('sessionCircles');
  const sessionCountText = $('sessionCount');
  const themeToggle = $('themeToggle');
  const beepSound = $('beepSound');

  const modeButtons = Array.from(
    document.querySelectorAll('.mode-button'),
  );

  let currentMode = MODES.work;
  let remainingSeconds = DEFAULTS.workMinutes * 60;
  let timerId = null;
  let isRunning = false;
  let completedWorkSessions = 0;

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return { ...DEFAULTS };
      const parsed = JSON.parse(saved);
      return { ...DEFAULTS, ...parsed };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }

  const settings = loadSettings();

  function applySettingsToUI() {
    workInput.value = String(settings.workMinutes);
    shortBreakInput.value = String(settings.shortBreakMinutes);
    longBreakInput.value = String(settings.longBreakMinutes);
    sessionsBeforeLongBreakInput.value = String(
      settings.sessionsBeforeLongBreak,
    );
    autoStartNextInput.checked = Boolean(settings.autoStartNext);
    soundEnabledInput.checked = Boolean(settings.soundEnabled);
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add(THEME_CLASS_LIGHT);
      themeToggle.querySelector('.theme-toggle-icon').textContent = '🌙';
    } else {
      root.classList.remove(THEME_CLASS_LIGHT);
      themeToggle.querySelector('.theme-toggle-icon').textContent = '☀️';
    }
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function getCurrentModeMinutes() {
    if (currentMode === MODES.work) return settings.workMinutes;
    if (currentMode === MODES.shortBreak) return settings.shortBreakMinutes;
    return settings.longBreakMinutes;
  }

  function updateTimerSubtitle() {
    if (currentMode === MODES.work) {
      timerSubtitle.textContent = isRunning ? '专注中…' : '准备开始专注';
    } else if (currentMode === MODES.shortBreak) {
      timerSubtitle.textContent = isRunning ? '短休息中…' : '准备开始短休息';
    } else {
      timerSubtitle.textContent = isRunning ? '长休息中…' : '准备开始长休息';
    }
  }

  function updateSessionProgress() {
    sessionCountText.textContent = String(completedWorkSessions);
    sessionCircles.innerHTML = '';
    const maxCircles = 8;
    const count = Math.min(completedWorkSessions, maxCircles);
    for (let i = 0; i < count; i += 1) {
      const dot = document.createElement('div');
      dot.className = 'progress-circle filled';
      sessionCircles.appendChild(dot);
    }
    for (let i = count; i < maxCircles; i += 1) {
      const dot = document.createElement('div');
      dot.className = 'progress-circle';
      sessionCircles.appendChild(dot);
    }
  }

  function syncDocumentTitle() {
    const label =
      currentMode === MODES.work
        ? '专注'
        : currentMode === MODES.shortBreak
        ? '短休'
        : '长休';
    document.title = `${formatTime(remainingSeconds)} · ${label} · 番茄钟`;
  }

  function updateTimerUI() {
    timerDisplay.textContent = formatTime(remainingSeconds);
    startPauseBtn.textContent = isRunning ? '暂停' : '开始';
    updateTimerSubtitle();
    syncDocumentTitle();
  }

  function resetTimerForCurrentMode() {
    remainingSeconds = getCurrentModeMinutes() * 60;
    isRunning = false;
    clearInterval(timerId);
    timerId = null;
    updateTimerUI();
  }

  function playBeep() {
    if (!settings.soundEnabled) return;
    try {
      beepSound.currentTime = 0;
      void beepSound.play();
    } catch {
      // ignore
    }
  }

  function notifyFinished() {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        const body =
          currentMode === MODES.work
            ? '专注结束，可以休息一下啦。'
            : '休息结束，准备下一轮专注。';
        new Notification('番茄钟结束', { body });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }

  function moveToNextMode() {
    if (currentMode === MODES.work) {
      completedWorkSessions += 1;
      const useLongBreak =
        completedWorkSessions % settings.sessionsBeforeLongBreak === 0;
      currentMode = useLongBreak ? MODES.longBreak : MODES.shortBreak;
    } else {
      currentMode = MODES.work;
    }
    modeButtons.forEach((btn) => {
      btn.classList.toggle(
        'active',
        btn.dataset.mode === currentMode,
      );
    });
    resetTimerForCurrentMode();
    updateSessionProgress();
    if (settings.autoStartNext) {
      handleStartPause();
    }
  }

  function tick() {
    if (remainingSeconds <= 0) {
      clearInterval(timerId);
      timerId = null;
      isRunning = false;
      playBeep();
      notifyFinished();
      moveToNextMode();
      return;
    }
    remainingSeconds -= 1;
    updateTimerUI();
  }

  function handleStartPause() {
    if (isRunning) {
      isRunning = false;
      clearInterval(timerId);
      timerId = null;
      updateTimerUI();
      return;
    }

    if (remainingSeconds <= 0) {
      remainingSeconds = getCurrentModeMinutes() * 60;
    }

    isRunning = true;
    updateTimerUI();
    timerId = setInterval(tick, 1000);
  }

  function handleReset() {
    completedWorkSessions = 0;
    updateSessionProgress();
    resetTimerForCurrentMode();
  }

  function handleModeChange(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    completedWorkSessions = currentMode === MODES.work ? completedWorkSessions : completedWorkSessions;
    clearInterval(timerId);
    timerId = null;
    isRunning = false;
    modeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    resetTimerForCurrentMode();
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function handleSettingsChange() {
    settings.workMinutes = clampNumber(
      workInput.value,
      1,
      120,
      DEFAULTS.workMinutes,
    );
    settings.shortBreakMinutes = clampNumber(
      shortBreakInput.value,
      1,
      60,
      DEFAULTS.shortBreakMinutes,
    );
    settings.longBreakMinutes = clampNumber(
      longBreakInput.value,
      1,
      60,
      DEFAULTS.longBreakMinutes,
    );
    settings.sessionsBeforeLongBreak = clampNumber(
      sessionsBeforeLongBreakInput.value,
      1,
      10,
      DEFAULTS.sessionsBeforeLongBreak,
    );
    settings.autoStartNext = Boolean(autoStartNextInput.checked);
    settings.soundEnabled = Boolean(soundEnabledInput.checked);
    saveSettings(settings);

    if (!isRunning) {
      resetTimerForCurrentMode();
    }
  }

  function handleThemeToggle() {
    settings.theme = settings.theme === 'light' ? 'dark' : 'light';
    saveSettings(settings);
    applyTheme(settings.theme);
  }

  function initEvents() {
    startPauseBtn.addEventListener('click', handleStartPause);
    resetBtn.addEventListener('click', handleReset);

    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (!mode) return;
        handleModeChange(mode);
      });
    });

    [
      workInput,
      shortBreakInput,
      longBreakInput,
      sessionsBeforeLongBreakInput,
    ].forEach((input) =>
      input.addEventListener('change', handleSettingsChange),
    );

    autoStartNextInput.addEventListener('change', handleSettingsChange);
    soundEnabledInput.addEventListener('change', handleSettingsChange);

    themeToggle.addEventListener('click', handleThemeToggle);
  }

  function init() {
    applySettingsToUI();
    applyTheme(settings.theme);
    resetTimerForCurrentMode();
    updateSessionProgress();
    initEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

