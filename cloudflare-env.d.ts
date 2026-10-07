declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    INFINITEPAY_HANDLE?: string;
    ADMIN_PASSWORD?: string;
  }
}
