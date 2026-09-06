import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";
import { useLanguageStore } from "../languageStore";
import { phrase } from "../shell/phrase";

export function NavItem({ icon, label, active = false, disabled = false, onClick }: { icon: string; label: string; active?: boolean; disabled?: boolean; onClick?: () => void }) {
  const t = useLanguageStore((state) => state.t);
  return (
    <button className={clsx("nav-item", active && "is-active")} disabled={disabled} onClick={onClick} title={disabled ? phrase(t, "navNotAvailablePrefix", label, "navNotAvailableSuffix") : undefined}>
      <Icon icon={icon} width={18} height={18} />
      {label}
    </button>
  );
}
