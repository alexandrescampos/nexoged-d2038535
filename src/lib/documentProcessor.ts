import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';



/**
 * Utilitário para otimização de documentos antes do upload.
 * Suporta compressão de imagens e PDFs no cliente para reduzir tráfego de rede e custo de storage.
 */
export const documentProcessor = {
  /**
   * Comprime uma imagem preservando a qualidade visual.
   * Útil para fotos de documentos, comprovantes, etc.
   */
  async compressImage(file: File, quality: number = 0.7): Promise<Blob> {
    if (!file.type.startsWith('image/')) return file;
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Limita dimensões máximas para evitar arquivos gigantes
        const MAX_WIDTH = 2500;
        const MAX_HEIGHT = 2500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Erro na compressão da imagem"));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
    });
  },

  /**
   * Comprime um arquivo PDF usando pdf-lib.
   * Tenta otimizar o documento sem remover metadados essenciais ou prejudicar texto.
   */
  async compressPdf(file: File): Promise<Blob> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      // A otimização básica do pdf-lib ao salvar com object streams
      // já pode reduzir significativamente o tamanho de alguns PDFs
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });
      
      return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (error) {
      console.error("Erro ao comprimir PDF:", error);
      return file;
    }
  },

  /**
   * Envia o documento para processamento (ZIP/Optimization no cliente).
   */
  async optimizeDocument(file: File): Promise<Blob | File> {
    // Se for imagem, faz compressão local imediata
    if (file.type.startsWith('image/')) {
      try {
        const compressed = await this.compressImage(file);
        return new File([compressed], file.name, { type: 'image/jpeg' });
      } catch (e) {
        console.warn("Falha na compressão local da imagem, seguindo com arquivo original", e);
        return file;
      }
    }

    // Se for PDF, tenta compressão estrutural
    if (file.type === 'application/pdf') {
      try {
        const compressed = await this.compressPdf(file);
        // Só substitui se for realmente menor
        if (compressed.size < file.size) {
          console.log(`PDF comprimido: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressed.size / 1024 / 1024).toFixed(2)}MB`);
          return new File([compressed], file.name, { type: 'application/pdf' });
        }
        return file;
      } catch (e) {
        console.warn("Falha na compressão do PDF, seguindo com arquivo original", e);
        return file;
      }
    }

    return file;
  },

  /**
   * Calcula o número de páginas ou abas de um arquivo.
   * Suporta PDF (páginas), Imagens (1 página), Planilhas (número de abas), Word/Outros (mínimo 1).
   */
  async countPages(file: File): Promise<number> {
    const type = file.type.toLowerCase();
    const ext = file.name.split('.').pop()?.toLowerCase();

    // PDF: Conta páginas reais
    if (type === 'application/pdf' || ext === 'pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        return pdfDoc.getPageCount();
      } catch (e) {
        console.warn("Falha ao contar páginas do PDF:", e);
        return 1;
      }
    }

    // Imagens: Sempre 1 página
    if (type.startsWith('image/')) {
      return 1;
    }

    // Planilhas: Conta número de planilhas (sheets)
    const spreadsheetTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (spreadsheetTypes.includes(type) || ['xlsx', 'xls', 'csv'].includes(ext || '')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array', bookSheets: true });
        return workbook.SheetNames.length || 1;
      } catch (e) {
        console.warn("Falha ao contar abas da planilha:", e);
        return 1;
      }
    }

    // Word: Tenta extrair contagem de páginas do docProps/app.xml
    if (type.includes('word') || ['docx', 'docm'].includes(ext || '')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const appXml = await zip.file("docProps/app.xml")?.async("string");
        
        if (appXml) {
          const match = appXml.match(/<Pages>(\d+)<\/Pages>/);
          if (match && match[1]) {
            return parseInt(match[1], 10) || 1;
          }
        }
      } catch (e) {
        console.warn("Falha ao contar páginas do Word:", e);
      }
    }

    // Outros tipos (XML, TXT, etc): Mínimo 1
    return 1;

  }
};
