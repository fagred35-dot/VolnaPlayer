import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "ru";

const STORAGE_KEY = "volna-lang";

/** Английский — язык по умолчанию («системный») */
const en = {
  // общие
  close: "Close",
  cancel: "Cancel",
  ok: "OK",
  retry: "Retry",
  remove: "Remove",
  download: "Download",
  open: "Open",
  appName: "Volna",
  appTagline: "light music player",

  // заголовок окна / вкладки
  tabTitleIdle: "Volna — music player",
  tabTitlePlaying: "{title} — Volna",

  // приветствие
  greetNight: "Good night",
  greetMorning: "Good morning",
  greetAfternoon: "Good afternoon",
  greetEvening: "Good evening",

  // навигация
  library: "Library",
  favorites: "Favorites",
  recent: "Recent",
  albums: "Albums",
  list: "List",
  playlists: "Playlists",
  newPlaylist: "New playlist",
  playlistNamePlaceholder: "Name…",
  playlistNameTaken: "A playlist with this name already exists",
  playlistsEmptyHint: "Nothing here yet. Create a playlist and add tracks from their menu",
  addFiles: "Add files",
  chooseMusicFolder: "Choose music folder",
  downloadMusic: "Download music",
  settings: "Settings",

  // карточка папки
  sync: "Sync",
  inExplorer: "In Explorer",

  // карточка библиотеки
  libraryStats: "Library",
  ofAudio: "of audio",
  accentTitle: "Accent",
  accentDesc: "Interface highlight color",
  accentModeSolid: "Color",
  accentModeGradient: "Gradient",
  accentNoGradient: "No gradient",
  winOpacityTitle: "Background density",

  // подсказка внизу
  menuHintSearch: "Menu:",

  // сортировка
  sortTitle: "Sort",
  sortAdded: "Custom order",
  sortByName: "Title",
  sortByArtist: "Artist",
  sortByAlbum: "Album",
  sortByDuration: "Duration",
  sortByAddedDate: "Date added",
  sortOrderBadge: "order",

  // поиск
  searchPlaceholder: "Search…",

  // кнопки шапки
  folderBtn: "Folder",
  filesBtn: "Files",
  showAsAlbums: "Show as albums",
  showAsList: "Show as list",
  backToAlbums: "← all albums",
  backToAlbumsTitle: "Back to albums",
  exitPlaylist: "✕ exit",
  exitPlaylistTitle: "Leave playlist",

  // виды библиотеки
  viewAlbumView: "Albums",
  viewListView: "List",

  // счётчики
  countTracksOne: "track",
  countTracksFew: "tracks",
  countTracksMany: "tracks",
  tracksUpNext: "{n} up next",
  emptyQueueWord: "empty",

  // пустые состояния
  libraryEmpty: "Your library is empty",
  libraryEmptyHint:
    "Drop audio files here or add them from your disk. Everything is stored locally — no internet needed.",
  pickFiles: "Choose files",
  wholeFolder: "A whole folder",
  formatsLine: "MP3 · FLAC · WAV · OGG · M4A · AAC · OPUS",
  albumNoTracks: "No tracks in this album",
  playlistEmptyHint: "Playlist is empty — add tracks via their menu (click the title below)",
  recentEmptyHint: "Nothing played yet — just play some music",
  nothingFound: "Nothing found",
  nothingFoundHint: "Try another query or reset the filters",
  unknownArtist: "Unknown artist",

  // заголовки колонок
  colTitle: "Title",
  colArtist: "Artist",
  colTime: "Time",
  seek: "Seek",
  disc2d: "2D cover",
  backToVinyl: "Back to vinyl (3D)",
  flatCover: "Flat cover (2D)",
  speedNx: "{s}× speed",
  hintSpacePause: "space — pause",
  hintArrowSeek: "← → — seek",

  // плеер
  noTrack: "No track",
  addSomeMusic: "Add some music",
  trackMenu: "Track menu",
  favAdd: "Add to favorites",
  favRemove: "Remove from favorites",
  nowPlaying: "Now playing",
  playNextLabel: "Play next",
  addToQueue: "Add to queue",
  addToPlaylist: "Add to playlist",
  removeFromPlaylist: "Remove from playlist",
  createPlaylistSidebarHint: "Create a playlist in the sidebar",
  showInExplorer: "Show in folder",
  removeFromLibrary: "Remove from library",
  deleteFromDevice: "Delete from device",
  confirmDeleteTitle: "Delete from device?",
  confirmDeleteText: "The file «{name}» will be permanently deleted from disk.",
  confirmYes: "Yes, delete",
  toastFileDeleted: "Deleted from device: {name}",
  toastDeleteFailed: "Could not delete the file",
  clickToCopy: "Click to copy",
  shuffleOn: "Shuffle on — click to play in order",
  shuffleOff: "In order — click to enable shuffle",
  repeatThisTrack: "Repeating this track 🔁 — click to turn off",
  repeatAllTracks: "Repeating the whole playlist 🔁 — click to repeat one track",
  repeatOff: "Repeat off — click to repeat the playlist",
  prevTrack: "Previous",
  nextTrack: "Next",
  playPause: "Play / Pause",
  speedTitle: "Speed",
  miniPlayer: "Mini player",
  miniPlayerOnlyWindows: "Mini player is available in the Windows app",
  queueBtn: "Queue",
  muteTitle: "Mute",
  masterVolume: "Master volume",
  masterShort: "Master",
  trackVolume: "Track volume",
  trackShort: "Track",
  resetTrackVolume: "Reset track: 100%",
  quieter30: "Quieter by 30%",
  quieter50: "Quieter by 50%",
  standardVolume: "Standard volume",
  fullscreenNow: "Fullscreen",
  equalizer: "Equalizer",
  sleepTimer: "Sleep timer",

  // меню трека (ПКМ)
  menuPlay: "Play",
  menuCreatePlaylistHint: "Create a playlist in the sidebar",
  menuInPlaylistName: "To «{name}»",

  // очередь
  queueTitle: "Queue",
  clearQueue: "Clear",
  queueEmpty: "Queue is empty",
  queueEmptyHint: "Open a track's menu (click the title below) and press «Add to queue»",

  // эквалайзер
  eqSubtitle: "10 bands · Web Audio API · 0% CPU when paused",
  eqOnOff: "On/Off",
  eqActive: "Equalizer active",
  eqInactive: "Equalizer off — sound goes straight through",
  eqBandHz: "Band {hz} Hz",
  eqKilo: "k",

  // таймер сна
  stSubtitle: "Music will stop by itself",
  stUntilStop: "until stop",
  stCancelTimer: "Cancel timer",
  stMinutes: "{m} min",
  stCustomPlaceholder: "Minutes…",
  stCustomRange: "Enter from 1 to 720 minutes",
  stNote: "Fall asleep to music — the player pauses itself and saves your battery",
  toastSleepSet: "Sleep timer: {min} min",
  toastSleepCancelled: "Timer cancelled",
  toastSleepFired: "Sleep timer finished — music stopped",

  // статистика
  statsTitle: "Statistics",
  statsSubtitle: "What you listen to",
  statsEmpty: "Nothing here yet",
  statsEmptyHint: "Just play some music — plays, time and favorite tracks will show up here",
  statPlays: "plays",
  statListeningTime: "of listening time",
  statInLibrary: "tracks in library",
  statFavorites: "in favorites",
  statsMostPlayed: "Most played",
  statsRecent: "Recently played",

  // альбомы
  albumsEmpty: "No albums",
  albumsEmptyHint: "Albums are built from file tags — add music with proper tags",
  noAlbum: "No album",
  unknownAlbum: "Unknown album",

  // темы
  themesTitle: "Themes & styles",
  themesSubtitle: "Go wild: themes · wallpapers · CSS code",
  tabThemes: "Themes",
  tabWallpaper: "Wallpaper",
  tabCss: "CSS code",
  readyThemesNow: "Ready-made themes · now: {current}",
  randomTheme: "Random",
  uploadWallpaper: "Upload wallpaper",
  wallpaperRemove: "Remove",
  wallpaperUrlPlaceholder: "or an image / GIF link…",
  wallpaperGifNote: "🎞 PNG, JPG and animated GIF are supported — the gif comes alive right in the app background.",
  wallDim: "Dim",
  wallBlur: "Blur",
  customCssInstant: "Your CSS — applied instantly",
  cssToggle: "CSS on/off",
  aiGenerator: "🤖 AI theme generator",
  aiGeneratorHint:
    "Describe a style (any language) — you'll get a ready-to-use English prompt for ChatGPT / Claude / any AI.",
  aiStylePlaceholder: "For example: deep space, purple neon, glass panels, soft glow…",
  buildPrompt: "⚡ Build prompt",
  copied: "✓ Copied",
  copy: "📋 Copy",
  pasteAiAnswer: "📥 Paste the AI answer — code inside <code>```css ... ```</code> will be extracted and applied:",
  pasteAiPlaceholder: "Paste the AI answer here…",
  apply: "Apply",
  themeVarsTitle: "Theme variables — use them in your code",
  themeVarsExample:
    'Example: <code>:root {"{ --accent: #ff00aa; --bg-base: #000; }"}</code> recolors the whole UI. Classes to style: <code>.app-header, .artist-col, .track-cover, .sidebar-stats</code>.',
  resetAll: "Reset all",
  savedAutomatically: "Everything is saved automatically",
  toastThemeSet: "Theme: {name}",
  toastResetDone: "Theme & styles reset",
  toastWallpaperSet: "Wallpaper set",
  toastWallpaperGif: "Wallpaper set · GIF is alive 🎞",
  toastWallpaperUrl: "Wallpaper set from URL",
  toastWallpaperUrlGif: "URL wallpaper set · GIF is alive 🎞",
  toastNeedImage: "An image file is required (PNG/JPG/GIF/WebP)",
  toastCssApplied: "AI theme applied",

  // о приложении
  creditsTitle: "Open source",
  creditsSubtitle: "«Volna» is built on these open-source projects",
  creditsFooter:
    "All projects are distributed under free licenses (MIT, Apache-2.0, Unlicense, etc.). Links open in your browser.",

  // мини-плеер
  expand: "Expand",
  back: "Back",
  forward: "Forward",
  mpSettings: "Overlay settings",
  mpView: "Layout",
  mpBgTitle: "Window background",
  mpBgTheme: "Theme",
  mpBgTransparent: "Transparent",
  mpPresetStandard: "Standard",
  mpPresetCompact: "Compact",
  mpPresetBar: "Bar",
  mpPresetCover: "Cover",
  mpMove: "Move overlay (Ctrl+Alt+M)",
  mpMoveHint: "Drag the overlay anywhere",
  mpMoveFinish: "Done (Esc)",

  // drag&drop
  dropToAdd: "Drop to add to library",

  // тосты общие
  toastNoAudioFiles: "No audio files in selection",
  toastAddedN: "Added: {n}",
  toastAlreadyInLibrary: "All of these are already in your library",
  toastFolderAdded: "Folder «{name}»: added {n}",
  toastFolderSynced: "Folder «{name}» synced",
  toastRescanNew: "New tracks: {n}",
  toastRescanNone: "Everything is up to date",
  toastRemoved: "Removed: {title}",
  toastUpNext: "Up next: {title}",
  toastQueued: "Queued: {title}",
  toastAddedToQueue: "Added to queue",
  toastAddedToPl: "Added to «{name}»",
  toastRemovedFromPl: "Removed from playlist",
  toastDownloaded: "Downloaded: {title}",
  toastChooseFolderFirst: "Choose your music folder first — downloads will go there",
  toastMiniOpened: "Mini player opened",
  toastMiniUnavailable: "Mini player is available in the Windows app",

  // настройки
  settingsTitle: "Settings",
  settingsSubtitle: "All tools in one place",
  setTabGeneral: "General",
  setTabAppearance: "Appearance",
  setTabIntegrations: "Integrations",
  setTabAbout: "About",
  winTranspTitle: "Transparent window",
  winTranspDesc: "The desktop shows through the app",
  winTranspRestart: "Takes effect after app restart",
  winBlurTitle: "Background blur behind window",
  winBlurNone: "None",
  winBlurAcrylic: "Acrylic",
  winBlurMica: "Mica",
  winBlurNote: "Blur requires Windows 11 and transparent mode",
  toastRestartNeeded: "Restart the app to apply",
  winMinimize: "Minimize",
  winMaximize: "Maximize",
  winRestoreWin: "Restore",
  rowThemesDesc: "Wallpapers, GIF, CSS code, AI generator",
  rowEqDesc: "10 bands · 9 presets",
  rpcRowTitle: "Discord RPC",
  rpcRowDesc: "«Listening» status in your profile",
  rowStatsDesc: "Plays · time · tops",
  aboutRowTitle: "About the app",
  aboutRowDesc: "Hold the «Volna» logo — open-source projects",
  languageRowTitle: "Language",
  languageRowDesc: "Interface language (saved automatically)",
  langEn: "English",
  langRu: "Russian",

  // скачивание
  dlTitle: "Download music",
  dlSubtitle: "yt-dlp · 1000+ sites",
  tabLink: "Link",
  tabSearch: "YouTube search",
  linkPlaceholder: "Paste a video link: YouTube, VK, Twitch, TikTok…",
  addBtn: "Add",
  searchPlaceholder2: "Type a track or artist name…",
  searchBtn: "Search",
  searching: "Searching…",
  searchEmpty: "Nothing found",
  searchFailed: "Search failed. yt-dlp may still be downloading — try again in a moment.",
  destSavedTo: "Saved to",
  destWillSaveTo: "Saving to",
  openFolder: "Open folder",
  done: "Done",
  statusWaiting: "Waiting",
  statusDownloading: "Downloading audio…",
  statusProcessing: "Processing audio…",
  statusCancelled: "Cancelled",
  firstRunNote: "first run may download yt-dlp, a JS runtime (Node) and FFmpeg",
  addedWithTagsNote: "The track lands in your library with cover, artist and duration.",
  explorerRefreshNote: "If you don't see the file in Explorer — refresh the window (F5).",
  mp3Note: "MP3 if FFmpeg is present, otherwise M4A.",
  folderNote: "Saved into your music folder — stays after restart",
  queueCountLabel: "{n} in queue",
  dlErrorGeneric: "Download failed",
  resultsFound: "Results for «{q}»",
  alreadyInQueue: "This link is already in the queue",
} as const;

export type TKey = keyof typeof en;

const ru: Record<TKey, string> = {
  // общие
  close: "Закрыть",
  cancel: "Отмена",
  ok: "ОК",
  retry: "Повторить",
  remove: "Убрать",
  download: "Скачать",
  open: "Открыть",
  appName: "Волна",
  appTagline: "лёгкий плеер",

  tabTitleIdle: "Волна — музыкальный плеер",
  tabTitlePlaying: "{title} — Волна",

  greetNight: "Доброй ночи",
  greetMorning: "Доброе утро",
  greetAfternoon: "Добрый день",
  greetEvening: "Добрый вечер",

  library: "Библиотека",
  favorites: "Избранное",
  recent: "Недавние",
  albums: "Альбомы",
  list: "Список",
  playlists: "Плейлисты",
  newPlaylist: "Новый плейлист",
  playlistNamePlaceholder: "Название…",
  playlistNameTaken: "Плейлист с таким именем уже есть",
  playlistsEmptyHint: "Пока пусто. Создайте плейлист и добавляйте треки через их меню",
  addFiles: "Добавить файлы",
  chooseMusicFolder: "Выбрать папку с музыкой",
  downloadMusic: "Скачать музыку",
  settings: "Настройки",

  sync: "Синхронизация",
  inExplorer: "В проводнике",

  libraryStats: "Библиотека",
  ofAudio: "звука",
  accentTitle: "Акцент",
  accentDesc: "Цвет выделения интерфейса",
  accentModeSolid: "Цвет",
  accentModeGradient: "Градиент",
  accentNoGradient: "Без градиента",
  winOpacityTitle: "Плотность фона",

  menuHintSearch: "Меню:",

  sortTitle: "Сортировка",
  sortAdded: "Как добавлены",
  sortByName: "Название",
  sortByArtist: "Исполнитель",
  sortByAlbum: "Альбом",
  sortByDuration: "Длительность",
  sortByAddedDate: "Дата добавления",
  sortOrderBadge: "порядок",

  searchPlaceholder: "Поиск…",

  folderBtn: "Папка",
  filesBtn: "Файлы",
  showAsAlbums: "Показать альбомами",
  showAsList: "Показать списком",
  backToAlbums: "← все альбомы",
  backToAlbumsTitle: "Назад к альбомам",
  exitPlaylist: "✕ выйти",
  exitPlaylistTitle: "Выйти из плейлиста",

  viewAlbumView: "Альбомы",
  viewListView: "Список",

  countTracksOne: "трек",
  countTracksFew: "трека",
  countTracksMany: "треков",
  tracksUpNext: "{n} дальше",
  emptyQueueWord: "пусто",

  libraryEmpty: "Библиотека пуста",
  libraryEmptyHint:
    "Перетащите сюда аудиофайлы или добавьте их с диска. Всё хранится локально — интернет не нужен.",
  pickFiles: "Выбрать файлы",
  wholeFolder: "Целую папку",
  formatsLine: "MP3 · FLAC · WAV · OGG · M4A · AAC · OPUS",
  albumNoTracks: "В альбоме нет треков",
  playlistEmptyHint: "Плейлист пуст — добавьте треки через меню трека (клик по названию внизу)",
  recentEmptyHint: "Ещё ничего не слушали — просто включите музыку",
  nothingFound: "Ничего не найдено",
  nothingFoundHint: "Попробуйте другой запрос или сбросьте фильтры",
  unknownArtist: "Неизвестный исполнитель",

  colTitle: "Название",
  colArtist: "Исполнитель",
  colTime: "Время",
  seek: "Перемотка",
  disc2d: "2D-обложка",
  backToVinyl: "Вернуть винил (3D)",
  flatCover: "Плоская обложка (2D)",
  speedNx: "скорость {s}×",
  hintSpacePause: "пробел — пауза",
  hintArrowSeek: "← → — перемотка",

  noTrack: "Нет трека",
  addSomeMusic: "Добавьте музыку",
  trackMenu: "Меню трека",
  favAdd: "В избранное",
  favRemove: "Убрать из избранного",
  nowPlaying: "Сейчас играет",
  playNextLabel: "Играть следующим",
  addToQueue: "В очередь",
  addToPlaylist: "В плейлист",
  removeFromPlaylist: "Убрать из плейлиста",
  createPlaylistSidebarHint: "Создайте плейлист в боковом меню",
  showInExplorer: "Показать в папке",
  removeFromLibrary: "Удалить из библиотеки",
  deleteFromDevice: "Удалить с устройства",
  confirmDeleteTitle: "Удалить с устройства?",
  confirmDeleteText: "Файл «{name}» будет безвозвратно удалён с диска.",
  confirmYes: "Да, удалить",
  toastFileDeleted: "Удалено с устройства: {name}",
  toastDeleteFailed: "Не удалось удалить файл",
  clickToCopy: "Нажмите, чтобы скопировать",
  shuffleOn: "Вперемешку: вкл — нажми, чтобы играть по порядку",
  shuffleOff: "По порядку — нажми, чтобы включить перемешку",
  repeatThisTrack: "Повторяется этот трек 🔁 — нажми, чтобы выключить",
  repeatAllTracks: "Повторяется весь плейлист 🔁 — нажми, чтобы повторять один трек",
  repeatOff: "Повтор выключен — нажми, чтобы повторять плейлист",
  prevTrack: "Предыдущий",
  nextTrack: "Следующий",
  playPause: "Играть / Пауза",
  speedTitle: "Скорость",
  miniPlayer: "Мини-плеер",
  miniPlayerOnlyWindows: "Мини-плеер доступен в Windows-приложении",
  queueBtn: "Очередь",
  muteTitle: "Без звука",
  masterVolume: "Общая громкость",
  masterShort: "Общая",
  trackVolume: "Громкость трека",
  trackShort: "Трек",
  resetTrackVolume: "Сбросить трек: 100%",
  quieter30: "Тише на 30%",
  quieter50: "Тише на 50%",
  standardVolume: "Стандартная громкость",
  fullscreenNow: "Во весь экран",
  equalizer: "Эквалайзер",
  sleepTimer: "Таймер сна",

  menuPlay: "Играть",
  menuCreatePlaylistHint: "Создайте плейлист в боковом меню",
  menuInPlaylistName: "В «{name}»",

  queueTitle: "Очередь",
  clearQueue: "Очистить",
  queueEmpty: "Очередь пуста",
  queueEmptyHint: "Откройте меню трека (клик по названию внизу) и нажмите «В очередь»",

  eqSubtitle: "10 полос · Web Audio API · 0% CPU в паузе",
  eqOnOff: "Вкл/выкл",
  eqActive: "Эквалайзер активен",
  eqInactive: "Эквалайзер выключен — звук идёт напрямую",
  eqBandHz: "Полоса {hz} Гц",
  eqKilo: "к",

  stSubtitle: "Музыка остановится сама",
  stUntilStop: "до остановки",
  stCancelTimer: "Отменить таймер",
  stMinutes: "{m} мин",
  stCustomPlaceholder: "Минут…",
  stCustomRange: "Введите от 1 до 720 минут",
  stNote: "Засыпайте под музыку — плеер сам поставит паузу и не будет жечь батарею",
  toastSleepSet: "Таймер сна: {min} мин",
  toastSleepCancelled: "Таймер отменён",
  toastSleepFired: "Таймер сна сработал — музыка остановлена",

  statsTitle: "Статистика",
  statsSubtitle: "Что вы слушаете",
  statsEmpty: "Пока пусто",
  statsEmptyHint: "Просто включите музыку — здесь появятся прослушивания, время и любимые треки",
  statPlays: "прослушиваний",
  statListeningTime: "времени в музыке",
  statInLibrary: "треков в библиотеке",
  statFavorites: "в избранном",
  statsMostPlayed: "Чаще всего",
  statsRecent: "Недавние",

  albumsEmpty: "Нет альбомов",
  albumsEmptyHint: "Альбомы собираются из тегов файлов — добавьте музыку с заполненными тегами",
  noAlbum: "Без альбома",
  unknownAlbum: "Неизвестный альбом",

  themesTitle: "Темы и стили",
  themesSubtitle: "Разгуляйся: темы · обои · CSS-код",
  tabThemes: "Темы",
  tabWallpaper: "Обои",
  tabCss: "CSS-код",
  readyThemesNow: "Готовые темы · сейчас: {current}",
  randomTheme: "Случайная",
  uploadWallpaper: "Загрузить обои",
  wallpaperRemove: "Убрать",
  wallpaperUrlPlaceholder: "или ссылка на картинку / GIF…",
  wallpaperGifNote: "🎞 Поддерживаются PNG, JPG и анимированные GIF — гифка оживает прямо в фоне приложения.",
  wallDim: "Затемнение",
  wallBlur: "Размытие",
  customCssInstant: "Свой CSS — применяется мгновенно",
  cssToggle: "Вкл/выкл CSS",
  aiGenerator: "🤖 ИИ-генератор темы",
  aiGeneratorHint: "Опиши стиль (можно по-русски) — получишь готовый промпт на английском для ChatGPT / Claude / любой ИИ.",
  aiStylePlaceholder: "Например: космос, фиолетовый неон, стеклянные панели, мягкое свечение…",
  buildPrompt: "⚡ Собрать промпт",
  copied: "✓ Скопировано",
  copy: "📋 Копировать",
  pasteAiAnswer: "📥 Вставить ответ ИИ — код из <code>```css ... ```</code> будет извлечён и применён:",
  pasteAiPlaceholder: "Вставьте сюда ответ ИИ…",
  apply: "Применить",
  themeVarsTitle: "Переменные темы — используйте в своём коде",
  themeVarsExample:
    'Пример: <code>:root {"{ --accent: #ff00aa; --bg-base: #000; }"}</code> — перекрасит весь интерфейс. Классы для стилизации: <code>.app-header, .artist-col, .track-cover, .sidebar-stats</code>.',
  resetAll: "Сбросить всё",
  savedAutomatically: "Всё сохраняется автоматически",
  toastThemeSet: "Тема: {name}",
  toastResetDone: "Тема и стили сброшены",
  toastWallpaperSet: "Обои установлены",
  toastWallpaperGif: "Обои установлены · GIF ожил 🎞",
  toastWallpaperUrl: "Обои по ссылке установлены",
  toastWallpaperUrlGif: "Обои по ссылке · GIF ожил 🎞",
  toastNeedImage: "Нужен файл картинки (PNG/JPG/GIF/WebP)",
  toastCssApplied: "ИИ-тема применена",

  creditsTitle: "Открытый код",
  creditsSubtitle: "«Волна» собрана на этих open-source проектах",
  creditsFooter:
    "Все проекты распространяются под свободными лицензиями (MIT, Apache-2.0, Unlicense и др.). Ссылки открываются в вашем браузере.",

  expand: "Развернуть",
  back: "Назад",
  forward: "Вперёд",
  mpSettings: "Настройки оверлея",
  mpView: "Вид",
  mpBgTitle: "Фон окна",
  mpBgTheme: "Тема",
  mpBgTransparent: "Прозрачный",
  mpPresetStandard: "Стандарт",
  mpPresetCompact: "Компакт",
  mpPresetBar: "Панель",
  mpPresetCover: "Обложка",
  mpMove: "Переместить оверлей (Ctrl+Alt+M)",
  mpMoveHint: "Перетащите оверлей куда нужно",
  mpMoveFinish: "Готово (Esc)",

  dropToAdd: "Отпустите — добавим в библиотеку",

  toastNoAudioFiles: "В выборе нет аудиофайлов",
  toastAddedN: "Добавлено: {n}",
  toastAlreadyInLibrary: "Всё это уже есть в библиотеке",
  toastFolderAdded: "Папка «{name}»: добавлено {n}",
  toastFolderSynced: "Папка «{name}» синхронизирована",
  toastRescanNew: "Новых треков: {n}",
  toastRescanNone: "Всё актуально, новых нет",
  toastRemoved: "Удалено: {title}",
  toastUpNext: "Дальше: {title}",
  toastQueued: "В очередь: {title}",
  toastAddedToQueue: "Добавлено в очередь",
  toastAddedToPl: "Добавлено в «{name}»",
  toastRemovedFromPl: "Убрано из плейлиста",
  toastDownloaded: "Скачано: {title}",
  toastChooseFolderFirst: "Сначала выберите папку с музыкой — туда будут скачиваться треки",
  toastMiniOpened: "Мини-плеер открыт",
  toastMiniUnavailable: "Мини-плеер доступен в Windows-приложении",

  settingsTitle: "Настройки",
  settingsSubtitle: "Все инструменты в одном месте",
  setTabGeneral: "Общие",
  setTabAppearance: "Внешний вид",
  setTabIntegrations: "Интеграции",
  setTabAbout: "О приложении",
  winTranspTitle: "Прозрачное окно",
  winTranspDesc: "Сквозь приложение видно рабочий стол",
  winTranspRestart: "Применится после перезапуска приложения",
  winBlurTitle: "Размытие фона за окном",
  winBlurNone: "Нет",
  winBlurAcrylic: "Acrylic",
  winBlurMica: "Mica",
  winBlurNote: "Размытие работает на Windows 11 и требует прозрачного окна",
  toastRestartNeeded: "Перезапустите приложение, чтобы применить",
  winMinimize: "Свернуть",
  winMaximize: "Развернуть",
  winRestoreWin: "Свернуть в окно",
  rowThemesDesc: "Обои, GIF, CSS-код, ИИ-генератор",
  rowEqDesc: "10 полос · 9 пресетов",
  rpcRowTitle: "Discord RPC",
  rpcRowDesc: "Статус «Слушает» в профиле",
  rowStatsDesc: "Прослушивания · время · топы",
  aboutRowTitle: "О приложении",
  aboutRowDesc: "Зажми логотип «Волна» — open-source проекты",
  languageRowTitle: "Язык",
  languageRowDesc: "Язык интерфейса (сохраняется автоматически)",
  langEn: "English",
  langRu: "Русский",

  dlTitle: "Скачать музыку",
  dlSubtitle: "yt-dlp · 1000+ сайтов",
  tabLink: "Ссылка",
  tabSearch: "Поиск в YouTube",
  linkPlaceholder: "Вставьте ссылку на видео: YouTube, VK, Twitch, TikTok…",
  addBtn: "Добавить",
  searchPlaceholder2: "Введите название трека или исполнителя…",
  searchBtn: "Найти",
  searching: "Ищу…",
  searchEmpty: "Ничего не найдено",
  searchFailed: "Поиск не удался. Возможно, yt-dlp ещё скачивается — попробуйте чуть позже.",
  destSavedTo: "Сохранено в",
  destWillSaveTo: "Сохраняется в",
  openFolder: "Открыть папку",
  done: "Готово",
  statusWaiting: "В очереди",
  statusDownloading: "Скачиваю аудио…",
  statusProcessing: "Обработка аудио…",
  statusCancelled: "Отменено",
  firstRunNote: "первый запуск может скачивать yt-dlp, JS-рантайм (Node) и FFmpeg",
  addedWithTagsNote: "Трек появится в библиотеке с обложкой, исполнителем и временем.",
  explorerRefreshNote: "Если не видите файл в проводнике — обновите окно (F5).",
  mp3Note: "MP3 при наличии FFmpeg, иначе M4A.",
  folderNote: "Сохранится в вашу папку с музыкой и останется после перезапуска",
  queueCountLabel: "{n} в очереди",
  dlErrorGeneric: "Не удалось скачать",
  resultsFound: "Результаты: «{q}»",
  alreadyInQueue: "Эта ссылка уже в очереди",
};

const dicts: Record<Lang, Record<TKey, string>> = { en, ru };

type Vars = Record<string, string | number>;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Vars) => string;
}

const Ctx = createContext<I18nCtx>({ lang: "en", setLang: () => undefined, t: (k) => k });

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "ru" || v === "en") return v;
  } catch {
    /* приватный режим */
  }
  return "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* квота */
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const t = useCallback(
    (key: TKey, vars?: Vars): string => {
      let s: string = dicts[lang][key] ?? dicts.en[key] ?? String(key);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      }
      return s;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  return useContext(Ctx);
}

/** Локализованные формы числа: ru — 3 формы, en — 1/many */
export function countText(lang: Lang, n: number, one: string, few: string, many: string): string {
  let word: string;
  if (lang === "ru") {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    word = a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many;
  } else {
    word = n === 1 ? one : many;
  }
  return `${n} ${word}`;
}

/** Дата в локали текущего языка */
export function formatDate(lang: Lang, ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(lang === "ru" ? "ru" : "en", { day: "numeric", month: "short" });
  } catch {
    return new Date(ts).toLocaleDateString();
  }
}
