import { watch } from "node:fs";

import type { WatchPlan } from "./types.js";
import { stableStringify } from "./utils.js";

interface WatchCycle {
  plan: WatchPlan;
  summary: string;
}

interface WatchArgs {
  run: () => Promise<WatchCycle>;
  onError: (error: unknown) => void;
  getFallbackPlan?: () => Promise<WatchPlan>;
}

export async function runWatchMode(args: WatchArgs): Promise<void> {
  let closeCurrentWatchers = () => {};
  let pendingTimer: NodeJS.Timeout | undefined;
  let running = false;
  let rerunRequested = false;
  let lastRemoteFingerprint = "";
  let remoteFailureReported = false;
  let lastTriggerReason = "initial run";

  const applyPlan = (plan: WatchPlan, trigger: (reason: string) => void) => {
    closeCurrentWatchers();

    const closers: Array<() => void> = [];
    const watchedFiles = [...new Set(plan.localFiles)];

    for (const file of watchedFiles) {
      const watcher = watch(file, () => trigger(`local change detected in ${file}`));
      closers.push(() => watcher.close());
    }

    if (plan.remote) {
      const poll = async () => {
        try {
          const response = await fetch(plan.remote!.url, {
            headers: plan.remote!.headers,
          });

          if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
          }

          const fingerprint = stableStringify({
            status: response.status,
            body: await response.text(),
          });

          if (!lastRemoteFingerprint) {
            lastRemoteFingerprint = fingerprint;
          } else if (fingerprint !== lastRemoteFingerprint) {
            lastRemoteFingerprint = fingerprint;
            trigger(`remote change detected from ${plan.remote!.url}`);
          }

          remoteFailureReported = false;
          timeoutId = setTimeout(poll, plan.remote!.pollIntervalMs);
        } catch (error) {
          if (!remoteFailureReported) {
            args.onError(
              new Error(
                `Remote watch polling failed for ${plan.remote!.url}. Quill Type will retry automatically. ${error instanceof Error ? error.message : String(error)}`,
              ),
            );
            remoteFailureReported = true;
          }

          timeoutId = setTimeout(poll, plan.remote!.retryDelayMs);
        }
      };

      let timeoutId: NodeJS.Timeout | undefined = setTimeout(poll, plan.remote.pollIntervalMs);
      closers.push(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
    }

    closeCurrentWatchers = () => {
      for (const close of closers) {
        close();
      }
    };

    console.log(
      `Watch plan updated: ${watchedFiles.length} local file(s), ${
        plan.remote ? `remote polling every ${plan.remote.pollIntervalMs}ms` : "no remote polling"
      }.`,
    );
  };

  const trigger = (reason: string) => {
    lastTriggerReason = reason;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(async () => {
      if (running) {
        rerunRequested = true;
        return;
      }

      running = true;
      console.log(`Re-running Quill Type because ${lastTriggerReason}...`);

      try {
        const cycle = await args.run();
        console.log(cycle.summary);
        applyPlan(cycle.plan, trigger);
      } catch (error) {
        args.onError(error);
      } finally {
        running = false;

        if (rerunRequested) {
          rerunRequested = false;
          trigger("another change arrived while Quill Type was busy");
        }
      }
    }, 250);
  };

  try {
    const initialCycle = await args.run();
    console.log(initialCycle.summary);
    applyPlan(initialCycle.plan, trigger);
  } catch (error) {
    args.onError(error);

    if (!args.getFallbackPlan) {
      throw error;
    }

    const fallbackPlan = await args.getFallbackPlan();
    console.log("Watch started in retry mode. Quill Type will keep polling for the source.");
    applyPlan(fallbackPlan, trigger);
  }

  process.on("SIGINT", () => {
    closeCurrentWatchers();
    process.exit(0);
  });

  await new Promise(() => {
    // Keep the process alive until interrupted by the user.
  });
}
