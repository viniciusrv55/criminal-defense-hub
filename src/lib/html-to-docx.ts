import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

interface RunStyle { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean }

function inlineRuns(node: Node, style: RunStyle = {}): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text) return [];
    return [new TextRun({ text, ...style, underline: style.underline ? {} : undefined })];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const next: RunStyle = { ...style };
  if (tag === 'strong' || tag === 'b') next.bold = true;
  if (tag === 'em' || tag === 'i') next.italic = true;
  if (tag === 'u') next.underline = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') next.strike = true;
  if (tag === 'br') return [new TextRun({ break: 1 })];
  const out: TextRun[] = [];
  el.childNodes.forEach(child => out.push(...inlineRuns(child, next)));
  return out;
}

function blocks(el: HTMLElement): Paragraph[] {
  const result: Paragraph[] = [];
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = (node.textContent ?? '').trim();
      if (txt) result.push(new Paragraph({ children: [new TextRun(txt)] }));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const child = node as HTMLElement;
    const tag = child.tagName.toLowerCase();
    switch (tag) {
      case 'h1':
        result.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: inlineRuns(child) }));
        break;
      case 'h2':
        result.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: inlineRuns(child) }));
        break;
      case 'h3':
        result.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: inlineRuns(child) }));
        break;
      case 'blockquote':
        result.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { left: 720 }, children: inlineRuns(child) }));
        break;
      case 'ul':
      case 'ol':
        child.querySelectorAll(':scope > li').forEach(li => {
          result.push(new Paragraph({
            bullet: tag === 'ul' ? { level: 0 } : undefined,
            numbering: tag === 'ol' ? { reference: 'numbered', level: 0 } : undefined,
            children: inlineRuns(li as HTMLElement),
          }));
        });
        break;
      case 'p':
        result.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: inlineRuns(child) }));
        break;
      default:
        result.push(new Paragraph({ children: inlineRuns(child) }));
    }
  });
  return result;
}

/** Converts HTML string into a downloadable DOCX Blob. */
export async function htmlToDocxBlob(html: string, title = 'Documento'): Promise<Blob> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  const children = blocks(root);

  const document = new Document({
    creator: 'Lindomberto Moraes',
    title,
    numbering: {
      config: [{
        reference: 'numbered',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      }],
    },
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });

  return await Packer.toBlob(document);
}
