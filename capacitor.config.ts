import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.joypayroll.app",
  appName: "Joy Payroll",
  webDir: "dist-supabase",
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0b1220",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#ffffff"
    }
  }
};

export default config;
