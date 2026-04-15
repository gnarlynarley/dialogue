export default function getIndent(line: string): number {
  return line.length - line.trimStart().length;
}
