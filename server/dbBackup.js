import { query } from './db.js';

const BACKUP_TABLES = [
  'users',
  'sessions',
  'otps',
  'plans',
  'contacts',
  'purchases',
  'blogs',
  'user_templates',
  'site_settings',
  'usage_logs',
  'visitor_logs'
];

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = (year - 1980) << 9 | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

export function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, day } = dosDateTime();

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name.replace(/\\/g, '/'), 'utf8');
    const dataBuffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(String(file.data), 'utf8');
    const checksum = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(day, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(day, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralOffset = offset;
  const centralBuffer = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuffer, end]);
}

async function readTableRows(tableName) {
  const result = await query(`SELECT * FROM ${tableName} ORDER BY 1 ASC`);
  return result.rows || [];
}

export async function createDatabaseBackupZip() {
  const generatedAt = new Date().toISOString();
  const files = [];
  const tableSummaries = [];

  for (const tableName of BACKUP_TABLES) {
    const rows = await readTableRows(tableName);
    tableSummaries.push({ table: tableName, rows: rows.length });
    files.push({
      name: `data/${tableName}.json`,
      data: JSON.stringify(rows, null, 2)
    });
  }

  files.unshift({
    name: 'manifest.json',
    data: JSON.stringify({
      app: 'Zen Caption AI',
      type: 'neon-postgres-backup',
      generatedAt,
      tables: tableSummaries
    }, null, 2)
  });

  files.push({
    name: 'README.txt',
    data: [
      'Zen Caption AI database backup',
      `Generated at: ${generatedAt}`,
      '',
      'This archive stores each table as clean JSON under /data.',
      'Import should validate table names and use transactions before writing to Neon SQL.'
    ].join('\n')
  });

  return {
    buffer: createZip(files),
    generatedAt,
    tableSummaries
  };
}

export function getBackupFileName(date = new Date()) {
  return `zen-caption-db-backup-${date.toISOString().replace(/[:.]/g, '-').slice(0, 19)}Z.zip`;
}
