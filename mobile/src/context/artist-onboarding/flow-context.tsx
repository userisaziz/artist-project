import { createContext, useContext } from 'react';

/**
 * `editing` starts the onboarding steps at Profile: "Edit and resubmit" on a rejection (moving the artist from In review
 * back into onboarding), or Me → Edit profile on an approved profile (which the server turns back into a draft).
 */
export interface ArtistFlow { editing: boolean; startEditing: () => void }

export const ArtistFlowContext = createContext<ArtistFlow>({ editing: false, startEditing: () => {} });

export function useArtistFlow(): ArtistFlow {
  return useContext(ArtistFlowContext);
}
