# ZamboAlert — Citizen App

React Native (Expo) mobile app for citizens using the ZamboAlert emergency communication system in Zamboanga City. Works offline using Bluetooth Low Energy (BLE) beaconing to signal nearby rescuer pods even without cellular signal.

## Tech Stack
- **Framework:** React Native + Expo SDK 54
- **Navigation:** React Navigation (Stack + Bottom Tabs)
- **Font:** Inter (via @expo-google-fonts)
- **Icons:** @expo/vector-icons (Ionicons)

## Screens
| Screen | Description |
|---|---|
| Welcome | App landing page with Sign in / Create account |
| Login | Role-based login (Citizen / Rescuer) |
| Sign Up | Account registration with role selection |
| SOS | One-tap disaster emergency buttons (Earthquake, Flash Flood, Landslide, Fire) |
| Status | BLE beacon status and nearby rescuer pod detection |
| Log | Timestamped history of SOS events |
| Settings | Emergency profile, permissions, logout |

## Getting Started

```bash
# Install dependencies
npm install

# Install correct babel preset for Expo SDK 54
npm install --save-dev babel-preset-expo@~54.0.10

# Start the development server
npx expo start --clear
```

Scan the QR code with **Expo Go** on your Android device.

## Demo Accounts
| Role | Email | Password |
|---|---|---|
| Citizen | citizen@test.com | test1234 |
| Rescuer | rescuer@test.com | test1234 |

## Project Structure
```
src/
  theme/          colors.js, typography.js
  components/     Header, Card, Button, AlertBanner, StatusDot
  context/        AuthContext.js, AppStateContext.js
  navigation/     RootNavigator.js
  screens/
    auth/         WelcomeScreen, LoginScreen, SignUpScreen
                  SOSScreen, StatusScreen, LogScreen,
                  SettingsScreen, RescuerPlaceholderScreen
```

## Notes
- Citizen SOS uses native BLE advertising; install a development or production build (Expo Go does not include the native advertiser).
- The rescuer app starts with no seeded victims, pods, or logs and polls the gateway backend for recent pod telemetry every five seconds. Live SOS packets with a GPS satellite fix appear on the GPS map. Keep the phone and backend on the same LAN and configure `src/config.ts` with the backend computer's LAN address.
- The rescuer dashboard is under development — rescuer accounts show a placeholder screen
- Authentication uses the sibling `backend` service. Configure its Gmail SMTP environment variables to enable signup and login email verification; see `../backend/README.md`.
