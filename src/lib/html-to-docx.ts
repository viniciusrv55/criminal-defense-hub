import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  ExternalHyperlink, ImageRun,
} from 'docx';

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  size?: number; // half-points
  font?: string;
}

function alignFromStyle(el: HTMLElement): typeof AlignmentType[keyof typeof AlignmentType] | undefined {
  const ta = el.style?.textAlign;
  if (ta === 'center') return AlignmentType.CENTER;
  if (ta === 'right') return AlignmentType.RIGHT;
  if (ta === 'justify') return AlignmentType.JUSTIFIED;
  if (ta === 'left') return AlignmentType.LEFT;
  return undefined;
}

function parsePxToHalfPoints(px: string | undefined): number | undefined {
  if (!px) return undefined;
  const m = px.match(/([\d.]+)\s*px/);
  if (!m) return undefined;
  // 1px ≈ 0.75pt; half-points = pt*2
  return Math.round(parseFloat(m[1]) * 0.75 * 2);
}

function normalizeColor(c?: string): string | undefined {
  if (!c) return undefined;
  c = c.trim();
  if (c.startsWith('#')) return c.slice(1).toUpperCase();
  const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (m) return [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
}

function styleFromElement(el: HTMLElement, base: RunStyle): RunStyle {
  const out = { ...base };
  const s = el.style;
  if (s) {
    const c = normalizeColor(s.color);
    if (c) out.color = c;
    const fs = parsePxToHalfPoints(s.fontSize);
    if (fs) out.size = fs;
    const ff = s.fontFamily?.replace(/['"]/g, '').split(',')[0].trim();
    if (ff) out.font = ff;
    if (s.fontWeight === 'bold' || parseInt(s.fontWeight || '0') >= 600) out.bold = true;
    if (s.fontStyle === 'italic') out.italics = true;
    if (s.textDecoration?.includes('underline')) out.underline = true;
    if (s.textDecoration?.includes('line-through')) out.strike = true;
  }
  return out;
}

function inlineRuns(node: Node, style: RunStyle = {}): (TextRun | ExternalHyperlink)[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text) return [];
    return [new TextRun({
      text,
      bold: style.bold,
      italics: style.italics,
      underline: style.underline ? {} : undefined,
      strike: style.strike,
      color: style.color,
      size: style.size,
      font: style.font,
    })];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  let next: RunStyle = { ...style };
  if (tag === 'strong' || tag === 'b') next.bold = true;
  if (tag === 'em' || tag === 'i') next.italics = true;
  if (tag === 'u') next.underline = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') next.strike = true;
  if (tag === 'br') return [new TextRun({ break: 1 })];
  next = styleFromElement(el, next);

  if (tag === 'a') {
    const href = el.getAttribute('href') || '';
    const childRuns = Array.from(el.childNodes).flatMap(c => inlineRuns(c, { ...next, color: next.color || '0563C1', underline: true })) as TextRun[];
    return [new ExternalHyperlink({ link: href, children: childRuns })];
  }

  const out: (TextRun | ExternalHyperlink)[] = [];
  el.childNodes.forEach(child => out.push(...inlineRuns(child, next)));
  return out;
}

function paragraphFromElement(el: HTMLElement, opts: { heading?: typeof HeadingLevel[keyof typeof HeadingLevel]; defaultAlign?: typeof AlignmentType[keyof typeof AlignmentType]; bullet?: { level: number }; numbering?: { reference: string; level: number }; indentLeft?: number } = {}): Paragraph {
  const align = alignFromStyle(el) ?? opts.defaultAlign;
  return new Paragraph({
    heading: opts.heading,
    alignment: align,
    bullet: opts.bullet,
    numbering: opts.numbering,
    indent: opts.indentLeft ? { left: opts.indentLeft } : undefined,
    children: inlineRuns(el) as TextRun[],
  });
}

function tableFromElement(el: HTMLTableElement): Table {
  const rowsEls = Array.from(el.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr'));
  const colCount = Math.max(1, ...rowsEls.map(r => r.querySelectorAll(':scope > td, :scope > th').length));
  const totalWidth = 9360;
  const colWidth = Math.floor(totalWidth / colCount);
  const columnWidths = Array(colCount).fill(colWidth);
  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
  const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

  const rows: TableRow[] = rowsEls.map(rowEl => {
    const cellsEls = Array.from(rowEl.querySelectorAll(':scope > td, :scope > th'));
    const cells = cellsEls.map(cellEl => {
      const isHeader = cellEl.tagName.toLowerCase() === 'th';
      return new TableCell({
        width: { size: colWidth, type: WidthType.DXA },
        borders,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        shading: isHeader ? { fill: 'EEEEEE', type: ShadingType.CLEAR, color: 'auto' } : undefined,
        children: blocks(cellEl as HTMLElement, { defaultAlign: alignFromStyle(cellEl as HTMLElement) }),
      });
    });
    return new TableRow({ children: cells, tableHeader: rowEl.parentElement?.tagName.toLowerCase() === 'thead' });
  });

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    rows,
  });
}

function blocks(el: HTMLElement, ctx: { defaultAlign?: typeof AlignmentType[keyof typeof AlignmentType] } = {}): (Paragraph | Table)[] {
  const result: (Paragraph | Table)[] = [];
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = (node.textContent ?? '').trim();
      if (txt) result.push(new Paragraph({ alignment: ctx.defaultAlign, children: [new TextRun(txt)] }));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const child = node as HTMLElement;
    const tag = child.tagName.toLowerCase();
    switch (tag) {
      case 'h1': result.push(paragraphFromElement(child, { heading: HeadingLevel.HEADING_1, defaultAlign: ctx.defaultAlign })); break;
      case 'h2': result.push(paragraphFromElement(child, { heading: HeadingLevel.HEADING_2, defaultAlign: ctx.defaultAlign })); break;
      case 'h3': result.push(paragraphFromElement(child, { heading: HeadingLevel.HEADING_3, defaultAlign: ctx.defaultAlign })); break;
      case 'h4': result.push(paragraphFromElement(child, { heading: HeadingLevel.HEADING_4, defaultAlign: ctx.defaultAlign })); break;
      case 'blockquote':
        result.push(paragraphFromElement(child, { defaultAlign: ctx.defaultAlign ?? AlignmentType.JUSTIFIED, indentLeft: 720 }));
        break;
      case 'ul':
      case 'ol': {
        const items = Array.from(child.querySelectorAll(':scope > li')) as HTMLElement[];
        items.forEach(li => {
          result.push(new Paragraph({
            alignment: alignFromStyle(li) ?? ctx.defaultAlign,
            bullet: tag === 'ul' ? { level: 0 } : undefined,
            numbering: tag === 'ol' ? { reference: 'numbered', level: 0 } : undefined,
            children: inlineRuns(li) as TextRun[],
          }));
        });
        break;
      }
      case 'table':
        result.push(tableFromElement(child as HTMLTableElement));
        break;
      case 'hr':
        result.push(new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } },
          children: [],
        }));
        break;
      case 'p':
        result.push(paragraphFromElement(child, { defaultAlign: ctx.defaultAlign ?? AlignmentType.JUSTIFIED }));
        break;
      case 'div':
        // recurse into divs
        result.push(...blocks(child, ctx));
        break;
      default:
        result.push(paragraphFromElement(child, { defaultAlign: ctx.defaultAlign }));
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
        levels: [{
          level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
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
