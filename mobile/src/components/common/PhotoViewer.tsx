import { useState } from 'react';
import { FlatList, Modal, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableFeedback } from './PressableFeedback';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { Photo } from './Photo';
import { useTheme } from '../../core/theme/theme-provider';

export interface ViewerPhoto {
  id: string;
  url: string;
}

interface PhotoViewerProps {
  photos: ViewerPhoto[];
  /** The photo to open on; null keeps the viewer closed. */
  startIndex: number | null;
  onClose: () => void;
  /** Screen-reader name for each photo: "<label> 3 of 12". */
  label?: string;
}

const CLOSE_SIZE = 40;

/** Full-screen photos on the plum backdrop, swiped one at a time, with "3 of 12" and a close button.
 *  The whole photo is shown (contain), never cropped. */
export function PhotoViewer({ photos, startIndex, onClose, label = 'Work photo' }: PhotoViewerProps) {
  return (
    <Modal visible={startIndex !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {startIndex !== null ? <ViewerPager photos={photos} startIndex={startIndex} onClose={onClose} label={label} /> : null}
    </Modal>
  );
}

/** The open viewer. Mounted per opening, so it starts on the tapped photo each time. */
function ViewerPager({ photos, startIndex, onClose, label }: { photos: ViewerPhoto[]; startIndex: number; onClose: () => void; label: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(startIndex);
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.photoScrim }}>
      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={startIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={settle}
        renderItem={({ item, index: i }) => (
          <Photo uri={item.url} fit="contain" label={`${label} ${i + 1} of ${photos.length}`} style={{ width, height, backgroundColor: theme.colors.photoScrim }} />
        )}
      />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + theme.spacing.sm, left: theme.spacing.md, right: theme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="label" accessibilityLiveRegion="polite" style={{ color: theme.colors.textOnBrand }}>{`${index + 1} of ${photos.length}`}</AppText>
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel="Close photos"
          onPress={onClose}
          style={{ width: CLOSE_SIZE, height: CLOSE_SIZE, borderRadius: CLOSE_SIZE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.overlay }}
        >
          <Icon name="close" size={20} color={theme.colors.textOnBrand} />
        </PressableFeedback>
      </View>
    </View>
  );
}
