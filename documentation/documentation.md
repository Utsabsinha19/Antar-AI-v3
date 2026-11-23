# Antar AI - Project Documentation

## Project Overview

Antar AI is a frontend web application built to analyze live human engagement, attention, and cognitive load during digital sessions (e.g., video calls, deep work, or presentations). It uses a modern React tech stack to provide real-time dashboards, insights, and tracking.

### Tech Stack
*   **Framework**: React 19 (TypeScript) with Vite
*   **Styling**: Tailwind CSS (v4) with `clsx` and `tailwind-merge`
*   **Animations**: Framer Motion
*   **Charting**: Recharts
*   **Icons**: Lucide React
*   **State Management**: React Context API (`appStore`, `analysisStore`, `profileStore`)

## Features & Pages

The application is structured around a comprehensive dashboard layout (sidebar + topbar) with the following key pages:

1.  **Home Page**: Marketing landing page outlining the vision, use cases, and pricing plans.
2.  **Dashboard**: The central hub displaying recent session overviews, current engagement status, and quick actions.
3.  **Analytics Page**: Detailed time-series graphs and statistics from recorded sessions.
4.  **Digital Twin Page**: A unique feature aimed at modeling the user's behavioral patterns and focus baseline.
5.  **Attention Replay Page**: Allows users to review the attention and focus metrics over the timeline of a past session.
6.  **Engagement DNA Page**: Deep dive into the core components that make up the user's engagement score (attention, facial engagement, interaction).
7.  **Cognitive Load Page**: Specifically tracks mental fatigue, blink rates, and boredom indexes to suggest breaks and optimize workflows.
8.  **Reports Page**: Interface for viewing and potentially exporting analysis summaries.
9.  **Profile, Settings, Admin**: Standard management interfaces for the user account and application preferences.
10. **Auth Page**: Login and Registration screens.
11. **Live Webcam Analysis**: A floating or inline webcam component that captures and processes user feeds.
12. **AI Chatbot**: An integrated chatbot interface (`AIChatbot.tsx`) for querying data or receiving advice.

## Analysis Engine: Real-Time vs. Demo Mode

The core value proposition of Antar AI is its "Live Sensor Analysis." Upon studying the `WebcamAnalysis.tsx` and `analysisStore.tsx` files, it operates in a **hybrid mode**:

### 1. Real-Time (Working) Features
The application actively captures and processes real-world data from the user's environment:
*   **Audio/Voice Energy**: Uses the native Web Audio API (`AudioContext` and `AnalyserNode`) to calculate real-time RMS voice energy.
*   **Face Presence & Framing**: Uses the experimental browser `window.FaceDetector` API (if available) to detect if a face is present and calculates its bounding box (`FaceBox`) relative to the video dimensions.
*   **Tab Visibility**: Tracks `document.visibilityState` to see if the user is actively looking at the browser tab.

### 2. Demo Mode / Simulated Features (The "AI" Models)
Standard web browsers do not natively provide complex Computer Vision outputs (like gaze tracking or emotion). To avoid shipping heavy ML models (like TensorFlow.js or MediaPipe) in this version, the advanced "AI" metrics are **simulated using randomized math based on the real-time base signals**.

If a face is detected and the tab is visible, the app generates plausible (but fake) data for:
*   **Gaze Focus & Blink Rate**: Simulated using `Math.random()`. (e.g., `simulatedGazeFocus = isVisuallyEngaged ? 85 + Math.random() * 15 : 20 + Math.random() * 30`)
*   **Head Pose (Yaw/Pitch)**: Simulated to show minor movements.
*   **Facial Engagement**: Smile intensity and eye openness are simulated, heavily influenced by whether the user is talking (audio energy).
*   **Fatigue & Boredom**: Yawn probability and head droop are simulated over time (the longer the session runs, the higher the fatigue factor).

### 3. Derived Metrics
Based on the mix of real and simulated data, the app uses custom formulas to calculate:
*   **Attention Confidence Score**
*   **Interaction Activity Score** (Heavily based on real voice energy)
*   **Cognitive Fatigue Index**
*   **Deep Focus**
*   **Overall Engagement Probability**

### Conclusion
The project is a fully functional UI/UX prototype and dashboard. It successfully accesses local hardware (Webcam/Mic) to provide a **real-time structural shell**, but the deep Computer Vision analysis (Gaze, Emotion, Posture) is currently written for **demo mode**. To make the analysis 100% real-time in the future, the simulated math in `analysisStore.tsx` would need to be replaced by actual ML inferences from a library like Google MediaPipe or a backend AI service.
