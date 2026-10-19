// Mirrors backend app/feed/schemas.py.
export type PostKind = 'photos' | 'article';
export type PostTopic = 'look' | 'guide' | 'story';
export type FeedTab = 'for_you' | 'following' | 'stories';

export interface PostPhoto {
  url: string;
  width: number;
  height: number;
}

export interface Post {
  id: string;
  kind: PostKind;
  topic: PostTopic;
  title: string | null;
  text: string | null; // a photo set's caption
  excerpt: string | null; // an article's opening paragraph
  body: string | null; // the full article: on the post screen and the artist's own posts
  read_minutes: number | null;
  cover_url: string | null;
  photos: PostPhoto[];
  artist: { id: string; business_name: string; photo_url: string | null; city: string; rating_average: number | null; rating_count: number };
  service: { id: string; name: string; price_paise: number } | null;
  like_count: number;
  liked: boolean;
  following: boolean;
  featured: boolean;
  moderation: 'live' | 'hidden' | 'removed'; // always live in the customer feed; artists see takedowns
  created_at: string;
}

export type ReportReason = 'spam' | 'inappropriate' | 'contact_details' | 'other';

export interface PhotoInput {
  key: string;
  width: number;
  height: number;
}

export interface PostInput {
  kind: PostKind;
  topic?: PostTopic;
  title?: string | null;
  text: string;
  photos?: PhotoInput[];
  cover?: PhotoInput | null;
  service_id?: string | null;
}
