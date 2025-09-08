import { BrowserOAuthClient } from "@atproto/oauth-client-browser";

export const client = new BrowserOAuthClient({
  handleResolver: "https://bsky.social",
  clientMetadata: {
    client_id: import.meta.env.PROD
      ? `https://bsky-prefs.vercel.app/oauth-client-metadata.json`
      : `http://localhost?redirect_uri=${encodeURIComponent(`http://127.0.0.1:3000/oauth/callback`)}&scope=${encodeURIComponent("atproto transition:generic")}`,
    redirect_uris: [
      import.meta.env.PROD
        ? `https://bsky-prefs.vercel.app/oauth/callback`
        : `http://127.0.0.1:3000/oauth/callback`,
    ],
    client_name: "Bluesky preferences helper",
    client_uri: "https://bsky-prefs.vercel.app",
    scope: "atproto transition:generic",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    application_type: "web",
    dpop_bound_access_tokens: true,
  },
});
