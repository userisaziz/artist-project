import { z } from 'zod';
import type { AddressInput } from '../../types/addresses/addresses';

/** Mirrors backend app/user/schemas.py AddressIn (sorted after trimming). */
export const ADDRESS_LABEL_MAX = 40;
export const SAVED_ADDRESS_MIN = 5;
export const SAVED_ADDRESS_MAX = 300;

/** A new saved address as the profile form holds it. */
export interface SavedAddressDraft {
  label: string;
  address: string;
}

/** A saved address once its label and text have been trimmed into what the API wants. */
export const savedAddressDraftSchema = z
  .object({
    label: z.string().trim().min(1, 'Add a label'),
    address: z.string().trim().min(SAVED_ADDRESS_MIN, 'Add the full address, including the PIN'),
  })
  .transform((draft): AddressInput => ({ label: draft.label, address: draft.address }));
