import { clsx } from "clsx";
import { useId, type CSSProperties, type ReactNode } from "react";

type SettingsSwitchProps = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  describedBy?: string;
};

export function SettingsSwitch({ checked, label, onChange, disabled, describedBy }: SettingsSwitchProps) {
  return (
    <label className={clsx("settings-switch", checked && "is-on", disabled && "is-disabled")}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span aria-hidden="true"><i /></span>
    </label>
  );
}

export type SettingsChoiceOption<T extends string> = {
  value: T;
  label: string;
  content?: ReactNode;
  style?: CSSProperties;
  className?: string;
  disabled?: boolean;
};

type SettingsChoiceGroupProps<T extends string> = {
  label: string;
  value: T;
  options: readonly SettingsChoiceOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  optionClassName?: string;
};

export function SettingsChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  optionClassName = "settings-choice-card",
}: SettingsChoiceGroupProps<T>) {
  const name = useId();
  return (
    <fieldset className="settings-choice-fieldset">
      <legend className="settings-visually-hidden">{label}</legend>
      <div className={className ?? "settings-choice-grid"}>
        {options.map((option) => (
          <label
            key={option.value}
            className={clsx(optionClassName, option.className, value === option.value && "is-active", option.disabled && "is-disabled")}
            style={option.style}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            {option.content ?? <strong>{option.label}</strong>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
