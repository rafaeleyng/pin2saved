import { useState } from "react";
import { client } from "../lib/oauth";

export default function LoginPage() {
  const [handle, setHandle] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleBlueskyLogin = async () => {
    setIsLoading(true);
    try {
      await client.signIn("https://bsky.social");
    } catch (error) {
      console.error("Bluesky login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;

    setIsLoading(true);
    try {
      await client.signIn(
        handle.includes(".") ? handle.trim() : `${handle.trim()}.bsky.social`,
      );
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-medium text-gray-900">pin2saved</h2>
          <p className="text-gray-500 mt-2">
            Migrate your 📌 replies in <a href="https://bsky.app">Bluesky</a> to
            saved posts.
          </p>
        </div>

        <div className="space-y-6">
          <button
            onClick={handleBlueskyLogin}
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign in with Bluesky"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">Or</span>
            </div>
          </div>

          <form onSubmit={handleCustomLogin} className="space-y-4">
            <div>
              <label
                htmlFor="handle"
                className="block text-sm font-medium text-gray-700"
              >
                Your handle
              </label>
              <input
                id="handle"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="alice.bsky.social"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !handle.trim()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
