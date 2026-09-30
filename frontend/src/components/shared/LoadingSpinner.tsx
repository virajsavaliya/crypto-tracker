import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

export default function LoadingSpinner({ message = 'Loading...', className }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center min-h-[400px]", className)}>
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-gray-900 mx-auto" />
        {message && <p className="mt-4 text-gray-600 font-medium">{message}</p>}
      </div>
    </div>
  );
}
