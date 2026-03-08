import { Link, useLocation } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Modules', href: '/modules' },
  { label: 'Articles', href: '/articles' },
  { label: 'Reports', href: '/reports' },
  { label: 'Updates', href: '/updates' },
];

export function AppHeader() {
  const { pathname } = useLocation();

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center gap-8">
          <Link to="/modules" className="flex items-center gap-2.5">
            <Newspaper className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight font-['Playfair_Display',Georgia,serif]">Cronkite</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
