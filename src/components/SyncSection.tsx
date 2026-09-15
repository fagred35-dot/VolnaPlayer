import { useState } from "react";
import { IconPc, IconPhone, IconRefresh, IconSync, IconX } from "./icons";
import { useI18n } from "../lib/i18n";
import type { ScanStatus, SyncDevice } from "../lib/sync";

export interface SyncPeerView {
  deviceId: string;
  name: string;
  type: "pc" | "mobile" | "web";
  online: boolean;
  ip: string;
}

interface Props {
  device: SyncDevice;
  peers: SyncPeerView[];
  scanning: boolean;
  scanStatus?: ScanStatus;
  localIp: string | null;
  serverRunning: boolean;
  serverPort: number | null;
  connectError: "bad-ip" | "timeout" | "unreachable" | null;
  onScanNow: () => void;
  onRename: () => void;
  onDisconnect: (deviceId: string) => void;
  onConnectByIp: (ip: string) => Promise<boolean>;
  onOpenPort: () => void;
  /** версия сборки этого устройства */
  version?: string;
}

/** Секция «Синхронизация» в сайдбаре: это устройство + подключённые */
export default function SyncSection({
  device,
  peers,
  scanning,
  scanStatus,
  localIp,
  serverRunning,
  serverPort,
  connectError,
  onScanNow,
  onRename,
  onDisconnect,
  onConnectByIp,
  onOpenPort,
  version,
}: Props) {
  const { t } = useI18n();
  const [ipInput, setIpInput] = useState("");
  const DevIcon = device.type === "pc" ? IconPc : device.type === "mobile" ? IconPhone : IconSync;

  return (
    <div className="glass mt-3 rounded-xl p-3">
      <div className="flex items-center gap-2">
        <IconSync className="h-4 w-4 shrink-0 text-[var(--accent)]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">{t("syncSection")}</span>
        {scanning && (
          <span className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-[var(--accent)]" />
        )}
      </div>

      {/* это устройство */}
      <button
        onClick={onRename}
        className="mt-2.5 flex w-full items-center gap-2.5 rounded-lg bg-white/[0.05] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.09]"
        title={t("syncRename")}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
          <DevIcon className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-white">{device.name}</span>
          <span className="block text-[10px] font-semibold text-white/35">
            {t("syncThisDevice")}
            {version ? ` · v${version}` : ""}
          </span>
        </span>
      </button>

      {/* диагностика сети: на ПК — статус сервера, на телефоне — свой IP в сети */}
      <div className="mt-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-white/45">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              localIp ? (device.type === "pc" && !serverRunning ? "bg-amber-400" : "bg-emerald-400") : "bg-white/25"
            }`}
          />
          <span className="truncate">
            {device.type === "pc"
              ? localIp && serverRunning
                ? `${t("syncServer")}: ${localIp}:${serverPort ?? ""}`
                : localIp
                  ? t("syncServerOff")
                  : t("syncNoNetwork")
              : localIp
                ? `${t("syncMyIp")}: ${localIp}`
                : t("syncNoNetwork")}
          </span>
        </div>
        {/* подсказка по последнему поиску (пока ничего не подключено) */}
        {!peers.length && scanStatus === "foundBlocked" && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[10px] font-semibold leading-snug text-amber-300/90">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
            <span>{t("syncDiagBlocked")}</span>
          </div>
        )}
        {!peers.length && scanStatus === "none" && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[10px] font-semibold leading-snug text-white/40">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
            <span>{t("syncDiagNone")}</span>
          </div>
        )}
      </div>

      {/* подключённые устройства */}
      <div className="mt-2 space-y-1">
        {peers.map((peer) => {
          const Icon = peer.type === "pc" ? IconPc : peer.type === "mobile" ? IconPhone : IconSync;
          return (
            <div key={peer.deviceId} className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/[0.05]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] text-white/60">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-white/85">{peer.name}</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-white/35">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${peer.online ? "bg-emerald-400" : "bg-white/25"}`}
                  />
                  {peer.online ? t("syncConnected") : t("syncOffline")}
                </span>
              </span>
              <button
                onClick={() => onDisconnect(peer.deviceId)}
                className="hidden rounded p-1 text-white/30 transition-colors hover:text-red-400 group-hover:block"
                aria-label={t("syncDisconnect")}
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {!peers.length && <div className="px-2.5 py-1 text-[11px] leading-relaxed text-white/25">{t("syncHint")}</div>}
      </div>

      {/* подключение по IP — если скан не находит (роутер режет broadcast и т.п.) */}
      <div className="mt-2">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/30">{t("syncConnectByIp")}</div>
        <div className="flex gap-1.5">
          <input
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ipInput.trim()) void onConnectByIp(ipInput);
            }}
            placeholder={t("syncIpPlaceholder")}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white placeholder:text-white/25 outline-none focus:bg-white/[0.09]"
          />
          <button
            onClick={() => {
              if (ipInput.trim()) void onConnectByIp(ipInput);
            }}
            className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-white transition-transform hover:brightness-110 active:scale-95"
          >
            {t("syncConnect")}
          </button>
        </div>
        {connectError === "bad-ip" && <div className="mt-1 text-[10px] font-semibold text-red-300/90">{t("syncErrBadIp")}</div>}
        {connectError === "timeout" && (
          <div className="mt-1 text-[10px] font-semibold text-red-300/90">{t("syncErrTimeout")}</div>
        )}
        {connectError === "unreachable" && (
          <div className="mt-1 text-[10px] font-semibold text-red-300/90">{t("syncErrUnreachable")}</div>
        )}
      </div>

      {/* ПК: открыть порт в брандмауэре (UAC) */}
      {device.type === "pc" && (
        <button
          onClick={onOpenPort}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.07] py-1.5 text-[11px] font-bold text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
        >
          <IconSync className="h-3 w-3" />
          {t("syncOpenPort")}
        </button>
      )}

      <button
        onClick={onScanNow}
        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.07] py-1.5 text-[11px] font-bold text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
      >
        <IconRefresh className="h-3 w-3" />
        {scanning ? t("syncScanning") : t("syncScan")}
      </button>
    </div>
  );
}
