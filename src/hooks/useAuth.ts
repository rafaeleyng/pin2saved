import { useState, useEffect } from "react";
import { client } from "../lib/oauth";
import type { OAuthSession } from "@atproto/oauth-client-browser";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<OAuthSession | null>(null);

  const isAuthenticated = !!session;

  useEffect(() => {
    const initAuth = async () => {
      try {
        // we might have a session?
        if (window.location.pathname === "/oauth/callback") {
          setIsLoading(true);
        }

        // Initialize the client first - this handles OAuth callbacks
        const result = await client.init();
        setSession(result?.session || null);

        // If we're on the callback URL and have a session, redirect to home
        if (result?.session && window.location.pathname === "/oauth/callback") {
          window.history.replaceState({}, "", "/");
        }
      } catch (error) {
        console.error(error);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const signOut = async () => {
    try {
      // Get current session and sign out
      const result = await client.init();
      if (result?.session) {
        await result.session.signOut();
      }
      setSession(null);
    } catch (error) {
      console.error("Sign out failed:", error);
      setSession(null);
    }
  };

  return {
    isAuthenticated,
    isLoading,
    session,
    signOut,
  };
}
