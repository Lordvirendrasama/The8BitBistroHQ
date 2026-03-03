import { SVGAttributes } from 'react';
import { type LucideProps } from 'lucide-react';
import { type Icon } from 'lucide-react';

export * from 'lucide-react';

export type IconName = keyof typeof import('lucide-react').icons;

export type IconProps = LucideProps;

/**
 * @deprecated Use `Icon` from `lucide-react` instead.
 */
export type LucideIcon = Icon;

/**
 * @deprecated Use `Icon` from `lucide-react` instead.
 */
export type LucideIconNode = [string, SVGAttributes][];
