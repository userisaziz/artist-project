import { useState } from 'react';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { BottomSheet } from '../components/BottomSheet';
import { useTheme } from '../theme/theme-provider';
import { errorMessage } from '../api/error-message';

interface TextSheetProps {
  title: string;
  label: string;
  submitLabel: string;
  maxLength: number;
  /** Starting text (editing a reply). Mount the sheet with a `key` per target so this is read fresh. */
  initial?: string;
  note?: string;
  /** Blank text is allowed only when `allowEmpty` (clearing a reply). */
  allowEmpty?: boolean;
  onClose: () => void;
  onSubmit: (text: string) => Promise<void>;
}

/** One text box in a bottom sheet: the artist's Reply and Report sheets. Closes itself on success. */
export function TextSheet({ title, label, submitLabel, maxLength, initial = '', note, allowEmpty = false, onClose, onSubmit }: TextSheetProps) {
  const theme = useTheme();
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blank = !text.trim();

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(text.trim());
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible
      title={title}
      onClose={onClose}
      footer={<AppButton label={submitLabel} loading={saving} disabled={blank && !allowEmpty} onPress={() => { void submit(); }} />}
    >
      {note ? <AppText variant="caption" style={{ color: theme.colors.textSecondary, lineHeight: 19 }}>{note}</AppText> : null}
      <AppTextField label={label} value={text} onChangeText={setText} maxLength={maxLength} multiline style={{ height: 110, paddingTop: 12, textAlignVertical: 'top' }} />
      {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
    </BottomSheet>
  );
}
