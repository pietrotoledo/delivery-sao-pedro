declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    INFINITEPAY_HANDLE?: string;
    ADMIN_PASSWORD?: string;
    EVOLUTION_API_URL?: string;
    EVOLUTION_API_KEY?: string;
    EVOLUTION_INSTANCE?: string;
  }
}
