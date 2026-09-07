import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.alcode.cleanshelf',
  appName: 'CleanShelf',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0b0f18'
  },
  server: {
    androidScheme: 'https'
  }
}

export default config
