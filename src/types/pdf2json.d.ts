declare module 'pdf2json' {
  export class PDFParser {
    constructor(streaming?: boolean);
    
    on(event: string, callback: (data: any) => void): void;
    parseBuffer(buffer: Buffer): void;
    loadPDF(pdfFilePath: string): void;
    getRawTextContent(): string;
  }
}
