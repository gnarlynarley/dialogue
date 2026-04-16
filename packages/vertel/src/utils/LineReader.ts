import getIndent from './getIndent';

/**
 * @description LineReader that allows to iterate over the lines and and also peek into future lines
 */
export default class LineReader {
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

  peekTrimmed(): string {
    return this.peek().trim();
  }

  peekIsEmpty(): boolean {
    return this.peekTrimmed() === ''
  }

  advance(): string {
    return this.lines[this.pos++] ?? '';
  }

  indent(): number {
    return getIndent(this.peek());
  }

  skipEmpty(): void {
    while (this.hasMore() && this.peekIsEmpty()) this.advance();
  }
}
