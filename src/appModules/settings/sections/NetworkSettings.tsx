import type { TranslationKey } from "../../../languageStore";
import { formatConnectionType, formatEffectiveType, type NetworkSnapshot } from "../../../system/networkInfo";

type Props = {
  t: (key: TranslationKey) => string;
  network: NetworkSnapshot | null;
  networkBusy: boolean;
  networkError: boolean;
  refreshNetwork: () => void;
  dash: (value: string | number | null | undefined, empty?: string) => string;
};

export function NetworkSettings({ t, network, networkBusy, networkError, refreshNetwork, dash }: Props) {
  return <div className="settings-stack">
    <header className="settings-pane-head"><h2 id="settings-heading-network">{t("settingsNavNetwork")}</h2><button type="button" className="settings-btn-pill" disabled={networkBusy} onClick={refreshNetwork}>{networkBusy ? t("settingsNetworkRefreshing") : network ? t("settingsNetworkRefresh") : t("settingsNetworkRunDiagnostics")}</button></header>
    <p className="settings-inline-hint">{t("settingsNetworkDiagnosticsPrivacy")}</p>
    <div aria-live="polite">{networkBusy ? <p className="settings-inline-hint">{t("settingsNetworkRefreshing")}</p> : null}{networkError ? <p className="settings-inline-hint settings-error-text">{t("settingsNetworkDiagnosticsFailed")}</p> : null}{!network && !networkBusy && !networkError ? <p className="settings-inline-hint">{t("settingsNetworkDiagnosticsIdle")}</p> : null}</div>
    {network ? <dl className="settings-kv settings-kv-plain">{([[t("settingsNetworkStatus"), network.online ? t("settingsNetworkOnline") : t("settingsNetworkOffline")], [t("settingsNetworkType"), formatConnectionType(network.connectionType)], [t("settingsNetworkPublicIp"), dash(network.publicIp)], [t("settingsNetworkPublicIpSource"), dash(network.publicIpSource)], [t("settingsNetworkMeasuredRtt"), network.measuredRttMs != null ? `${network.measuredRttMs} ms` : "—"], [t("settingsNetworkLanIp"), network.lanIps.length ? network.lanIps.join(", ") : "—"], [t("settingsNetworkLocalIp"), network.localIps.length ? network.localIps.join(", ") : network.mdnsHosts.length ? network.mdnsHosts.join(", ") : "—"], [t("settingsNetworkEffective"), formatEffectiveType(network.effectiveType)], [t("settingsNetworkDownlink"), network.downlinkMbps != null ? `${network.downlinkMbps} Mbps` : "—"], [t("settingsNetworkRtt"), network.rttMs != null ? `${network.rttMs} ms` : "—"], [t("settingsNetworkSaveData"), network.saveData ? t("yes") : t("no")], [t("settingsNetworkPageHost"), dash(network.pageHost)], [t("settingsNetworkPageProtocol"), dash(network.pageProtocol)]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd title={value}>{value}</dd></div>)}</dl> : null}
  </div>;
}
