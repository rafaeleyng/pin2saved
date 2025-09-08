import { Agent } from "@atproto/api";
import type { OAuthSession } from "@atproto/oauth-client-browser";
import { useState } from "react";
import {
  createBookmarks,
  deletePushpinReplies,
  findPushpinReplies,
} from "../lib/migrate";

interface MigratePinsProps {
  session: OAuthSession;
}

type StatusUpdate = {
  status: "idle" | "working" | "success" | "error";
  message: string;
};

export default function MigratePins({ session }: MigratePinsProps) {
  const [keepOrDelete, setKeepOrDelete] = useState<"keep" | "delete">("keep");
  const [statusUpdate, setStatusUpdate] = useState<StatusUpdate>({
    status: "idle",
    message: "",
  });

  async function migrate() {
    try {
      const agent = new Agent(session);
      const progressUpdate = (msg: string) => {
        setStatusUpdate({
          status: "working",
          message: msg,
        });
      };

      const pushpinReplies = await findPushpinReplies(
        agent,
        agent.assertDid,
        progressUpdate,
      );
      await createBookmarks(agent, pushpinReplies, progressUpdate);
      if (keepOrDelete === "delete") {
        await deletePushpinReplies(agent, pushpinReplies, progressUpdate);
      }

      setStatusUpdate({
        status: "success",
        message: "Done!",
      });
    } catch (error) {
      setStatusUpdate({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-medium">Migrate your 📌 pins</h2>
        <p className="text-gray-600 mt-3">
          Note: you can choose between keeping or deleting your 📌 replies as
          you migrate to saved posts. You can start with the "Keep" option,
          check the result in Bluesky, and then decide to run again with the
          "Delete" option if would like to cleanup (the saved posts won't be
          duplicated if you run multiple times).
        </p>
      </div>

      {statusUpdate?.status === "idle" ? (
        <>
          <div className="flex flex-col gap-1">
            <label className="flex gap-2 items-center">
              <input
                type="radio"
                name="keepOrDelete"
                checked={keepOrDelete === "keep"}
                onChange={() => setKeepOrDelete("keep")}
              />
              Keep your 📌 replies when migrating to saved posts.
            </label>
            <label className="flex gap-2 items-center">
              <input
                type="radio"
                name="keepOrDelete"
                value={"delete"}
                checked={keepOrDelete === "delete"}
                onChange={() => setKeepOrDelete("delete")}
              />
              Delete your 📌 replies when migrating to saved posts.
            </label>
          </div>

          <button
            onClick={migrate}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 mx-auto"
          >
            Begin migration
          </button>
        </>
      ) : (
        <>
          <h3 className="text-center text-gray-800 text-lg font-medium mt-8">
            Migration in progress...
          </h3>
          <p className="text-center text-gray-600">
            {statusUpdate?.message || "Please wait..."}
            {statusUpdate?.status === "success" && (
              <>
                {" "}
                <a
                  target="_blank"
                  href="https://bsky.app/saved"
                  className="text-blue-500 hover:text-blue-600 hover:underline"
                >
                  View your saved posts
                </a>
              </>
            )}
          </p>

          {statusUpdate?.status === "success" && (
            <button
              onClick={() => setStatusUpdate({ status: "idle", message: "" })}
              className="mx-auto text-gray-400 hover:underline"
            >
              Go back
            </button>
          )}
        </>
      )}
    </div>
  );
}
