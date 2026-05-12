import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const repoRoot = process.cwd();
const packageRoot = join(repoRoot, 'applications', 'luci-app-ccswitch');
const distDir = join(repoRoot, 'dist');
const version = '1.5.2-1';
const packageName = 'luci-app-ccswitch';
const output = join(distDir, `${packageName}_${version}_all.ipk`);

function toPosix(path) {
  return path.split(sep).join('/');
}

function checksum(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) sum += bytes[i];
  return sum;
}

function tarHeader(name, size, mode, type = '0', mtime = 0) {
  const block = Buffer.alloc(512, 0);
  const nameBytes = Buffer.from(name);
  if (nameBytes.length > 100) throw new Error(`tar path too long: ${name}`);

  block.set(nameBytes, 0);
  block.write(mode.toString(8).padStart(7, '0') + '\0', 100, 8, 'ascii');
  block.write('0000000\0', 108, 8, 'ascii');
  block.write('0000000\0', 116, 8, 'ascii');
  block.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  block.write(mtime.toString(8).padStart(11, '0') + '\0', 136, 12, 'ascii');
  block.fill(0x20, 148, 156);
  block.write(type, 156, 1, 'ascii');
  block.write('ustar\0', 257, 6, 'ascii');
  block.write('00', 263, 2, 'ascii');
  block.write('root', 265, 4, 'ascii');
  block.write('root', 297, 4, 'ascii');

  const sum = checksum(block);
  block.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return block;
}

function pad512(size) {
  const rest = size % 512;
  return rest === 0 ? Buffer.alloc(0) : Buffer.alloc(512 - rest, 0);
}

function makeTar(entries, options = {}) {
  const chunks = [];
  const dirs = new Set();

  for (const entry of entries) {
    const parts = entry.name.split('/');
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/') + '/');
    }
  }

  for (const dir of [...dirs].sort()) {
    chunks.push(tarHeader(dir, 0, 0o755, '5'));
  }

  const fileEntries = options.preserveOrder
    ? entries
    : entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of fileEntries) {
    const data = entry.data ?? Buffer.alloc(0);
    chunks.push(tarHeader(entry.name, data.length, entry.mode ?? 0o644, '0'));
    chunks.push(data);
    chunks.push(pad512(data.length));
  }

  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

function walkFiles(dir) {
  const result = [];
  for (const item of readdirSync(dir)) {
    const path = join(dir, item);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...walkFiles(path));
    else if (stat.isFile()) result.push(path);
  }
  return result;
}

function dataEntries() {
  const entries = [];
  const rootDir = join(packageRoot, 'root');
  const htdocsDir = join(packageRoot, 'htdocs');

  for (const file of walkFiles(rootDir)) {
    const rel = toPosix(relative(rootDir, file));
    const executable =
      rel === 'usr/libexec/rpcd/ccswitch' ||
      rel === 'usr/libexec/ccswitch-proxy-cgi' ||
      rel === 'etc/init.d/ccswitch-proxy' ||
      rel === 'etc/uci-defaults/90_luci-ccswitch' ||
      rel.startsWith('usr/share/ccswitch/proxy-www/');

    entries.push({
      name: `./${rel}`,
      data: readFileSync(file),
      mode: executable ? 0o755 : 0o644
    });
  }

  for (const file of walkFiles(htdocsDir)) {
    entries.push({
      name: `./www/${toPosix(relative(htdocsDir, file))}`,
      data: readFileSync(file),
      mode: 0o644
    });
  }

  return entries;
}

function controlEntries() {
  const control = [
    `Package: ${packageName}`,
    `Version: ${version}`,
    'Depends: luci-base, rpcd, jsonfilter, uhttpd, curl',
    'Architecture: all',
    'Maintainer: Codex',
    'Section: luci',
    'Priority: optional',
    'Description: LuCI support for CC Switch provider switching',
    ''
  ].join('\n');

  const postinst = [
    '#!/bin/sh',
    '[ -n "$IPKG_INSTROOT" ] && exit 0',
    'chmod 755 /usr/libexec/rpcd/ccswitch 2>/dev/null',
    'chmod 755 /usr/libexec/ccswitch-proxy-cgi 2>/dev/null',
    'chmod 755 /etc/init.d/ccswitch-proxy 2>/dev/null',
    'chmod 755 /usr/share/ccswitch/proxy-www/health 2>/dev/null',
    'chmod 755 /usr/share/ccswitch/proxy-www/v1/messages 2>/dev/null',
    'chmod 755 /usr/share/ccswitch/proxy-www/v1/responses 2>/dev/null',
    'chmod 755 /usr/share/ccswitch/proxy-www/v1/models 2>/dev/null',
    'chmod 755 /usr/share/ccswitch/proxy-www/v1/chat/completions 2>/dev/null',
    '[ -x /etc/uci-defaults/90_luci-ccswitch ] && /etc/uci-defaults/90_luci-ccswitch',
    '[ -x /etc/init.d/ccswitch-proxy ] && /etc/init.d/ccswitch-proxy enable >/dev/null 2>&1',
    '[ -x /etc/init.d/ccswitch-proxy ] && /etc/init.d/ccswitch-proxy restart >/dev/null 2>&1',
    '[ -x /etc/init.d/rpcd ] && /etc/init.d/rpcd reload >/dev/null 2>&1',
    'exit 0',
    ''
  ].join('\n');

  const prerm = [
    '#!/bin/sh',
    '[ -n "$IPKG_INSTROOT" ] && exit 0',
    '[ -x /etc/init.d/ccswitch-proxy ] && /etc/init.d/ccswitch-proxy stop >/dev/null 2>&1',
    '[ -x /etc/init.d/ccswitch-proxy ] && /etc/init.d/ccswitch-proxy disable >/dev/null 2>&1',
    'exit 0',
    ''
  ].join('\n');

  const conffiles = [
    '/etc/config/ccswitch',
    ''
  ].join('\n');

  return [
    { name: './control', data: Buffer.from(control), mode: 0o644 },
    { name: './conffiles', data: Buffer.from(conffiles), mode: 0o644 },
    { name: './postinst', data: Buffer.from(postinst), mode: 0o755 },
    { name: './prerm', data: Buffer.from(prerm), mode: 0o755 }
  ];
}

mkdirSync(distDir, { recursive: true });
rmSync(output, { force: true });

const controlTarGz = gzipSync(makeTar(controlEntries()));
const dataTarGz = gzipSync(makeTar(dataEntries()));
const ipk = gzipSync(makeTar([
  { name: './debian-binary', data: Buffer.from('2.0\n'), mode: 0o644 },
  { name: './data.tar.gz', data: dataTarGz, mode: 0o644 },
  { name: './control.tar.gz', data: controlTarGz, mode: 0o644 }
], { preserveOrder: true }));

writeFileSync(output, ipk);
console.log(output);
