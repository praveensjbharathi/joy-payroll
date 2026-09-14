# Joy Payroll mobile app foundation

This branch adds the shared Android/iOS foundation for Joy Payroll. The existing React/Supabase frontend remains the app surface for both platforms, so payroll calculations, authentication, backend access, and role permissions continue to use the existing project paths.

## Mobile configuration

- App name: Joy Payroll
- App ID: `com.joypayroll.app`
- Web build output: `dist-supabase`
- Capacitor config: `capacitor.config.ts`
- Native folders: `android/` and `ios/` are generated locally by Capacitor

The existing root `app/` directory contains an older placeholder Compose scaffold. It is intentionally unchanged; the Capacitor Android and iOS projects are separate.

## Prerequisites

- Node.js `>=22.13.0`
- Android Studio and an Android SDK for Android builds
- macOS and Xcode for iOS builds
- A configured Joy Payroll backend environment for signed-in testing

## First-time setup

Clone this branch and install dependencies:

```bash
git clone --branch mobile/capacitor-foundation https://github.com/praveensjbharathi/joy-payroll.git
cd joy-payroll
npm install
```

Generate the native platform projects and sync the web build:

```bash
npm run build:supabase
npx cap add android
npx cap sync android
```

On macOS with Xcode installed, also add iOS:

```bash
npx cap add ios
npx cap sync ios
```

## Open the apps

Android:

```bash
npm run mobile:android
```

This builds the Supabase frontend, syncs Capacitor, and opens the project in Android Studio.

iOS (macOS only):

```bash
npm run mobile:ios
```

This builds the Supabase frontend, syncs Capacitor, and opens the project in Xcode. Open `ios/App/App.xcworkspace` if Xcode does not open it automatically.

After changing the web app, run:

```bash
npm run mobile:sync
```

Then rerun the app from Android Studio or Xcode.

## Backend and access

The mobile shell does not duplicate backend credentials. Authentication, payroll data, and existing access control stay in the current Supabase/Cloudflare configuration. Device testing must reach the backend over HTTPS; localhost URLs need emulator/device-specific networking and should not be hardcoded into production builds.

Before release, verify mobile session persistence and secure logout for the existing access roles, including Field HR, Payroll HR, HR Manager, and Super Admin if those roles are enabled in the deployed backend.

## Publishing

Google Play Console and Apple Developer access are not required for local development, Android Studio testing, iOS Simulator testing, or direct device testing with the appropriate local setup. They are required later for store distribution, signing, and production release.

## Recommended next milestones

1. Validate login, session persistence, logout, and role-based navigation on Android and iOS.
2. Add mobile-first navigation and dashboards while reusing the current payroll APIs and access-control rules.
3. Add device-safe handling for notifications, biometric unlock, and offline/error states.
4. Configure app icons, splash assets, signing identities, release builds, and store metadata.
