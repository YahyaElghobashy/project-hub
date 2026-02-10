import {
  BarChart3,
  Rocket,
  Briefcase,
  Smartphone,
  Wrench,
  TrendingUp,
  Target,
  Lightbulb,
  Lock,
  Zap,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  'bar-chart': BarChart3,
  'rocket': Rocket,
  'briefcase': Briefcase,
  'smartphone': Smartphone,
  'wrench': Wrench,
  'trending-up': TrendingUp,
  'target': Target,
  'lightbulb': Lightbulb,
  'lock': Lock,
  'zap': Zap,
  'refresh-cw': RefreshCw,
};

export function getProjectIcon(iconName: string, className = 'w-5 h-5') {
  const Icon = iconMap[iconName] || BarChart3;
  return <Icon className={className} />;
}

export { iconMap };
