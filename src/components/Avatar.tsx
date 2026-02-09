interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeStyles = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const getInitials = (name: string): string => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getColorFromName = (name: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-cyan-500',
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

export function Avatar({ src, alt, name, size = 'md', className = '' }: AvatarProps) {
  const displayName = name || alt || 'User';

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || 'Avatar'}
        className={`
          rounded-full object-cover
          ${sizeStyles[size]}
          ${className}
        `}
      />
    );
  }

  return (
    <div
      className={`
        rounded-full flex items-center justify-center
        font-medium text-white
        ${sizeStyles[size]}
        ${getColorFromName(displayName)}
        ${className}
      `}
    >
      {getInitials(displayName)}
    </div>
  );
}
