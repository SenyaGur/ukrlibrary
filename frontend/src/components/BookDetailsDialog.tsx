import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, BookOpen, X, ZoomIn } from "lucide-react";
import { booksApi, rentalsApi, resolveUrl } from "@/lib/api";

interface BookMedia {
  id: string;
  file_url: string;
  file_type: string;
  display_order: number;
}

interface BookDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookDescription?: string | null;
  bookAge?: string | null;
  bookPublisher?: string | null;
  bookPublisherCity?: string | null;
  bookPublicationYear?: string | null;
  bookSeries?: string | null;
  bookCategory?: string | null;
  coverColor: string;
  coverImageUrl?: string | null;
  available: boolean;
  onRent: () => void;
}

const getMinWidth = () => Math.max(400, window.innerWidth * 0.5);
const MAX_WIDTH = 1200;
const DEFAULT_WIDTH = () => Math.max(672, window.innerWidth * 0.5);

const BookDetailsDialog = ({
  open,
  onOpenChange,
  bookId,
  bookTitle,
  bookAuthor,
  bookDescription,
  bookAge,
  bookPublisher,
  bookPublisherCity,
  bookPublicationYear,
  bookSeries,
  bookCategory,
  coverColor,
  coverImageUrl,
  available,
  onRent,
}: BookDetailsDialogProps) => {
  const [media, setMedia] = useState<BookMedia[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dialogWidth, setDialogWidth] = useState(() => DEFAULT_WIDTH());
  const [isResizing, setIsResizing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Build images array: cover image first, then additional media (resolve relative URLs)
  const allImages = [
    ...(coverImageUrl ? [{ id: 'cover', file_url: resolveUrl(coverImageUrl) || '', file_type: 'image', display_order: -1 }] : []),
    ...media.filter(m => m.file_type.startsWith('image')).map(m => ({ ...m, file_url: resolveUrl(m.file_url) || '' })),
  ];

  useEffect(() => {
    if (open && bookId) {
      fetchMedia();
      setCurrentImageIndex(0);
      if (!available) {
        rentalsApi.getQueue(bookId).then(entries => setQueueLength(entries.length)).catch(() => setQueueLength(0));
      } else {
        setQueueLength(0);
      }
    }
  }, [open, bookId, available]);

  // Calculate optimal width based on widest image
  useEffect(() => {
    if (!open || allImages.length === 0) return;

    const calculateOptimalWidth = async () => {
      const imageWidths = await Promise.all(
        allImages.map((img) => {
          return new Promise<number>((resolve) => {
            const image = new Image();
            image.onload = () => {
              // Calculate width needed for image with padding
              const aspectRatio = image.width / image.height;
              // Target height is ~60% of viewport height
              const targetHeight = window.innerHeight * 0.5;
              const calculatedWidth = targetHeight * aspectRatio + 48; // 48px for padding
              resolve(Math.min(MAX_WIDTH, Math.max(getMinWidth(), calculatedWidth)));
            };
            image.onerror = () => resolve(DEFAULT_WIDTH());
            image.src = img.file_url;
          });
        })
      );

      const maxWidth = Math.max(...imageWidths, getMinWidth());
      setDialogWidth(Math.min(maxWidth, MAX_WIDTH));
    };

    calculateOptimalWidth();
  }, [open, allImages.length]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const data = await booksApi.getMedia(bookId);
      setMedia(data);
    } catch (error) {
      console.error("Помилка завантаження медіа:", error);
    }
    setLoading(false);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const getGradient = (color: string) => {
    const adjustColor = (col: string, amount: number) => {
      const hex = col.replace('#', '');
      const num = parseInt(hex, 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + amount));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
      const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
      return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    };
    const lighterColor = adjustColor(color, 40);
    const darkerColor = adjustColor(color, -50);
    return `linear-gradient(135deg, ${lighterColor} 0%, ${color} 50%, ${darkerColor} 100%)`;
  };

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = dialogWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = side === 'right' ? e.clientX - startX : startX - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(getMinWidth(), startWidth + delta * 2)); // *2 because dialog is centered
      setDialogWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dialogWidth]);

  const handleDialogOpenChange = (open: boolean) => {
    // Don't close dialog if lightbox is open (user is just closing lightbox)
    if (!open && lightboxOpen) {
      return;
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        ref={dialogRef}
        className="flex flex-col p-0 gap-0 overflow-hidden"
        style={{
          width: `${dialogWidth}px`,
          maxWidth: '95vw',
          maxHeight: '90vh',
          transition: isResizing ? 'none' : 'width 0.2s ease-out'
        }}
        aria-describedby={undefined}
      >
        {/* Left resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity group z-10"
          onMouseDown={(e) => handleMouseDown(e, 'left')}
        >
          <div className="w-1 h-16 bg-muted-foreground/30 rounded-full group-hover:bg-primary/50 transition-colors" />
        </div>

        {/* Right resize handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity group z-10"
          onMouseDown={(e) => handleMouseDown(e, 'right')}
        >
          <div className="w-1 h-16 bg-muted-foreground/30 rounded-full group-hover:bg-primary/50 transition-colors" />
        </div>

        {/* Fixed Header */}
        <div className="flex-shrink-0 p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold pr-8">{bookTitle}</DialogTitle>
          </DialogHeader>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
          {/* Image gallery */}
          <div
            className="relative rounded-xl overflow-hidden flex items-center justify-center py-6"
            style={{
              background: getGradient(coverColor),
              minHeight: '280px',
              maxHeight: '55vh'
            }}
          >
            {allImages.length > 0 ? (
              <>
                <div
                  className="relative cursor-zoom-in group"
                  onClick={() => setLightboxOpen(true)}
                >
                  <img
                    src={allImages[currentImageIndex].file_url}
                    alt={`${bookTitle} - зображення ${currentImageIndex + 1}`}
                    className="max-w-[95%] max-h-[45vh] object-contain rounded-lg shadow-lg"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg">
                    <ZoomIn className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                </div>

                {/* Navigation arrows */}
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); prevImage(); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); nextImage(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Image counter */}
                {allImages.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} / {allImages.length}
                  </div>
                )}
              </>
            ) : (
              <BookOpen className="w-20 h-20 text-white/30" />
            )}
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {allImages.map((img, index) => (
                <button
                  key={img.id}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    index === currentImageIndex ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img
                    src={img.file_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Book info */}
          <div className="space-y-4">
            <div>
              <p className="text-lg text-muted-foreground">{bookAuthor}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className={available ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}>
                {available ? "Доступна" : "Орендована"}
              </Badge>
              {bookCategory && (
                <Badge variant="outline">{bookCategory}</Badge>
              )}
              {bookAge && (
                <Badge variant="secondary">{bookAge}</Badge>
              )}
            </div>

            {/* Book details grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {bookPublisher && (
                <div>
                  <span className="text-muted-foreground">Видавництво:</span>
                  <p className="font-medium">{bookPublisher}{bookPublisherCity && `, ${bookPublisherCity}`}</p>
                </div>
              )}
              {bookPublicationYear && (
                <div>
                  <span className="text-muted-foreground">Рік видання:</span>
                  <p className="font-medium">{bookPublicationYear}</p>
                </div>
              )}
              {bookSeries && (
                <div>
                  <span className="text-muted-foreground">Серія:</span>
                  <p className="font-medium">{bookSeries}</p>
                </div>
              )}
            </div>

            {bookDescription && (
              <div className="pt-2 border-t">
                <h4 className="font-semibold mb-2">Опис</h4>
                <p className="text-muted-foreground leading-relaxed">{bookDescription}</p>
              </div>
            )}
          </div>

          {/* Rent / Reserve button */}
          <div className="space-y-2">
            <Button
              onClick={() => {
                onOpenChange(false);
                onRent();
              }}
              className="w-full"
              size="lg"
              variant={available ? "default" : "outline"}
            >
              {available ? "Орендувати книгу" : "Зарезервувати книгу"}
            </Button>
            {!available && queueLength > 0 && (
              <p className="text-sm text-center text-muted-foreground">
                В черзі: {queueLength} {queueLength === 1 ? "людина" : queueLength < 5 ? "людини" : "людей"}
              </p>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Lightbox for fullscreen image viewing - rendered via portal */}
      {lightboxOpen && allImages.length > 0 && createPortal(
        <Lightbox
          images={allImages}
          currentIndex={currentImageIndex}
          bookTitle={bookTitle}
          onClose={() => setLightboxOpen(false)}
          onPrev={prevImage}
          onNext={nextImage}
          onSelectIndex={setCurrentImageIndex}
        />,
        document.body
      )}
    </Dialog>
  );
};

// Separate Lightbox component to handle its own events
const Lightbox = ({
  images,
  currentIndex,
  bookTitle,
  onClose,
  onPrev,
  onNext,
  onSelectIndex,
}: {
  images: BookMedia[];
  currentIndex: number;
  bookTitle: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSelectIndex: (index: number) => void;
}) => {
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, onPrev, onNext]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-white/80 p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors z-20"
        aria-label="Закрити"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={onPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors z-10"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            type="button"
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors z-10"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      {/* Full size image */}
      <img
        src={images[currentIndex].file_url}
        alt={`${bookTitle} - зображення ${currentIndex + 1}`}
        className="max-w-[95vw] max-h-[95vh] object-contain pointer-events-none"
      />

      {/* Image counter */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 text-white px-4 py-2 rounded-full text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/50 rounded-lg max-w-[90vw] overflow-x-auto">
          {images.map((img, index) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onSelectIndex(index)}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                index === currentIndex ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={img.file_url}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookDetailsDialog;
