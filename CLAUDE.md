# CLAUDE.md
This file provides guidance to Claude Code when working with this repository.
## Project Overview
A React Native Dua & Dhikr app built with Expo. Helps users read, memorise,
and count Islamic supplications from the Hisn al-Muslim collection.
## Dev Commands
- `npm start` — start Expo dev server
- `npm run ios / android / web` — platform-specific launch
- EAS CLI for distribution builds
- No lint or test scripts configured
## Stack
- React Native 0.83.2 + Expo 55
- React Navigation 7 (Native Stack)
- AsyncStorage for persistence
## Navigation
7-screen stack:
`HomeScreen → DuaScreen / SearchScreen / FavoritesScreen / ReminderScreen / PlaylistScreen → CounterScreen`
## Data
- All duas from `husn_en.json` (~284KB), static, no backend
- Hierarchical: sections → duas with ID, Arabic, translation, repeat count
- `datasetTitles` strings must exactly match `TITLE` fields in the dataset
## State Management
- No global state manager
- Local `useState` per screen
- Favorites only persisted state via `favorites.js` (wraps AsyncStorage)
## Key Files
- `theme.js` — shared parchment palette and typography
- `playlists.js` — playlist definitions and datasetTitles lookup keys
- `notifications.js` — reminder/notification logic
- `CounterScreen.js` — most complex screen (479 lines)
## Navigation Params
- `DuaScreen` receives `{ category, datasetTitles }`
- `CounterScreen` receives a full playlist object
## Theme
Parchment palette:
- Background: `#F5F0E8`
- Text: `#2C2C2C`
- Accent terracotta: `#8B4A2F`
- Counter header yellow: `#F5F083`
## Working Style
This project follows a teacher/student workflow. The developer is learning
React Native.
Before making any change:
1. Explain the concept simply using a real-world metaphor
2. Show which exact file and line will be affected
3. Wait for confirmation before editing
During implementation:
- Make one small change at a time
- After each change, explain what was done and why
- Flag anything that could break other parts of the app
## Safety Protocol
We are working in safety-first mode.
First, analyse the task and classify it as SAFE, CAUTION, or HIGH RISK.
Then provide:
1. What you think I want
2. Assumptions
3. Files/systems likely affected
4. Exact plan
5. Risks
6. Rollback approach
Do not execute destructive, irreversible, or significant changes without
explicit approval.
Log all meaningful actions to `./logs/agent-session-log.md` and important
decisions to `./logs/decision-log.md`.
Prefer small reversible changes. If there is any meaningful risk, show the
dry-run plan before execution.
