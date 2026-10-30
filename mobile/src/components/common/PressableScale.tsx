import { PressableFeedback } from './PressableFeedback';
import type { PressableFeedbackProps } from './PressableFeedback';

/** A PressableFeedback with the Premium spring dip: 97% while held, settling back on release.
 *  Use it for cards, rows and tiles. Controls that style their own pressed look (AppButton) consume
 *  PressableFeedback directly with `scale`. */
export function PressableScale(props: Omit<PressableFeedbackProps, 'scale'>) {
  return <PressableFeedback {...props} scale />;
}
