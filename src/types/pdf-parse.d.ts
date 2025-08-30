declare module 'pdf-parse' {
  interface PDFParseOptions {
    pagerender?: any;
    max?: number;
    version?: string;
  }

  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }

  function pdfParse(data: Buffer, options?: PDFParseOptions): Promise<PDFParseResult>;
  
  export = pdfParse;
}
