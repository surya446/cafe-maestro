import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cafemaestro.app",
  appName: "Cafe Maestro",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
