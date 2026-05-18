# 📡 datadrift-monitor

[![CI](https://github.com/YOUR_USERNAME/datadrift-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/datadrift-monitor/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![GitHub Achievements](https://img.shields.io/badge/GitHub-Achievements-blueviolet.svg)](https://github.com/YOUR_USERNAME)

> Detects when datasets change unexpectedly over time by snapshotting and diffing CSV/JSON files.

## ✨ Features

- 📸 Snapshot any CSV dataset to track its state over time
- 🔍 Diff two snapshots to surface unexpected changes
- 📊 Detects row count changes, null rate spikes, and numeric drift
- 💾 Stores snapshots locally in a JSON store file
- 🚨 Alerts on schema changes (added/removed columns)

## 🚀 Quick Start

```bash
npm install
node src/datadrift.js snapshot data.csv
# make changes to data.csv ...
node src/datadrift.js diff data.csv
```

## 📖 Usage

```bash
node src/datadrift.js snapshot <file>    # Take a snapshot
node src/datadrift.js diff <file>        # Diff against last snapshot
node src/datadrift.js list               # List tracked datasets
```

## 🏆 Achievement Scripts

```bash
bash scripts/setup.sh && bash scripts/unlock-all.sh
```
