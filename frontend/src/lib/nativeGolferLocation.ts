import {
  Capacitor,
  registerPlugin,
} from "@capacitor/core";

interface TeerificLocationPlugin {
  start(options: {
    roundId: string;
    apiBase: string;
  }): Promise<void>;

  stop(): Promise<void>;
}

const NativeLocation =
  registerPlugin<TeerificLocationPlugin>(
    "TeerificLocation",
  );

export function isNativeGolferLocation(): boolean {
  return Capacitor.isNativePlatform();
}

export async function startNativeGolferLocation(
  roundId: string,
  apiBase: string,
): Promise<void> {
  await NativeLocation.start({
    roundId,
    apiBase,
  });
}

export async function stopNativeGolferLocation():
Promise<void> {
  await NativeLocation.stop();
}
