import type { ArtistProfile } from '../api/types';

/** Which artist area to show. Drives both the artist layout guards and the `/artist` hub. */
export type ArtistStage = 'onboarding' | 'review' | 'live';
export type ResumeStep = 'intro' | 'services' | 'portfolio';

export function artistStage(profile: ArtistProfile | null, editing: boolean): ArtistStage {
  if (!profile || profile.status === 'draft') return 'onboarding';
  if (profile.status === 'approved') return 'live';
  if (profile.status === 'rejected' && editing) return 'onboarding';
  return 'review'; // pending, or rejected until they press "Edit and resubmit"
}

/** Spec §4: each Continue saves, so a returning artist resumes at the first step the server has no data for. */
export function resumeStep(profile: ArtistProfile | null): ResumeStep {
  if (!profile) return 'intro'; // the Profile step creates the row, so a saved row always has profile details
  if (!profile.services.length) return 'services';
  return 'portfolio';
}

export function artistHref(profile: ArtistProfile | null, editing: boolean): string {
  switch (artistStage(profile, editing)) {
    case 'live':
      return '/artist/home';
    case 'review':
      return '/artist/in-review';
    case 'onboarding':
      return `/artist/onboarding/${editing ? 'profile' : resumeStep(profile)}`;
  }
}
