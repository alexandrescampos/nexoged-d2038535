import { invokeEdgeFunction } from "@/lib/invokeEdge";

/**
 * Utilitário para otimização de documentos antes do upload.
 * Suporta compressão de imagens no cliente para reduzir tráfego de rede e custo de storage.
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
   * Envia o documento para processamento via Edge Function (ZIP/Optimization no servidor).
   * No futuro, esta função chamará uma Edge Function para compressão GZIP ou Brotli
   * de documentos PDF e textos antes do armazenamento final.
   */
  async optimizeDocument(file: File): Promise<Blob | File> {
    // Se for imagem, faz compressão local imediata
    if (file.type.startsWith('image/')) {
      try {
        const compressed = await this.compressImage(file);
        // Retorna o blob como um novo arquivo mantendo o nome
        return new File([compressed], file.name, { type: 'image/jpeg' });
      } catch (e) {
        console.warn("Falha na compressão local, seguindo com arquivo original", e);
        return file;
      }
    }

    // Para PDFs e outros, retornamos o original por enquanto.
    // Em produção, aqui integraríamos com uma Edge Function que usa bibliotecas de PDF
    // para reduzir o tamanho (removendo metadados redundantes, etc).
    return file;
  }
};
