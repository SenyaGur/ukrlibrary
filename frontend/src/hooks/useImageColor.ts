import { useState, useEffect } from 'react';

// Extract dominant color from an image using canvas
const extractDominantColor = (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Sample a small area for performance
        const sampleSize = 50;
        canvas.width = sampleSize;
        canvas.height = sampleSize;

        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imageData.data;

        // Calculate average color
        let r = 0, g = 0, b = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          // Skip very light pixels (likely background)
          if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) continue;
          // Skip very dark pixels
          if (data[i] < 15 && data[i + 1] < 15 && data[i + 2] < 15) continue;
          
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }

        if (count === 0) {
          // Fallback if all pixels were filtered
          resolve('#6B7280');
          return;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Slightly saturate and darken the color for better visual appeal
        const factor = 0.85;
        r = Math.round(r * factor);
        g = Math.round(g * factor);
        b = Math.round(b * factor);

        const hex = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
        resolve(hex);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
};

export const useImageColor = (imageUrl: string | null | undefined, fallbackColor: string) => {
  const [color, setColor] = useState<string>(fallbackColor);
  const [isLoading, setIsLoading] = useState<boolean>(!!imageUrl);

  useEffect(() => {
    if (!imageUrl) {
      setColor(fallbackColor);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    extractDominantColor(imageUrl)
      .then((dominantColor) => {
        setColor(dominantColor);
      })
      .catch((error) => {
        console.warn('Failed to extract color from image:', error);
        setColor(fallbackColor);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [imageUrl, fallbackColor]);

  return { color, isLoading };
};
