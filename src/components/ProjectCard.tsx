import { useState } from 'react';

interface ProjectCardProps {
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  onClick?: () => void;
}

// BUG:BZ-076 - Layout Shift When Images Load
// Product cards show title first, then image loads and pushes the title down.
// No width/height or aspect-ratio is set on the image container, so the browser
// can't reserve space before the image loads. This causes a large CLS (Cumulative
// Layout Shift) — users may click the wrong card as content jumps.
export function ProjectCard({ title, description, imageUrl, category, onClick }: ProjectCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div
      data-bug-id="BZ-076"
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
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
      <div className="p-4">
        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full mb-2">
          {category}
        </span>
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{description}</p>
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
