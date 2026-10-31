import { z } from 'zod';

/** Mirrors backend app/shop/schemas.py OrderIn.address: 10 characters after trimming, at most 300. */
export const ORDER_ADDRESS_MIN = 10;
export const ORDER_ADDRESS_MAX = 300;

/** The delivery address as the checkout holds it. */
export interface CheckoutDraft {
  address: string;
}

/**
 * The delivery address, and the one hint the checkout shows while it is too short to ship to.
 *
 * The longer minimum is the order's own — a saved address can be shorter (profile → Saved addresses),
 * because that one is only a label for what they will type at checkout.
 */
export const checkoutDraftSchema = z.object({
  address: z
    .string()
    .trim()
    .min(ORDER_ADDRESS_MIN, 'Add the full address, including the PIN')
    .max(ORDER_ADDRESS_MAX),
});
