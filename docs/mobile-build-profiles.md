# Mobile build profiles

PlanTalk selects its AdMob configuration from the EAS build profile.

| Profile | Purpose | AdMob configuration |
| --- | --- | --- |
| `development` | Local development client and debugging | Google test IDs |
| `preview` | Installable internal QA build | Google test IDs |
| `production` | TestFlight, App Store, and Google Play | Production IDs from the EAS `production` environment |

The `eas-build-post-install` hook synchronizes the selected native AdMob App ID into both Android and iOS before compilation. JavaScript ad unit IDs are embedded from the matching EAS environment. Production builds fail when a required ID for the selected platform is missing or malformed.

## Required production variables

Configure these variables in the EAS `production` environment:

- `ADMOB_ANDROID_APP_ID`
- `ADMOB_IOS_APP_ID`
- `EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID`
- `EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID`

AdMob identifiers are public identifiers embedded in the application binary. Use EAS `plaintext` or `sensitive` visibility so dynamic build configuration can read them.

## Commands

```bash
# Development builds
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform ios --profile development

# Preview builds
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview

# Store/TestFlight production builds
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production

# Build and automatically submit to the stores
npx eas-cli@latest build --platform android --profile production --auto-submit
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

Before a production build, validate the environment available in the current shell:

```bash
npm run ads:validate:production
```
