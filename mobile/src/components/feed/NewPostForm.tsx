import { useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { Chip } from '../common/Chip';
import { KeyboardAvoider } from '../common/KeyboardAvoider';
import { Photo } from '../common/Photo';
import { Segmented } from '../common/Segmented';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { pickImages, uploadImage, type PickedImage } from '../../api/artist-onboarding/upload';
import { useCreatePost } from '../../hooks/feed/feed';
import { firstIssue } from '../../utils/common/validation';
import { postDraftSchema } from '../../utils/feed/post-draft';
import type { PhotoInput, PostKind, PostTopic } from '../../types/feed/feed';
import { Icon } from '../common/Icon';

const MAX_PHOTOS = 10;
const TITLE_MAX = 140;
const CAPTION_MAX = 2200;
const BODY_MAX = 20000;
const TILE = 96;
const TOPICS: { key: PostTopic; label: string }[] = [
  { key: 'look', label: 'Look' },
  { key: 'guide', label: 'Guide' },
  { key: 'story', label: 'Story' },
];

/** Drops heading/quote shortcuts that were inserted but never filled in. */
const withoutEmptyMarkers = (t: string) => t.replace(/^(##|>)\s*$/gm, '').trim();

interface NewPostFormProps {
  /** The artist's approved services, for "Link a service". */
  services: { id: string; name: string }[];
  onCancel: () => void;
  onPosted: () => void;
}

/** Prototype New post: Photos or Article, the cover or photos, title and text (with heading and quote
 *  shortcuts), a topic, and an optional linked service ("Book this look"). Uploads, then publishes. */
export function NewPostForm({ services, onCancel, onPosted }: NewPostFormProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const create = useCreatePost();
  const [kind, setKind] = useState<PostKind>('photos');
  const [topic, setTopic] = useState<PostTopic>('look');
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false); // state lags a fast double tap on Post
  const uploaded = useRef(new Map<string, PhotoInput>()); // by local uri: a retry doesn't upload twice
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const article = kind === 'article';
  const busy = progress !== null || create.isPending;
  const missing = firstIssue(postDraftSchema, { kind, photoCount: photos.length, title, text });

  const switchKind = (next: PostKind) => {
    setKind(next);
    setTopic(next === 'article' ? 'guide' : 'look');
  };
  const addPhotos = async () => {
    try {
      const picked = await pickImages(article ? 1 : MAX_PHOTOS - photos.length);
      if (article) setCover(picked[0] ?? cover);
      else setPhotos((current) => [...current, ...picked].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const insert = (prefix: string) => setText((t) => `${t.trimEnd()}${t.trim() ? '\n\n' : ''}${prefix}`);

  const upload = async (image: PickedImage): Promise<PhotoInput> => {
    const done = uploaded.current.get(image.uri);
    if (done) return done;
    const result = await uploadImage(image, 'post');
    uploaded.current.set(image.uri, result);
    return result;
  };

  const publish = async () => {
    if (missing || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const images = article ? (cover ? [cover] : []) : photos;
      const inputs: PhotoInput[] = [];
      for (const [i, image] of images.entries()) {
        setProgress(`Uploading ${i + 1} of ${images.length}…`);
        inputs.push(await upload(image));
      }
      setProgress('Publishing…');
      await create.mutateAsync({
        kind,
        topic,
        title: article ? title.trim() : null,
        text: withoutEmptyMarkers(text),
        photos: article ? [] : inputs,
        cover: article ? inputs[0] ?? null : null,
        service_id: serviceId,
      });
      if (mounted.current) onPosted(); // they may have gone back while it was publishing
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      if (mounted.current) setProgress(null);
    }
  };

  return (
    <KeyboardAvoider style={{ backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingBottom: 10 }}>
        <PressableFeedback accessibilityRole="button" onPress={onCancel} disabled={busy} hitSlop={8}>
          <AppText variant="label" style={{ color: theme.colors.textSecondary }}>Cancel</AppText>
        </PressableFeedback>
        <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>New post</AppText>
        <PressableFeedback accessibilityRole="button" accessibilityState={{ disabled: !!missing || busy }} onPress={() => { void publish(); }} disabled={!!missing || busy} hitSlop={8}>
          <AppText variant="label" style={{ color: missing || busy ? theme.colors.textMuted : theme.colors.brand }}>Post</AppText>
        </PressableFeedback>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.md, gap: 14, paddingBottom: insets.bottom + theme.spacing.xl }}>
        <Segmented options={[{ key: 'photos', label: 'Photos' }, { key: 'article', label: 'Article' }]} value={kind} onChange={switchKind} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(article ? (cover ? [cover] : []) : photos).map((p, i) => (
            <PressableFeedback
              key={`${p.uri}:${i}`}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${i + 1}`}
              disabled={busy}
              onPress={() => (article ? setCover(null) : setPhotos((all) => all.filter((_, j) => j !== i)))}
            >
              <Photo uri={p.uri} style={{ width: article ? TILE * 2 : TILE, height: TILE, borderRadius: theme.radii.md }} />
              <View style={{ position: 'absolute', top: 4, right: 4 }}><Icon name="close" size={16} color={theme.colors.textOnBrand} /></View>
            </PressableFeedback>
          ))}
          {(article ? !cover : photos.length < MAX_PHOTOS) ? (
            <PressableFeedback
              accessibilityRole="button"
              accessibilityLabel={article ? 'Add a cover photo' : 'Add photos'}
              disabled={busy}
              onPress={() => { void addPhotos(); }}
              style={{ width: article ? TILE * 2 : TILE, height: TILE, borderRadius: theme.radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppText variant="caption" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>{article ? '+ Cover photo' : '+ Photos'}</AppText>
            </PressableFeedback>
          ) : null}
        </ScrollView>

        {article ? <AppTextField label="Title" placeholder="How to get the darkest bridal mehendi stain" value={title} onChangeText={setTitle} maxLength={TITLE_MAX} /> : null}
        <TextInput
          accessibilityLabel={article ? 'Article' : 'Caption'}
          placeholder={article ? 'Write your article…' : 'Write a caption…'}
          placeholderTextColor={theme.colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={article ? BODY_MAX : CAPTION_MAX}
          style={{ minHeight: article ? 200 : 100, textAlignVertical: 'top', borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground, padding: 14, color: theme.colors.textPrimary, fontFamily: theme.typography.body.fontFamily, fontSize: 15 }}
        />
        {article ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Heading" selected={false} onPress={() => insert('## ')} />
            <Chip label="Quote" selected={false} onPress={() => insert('> ')} />
          </View>
        ) : null}

        <AppText variant="label" style={{ color: theme.colors.textPrimary }}>Topic</AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {TOPICS.map((t) => <Chip key={t.key} label={t.label} selected={topic === t.key} onPress={() => setTopic(t.key)} />)}
        </View>

        {services.length ? (
          <>
            <AppText variant="label" style={{ color: theme.colors.textPrimary }}>Link a service</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip label="None" selected={serviceId === null} onPress={() => setServiceId(null)} />
              {services.map((s) => <Chip key={s.id} label={s.name} selected={serviceId === s.id} onPress={() => setServiceId(s.id)} />)}
            </View>
            <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Posts with a linked service show a “Book this look” button.</AppText>
          </>
        ) : null}

        {progress ? <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: theme.colors.textSecondary }}>{progress}</AppText> : null}
        {error ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{error}</AppText> : null}
        {!error && missing ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{missing}</AppText> : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}
