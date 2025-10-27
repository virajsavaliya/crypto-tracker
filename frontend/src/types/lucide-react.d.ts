// Type declarations for lucide-react
// This fixes the TypeScript error for missing type definitions

declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';

  export type LucideIcon = FC<SVGProps<SVGSVGElement>>;

  // Export all icons used in the project
  export const Search: LucideIcon;
  export const ChevronUp: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const Loader2: LucideIcon;
  export const ArrowDown: LucideIcon;
  export const ArrowUp: LucideIcon;
  export const ChevronsUpDown: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const Filter: LucideIcon;
  export const Bell: LucideIcon;
  export const Trash2: LucideIcon;
  export const Award: LucideIcon;
  export const Send: LucideIcon;
  export const Plus: LucideIcon;
  export const X: LucideIcon;
  export const LogOut: LucideIcon;
  export const Menu: LucideIcon;
  export const Settings: LucideIcon;
  export const User: LucideIcon;
  export const CreditCard: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const TrendingDown: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const Info: LucideIcon;
  export const ExternalLink: LucideIcon;
  
  // Add any other icons you're using in your project
  export default LucideIcon;
}
