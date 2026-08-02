#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const profileArg = process.argv.find((arg) => arg.startsWith('--profile='));
const profile = profileArg?.split('=')[1]
  || process.env.EAS_BUILD_PROFILE
  || process.env.APP_ENV
  || 'development';
const dryRun = process.argv.includes('--dry-run');
const isProduction = profile === 'production';
const buildPlatform = process.env.EAS_BUILD_PLATFORM;

const TEST_IDS = {
  androidAppId: 'ca-app-pub-3940256099942544~3347511713',
  iosAppId: 'ca-app-pub-3940256099942544~1458002511',
  androidInterstitialId: 'ca-app-pub-3940256099942544/1033173712',
  iosInterstitialId: 'ca-app-pub-3940256099942544/4411468910',
};

const envNames = {
  androidAppId: 'ADMOB_ANDROID_APP_ID',
  iosAppId: 'ADMOB_IOS_APP_ID',
  androidInterstitialId: 'EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID',
  iosInterstitialId: 'EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID',
};

function validateId(name, value, separator) {
  const pattern = new RegExp(`^ca-app-pub-\\d{16}\\${separator}\\d{10}$`);
  if (!pattern.test(value)) {
    throw new Error(`${name} has an invalid AdMob ID: ${value}`);
  }
}

function resolveIds() {
  if (!isProduction) return TEST_IDS;

  const requiredKeys = buildPlatform === 'android'
    ? ['androidAppId', 'androidInterstitialId']
    : buildPlatform === 'ios'
      ? ['iosAppId', 'iosInterstitialId']
      : Object.keys(envNames);
  const missing = Object.entries(envNames)
    .filter(([key, envName]) => requiredKeys.includes(key) && !process.env[envName])
    .map(([, envName]) => envName);

  if (missing.length > 0) {
    throw new Error(
      `Production AdMob configuration is incomplete. Missing: ${missing.join(', ')}`,
    );
  }

  return Object.fromEntries(Object.entries(envNames).map(
    ([key, envName]) => [key, process.env[envName] || TEST_IDS[key]],
  ));
}

function replaceRequired(contents, pattern, replacement, filePath) {
  if (!pattern.test(contents)) {
    throw new Error(`Could not find the AdMob configuration in ${filePath}`);
  }
  return contents.replace(pattern, replacement);
}

function writeIfChanged(filePath, contents) {
  const current = fs.readFileSync(filePath, 'utf8');
  if (current === contents) return;
  if (!dryRun) fs.writeFileSync(filePath, contents);
}

function updateAppJson(ids) {
  const filePath = path.join(root, 'app.json');
  const appJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const plugin = appJson.expo.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === 'react-native-google-mobile-ads',
  );
  if (!plugin) throw new Error('react-native-google-mobile-ads plugin is missing from app.json');
  plugin[1].androidAppId = ids.androidAppId;
  plugin[1].iosAppId = ids.iosAppId;
  writeIfChanged(filePath, `${JSON.stringify(appJson, null, 2)}\n`);
}

function updateAndroidManifest(ids) {
  const filePath = path.join(root, 'android/app/src/main/AndroidManifest.xml');
  const current = fs.readFileSync(filePath, 'utf8');
  const updated = replaceRequired(
    current,
    /(<meta-data android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID" android:value=")[^"]+("[^>]*\/>)/,
    `$1${ids.androidAppId}$2`,
    filePath,
  );
  writeIfChanged(filePath, updated);
}

function updateIosPlist(ids) {
  const filePath = path.join(root, 'ios/PlanTalk/Info.plist');
  const current = fs.readFileSync(filePath, 'utf8');
  const updated = replaceRequired(
    current,
    /(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${ids.iosAppId}$2`,
    filePath,
  );
  writeIfChanged(filePath, updated);
}

try {
  const ids = resolveIds();
  validateId('ADMOB_ANDROID_APP_ID', ids.androidAppId, '~');
  validateId('ADMOB_IOS_APP_ID', ids.iosAppId, '~');
  validateId('EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID', ids.androidInterstitialId, '/');
  validateId('EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID', ids.iosInterstitialId, '/');

  updateAppJson(ids);
  updateAndroidManifest(ids);
  updateIosPlist(ids);

  console.log(`[configure-admob] ${profile} profile: ${isProduction ? 'production' : 'test'} IDs verified${dryRun ? ' (dry run)' : ''}.`);
} catch (error) {
  console.error(`[configure-admob] ${error.message}`);
  process.exit(1);
}
