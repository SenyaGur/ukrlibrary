import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { useImageColor } from "@/hooks/useImageColor";
import { resolveUrl } from "@/lib/api";

interface BookCardProps {
  id: string;
  title: string;
  author: string;
  coverColor: string;
  coverImageUrl?: string | null;
  available: boolean;
  isNew?: boolean;
  totalCopies?: number;
  availableCopies?: number;
  onClick: () => void;
}

// Heart "New" badge component
const NewBadge = () => (
  <div className="absolute top-2 left-2 w-14 h-14 flex items-center justify-center z-10">
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
      <path
        d="M50 88 C20 60, 0 40, 0 25 C0 10, 15 0, 30 0 C40 0, 48 8, 50 12 C52 8, 60 0, 70 0 C85 0, 100 10, 100 25 C100 40, 80 60, 50 88Z"
        fill="#5BC0EB"
      />
      <text
        x="50"
        y="38"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="cursive"
        fontSize="26"
        fontWeight="500"
        fill="#1a1a1a"
        style={{ fontStyle: 'italic' }}
      >
        New
      </text>
    </svg>
  </div>
);

// Generate gradient based on cover color - from lighter top-left to darker bottom-right
const getGradient = (color: string) => {
  const lighterColor = adjustColor(color, 40);
  const darkerColor = adjustColor(color, -50);
  return `linear-gradient(135deg, ${lighterColor} 0%, ${color} 50%, ${darkerColor} 100%)`;
};

// Helper to darken/lighten a color
const adjustColor = (color: string, amount: number) => {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
};

const BookCard = ({ id, title, author, coverColor, coverImageUrl, available, isNew, totalCopies, availableCopies, onClick }: BookCardProps) => {
  const resolvedCoverUrl = resolveUrl(coverImageUrl);
  // Extract dominant color from cover image, fallback to provided coverColor
  const { color: dominantColor } = useImageColor(resolvedCoverUrl, coverColor);
  
  return (
    <div className="group cursor-pointer" onClick={onClick}>
      {/* Portrait cover with rounded corners */}
      <div 
        className={`aspect-[3/4] rounded-xl relative flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl mb-3${!available ? ' opacity-50 grayscale' : ''}`}
        style={{ background: getGradient(dominantColor) }}
      >
        {resolvedCoverUrl ? (
          <img
            src={resolvedCoverUrl}
            alt={title}
            className="w-[85%] h-[85%] object-cover rounded-lg shadow-lg"
          />
        ) : (
          <BookOpen className="w-12 h-12 text-white/30 transition-all duration-300 group-hover:scale-110 group-hover:text-white/50" />
        )}
        
        {/* New badge */}
        {isNew && <NewBadge />}
        
        {/* Availability badge */}
        <Badge
          className={`absolute top-2 right-2 text-xs ${
            available
              ? 'bg-green-500 text-white'
              : 'bg-black/50 text-white'
          }`}
        >
          {totalCopies && totalCopies > 1
            ? `${availableCopies} з ${totalCopies} дост.`
            : available ? "Доступна" : "Орендована"}
        </Badge>
      </div>
      
      {/* Book info */}
      <div className="px-1">
        <h3 className="font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-1">
          {author}
        </p>
      </div>
    </div>
  );
};

export default BookCard;