import { extname } from 'node:path';

export type FileVerdict = { kind: 'accepted' } | { kind: 'refused'; reason: string };

export class UploadRefusedError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'UploadRefusedError';
    this.status = status;
    this.code = code;
  }
}

interface Signature {
  readonly format: string;
  readonly offset: number;
  readonly bytes: Buffer;
}

const EXECUTABLE_FORMAT = 'executable';

function signature(format: string, offset: number, bytes: number[]): Signature {
  return { format, offset, bytes: Buffer.from(bytes) };
}

function textSignature(format: string, offset: number, text: string): Signature {
  return { format, offset, bytes: Buffer.from(text, 'latin1') };
}

const SIGNATURES: readonly Signature[] = [
  signature('png', 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  signature('jpeg', 0, [0xff, 0xd8, 0xff]),
  textSignature('gif', 0, 'GIF87a'),
  textSignature('gif', 0, 'GIF89a'),
  textSignature('riff', 0, 'RIFF'),
  textSignature('isobmff', 4, 'ftyp'),
  signature('matroska', 0, [0x1a, 0x45, 0xdf, 0xa3]),
  signature('ico', 0, [0x00, 0x00, 0x01, 0x00]),
  textSignature('mp3', 0, 'ID3'),
  signature('mp3', 0, [0xff, 0xfb]),
  signature('mp3', 0, [0xff, 0xf3]),
  signature('mp3', 0, [0xff, 0xf2]),
  signature('mp3', 0, [0xff, 0xfa]),
  textSignature('woff', 0, 'wOFF'),
  textSignature('woff2', 0, 'wOF2'),
  signature('ttf', 0, [0x00, 0x01, 0x00, 0x00]),
  textSignature('otf', 0, 'OTTO'),
  textSignature('pdf', 0, '%PDF-'),
  signature('zip', 0, [0x50, 0x4b, 0x03, 0x04]),
  signature('compound', 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  signature(EXECUTABLE_FORMAT, 0, [0x4d, 0x5a]),
  signature(EXECUTABLE_FORMAT, 0, [0x7f, 0x45, 0x4c, 0x46]),
  signature(EXECUTABLE_FORMAT, 0, [0xcf, 0xfa, 0xed, 0xfe]),
  signature(EXECUTABLE_FORMAT, 0, [0xce, 0xfa, 0xed, 0xfe]),
  signature(EXECUTABLE_FORMAT, 0, [0xfe, 0xed, 0xfa, 0xcf]),
  signature(EXECUTABLE_FORMAT, 0, [0xfe, 0xed, 0xfa, 0xce]),
  signature(EXECUTABLE_FORMAT, 0, [0xca, 0xfe, 0xba, 0xbe]),
];

interface ExtensionPolicy {
  readonly formats: readonly string[];
  readonly allowUnsigned: boolean;
}

function requires(...formats: string[]): ExtensionPolicy {
  return { formats, allowUnsigned: false };
}

function permits(...formats: string[]): ExtensionPolicy {
  return { formats, allowUnsigned: true };
}

const EXTENSION_POLICIES: Partial<Record<string, ExtensionPolicy>> = {
  '.png': requires('png'),
  '.jpg': requires('jpeg'),
  '.jpeg': requires('jpeg'),
  '.gif': requires('gif'),
  '.webp': requires('riff'),
  '.avif': requires('isobmff'),
  '.ico': requires('ico'),
  '.mp4': requires('isobmff'),
  '.mov': requires('isobmff'),
  '.webm': requires('matroska'),
  '.mp3': requires('mp3'),
  '.wav': requires('riff'),
  '.woff': requires('woff'),
  '.woff2': requires('woff2'),
  '.ttf': requires('ttf', 'otf'),
  '.eot': permits(),
  '.pdf': requires('pdf'),
  '.docx': requires('zip'),
  '.xlsx': requires('zip'),
  '.pptx': requires('zip'),
  '.doc': permits('compound', 'zip'),
  '.xls': permits('compound', 'zip'),
  '.ppt': permits('compound', 'zip'),
  '.svg': permits(),
  '.css': permits(),
  '.txt': permits(),
  '.md': permits(),
  '.csv': permits(),
  '.json': permits(),
};

const OOXML_MACRO_PART = 'vbaProject.bin';
const COMPOUND_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const COMPOUND_MACRO_STREAM = Buffer.from('_VBA_PROJECT', 'utf16le');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_LENGTH = 22;
const CENTRAL_FILE_LENGTH = 46;
const MAXIMUM_COMMENT_LENGTH = 0xffff;
const ZIP64_MARKER = 0xffffffff;
const ENCRYPTED_FLAG = 0x0001;

const ACCEPTED: FileVerdict = { kind: 'accepted' };

interface Unreadable {
  kind: 'unreadable';
  reason: string;
}

type LocatedOffset = { kind: 'offset'; offset: number } | Unreadable;

type ArchiveNames = { kind: 'names'; names: string[] } | Unreadable;

function detectFormat(content: Buffer): string | undefined {
  for (const candidate of SIGNATURES) {
    const start = candidate.offset;
    const end = start + candidate.bytes.length;
    if (end <= content.length && content.subarray(start, end).equals(candidate.bytes)) {
      return candidate.format;
    }
  }
  return undefined;
}

function endOfCentralDirectoryOffset(archive: Buffer): LocatedOffset {
  if (archive.length < END_OF_CENTRAL_DIRECTORY_LENGTH) {
    return {
      kind: 'unreadable',
      reason: 'not a zip archive: too short for an end-of-central-directory record',
    };
  }
  const earliest = Math.max(
    0,
    archive.length - END_OF_CENTRAL_DIRECTORY_LENGTH - MAXIMUM_COMMENT_LENGTH
  );
  let offset = archive.length - END_OF_CENTRAL_DIRECTORY_LENGTH;
  while (offset >= earliest) {
    if (archive.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return { kind: 'offset', offset };
    }
    offset -= 1;
  }
  return { kind: 'unreadable', reason: 'not a zip archive: no end-of-central-directory record' };
}

function archiveEntryNames(archive: Buffer): ArchiveNames {
  const located = endOfCentralDirectoryOffset(archive);
  if (located.kind === 'unreadable') {
    return located;
  }
  const entryCount = archive.readUInt16LE(located.offset + 10);
  let offset = archive.readUInt32LE(located.offset + 16);
  const names: string[] = [];
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (
      offset + CENTRAL_FILE_LENGTH > archive.length ||
      archive.readUInt32LE(offset) !== CENTRAL_FILE_SIGNATURE
    ) {
      return { kind: 'unreadable', reason: 'corrupt zip archive: central directory ends early' };
    }
    if ((archive.readUInt16LE(offset + 8) & ENCRYPTED_FLAG) !== 0) {
      return { kind: 'unreadable', reason: 'unsupported zip archive: entries are encrypted' };
    }
    if (
      archive.readUInt32LE(offset + 20) === ZIP64_MARKER ||
      archive.readUInt32LE(offset + 42) === ZIP64_MARKER
    ) {
      return { kind: 'unreadable', reason: 'unsupported zip archive: zip64 entries' };
    }
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const nameStart = offset + CENTRAL_FILE_LENGTH;
    if (nameStart + nameLength > archive.length) {
      return { kind: 'unreadable', reason: 'corrupt zip archive: entry name ends early' };
    }
    names.push(archive.subarray(nameStart, nameStart + nameLength).toString('utf8'));
    offset = nameStart + nameLength + extraLength + commentLength;
  }
  return { kind: 'names', names };
}

function archiveMacroVerdict(content: Buffer): FileVerdict {
  const names = archiveEntryNames(content);
  if (names.kind === 'unreadable') {
    return { kind: 'refused', reason: `archive cannot be inspected: ${names.reason}` };
  }
  for (const name of names.names) {
    if (name.endsWith(OOXML_MACRO_PART)) {
      return { kind: 'refused', reason: `archive carries the macro part ${name}` };
    }
  }
  return ACCEPTED;
}

function macroVerdict(content: Buffer): FileVerdict {
  if (content.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) {
    return archiveMacroVerdict(content);
  }
  const compound = content.subarray(0, COMPOUND_MAGIC.length).equals(COMPOUND_MAGIC);
  if (compound && content.includes(COMPOUND_MACRO_STREAM)) {
    return { kind: 'refused', reason: 'compound document carries a VBA project stream' };
  }
  return ACCEPTED;
}

function formatVerdict(extension: string, detected: string | undefined): FileVerdict {
  const policy = EXTENSION_POLICIES[extension];
  if (policy === undefined) {
    return ACCEPTED;
  }
  if (detected === undefined) {
    return policy.allowUnsigned
      ? ACCEPTED
      : { kind: 'refused', reason: `${extension} carries no recognizable signature` };
  }
  if (policy.formats.includes(detected)) {
    return ACCEPTED;
  }
  return { kind: 'refused', reason: `${extension} carries ${detected} content` };
}

export function inspectUploadedFile(fileName: string, content: Buffer): FileVerdict {
  const detected = detectFormat(content);
  if (detected === EXECUTABLE_FORMAT) {
    return { kind: 'refused', reason: 'executable content' };
  }
  const macro = macroVerdict(content);
  if (macro.kind === 'refused') {
    return macro;
  }
  return formatVerdict(extname(fileName).toLowerCase(), detected);
}
