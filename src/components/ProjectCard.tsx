import { useState, useRef, useCallback } from 'react';
import { Bookmark } from 'lucide-react';

interface ProjectCardProps {
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  onClick?: () => void;
  onBookmark?: () => void;
}

// BUG:BZ-076 - Layout Shift When Images Load
// Product cards show title first, then image loads and pushes the title down.
// No width/height or aspect-ratio is set on the image container, so the browser
// can't reserve space before the image loads. This causes a large CLS (Cumulative
// Layout Shift) — users may click the wrong card as content jumps.
export function ProjectCard({ title, description, imageUrl, category, onClick, onBookmark }: ProjectCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // BUG:BZ-085 - Invisible Overlapping Clickable Areas
  // The card has a click handler covering the entire area, and the bookmark button
  // inside has its own handler. The button uses e.stopPropagation() but the card's
  // click target has extra padding that extends over the button's visual boundary.
  // Clicking near the button edge triggers the card action instead of the button.
  const handleBookmark = useCallback((e: React.MouseEvent) => {
    // stopPropagation only works when the click lands exactly on the button element,
    // not on the padding area that visually appears to be part of the button
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
    if (onBookmark) onBookmark();
  }, [isBookmarked, onBookmark]);

  return (
    <div
      data-bug-id="BZ-076"
      className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
      ref={cardRef}
    >
      {/* BUG:BZ-076 - No dimensions set on image container. When the image loads,
          it pushes all content below it down by ~200px, causing layout shift.
          Should use aspect-ratio or explicit height to reserve space. */}
      <div>
        <img
          src={imageUrl}
          alt={title}
          className="w-full object-cover"
          onLoad={() => {
            setImageLoaded(true);
            if (typeof window !== 'undefined') {
              window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
              if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-076')) {
                window.__PERCEPTR_TEST_BUGS__.push({
                  bugId: 'BZ-076',
                  timestamp: Date.now(),
                  description: 'Image loaded without reserved space - content shifted down causing layout jump',
                  page: 'Visual/Layout'
                });
              }
            }
          }}
        />
      </div>
      {/* BUG:BZ-085 - The card's click area and the bookmark button overlap.
          The button has a small visible target but the card's click handler covers
          the entire area including the space around the button. Clicking near the
          button edge fires the card action instead of the button action. */}
      <div data-bug-id="BZ-085" className="p-4 relative">
        <div className="flex items-start justify-between">
          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full mb-2">
            {category}
          </span>
          {/* BUG:BZ-085 - Bookmark button with small visible icon but the interactive
              area doesn't extend far enough. The surrounding card click zone captures
              clicks on the edges of this button. The button's padding is small (p-1)
              while the parent div's padding (p-4) creates a dead zone where clicks
              go to the card instead of the button. */}
          <button
            onClick={(e) => {
              handleBookmark(e);
              if (typeof window !== 'undefined') {
                window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-085')) {
                  window.__PERCEPTR_TEST_BUGS__.push({
                    bugId: 'BZ-085',
                    timestamp: Date.now(),
                    description: 'Overlapping clickable areas - card click handler captures clicks near bookmark button edge',
                    page: 'Visual/Layout'
                  });
                }
              }
            }}
            className="p-1 text-zinc-400 hover:text-yellow-500 transition-colors"
            aria-label="Bookmark project"
          >
            <Bookmark className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>
        <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">{title}</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{description}</p>
      </div>
    </div>
  );
}

// Featured project cards data with placeholder images
export const featuredProjects = [
  {
    title: 'Website Redesign',
    description: 'Complete overhaul of the company website with modern design principles',
    imageUrl: 'https://picsum.photos/seed/project1/400/200',
    category: 'Design',
  },
  {
    title: 'Mobile App v2.0',
    description: 'Next generation mobile app with improved performance and new features',
    imageUrl: 'https://picsum.photos/seed/project2/400/200',
    category: 'Engineering',
  },
  {
    title: 'Analytics Dashboard',
    description: 'Real-time analytics dashboard for monitoring key business metrics',
    imageUrl: 'https://picsum.photos/seed/project3/400/200',
    category: 'Data',
  },
  {
    title: 'Customer Portal',
    description: 'Self-service portal for customers to manage their accounts and subscriptions',
    imageUrl: 'https://picsum.photos/seed/project4/400/200',
    category: 'Product',
  },
  {
    title: 'API Integration Hub',
    description: 'Centralized hub for managing third-party API integrations and webhooks',
    imageUrl: 'https://picsum.photos/seed/project5/400/200',
    category: 'Engineering',
  },
  {
    title: 'Cloud Migration',
    description: 'Migrating infrastructure from on-premise to cloud-native architecture',
    imageUrl: 'https://picsum.photos/seed/project6/400/200',
    category: 'Infrastructure',
  },
];
