import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/** Whether the software keyboard is up (so screens can drop the bottom safe-area inset while it covers it). */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);
  return visible;
}
