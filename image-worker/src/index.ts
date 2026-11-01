// Serves WebP variants of the public image bucket, derived on demand from the stored originals.
//
// The app uploaded a 1024x1024 / 244 KB JPEG and the mobile client decoded all of it to paint a 44 px
// avatar. This worker sits in front of the public R2 bucket, resizes the original to the size the
// screen actually shows, re-encodes it as WebP, and lets the edge keep the result for a year. The
// originals are never rewritten: a variant costs nothing until someone asks for it, and the bucket
// keeps exactly the bytes the app uploaded.
//
// Only the public bucket is bound. Identity documents live in a separate private bucket that this
// worker cannot see, so a signed-link URL is not routable here.
//
// Deploy: npx -y wrangler deploy   (login once first: npx -y wrangler login)

// The Cloudflare Images binding, declared locally so the repo needs no @cloudflare/workers-types install.
interface Env {
  IMAGES: ImagesBinding | undefined;
  IMAGES_BUCKET: R2Bucket;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface R2ObjectBody {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: { contentType?: string; cacheControl?: string };
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
}

interface TransformOptions {
  width?: number;
  height?: number;
  fit?: 'scale' | 'crop' | 'fit' | 'fill' | 'contain' | 'cover';
  gravity?: string;
  rotate?: number;
  flip?: string;
  background?: string;
  metadata?: 'none' | 'copyright' | 'location' | 'exif';
}

interface OutputOptions {
  format?: 'image/avif' | 'image/webp' | 'image/jpeg' | 'image/png';
  quality?: number;
}

interface ImageResult {
  // The binding exposes these as methods, not as plain properties.
  response(): Response;
  contentType(): string;
}

interface ImageTransformer {
  transform(options: TransformOptions): ImageTransformer;
  output(options: OutputOptions): Promise<ImageResult>;
}

interface ImagesBinding {
  input(input: ReadableStream): ImageTransformer;
}

// The Workers runtime's own cache. The DOM lib's CacheStorage has no `default`, so it is declared here.
interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

type Variant = 'thumb' | 'card' | 'full';

// The same three sizes the app asks Cloudinary for (app/upload/service.py), so the two hosts agree on
// what a thumbnail looks like. `cover` crops to fill the box the way Cloudinary's c_fill does; `full`
// keeps the whole picture and only caps the width.
const VARIANTS: Record<Variant, TransformOptions> = {
  thumb: { width: 240, height: 240, fit: 'cover', gravity: 'center' },
  card: { width: 720, height: 900, fit: 'cover', gravity: 'center' },
  full: { width: 1600, fit: 'contain' },
};

const WEBP_QUALITY = 80;

// The bytes behind a key never change and the transform is a constant of this worker, so the result
// can be kept forever: a year, then revalidated.
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

// Bumped whenever the transform changes. The edge cache is keyed by URL, so a variant made by an
// older build would otherwise keep being served after a new deploy.
const CACHE_VERSION = 'v2';

const VARIANTS_LIST = Object.keys(VARIANTS).join(', ');

function problem(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** The R2 key from the path, or null when the path is not a variant plus a key. */
function parsePath(pathname: string): { variant: Variant; key: string } | null {
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments.length < 2) {
    return null;
  }
  const [variant, ...rest] = segments;
  if (!(variant in VARIANTS)) {
    return null;
  }
  const key = rest.join('/');
  if (!key || key.split('/').some((part) => part === '.' || part === '..')) {
    return null;
  }
  return { variant: variant as Variant, key };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    const url = new URL(request.url);
    const parsed = parsePath(url.pathname);
    if (!parsed) {
      return problem(404, `expected /{variant}/{key}, where variant is one of: ${VARIANTS_LIST}`);
    }
    const { variant, key } = parsed;

    // The edge copy of the finished variant. Keyed by the request URL plus the cache version, so the
    // same variant of the same key is served from the edge after the first time, and a new build
    // does not keep serving the variants of the old one.
    const cache = (caches as unknown as { default: EdgeCache }).default;
    const cacheKey = new Request(`${url.origin}${url.pathname}?c=${CACHE_VERSION}`, { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    const object = await env.IMAGES_BUCKET.get(key);
    if (!object) {
      return problem(404, 'not found');
    }

    // Without the Images binding the worker does nothing but pass the original through: a plain
    // avatar service is still better than a broken one.
    if (!env.IMAGES) {
      const response = new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
          'Cache-Control': CACHE_CONTROL,
          ETag: `"${object.httpEtag}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    const transformed = await env.IMAGES.input(object.body)
      .transform(VARIANTS[variant])
      .output({ format: 'image/webp', quality: WEBP_QUALITY });

    // The binding hands back its result through methods: `response()` is the transformed image and
    // `contentType()` its type. Reading them as plain properties yields the unbound functions, which
    // look like an empty 200 to the client.
    const transformedResponse = transformed.response();
    const bytes = await transformedResponse.arrayBuffer();

    // A transform that did not run must never reach the client as an empty 200. The original is
    // served instead: the same picture, just not resized.
    if (!transformedResponse.ok || bytes.byteLength === 0) {
      console.warn(
        `image transform failed: status=${transformedResponse.status} bytes=${bytes.byteLength}`,
      );
      const original = await env.IMAGES_BUCKET.get(key);
      if (!original) {
        return problem(404, 'not found');
      }
      const fallback = new Response(original.body, {
        headers: {
          'Content-Type': original.httpMetadata?.contentType || 'image/jpeg',
          'Cache-Control': CACHE_CONTROL,
          ETag: `"${original.httpEtag}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
      ctx.waitUntil(cache.put(cacheKey, fallback.clone()));
      return fallback;
    }

    const response = new Response(bytes, {
      headers: {
        'Content-Type': transformed.contentType(),
        'Cache-Control': CACHE_CONTROL,
        // The bytes are a pure function of the key and the variant, so the source object and the
        // variant name identify them exactly.
        ETag: `W/"${variant}-${object.httpEtag}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
