import type { PercentCrop } from "react-image-crop";

interface CropDownloadOptions {
  imageSrc: string;
  crop: PercentCrop;
  naturalWidth: number;
  naturalHeight: number;
  fileName: string;
  mimeType: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function downloadCrop({
  imageSrc,
  crop,
  naturalWidth,
  naturalHeight,
  fileName,
  mimeType,
}: CropDownloadOptions): Promise<void> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  const srcX = Math.round((crop.x / 100) * naturalWidth);
  const srcY = Math.round((crop.y / 100) * naturalHeight);
  const srcW = Math.round((crop.width / 100) * naturalWidth);
  const srcH = Math.round((crop.height / 100) * naturalHeight);

  canvas.width = srcW;
  canvas.height = srcH;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  const lastDotIndex = fileName.lastIndexOf(".");
  const nameWithoutExt =
    lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
  const originalExtension =
    lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : "";

  return new Promise<void>((resolve) => {
    canvas.toBlob(
      (blob: Blob | null) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${nameWithoutExt}-crop${originalExtension}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
        resolve();
      },
      mimeType,
      1.0,
    );
  });
}
