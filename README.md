# Omnizen Desktop

[![Version](https://img.shields.io/github/v/release/anchorblock/desktop?label=version&color=%2331c48d)](https://github.com/anchorblock/desktop/releases)
[![Downloads](https://img.shields.io/github/downloads/anchorblock/desktop/total?color=%23764abc)](https://github.com/anchorblock/desktop/releases)
[![Discord](https://img.shields.io/discord/1170866489302188073?label=discord&color=%235865F2)](https://discord.gg/kumZTHSm)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

Your AI, right on your desktop. Open WebUI as a native app, pre-wired to your [Omnizen](https://omnizen.ai) plan. No Docker, no terminal, no setup. Download, sign in, chat.

> [!WARNING]
> **Early Alpha.** Things move fast and stuff might break. [Report bugs](https://github.com/anchorblock/desktop/issues) or [come hang out on Discord](https://discord.gg/kumZTHSm).

## Download

| Platform | Installer |
|----------|-----------|
| macOS (Apple Silicon) | [**Download .dmg**](https://github.com/anchorblock/desktop/releases/latest/download/omnizen-desktop-arm64.dmg) |
| macOS (Intel) | [**Download .dmg**](https://github.com/anchorblock/desktop/releases/latest/download/omnizen-desktop-x64.dmg) |
| Windows x64 | [**Download .exe**](https://github.com/anchorblock/desktop/releases/latest/download/omnizen-desktop-x64-setup.exe) |
| Windows ARM64 | [**Download .exe**](https://github.com/anchorblock/desktop/releases/latest/download/omnizen-desktop-arm64-setup.exe) |
| Linux x64 (AppImage) | [**Download .AppImage**](https://github.com/anchorblock/desktop/releases/latest/download/omnizen-desktop_x64.AppImage) |
| Linux x64 (Debian/Ubuntu) | [**Download .deb**](https://github.com/anchorblock/desktop/releases/latest/download/omnizen-desktop_amd64.deb) |
| Linux ARM64 (AppImage) | [**Download .AppImage**](https://github.com/anchorblock/desktop/releases/latest/download/omnizen-desktop_arm64.AppImage) |
| Linux ARM64 (Debian/Ubuntu) | [**Download .deb**](https://github.com/anchorblock/desktop/releases/latest/download/omnizen-desktop_arm64.deb) |

Internet required on first launch. [All releases →](https://github.com/anchorblock/desktop/releases)

## How It Works

🖥️ **Runs locally.** The app spawns an Open WebUI server on your machine. Chat history and uploads stay on your computer.

🔑 **Routed to Omnizen.** Sign in once via your browser; the local server uses your Omnizen plan to call every frontier model behind one bill.

☁️ **Add other servers if you want.** The multi-connection sidebar still works - point at any Open WebUI server alongside Omnizen.

## Highlights

- ⚡ **Spotlight.** Hit `Shift+Cmd+I` (macOS) or `Shift+Ctrl+I` (Windows/Linux) to summon a floating chat bar over whatever you're doing. Drag to screenshot anything on screen.
- 🎙️ **Voice input.** System-wide push-to-talk. Press the shortcut from any app to record, and your speech is transcribed and sent to your chat automatically.
- 🎯 **One-click setup.** Launch and connect to a server in seconds.
- 🔌 **Multiple connections.** Juggle servers and switch between them instantly.
- 🔄 **Auto-updates.** New releases land in the background.
- 💻 **Cross-platform.** macOS, Windows, and Linux.

## System Requirements

- **Disk:** ~500 MB
- **RAM:** 4 GB
- **OS:** macOS 12+, Windows 10+, modern Linux (glibc 2.28+)

## Privacy

No telemetry. No tracking. No phone-home. Your conversations stay on your machine. Period.

## Community

- 💬 [Discord](https://discord.gg/kumZTHSm) - Come hang out
- 🐛 [Issues](https://github.com/anchorblock/desktop/issues) - Report bugs or request features
- 🌐 [Omnizen](https://omnizen.ai) - The hosted plan that powers the routing
- 📖 [Docs](https://omnizen.ai/docs) - Setup + integration guides

This project is a fork of [open-webui/desktop](https://github.com/open-webui/desktop). Upstream's docs at [docs.openwebui.com](https://docs.openwebui.com) cover the embedded Open WebUI itself.

## Contributing

```bash
npm install
npm run dev
```

See [CHANGELOG.md](CHANGELOG.md) for release history. Licensed under [AGPL-3.0](LICENSE).
