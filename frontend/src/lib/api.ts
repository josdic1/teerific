import { Capacitor } from "@capacitor/core";

export const API_BASE =
  Capacitor.isNativePlatform()
    ? "https://trifficserver-production-2430.up.railway.app"
    : "";
