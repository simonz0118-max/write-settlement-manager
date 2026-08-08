const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

const utf8 = new TextDecoder('utf-8');

function findSignatureBackwards(bytes, signature) {
  for (let i = bytes.length - 4; i >= 0; i--) {
    if (bytes[i] === (signature & 0xff) &&
        bytes[i + 1] === ((signature >>> 8) & 0xff) &&
        bytes[i + 2] === ((signature >>> 16) & 0xff) &&
        bytes[i + 3] === ((signature >>> 24) & 0xff)) return i;
  }
  return -1;
}

function decodeFilename(bytes, flags) {
  // WRITE files use UTF-8 for relevant names. The fallback still keeps ASCII XLSX paths intact.
  return utf8.decode(bytes);
}

export class ZipArchive {
  constructor(blob, entries) {
    this.blob = blob;
    this.entries = entries;
    this.byName = new Map(entries.map((entry) => [entry.name, entry]));
  }

  static async open(blob) {
    if (!(blob instanceof Blob)) throw new Error('ZIP source must be a Blob/File');
    const tailSize = Math.min(blob.size, 65557);
    const tailOffset = blob.size - tailSize;
    const tail = new Uint8Array(await blob.slice(tailOffset).arrayBuffer());
    const eocdPos = findSignatureBackwards(tail, EOCD_SIG);
    if (eocdPos < 0) throw new Error('不是有效的 ZIP/XLSX：找不到中央目录');
    const eocd = new DataView(tail.buffer, tail.byteOffset + eocdPos);
    const entriesTotal = eocd.getUint16(10, true);
    const centralSize = eocd.getUint32(12, true);
    const centralOffset = eocd.getUint32(16, true);
    if (entriesTotal === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff) {
      throw new Error('暂不支持 ZIP64 文件');
    }

    const central = new Uint8Array(await blob.slice(centralOffset, centralOffset + centralSize).arrayBuffer());
    const view = new DataView(central.buffer, central.byteOffset, central.byteLength);
    const entries = [];
    let pos = 0;
    while (pos + 46 <= central.length && entries.length < entriesTotal) {
      if (view.getUint32(pos, true) !== CEN_SIG) break;
      const flags = view.getUint16(pos + 8, true);
      const method = view.getUint16(pos + 10, true);
      const compressedSize = view.getUint32(pos + 20, true);
      const uncompressedSize = view.getUint32(pos + 24, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localOffset = view.getUint32(pos + 42, true);
      const name = decodeFilename(central.slice(pos + 46, pos + 46 + nameLen), flags).replace(/^\//, '');
      entries.push({ name, flags, method, compressedSize, uncompressedSize, localOffset });
      pos += 46 + nameLen + extraLen + commentLen;
    }
    if (!entries.length) throw new Error('ZIP 中没有可读取的条目');
    return new ZipArchive(blob, entries);
  }

  get(name) {
    return this.byName.get(String(name).replace(/^\//, ''));
  }

  list(predicate = null) {
    return predicate ? this.entries.filter(predicate) : [...this.entries];
  }

  async dataRange(entry) {
    const header = new DataView(await this.blob.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer());
    if (header.getUint32(0, true) !== LOC_SIG) throw new Error(`ZIP 条目损坏：${entry.name}`);
    const nameLen = header.getUint16(26, true);
    const extraLen = header.getUint16(28, true);
    const start = entry.localOffset + 30 + nameLen + extraLen;
    return { start, end: start + entry.compressedSize };
  }

  async stream(entryOrName) {
    const entry = typeof entryOrName === 'string' ? this.get(entryOrName) : entryOrName;
    if (!entry) throw new Error(`ZIP 中找不到：${entryOrName}`);
    const { start, end } = await this.dataRange(entry);
    const source = this.blob.slice(start, end).stream();
    if (entry.method === 0) return source;
    if (entry.method === 8) {
      try {
        return source.pipeThrough(new DecompressionStream('deflate-raw'));
      } catch (err) {
        throw new Error('当前浏览器不支持 ZIP Deflate 流式解压，请升级 Chrome / Edge / Safari。');
      }
    }
    throw new Error(`不支持 ZIP 压缩方法 ${entry.method}：${entry.name}`);
  }

  async bytes(entryOrName, maxBytes = 32 * 1024 * 1024) {
    const entry = typeof entryOrName === 'string' ? this.get(entryOrName) : entryOrName;
    if (!entry) return new Uint8Array();
    if (entry.uncompressedSize > maxBytes) throw new Error(`条目过大，禁止整块载入：${entry.name}`);
    const stream = await this.stream(entry);
    const reader = stream.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error(`条目过大，禁止整块载入：${entry.name}`);
      chunks.push(value);
    }
    const merged = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
    return merged;
  }

  async text(entryOrName, maxBytes = 32 * 1024 * 1024) {
    return utf8.decode(await this.bytes(entryOrName, maxBytes));
  }

  async toBlob(entryOrName, onProgress = null) {
    const entry = typeof entryOrName === 'string' ? this.get(entryOrName) : entryOrName;
    if (!entry) throw new Error(`ZIP 中找不到：${entryOrName}`);
    const stream = await this.stream(entry);
    const reader = stream.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
      onProgress?.(size, entry.uncompressedSize || size);
    }
    return new Blob(chunks, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}
