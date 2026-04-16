import type { Story, Node, NodeId, OptionsOptionNode } from './types';
import GenerateId from './utils/GenerateId';
import getIndent from './utils/getIndent';
import LineReader from './utils/LineReader';

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
function createSegments(reader: LineReader, baseIndent: number): Segment[] {
  const segments: Segment[] = [];

  while (reader.hasMore()) {
    reader.skipEmpty();
    if (!reader.hasMore()) break;

    if (reader.indent() < baseIndent) break;
    if (reader.indent() > baseIndent) {
      reader.advance();
      continue;
    }

    const trimmed = reader.peekTrimmed();

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
    if (reader.peekTrimmed() === '') {
      reader.advance();
      continue;
    }

    if (reader.indent() < baseIndent) break;
    if (reader.indent() === baseIndent && !reader.peekTrimmed().startsWith('>'))
      break;

    if (reader.indent() === baseIndent && reader.peekTrimmed().startsWith('>')) {
      const text = reader.peekTrimmed().slice(1).trim();
      reader.advance();

      const nestedLines: string[] = [];
      while (reader.hasMore()) {
        if (reader.peekTrimmed() === '') {
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
  generateId: GenerateId,
): NodeId | null {
  if (segments.length === 0) return nextAfter;

  let currentNext = nextAfter;

  for (let i = segments.length - 1; i >= 0; i--) {
    currentNext = buildNode(segments[i]!, currentNext, nodes, generateId);
  }

  return currentNext;
}

function buildNode(
  seg: Segment,
  next: NodeId | null,
  nodes: Map<NodeId, Node>,
  generateId: GenerateId,
): NodeId {
  switch (seg.kind) {
    case 'text': {
      const id = generateId.create();
      nodes.set(id, { kind: 'text', id, text: seg.text, next });
      return id;
    }
    case 'command': {
      const id = generateId.create();
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
      const id = generateId.create();
      const options: OptionsOptionNode[] = seg.entries.map((entry) => {
        const optId = generateId.create();
        const optNext = buildNestedOption(
          entry.nestedLines,
          next,
          nodes,
          generateId,
        );
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
  generateId: GenerateId,
): NodeId | null {
  const firstNonEmpty = nestedLines.find((l) => l.trim() !== '');
  if (!firstNonEmpty) return fallback;

  const nestedIndent = getIndent(firstNonEmpty);
  const reader = new LineReader(nestedLines);
  const segments = createSegments(reader, nestedIndent);

  return buildNodeGraph(segments, fallback, nodes, generateId) ?? fallback;
}

function splitScenes(
  allLines: string[],
): { header: string[]; body: string[] }[] {
  const scenes: { header: string[]; body: string[] }[] = [];
  const reader = new LineReader(allLines);

  while (reader.hasMore()) {
    if (reader.peekTrimmed() !== '---') {
      reader.advance();
      continue;
    }
    reader.advance();

    const header: string[] = [];
    while (reader.hasMore() && reader.peekTrimmed() !== '---') {
      header.push(reader.advance());
    }
    if (reader.hasMore()) reader.advance();

    const body: string[] = [];
    while (reader.hasMore() && reader.peekTrimmed() !== '===') {
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
  const generateId = new GenerateId();

  return splitScenes(storyString.split('\n')).map(({ header, body }) => {
    const name = parseName(header);
    const nodes = new Map<NodeId, Node>();
    const segments = createSegments(new LineReader(body), 0);
    const startNodeId = buildNodeGraph(segments, null, nodes, generateId);

    return { name, startNodeId, nodes };
  });
}
