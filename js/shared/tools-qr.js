// QR Model 2, byte mode + UTF-8 ECI, level L, versions 1..20.
// ISO/IEC 18004 block parameters; generated locally, never sent to a QR service.
const TOOL_QR_BLOCKS = [null, [1, 26, 19], [1, 44, 34], [1, 70, 55], [1, 100, 80], [1, 134, 108], [2, 86, 68], [2, 98, 78], [2, 121, 97], [2, 146, 116], [2, 86, 68, 2, 87, 69], [4, 101, 81], [2, 116, 92, 2, 117, 93], [4, 133, 107], [3, 145, 115, 1, 146, 116], [5, 109, 87, 1, 110, 88], [5, 122, 98, 1, 123, 99], [1, 135, 107, 5, 136, 108], [5, 150, 120, 1, 151, 121], [3, 141, 113, 4, 142, 114], [3, 135, 107, 5, 136, 108]];
function qrMultiply(a, b) {
  let result = 0;
  while (b) {
    if (b & 1) result ^= a;
    a <<= 1;
    if (a & 256) a ^= 285;
    b >>= 1;
  }
  return result;
}
function qrRemainder(data, degree) {
  let poly = [1],
    root = 1;
  for (let i = 0; i < degree; i++) {
    const next = Array(poly.length + 1).fill(0);
    poly.forEach((v, j) => {
      next[j] ^= v;
      next[j + 1] ^= qrMultiply(v, root);
    });
    poly = next;
    root = qrMultiply(root, 2);
  }
  const rem = Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= qrMultiply(poly[i + 1], factor);
  }
  return rem;
}
export function toolQrMatrix(text) {
  const bytes = new TextEncoder().encode(text);
  let version, blocks, capacity;
  for (version = 1; version <= 20; version++) {
    blocks = [];
    const spec = TOOL_QR_BLOCKS[version];
    for (let i = 0; i < spec.length; i += 3) for (let j = 0; j < spec[i]; j++) blocks.push({
      total: spec[i + 1],
      data: spec[i + 2]
    });
    capacity = blocks.reduce((n, b) => n + b.data, 0);
    if (12 + 4 + (version < 10 ? 8 : 16) + bytes.length * 8 <= capacity * 8) break;
  }
  if (version > 20) throw Error('QR 내용이 너무 깁니다. UTF-8 850바이트 이내로 줄여 주세요.');
  const bits = [],
    push = (v, n) => {
      for (let i = n - 1; i >= 0; i--) bits.push(v >>> i & 1);
    };
  push(7, 4);
  push(26, 8);
  push(4, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach(b => push(b, 8));
  push(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((v, b) => v * 2 + b, 0));
  while (data.length < capacity) data.push(data.length % 2 === Math.ceil(bits.length / 8) % 2 ? 236 : 17);
  let offset = 0;
  for (const block of blocks) {
    block.bytes = data.slice(offset, offset + block.data);
    offset += block.data;
    block.ecc = qrRemainder(block.bytes, block.total - block.data);
  }
  const words = [];
  for (let i = 0; i < Math.max(...blocks.map(b => b.data)); i++) for (const block of blocks) if (i < block.data) words.push(block.bytes[i]);
  for (let i = 0; i < blocks[0].ecc.length; i++) for (const block of blocks) words.push(block.ecc[i]);
  const size = version * 4 + 17,
    matrix = Array.from({
      length: size
    }, () => Array(size).fill(false)),
    fixed = matrix.map(row => row.map(() => false));
  const mark = (x, y, value) => {
    if (x >= 0 && y >= 0 && x < size && y < size) {
      matrix[y][x] = !!value;
      fixed[y][x] = true;
    }
  };
  for (let i = 0; i < size; i++) {
    mark(6, i, i % 2 === 0);
    mark(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    mark(cx + dx, cy + dy, d !== 2 && d !== 4);
  }
  const positions = [];
  if (version > 1) {
    const count = Math.floor(version / 7) + 2,
      step = Math.floor((version * 4 + count * 2 + 1) / (count * 2 - 2)) * 2;
    positions.push(6);
    for (let i = count - 1; i >= 1; i--) positions.splice(1, 0, size - 7 - (count - 1 - i) * step);
  }
  for (let iy = 0; iy < positions.length; iy++) for (let ix = 0; ix < positions.length; ix++) {
    if (ix === 0 && iy === 0 || ix === 0 && iy === positions.length - 1 || ix === positions.length - 1 && iy === 0) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(positions[ix] + dx, positions[iy] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  let rem = 8;
  for (let i = 0; i < 10; i++) rem = rem << 1 ^ (rem >>> 9) * 1335;
  const format = (8 << 10 | rem) ^ 21522,
    bit = i => format >>> i & 1;
  for (let i = 0; i <= 5; i++) mark(8, i, bit(i));
  mark(8, 7, bit(6));
  mark(8, 8, bit(7));
  mark(7, 8, bit(8));
  for (let i = 9; i < 15; i++) mark(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) mark(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) mark(8, size - 15 + i, bit(i));
  mark(8, size - 8, true);
  if (version >= 7) {
    let v = version;
    for (let i = 0; i < 12; i++) v = v << 1 ^ (v >>> 11) * 7973;
    const value = version << 12 | v;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + i % 3,
        b = Math.floor(i / 3);
      mark(a, b, value >>> i & 1);
      mark(b, a, value >>> i & 1);
    }
  }
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const y = (right + 1 & 2) === 0 ? size - 1 - vert : vert;
      for (let dx = 0; dx < 2; dx++) {
        const x = right - dx;
        if (!fixed[y][x]) {
          const value = index < words.length * 8 ? words[index >>> 3] >>> 7 - index % 8 & 1 : 0;
          matrix[y][x] = !!(value ^ ((x + y) % 2 === 0 ? 1 : 0));
          index++;
        }
      }
    }
  }
  return matrix;
}
