import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SyncDevice, SyncSnapshot, PeerInfo, ScanStatus } from "../lib/sync";
import {
  loadDevice,
  loadPeers,
  savePeers,
  saveDeviceName,
  scanSubnet,
  fetchInfo,
  probeInfo,
  fetchSnapshot,
  pushSnapshot,
  startDiscovery,
  stopDiscovery,
  getDiscoveredPeer,
  SYNC_PORT,
} from "../lib/sync";
import { isMobilePlatform } from "../lib/platform";
import { appLog } from "../lib/applog";

interface Options {
  /** синхронизация доступна только на ПК (сервер) и телефоне (клиент) */
  enabled: boolean;
  /** актуальная ревизия библиотеки — публикуем снапшот при её изменении */
  currentRev: string;
  /** построить снапшот текущей библиотеки */
  getSnapshot: () => SyncSnapshot | null;
  /** применить чужой снапшот (слияние выполняется в App) */
  onIncomingSnapshot: (snap: SyncSnapshot) => void;
}

export interface SyncCandidate extends PeerInfo {
  firstSeen: number;
}

/**
 * Оркестрация сетевой синхронизации:
 *  - сканирует Wi-Fi-подсеть и показывает новые устройства (баннер);
 *  - держит список подключённых, периодически сверяет ревизии;
 *  - при расхождении — тянет снапшот, отдаёт его в App на слияние
 *    и публикует свой обновлённый обратно.
 */
export function useSync({ enabled, currentRev, getSnapshot, onIncomingSnapshot }: Options) {
  const [device, setDevice] = useState<SyncDevice>(() => loadDevice());
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [serverRunning, setServerRunning] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);
  // На ПК сервер включается тумблером (opt-in); телефон — только клиент,
  // слушать ему нечего, поэтому сразу «включён».
  const [syncOn, setSyncOn] = useState(() => isMobilePlatform());
  const [pairCode, setPairCode] = useState<string>("");
  const [peers, setPeers] = useState<PeerInfo[]>(() => loadPeers());
  const [candidate, setCandidate] = useState<SyncCandidate | null>(null);
  const [scanning, setScanning] = useState(false);
  const [connectError, setConnectError] = useState<"bad-ip" | "timeout" | "unreachable" | "bad-code" | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");

  const cbRef = useRef({ getSnapshot, onIncomingSnapshot, currentRev });
  cbRef.current = { getSnapshot, onIncomingSnapshot, currentRev };
  const deviceRef = useRef(device);
  deviceRef.current = device;
  const peersRef = useRef(peers);
  peersRef.current = peers;
  const mergedRevs = useRef<Map<string, string>>(new Map());
  const busyPeers = useRef<Set<string>>(new Set());

  /* ---------- статус сервера + локальный IP ---------- */
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      try {
        const st = await window.volna?.syncStatus();
        if (!alive || !st) return;
        setLocalIp(st.localIp);
        setServerRunning(st.running);
        setServerPort(st.port);
        if (typeof st.enabled === "boolean") setSyncOn(st.enabled);
        if (st.token) setPairCode(st.token);
        appLog("sync", "pc status", st);
        if (st.deviceName && deviceRef.current.type === "pc") {
          // ПК по умолчанию называется hostname (пользователь может переименовать)
          const d = deviceRef.current;
          if (d.name === "Компьютер") {
            const upd = { ...d, name: st.deviceName };
            setDevice(upd);
            try {
              localStorage.setItem("volna.sync.device", JSON.stringify(upd));
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* нет моста (веб) */
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);

  /* ---------- реакция на входящие снапшоты (сервер на ПК) ---------- */
  useEffect(() => {
    if (!enabled || !window.volna?.onSyncIncoming) return;
    return window.volna.onSyncIncoming((raw) => {
      const snap = raw as SyncSnapshot;
      if (!snap || !snap.deviceId || snap.deviceId === deviceRef.current.id) return;
      cbRef.current.onIncomingSnapshot(snap);
    });
  }, [enabled]);

  /* ---------- публикация своего снапшота при изменении библиотеки ---------- */
  useEffect(() => {
    if (!enabled || !currentRev || !syncOn) return;
    const t = setTimeout(() => {
      const snap = cbRef.current.getSnapshot();
      if (!snap) return;
      try {
        window.volna?.syncPublish(snap);
      } catch {
        /* не ПК */
      }
      for (const p of peersRef.current) {
        void pushSnapshot(p, snap);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [enabled, currentRev, syncOn]);

  /* ---------- опрос подключённых устройств ---------- */
  useEffect(() => {
    if (!enabled || !syncOn) return;
    let alive = true;

    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      for (const p of peersRef.current) {
        if (busyPeers.current.has(p.deviceId)) continue;
        busyPeers.current.add(p.deviceId);
        (async () => {
          try {
            const info = await fetchInfo(p.ip, p.port, 1500);
            setPeers((prev) =>
              prev.map((x) =>
                x.deviceId === p.deviceId ? { ...x, lastSeen: info ? Date.now() : x.lastSeen, rev: info?.rev ?? x.rev } : x
              )
            );
            if (!info) return;
            const merged = mergedRevs.current.get(p.deviceId);
            if (info.rev && info.rev !== merged) {
              appLog("sync", "peer rev differs, pulling", `${p.name} ${p.ip}`);
              const got = await fetchSnapshot(p);
              if (!alive || !got.ok || got.snap.deviceId !== p.deviceId) return;
              const snap = got.snap;
              mergedRevs.current.set(p.deviceId, snap.rev);
              appLog("sync", "snapshot pulled", `${snap.tracks.length} tracks from ${p.name}`);
              cbRef.current.onIncomingSnapshot(snap);
              const mine = cbRef.current.getSnapshot();
              if (mine) void pushSnapshot(p, mine);
            }
          } finally {
            busyPeers.current.delete(p.deviceId);
          }
        })();
      }
    };

    const timer = setInterval(poll, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [enabled, syncOn]);

  /* ---------- UDP-слушатель анонсов ПК (Android, как в LocalSend) ---------- */
  useEffect(() => {
    if (!enabled || !isMobilePlatform()) return;
    void startDiscovery();
    return () => {
      void stopDiscovery();
    };
  }, [enabled]);

  /* ---------- сканирование сети ---------- */
  const scan = useCallback(async () => {
    if (!enabled) return;
    setScanning(true);
    try {
      let found: PeerInfo[] = [];
      let heardButBlocked = false;
      // 1) UDP-анонсы (быстро и без перебора): телефон уже слышит ПК
      const d = await getDiscoveredPeer();
      if (d && d.deviceId !== deviceRef.current.id) {
        appLog("sync", "udp heard", `${d.name} ${d.ip}:${d.port}`);
        const info = await fetchInfo(d.ip, d.port || SYNC_PORT, 800);
        if (info && info.deviceId !== deviceRef.current.id) found = [info];
        else heardButBlocked = true; // ПК передаёт анонсы, но HTTP-порт закрыт
        if (heardButBlocked) appLog("sync", "udp heard but http failed", `${d.ip}:${d.port || SYNC_PORT}`);
      }
      // 2) fallback — прежний слепой скан /24
      if (!found.length && localIp) {
        found = await scanSubnet(localIp, deviceRef.current.id);
        if (found.length) heardButBlocked = false;
      }
      if (!found.length) {
        appLog("sync", "scan: nothing", { heard: heardButBlocked, selfIp: localIp });
        setScanStatus(localIp || heardButBlocked ? (heardButBlocked ? "foundBlocked" : "none") : "none");
        return;
      }
      appLog("sync", "scan: found", found.map((f) => `${f.name} ${f.ip}:${f.port}`));
      setScanStatus("found");
      setPeers((prev) => {
        const map = new Map(prev.map((x) => [x.deviceId, x]));
        for (const f of found) {
          const ex = map.get(f.deviceId);
          if (ex) map.set(f.deviceId, { ...ex, ...f, lastSeen: Date.now() });
          else map.set(f.deviceId, f);
        }
        const next = [...map.values()];
        savePeers(next);
        return next;
      });
      // Баннер: найденное устройство, которого ещё НЕТ в подключённых.
      // Закрытый баннер появится снова при следующем скане — пока не подключат.
      const peerIds = new Set(peersRef.current.map((x) => x.deviceId));
      const fresh = found.find((f) => !peerIds.has(f.deviceId));
      if (fresh) setCandidate((cur) => cur ?? { ...fresh, firstSeen: Date.now() });
    } finally {
      setScanning(false);
    }
  }, [enabled, localIp]);

  /* периодическое сканирование, пока окно видно */
  useEffect(() => {
    if (!enabled || !localIp) return;
    void scan();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void scan();
    }, 15000);
    return () => clearInterval(timer);
  }, [enabled, localIp, scan]);

  /* ---------- действия ---------- */
  /** Подключение к найденному устройству. Для ПК-сервера нужен парный код
   *  (12 символов с экрана ПК) — без него сервер не отдаёт и не принимает данные. */
  const connectCandidate = useCallback(async (c: SyncCandidate, code?: string) => {
    setCandidate(null);
    const p: PeerInfo = { ...c, token: code ? code.trim().toLowerCase() : undefined };
    setPeers((prev) => {
      if (prev.some((x) => x.deviceId === p.deviceId)) return prev;
      const next = [...prev, p];
      savePeers(next);
      return next;
    });
    // немедленный обмен: тянули их → отдали своё
    const got = await fetchSnapshot(p);
    if (!got.ok) {
      if (got.unauthorized) {
        // код неверный — убираем устройство и просим ввести заново
        appLog("sync", "pair code rejected", `${p.name} ${p.ip}`);
        setConnectError("bad-code");
        setPeers((prev) => {
          const next = prev.filter((x) => x.deviceId !== p.deviceId);
          savePeers(next);
          return next;
        });
        return false;
      }
    } else {
      const snap = got.snap;
      if (snap.deviceId === p.deviceId) {
        mergedRevs.current.set(p.deviceId, snap.rev);
        cbRef.current.onIncomingSnapshot(snap);
      }
    }
    const mine = cbRef.current.getSnapshot();
    if (mine) void pushSnapshot(p, mine);
    return true;
  }, []);

  /** Тумблер синхронизации на ПК: старт/стоп HTTP+UDP сервера (main-процесс) */
  const setSyncEnabled = useCallback(async (on: boolean) => {
    try {
      const st = await window.volna?.syncSetEnabled?.(on);
      if (st) {
        setSyncOn(!!st.enabled);
        setServerRunning(st.running);
        setServerPort(st.port);
        setLocalIp(st.localIp);
        if (st.token) setPairCode(st.token);
      }
    } catch {
      /* не ПК */
    }
  }, []);

  const disconnectPeer = useCallback((id: string) => {
    setPeers((prev) => {
      const next = prev.filter((x) => x.deviceId !== id);
      savePeers(next);
      return next;
    });
    mergedRevs.current.delete(id);
  }, []);

  /** Ручное подключение по адресу "192.168.1.5" или "192.168.1.5:51789" + парный код */
  const connectByIp = useCallback(
    async (raw: string, code?: string): Promise<boolean> => {
      const m = raw.trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{2,5}))?$/);
      if (!m) {
        setConnectError("bad-ip");
        appLog("sync", "connect by ip: bad address", raw);
        return false;
      }
      const ip = m[1];
      const port = m[2] ? Number(m[2]) : SYNC_PORT;
      appLog("sync", "connect by ip…", `${ip}:${port} (self ${localIp ?? "?"})`);
      const { info, kind } = await probeInfo(ip, port, 2500);
      if (!info || info.deviceId === deviceRef.current.id) {
        setConnectError(kind === "timeout" ? "timeout" : "unreachable");
        appLog("sync", "connect failed", kind ?? "not volna");
        return false;
      }
      setConnectError(null);
      appLog("sync", "connect ok", `${info.name} ${ip}:${port}`);
      return connectCandidate({ ...info, firstSeen: Date.now() }, code);
    },
    [connectCandidate, localIp]
  );

  const renameDevice = useCallback((name: string) => {
    setDevice(saveDeviceName(name));
  }, []);

  const dismissCandidate = useCallback(() => setCandidate(null), []);

  const isOnline = useMemo(
    () => (p: PeerInfo) => Date.now() - p.lastSeen < 45000,
    []
  );

  return {
    device,
    localIp,
    serverRunning,
    serverPort,
    syncOn,
    pairCode,
    setSyncEnabled,
    peers,
    candidate,
    scanning,
    scanStatus,
    connectError,
    isOnline,
    connectCandidate,
    connectByIp,
    disconnectPeer,
    renameDevice,
    dismissCandidate,
    scanNow: scan,
  };
}
