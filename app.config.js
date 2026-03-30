export default ({ config }) => ({
  ...config,
  name: 'DineMatch',
  slug: 'dinematch',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',

  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#2a1505',
  },

  // ─── iOS ────────────────────────────────────────────────────────────────────
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.yourname.dinematch',
    buildNumber: '1',
    infoPlist: {
      // Location — required for proximity detection
      NSLocationWhenInUseUsageDescription:
        'DineMatch uses your location to find nearby restaurants and detect when you arrive for your dining date.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'DineMatch uses background location to detect when you arrive at the restaurant and unlock chat with your dining match.',
      NSLocationAlwaysUsageDescription:
        'DineMatch uses background location to unlock chat when you arrive at the restaurant.',
      // Camera + Photos — for profile setup
      NSCameraUsageDescription:
        'Take a photo for your DineMatch profile.',
      NSPhotoLibraryUsageDescription:
        'Choose a photo from your library for your DineMatch profile.',
    },
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY,
    },
  },

  // ─── Android ────────────────────────────────────────────────────────────────
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2a1505',
    },
    package: 'com.yourname.dinematch',
    versionCode: 1,
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',   // needed for 100m unlock while app is in background
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'RECEIVE_BOOT_COMPLETED',        // for scheduled notifications
      'VIBRATE',
    ],
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY,
      },
    },
    googleServicesFile: './google-services.json',   // download from Firebase console
  },

  // ─── Plugins ────────────────────────────────────────────────────────────────
  plugins: [
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'DineMatch uses your location to detect when you arrive at the restaurant and unlock chat.',
        locationAlwaysPermission:
          'DineMatch uses background location to unlock chat when you arrive.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose a profile photo for DineMatch.',
        cameraPermission: 'Take a profile photo for DineMatch.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#c85c28',
        sounds: ['./assets/sounds/match.wav'],
      },
    ],
    'expo-font',
  ],

  // ─── Extra env vars exposed to app ──────────────────────────────────────────
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});
