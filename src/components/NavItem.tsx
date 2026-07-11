import { Icon } from "@iconify-icon/react";
import { clsx } from "clsx";

export function NavItem({ icon, label, active = false, disabled = false, onClick }: { icon: string; label: string; active?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button className={clsx("nav-item", active && "is-active")} disabled={disabled} onClick={onClick} title={disabled ? `${label} is not available yet` : undefined}>
      <Icon icon={icon} width={18} height={18} />
      {label}
    </button>
  );
}
