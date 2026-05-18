#!/usr/bin/env node
/**
 * datadrift-monitor — Detects when datasets change unexpectedly over time
 * Usage: node src/datadrift.js <command> [options]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = '.datadrift-store.json';

function loadStore() {
  if (!fs.existsSync(STORE_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch { return {}; }
}

function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function parseCSV(content) {
  const lines = content.trim().split('\n').filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(l => l.split(',').map(v => v.trim()));
  return { headers, rows };
}

function profileDataset(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const size = fs.statSync(filePath).size;
  const { headers, rows } = parseCSV(content);
  
  const profile = { hash, size, rowCount: rows.length, colCount: headers.length, headers, timestamp: new Date().toISOString(), stats: {} };
  
  headers.forEach((h, i) => {
    const values = rows.map(r => r[i]).filter(v => v !== '');
    const nums = values.map(Number).filter(v => !isNaN(v));
    profile.stats[h] = {
      nonEmpty: values.length,
      unique: new Set(values).size,
      nullRate: ((rows.length - values.length) / rows.length).toFixed(3),
      ...(nums.length > 0 ? {
        min: Math.min(...nums),
        max: Math.max(...nums),
        mean: (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4),
        stddev: (() => {
          const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
          return Math.sqrt(nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nums.length).toFixed(4);
        })()
      } : {})
    };
  });
  return profile;
}

function snapshotCommand(filePath) {
  if (!fs.existsSync(filePath)) { console.error(`❌ File not found: ${filePath}`); process.exit(1); }
  const store = loadStore();
  const key = path.resolve(filePath);
  const profile = profileDataset(filePath);
  
  if (!store[key]) store[key] = { snapshots: [] };
  store[key].snapshots.push(profile);
  saveStore(store);
  
  console.log(`\n📸 Snapshot saved — ${path.basename(filePath)}`);
  console.log(`   Rows: ${profile.rowCount} | Cols: ${profile.colCount} | Size: ${profile.size}B`);
  console.log(`   Hash: ${profile.hash.slice(0, 16)}...`);
  console.log(`   Time: ${profile.timestamp}`);
  console.log(`   Total snapshots: ${store[key].snapshots.length}`);
}

function diffCommand(filePath) {
  if (!fs.existsSync(filePath)) { console.error(`❌ File not found: ${filePath}`); process.exit(1); }
  const store = loadStore();
  const key = path.resolve(filePath);
  
  if (!store[key] || store[key].snapshots.length < 2) {
    console.log('⚠️  Need at least 2 snapshots to diff. Run: snapshot first.');
    return;
  }
  
  const snaps = store[key].snapshots;
  const prev = snaps[snaps.length - 2];
  const curr = profileDataset(filePath);
  
  console.log(`\n🔍 Drift Report — ${path.basename(filePath)}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`Previous: ${prev.timestamp}`);
  console.log(`Current:  ${curr.timestamp}`);
  console.log('');
  
  let drifted = false;
  
  if (prev.hash !== curr.hash) {
    drifted = true;
    console.log('🚨 CHANGES DETECTED:');
    if (prev.rowCount !== curr.rowCount) {
      const diff = curr.rowCount - prev.rowCount;
      console.log(`  📊 Row count: ${prev.rowCount} → ${curr.rowCount} (${diff > 0 ? '+' : ''}${diff})`);
    }
    if (prev.colCount !== curr.colCount) {
      console.log(`  📐 Column count: ${prev.colCount} → ${curr.colCount}`);
    }
    if (prev.size !== curr.size) {
      const diff = curr.size - prev.size;
      console.log(`  💾 File size: ${prev.size}B → ${curr.size}B (${diff > 0 ? '+' : ''}${diff}B)`);
    }
    
    prev.headers.forEach(h => {
      const ps = prev.stats[h], cs = curr.stats[h];
      if (!cs) { console.log(`  ❌ Column removed: ${h}`); return; }
      const alerts = [];
      if (ps.nonEmpty !== cs.nonEmpty) alerts.push(`non-empty: ${ps.nonEmpty}→${cs.nonEmpty}`);
      if (parseFloat(cs.nullRate) - parseFloat(ps.nullRate) > 0.05) alerts.push(`null rate ↑ ${(parseFloat(cs.nullRate)*100).toFixed(1)}%`);
      if (ps.mean && cs.mean && Math.abs((parseFloat(cs.mean) - parseFloat(ps.mean)) / parseFloat(ps.mean)) > 0.1)
        alerts.push(`mean drift: ${ps.mean}→${cs.mean}`);
      if (alerts.length) console.log(`  ⚠️  ${h}: ${alerts.join(' | ')}`);
    });
    curr.headers.filter(h => !prev.headers.includes(h)).forEach(h => console.log(`  ✅ Column added: ${h}`));
  } else {
    console.log('✅ No drift detected. Dataset is identical.');
  }
  
  console.log(`\n${drifted ? '🔴 Status: DRIFT DETECTED' : '🟢 Status: STABLE'}`);
}

function listCommand() {
  const store = loadStore();
  const keys = Object.keys(store);
  if (!keys.length) { console.log('No datasets tracked yet. Run: snapshot <file>'); return; }
  console.log('\n📋 Tracked Datasets:');
  keys.forEach(k => {
    const snaps = store[k].snapshots;
    console.log(`  ${path.basename(k)} — ${snaps.length} snapshot(s), last: ${snaps[snaps.length-1].timestamp}`);
  });
}

const [,, cmd, file] = process.argv;
if (!cmd || cmd === 'help') {
  console.log('datadrift-monitor — Dataset Change Detector\n');
  console.log('Commands:');
  console.log('  snapshot <file>    Take a snapshot of a dataset');
  console.log('  diff <file>        Compare latest state vs last snapshot');
  console.log('  list               List all tracked datasets');
  process.exit(0);
}

if (cmd === 'snapshot') snapshotCommand(file);
else if (cmd === 'diff') diffCommand(file);
else if (cmd === 'list') listCommand();
else { console.error(`Unknown command: ${cmd}`); process.exit(1); }
