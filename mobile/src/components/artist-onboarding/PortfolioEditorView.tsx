import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { PhotoGrid } from '../common/PhotoGrid';
import { PortfolioPhotoTile } from './PortfolioPhotoTile';
import { PendingPhotoTile } from './PendingPhotoTile';
import { AddPhotoTile } from './AddPhotoTile';
import { PhotoActionsSheet } from './PhotoActionsSheet';
import { useTheme } from '../../core/theme/theme-provider';
import type { PortfolioEditor } from '../../hooks/artist-onboarding/portfolio-editor';
import type { PortfolioPhoto } from '../../types/artist-onboarding/artist-onboarding';

interface PortfolioEditorViewProps {
  photos: PortfolioPhoto[];
  editor: PortfolioEditor;
}

/** The portfolio grid shared by the onboarding step and Me → Portfolio: the first photo is the cover; tap a photo
 *  for Make cover / Remove; failed uploads stay on the grid with Retry. */
export function PortfolioEditorView({ photos, editor }: PortfolioEditorViewProps) {
  const theme = useTheme();
  const [open, setOpen] = useState<PortfolioPhoto | null>(null);

  // The sheet closes whether the write landed or not: a failure's message is on the page, which the sheet
  // would otherwise cover.
  const act = async (run: (id: string) => Promise<void>) => {
    if (!open) return;
    await run(open.id);
    setOpen(null);
  };

  return (
    <>
      <PhotoGrid>
        {photos.map((p, i) => <PortfolioPhotoTile key={p.id} photo={p} position={i + 1} cover={i === 0} onOpen={setOpen} />)}
        {editor.pending.map((item) => (
          <PendingPhotoTile key={item.localId} item={item} onRetry={(id) => { void editor.retry(id); }} onDiscard={editor.discard} />
        ))}
        {editor.canAdd ? <AddPhotoTile onPress={() => { void editor.add(); }} /> : null}
      </PhotoGrid>

      <View style={{ marginTop: theme.spacing.md, padding: theme.spacing[3.5], borderRadius: theme.radii.menu, backgroundColor: theme.colors.washTop }}>
        <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>
          <AppText variant="caption" style={{ color: theme.colors.brand, fontFamily: theme.typography.label.fontFamily }}>Tip: </AppText>
          Daylight photos of finished work get more bookings than studio shots. Tap a photo to make it your cover or remove it.
        </AppText>
      </View>
      {editor.error ? (
        <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{editor.error}</AppText>
      ) : null}

      {open ? (
        <PhotoActionsSheet
          key={open.id}
          photo={open}
          cover={photos[0]?.id === open.id}
          busy={editor.busy}
          onMakeCover={() => { void act(editor.makeCover); }}
          onRemove={() => { void act(editor.remove); }}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}
