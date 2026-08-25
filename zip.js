// Minimal ZIP writer (STORE method, no compression). Good enough for bundling
// small text files (SVGs) without pulling in a third-party dependency.

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      t[n] = c;
    }
    return t;
  })());
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function stringToBytes(str) {
  return new TextEncoder().encode(str);
}

function writeUint32LE(view, offset, value) {
  view.setUint32(offset, value, true);
}
function writeUint16LE(view, offset, value) {
  view.setUint16(offset, value, true);
}

// files: [{name, content (string)}]
function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = 0x21; // arbitrary fixed date (Jan 1 1980-ish), fine for generated files

  files.forEach(file => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = stringToBytes(file.content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new ArrayBuffer(30);
    const lv = new DataView(localHeader);
    writeUint32LE(lv, 0, 0x04034b50);
    writeUint16LE(lv, 4, 20);
    writeUint16LE(lv, 6, 0);
    writeUint16LE(lv, 8, 0); // no compression
    writeUint16LE(lv, 10, dosTime);
    writeUint16LE(lv, 12, dosDate);
    writeUint32LE(lv, 14, crc);
    writeUint32LE(lv, 18, size);
    writeUint32LE(lv, 22, size);
    writeUint16LE(lv, 26, nameBytes.length);
    writeUint16LE(lv, 28, 0);

    localParts.push(new Uint8Array(localHeader), nameBytes, dataBytes);

    const centralHeader = new ArrayBuffer(46);
    const cv = new DataView(centralHeader);
    writeUint32LE(cv, 0, 0x02014b50);
    writeUint16LE(cv, 4, 20);
    writeUint16LE(cv, 6, 20);
    writeUint16LE(cv, 8, 0);
    writeUint16LE(cv, 10, 0);
    writeUint16LE(cv, 12, dosTime);
    writeUint16LE(cv, 14, dosDate);
    writeUint32LE(cv, 16, crc);
    writeUint32LE(cv, 20, size);
    writeUint32LE(cv, 24, size);
    writeUint16LE(cv, 28, nameBytes.length);
    writeUint16LE(cv, 30, 0);
    writeUint16LE(cv, 32, 0);
    writeUint16LE(cv, 34, 0);
    writeUint16LE(cv, 36, 0);
    writeUint32LE(cv, 38, 0);
    writeUint32LE(cv, 42, offset);

    centralParts.push(new Uint8Array(centralHeader), nameBytes);

    offset += localHeader.byteLength + nameBytes.length + dataBytes.length;
  });

  const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0);
  const centralOffset = offset;

  const endRecord = new ArrayBuffer(22);
  const ev = new DataView(endRecord);
  writeUint32LE(ev, 0, 0x06054b50);
  writeUint16LE(ev, 4, 0);
  writeUint16LE(ev, 6, 0);
  writeUint16LE(ev, 8, files.length);
  writeUint16LE(ev, 10, files.length);
  writeUint32LE(ev, 12, centralSize);
  writeUint32LE(ev, 16, centralOffset);
  writeUint16LE(ev, 20, 0);

  const allParts = [...localParts, ...centralParts, new Uint8Array(endRecord)];
  return new Blob(allParts, { type: 'application/zip' });
}
