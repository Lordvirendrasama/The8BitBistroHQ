export const PixelPerksLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    {...props}
  >
    {/* Body - Green Cup (Accent) */}
    <rect x="6" y="10" width="12" height="10" fill="hsl(var(--accent))" />
    <rect x="4" y="12" width="2" height="4" fill="hsl(var(--accent))" />
    
    {/* Liquid - Red Coffee (Primary) */}
    <rect x="7" y="8" width="10" height="2" fill="hsl(var(--primary))" />
    
    {/* Steam */}
    <rect x="10" y="5" width="1" height="2" fill="currentColor" className="text-muted-foreground opacity-40" />
    <rect x="12" y="3" width="1" height="2" fill="currentColor" className="text-muted-foreground opacity-40" />
    
    {/* Glasses/Eyes */}
    <rect x="8" y="12" width="3" height="3" fill="black" />
    <rect x="13" y="12" width="3" height="3" fill="black" />
    <rect x="9" y="13" width="1" height="1" fill="white" />
    <rect x="14" y="13" width="1" height="1" fill="white" />
    
    {/* Mouth */}
    <rect x="11" y="16" width="2" height="1" fill="black" />
    
    {/* Legs */}
    <rect x="9" y="20" width="1" height="2" fill="black" />
    <rect x="14" y="20" width="1" height="2" fill="black" />
    
    {/* Mini Controller */}
    <rect x="15" y="15" width="6" height="4" fill="#888888" />
    <rect x="16" y="16" width="1" height="1" fill="hsl(var(--primary))" />
    <rect x="19" y="17" width="1" height="1" fill="black" />
  </svg>
);
