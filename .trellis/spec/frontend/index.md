# Frontend Development Guidelines

> Best practices for Electron renderer process development in open-typeless.

---

## Overview

The frontend (renderer process) provides:
- Floating window showing recording status
- Real-time transcription display (interim + final results)
- Settings/preferences UI (if needed)

---

## Guidelines Index

### Core Patterns

| Guide | Description | Priority |
|-------|-------------|----------|
| [IPC & Electron](./ipc-electron.md) | IPC communication patterns, context isolation | HIGH |
| [Directory Structure](./directory-structure.md) | React component organization | MEDIUM |
| [State Management](./state-management.md) | Context patterns, local/global state | MEDIUM |
| [React Pitfalls](./react-pitfalls.md) | Common bugs and how to avoid them | MEDIUM |

---

## Quick Reference

### IPC Communication

```typescript
// Renderer → Main
window.electron.ipcRenderer.invoke('channel-name', data)

// Main → Renderer (subscriptions)
window.electron.ipcRenderer.on('event-name', callback)
```

### Key UI States

| State | Display |
|-------|---------|
| Idle | Hidden or minimal indicator |
| Listening | "● Listening..." with animation |
| Processing | Show interim transcription |
| Complete | Final text (auto-hide after paste) |
| Error | Error message with retry option |

---

**Language**: All documentation is in **English**.
