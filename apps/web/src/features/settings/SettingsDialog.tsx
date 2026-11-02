import type { KeysMode } from '../terminal/keysPreference';
import { KeysSection } from './KeysSection';
import { PasswordSection } from './PasswordSection';

interface Props {
  keysMode: KeysMode;
  touchScreen: boolean;
  onKeysChange(mode: KeysMode): void;
  onClose(): void;
}

export function SettingsDialog({ keysMode, touchScreen, onKeysChange, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>Settings</h2>
        <KeysSection mode={keysMode} touchScreen={touchScreen} onChange={onKeysChange} />
        <PasswordSection />
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
