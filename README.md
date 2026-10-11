# Movieflix 🎬

Movieflix is a high-performance, modern mobile streaming application built with React Native and Expo. It provides a Netflix-style cinematic video streaming experience with offline downloads, multi-audio dubbing, real-time multi-language subtitle translation, and Picture-in-Picture playback.

---

## ✨ Features

- **Cinematic Video Player**:
  - Netflix-style 6-second intro loading screen.
  - Native Picture-in-Picture (PiP) support.
  - Multi-resolution stream quality selector (1080p FHD, 720p HD, 480p, 360p).
  - Multi-audio dubbing (English, Hindi, French, Spanish, Tamil, Telugu).
  - Real-time SRT subtitle engine with 20+ language live translations.
  - Gesture controls: double-tap 10s seek, speed controls (0.75× to 2.0×), and zoom/stretch aspect ratio modes.

- **Offline Downloads & Local Storage**:
  - Background video and subtitle file downloads with live progress tracking.
  - Encrypted, keystore-backed local storage for download history, watch progress, and custom watchlist.
  - Seamless offline mode for playing saved media without internet connection.

- **Curated Catalogs & Live Server Sync**:
  - 8 curated OTT sections (Trending Now, Latest Releases, Netflix Popular, Hindi Movies, Anime Trending, Latest Anime, Web Series, Animation).
  - Dynamic category pills and live exploration modal with responsive search.
  - 3-column explore grid with randomized shuffle and load-more pagination.

- **Smart Health & Wellness**:
  - Automated 2-hour continuous watching break notifications.
  - Download completion notifications and custom alerts.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo Go app or development build on Android/iOS

### Installation
```bash
git clone https://github.com/movieflix/movieflix.git
cd movieflix
npm install
```

### Run Locally
```bash
npx expo start
```
Scan the QR code with Expo Go on your mobile device.

---

## 🛠️ Tech Stack
- **Framework**: [Expo](https://expo.dev/) (SDK 53) & React Native
- **Video Engine**: `expo-video`
- **File System & Downloads**: `expo-file-system`
- **Notifications**: `expo-notifications`
- **Icons**: `@expo/vector-icons` (Ionicons, MaterialIcons, Feather)
- **Local Storage**: `@react-native-async-storage/async-storage` & `expo-secure-store`
