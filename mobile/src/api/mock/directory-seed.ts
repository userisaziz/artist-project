// Six approved artists for the mock directory (spec §5), each a sign-in-able account so artist screens can be
// tried with real data. Priya (+15550009999) is the long-standing demo artist. Photos are fixed-seed placeholders.

export interface SeedService { category: string; subcategory: string; name: string; rupees: number; minutes: number; description: string }
export interface SeedArtist {
  phone: string;
  first_name: string;
  business_name: string;
  city: string;
  categories: string[];
  bio: string;
  slug: string;
  services: SeedService[];
}

export const PRIYA_PHONE = '+15550009999';

export const SEED_ARTISTS: SeedArtist[] = [
  {
    phone: PRIYA_PHONE, first_name: 'Priya', business_name: 'Priya Bridal Studio', city: 'Bangalore', slug: 'priya',
    categories: ['Mehendi', 'Makeup'],
    bio: 'Bridal mehendi and makeup from one studio, for brides who want a single, calm morning.',
    services: [
      { category: 'Mehendi', subcategory: 'Bridal', name: 'Bridal Classic', rupees: 4_500, minutes: 180, description: 'Full hands to the wrist, with a traditional bridal motif.' },
      { category: 'Mehendi', subcategory: 'Arabic', name: 'Arabic Hands', rupees: 1_500, minutes: 60, description: 'Flowing Arabic trails on both hands.' },
      { category: 'Makeup', subcategory: 'Bridal', name: 'HD Bridal Makeup', rupees: 18_000, minutes: 180, description: 'HD base, lashes and draping for the ceremony.' },
    ],
  },
  {
    phone: '+919900000002', first_name: 'Ayesha', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', slug: 'ayesha',
    categories: ['Mehendi'],
    bio: 'Twelve years of fine-line bridal mehendi. Organic henna, mixed fresh every morning.',
    services: [
      { category: 'Mehendi', subcategory: 'Bridal', name: 'Bridal Full Arms', rupees: 6_500, minutes: 240, description: 'Fingertips to elbows, with your story worked into the design.' },
      { category: 'Mehendi', subcategory: 'Arabic', name: 'Arabic Party', rupees: 2_500, minutes: 90, description: 'Bold Arabic patterns for sangeet and parties.' },
      { category: 'Mehendi', subcategory: 'Arabic', name: 'Arabic Feet', rupees: 1_200, minutes: 60, description: 'Matching Arabic designs for both feet.' },
    ],
  },
  {
    phone: '+919900000003', first_name: 'Kavya', business_name: 'Glow by Kavya', city: 'Bangalore', slug: 'kavya',
    categories: ['Makeup'],
    bio: 'Soft, skin-first makeup that photographs beautifully and lasts all night.',
    services: [
      { category: 'Makeup', subcategory: 'Bridal', name: 'Airbrush Bridal', rupees: 28_000, minutes: 180, description: 'Airbrush base, trial included, touch-up kit to take home.' },
      { category: 'Makeup', subcategory: 'Party', name: 'Party Makeup', rupees: 4_000, minutes: 90, description: 'Evening glam with lashes.' },
      { category: 'Makeup', subcategory: 'Party', name: 'Engagement Look', rupees: 9_500, minutes: 120, description: 'Hair styling and makeup for the ring ceremony.' },
    ],
  },
  {
    phone: '+919900000004', first_name: 'Zara', business_name: 'Henna House by Zara', city: 'Bangalore', slug: 'zara',
    categories: ['Mehendi'],
    bio: 'Contemporary henna with minimal, modern patterns.',
    services: [
      { category: 'Mehendi', subcategory: 'Bridal', name: 'Bridal Classic', rupees: 5_000, minutes: 180, description: 'Classic bridal hands with a modern twist.' },
      { category: 'Mehendi', subcategory: 'Arabic', name: 'Arabic Hands', rupees: 1_800, minutes: 60, description: 'Light Arabic vines for both hands.' },
    ],
  },
  {
    phone: '+919900000005', first_name: 'Meher', business_name: 'Studio Meher', city: 'Mumbai', slug: 'meher',
    categories: ['Makeup', 'Mehendi'],
    bio: 'A Bandra studio for bridal makeup and mehendi, at your venue.',
    services: [
      { category: 'Makeup', subcategory: 'Bridal', name: 'HD Bridal Makeup', rupees: 22_000, minutes: 180, description: 'HD makeup with hair styling and draping.' },
      { category: 'Mehendi', subcategory: 'Bridal', name: 'Bridal Classic', rupees: 5_500, minutes: 180, description: 'Traditional bridal mehendi.' },
    ],
  },
  {
    phone: '+919900000006', first_name: 'Rhea', business_name: 'Rhea Makeovers', city: 'Bangalore', slug: 'rhea',
    categories: ['Makeup'],
    bio: 'Party and engagement looks, done at home.',
    services: [
      { category: 'Makeup', subcategory: 'Party', name: 'Party Makeup', rupees: 3_500, minutes: 90, description: 'Quick, polished party makeup.' },
      { category: 'Makeup', subcategory: 'Party', name: 'Engagement Look', rupees: 8_000, minutes: 120, description: 'Makeup and a soft hairdo.' },
    ],
  },
];

/** Customers who own the seeded bookings. */
export const SEED_CUSTOMERS = [
  { phone: '+919800000001', first_name: 'Meera', last_name: 'Iyer' },
  { phone: '+919800000002', first_name: 'Sneha', last_name: 'Kapoor' },
];

export const PORTFOLIO_SIZE = 6;
export const seedPhotoUrl = (slug: string, n: number) => `https://picsum.photos/seed/atelier-${slug}-${n}/600/800`;
export const seedAvatarUrl = (slug: string) => `https://picsum.photos/seed/atelier-${slug}-avatar/200/200`;
