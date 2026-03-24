import type { Story, Node, NodeId, OptionsOptionNode } from './types';

function getIndent(line: string): number {
  return line.match(/^( *)/)![1]!.length;
}

/**
 * @description LineReader that allows to iterate over the lines and and also peek into future lines
 */
class LineReader {
  private lines: string[];
  private pos = 0;

  constructor(lines: string[]) {
    this.lines = lines;
  }

  hasMore(): boolean {
    return this.pos < this.lines.length;
  }

  peek(): string {
    return this.lines[this.pos] ?? '';
  }

  advance(): string {
    return this.lines[this.pos++] ?? '';
  }

  trimmed(): string {
    return this.peek().trim();
  }

  indent(): number {
    return getIndent(this.peek());
  }

  skipEmpty(): void {
    while (this.hasMore() && this.trimmed() === '') this.advance();
  }
}

let idCounter = 0;
function generateId(): string {
  return `${idCounter++}`;
}

type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'command'; name: string; argument: string | null }
  | { kind: 'options'; entries: OptionEntry[] };

type OptionEntry = { text: string; nestedLines: string[] };

/**
 *
 * @param reader LineReader that iterates over the lines
 * @param baseIndent base indent where to start the process
 */
function tokenize(reader: LineReader, baseIndent: number): Segment[] {
  const segments: Segment[] = [];

  while (reader.hasMore()) {
    reader.skipEmpty();
    if (!reader.hasMore()) break;

    if (reader.indent() < baseIndent) break;
    if (reader.indent() > baseIndent) {
      reader.advance();
      continue;
    }

    const trimmed = reader.trimmed();

    if (trimmed.startsWith('>')) {
      segments.push(tokenizeOptions(reader, baseIndent));
    } else if (/^\[.+\]$/.test(trimmed)) {
      segments.push(tokenizeCommand(trimmed));
      reader.advance();
    } else {
      segments.push({ kind: 'text', text: trimmed });
      reader.advance();
    }
  }

  return segments;
}

function tokenizeCommand(trimmed: string): Segment {
  const inner = trimmed.slice(1, -1);
  const colonIdx = inner.indexOf(':');

  if (colonIdx !== -1) {
    return {
      kind: 'command',
      name: inner.slice(0, colonIdx),
      argument: inner.slice(colonIdx + 1),
    };
  }

  return { kind: 'command', name: inner, argument: null };
}

function tokenizeOptions(reader: LineReader, baseIndent: number): Segment {
  const entries: OptionEntry[] = [];

  while (reader.hasMore()) {
    if (reader.trimmed() === '') {
      reader.advance();
      continue;
    }

    if (reader.indent() < baseIndent) break;
    if (reader.indent() === baseIndent && !reader.trimmed().startsWith('>'))
      break;

    if (reader.indent() === baseIndent && reader.trimmed().startsWith('>')) {
      const text = reader.trimmed().slice(1).trim();
      reader.advance();

      const nestedLines: string[] = [];
      while (reader.hasMore()) {
        if (reader.trimmed() === '') {
          nestedLines.push(reader.advance());
          continue;
        }
        if (reader.indent() <= baseIndent) break;
        nestedLines.push(reader.advance());
      }

      entries.push({ text, nestedLines });
    } else {
      reader.advance();
    }
  }

  return { kind: 'options', entries };
}

function buildNodeGraph(
  segments: Segment[],
  nextAfter: NodeId | null,
  nodes: Map<NodeId, Node>,
): NodeId | null {
  if (segments.length === 0) return nextAfter;

  let currentNext = nextAfter;

  for (let i = segments.length - 1; i >= 0; i--) {
    currentNext = buildNode(segments[i]!, currentNext, nodes);
  }

  return currentNext;
}

function buildNode(
  seg: Segment,
  next: NodeId | null,
  nodes: Map<NodeId, Node>,
): NodeId {
  switch (seg.kind) {
    case 'text': {
      const id = generateId();
      nodes.set(id, { kind: 'text', id, text: seg.text, next });
      return id;
    }
    case 'command': {
      const id = generateId();
      nodes.set(id, {
        kind: 'command',
        id,
        name: seg.name,
        argument: seg.argument,
        next,
      });
      return id;
    }
    case 'options': {
      const id = generateId();
      const options: OptionsOptionNode[] = seg.entries.map((entry) => {
        const optId = generateId();
        const optNext = buildNestedOption(entry.nestedLines, next, nodes);
        return { id: optId, text: entry.text, next: optNext };
      });
      nodes.set(id, { kind: 'options', id, options });
      return id;
    }
  }
}

function buildNestedOption(
  nestedLines: string[],
  fallback: NodeId | null,
  nodes: Map<NodeId, Node>,
): NodeId | null {
  const firstNonEmpty = nestedLines.find((l) => l.trim() !== '');
  if (!firstNonEmpty) return fallback;

  const nestedIndent = getIndent(firstNonEmpty);
  const reader = new LineReader(nestedLines);
  const segments = tokenize(reader, nestedIndent);

  return buildNodeGraph(segments, fallback, nodes) ?? fallback;
}

function splitScenes(
  allLines: string[],
): { header: string[]; body: string[] }[] {
  const scenes: { header: string[]; body: string[] }[] = [];
  const reader = new LineReader(allLines);

  while (reader.hasMore()) {
    if (reader.trimmed() !== '---') {
      reader.advance();
      continue;
    }
    reader.advance();

    const header: string[] = [];
    while (reader.hasMore() && reader.trimmed() !== '---') {
      header.push(reader.advance());
    }
    if (reader.hasMore()) reader.advance();

    const body: string[] = [];
    while (reader.hasMore() && reader.trimmed() !== '===') {
      body.push(reader.advance());
    }
    if (reader.hasMore()) reader.advance();

    scenes.push({ header, body });
  }

  return scenes;
}

function parseName(headerLines: string[]): string {
  const nameLine = headerLines.find((l) => l.trim().startsWith('name:'));
  return nameLine ? nameLine.trim().replace(/^name:\s*/, '') : '';
}

export function parse(storyString: string): Story {
  idCounter = 0;

  return splitScenes(storyString.split('\n')).map(({ header, body }) => {
    const name = parseName(header);
    const nodes = new Map<NodeId, Node>();
    const segments = tokenize(new LineReader(body), 0);
    const startNodeId = buildNodeGraph(segments, null, nodes);
    return { name, startNodeId, nodes };
  });
}
