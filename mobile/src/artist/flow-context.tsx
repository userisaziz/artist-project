import { createContext, useContext } from 'react';

/** "Edit and resubmit" flips `editing`, which moves a rejected artist from In review back into onboarding. */
export interface ArtistFlow { editing: boolean; startEditing: () => void }

export const ArtistFlowContext = createContext<ArtistFlow>({ editing: false, startEditing: () => {} });

export function useArtistFlow(): ArtistFlow {
  return useContext(ArtistFlowContext);
}
