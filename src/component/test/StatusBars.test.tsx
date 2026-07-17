import { render } from '@testing-library/react';
import { StatusBars } from '~/component/StatusBars';

const barsOf = (container: HTMLElement): Element[] => [
  ...container.querySelectorAll('span.origin-bottom'),
];

describe('StatusBars', () => {
  it('animates the bars while actively playing', () => {
    const { container } = render(<StatusBars colorHex='#b91c1c' active />);
    const bars = barsOf(container);
    expect(bars).toHaveLength(11);
    bars.forEach((bar) => {
      expect(bar.className).toContain('motion-safe:animate-eq');
    });
  });

  it('renders a static dimmed silhouette when not active (e.g. muted)', () => {
    const { container } = render(<StatusBars colorHex='#b91c1c' active={false} />);
    barsOf(container).forEach((bar) => {
      expect(bar.className).not.toContain('animate-eq');
    });
  });

  it('goes static when the global animations switch is off', () => {
    const { container } = render(<StatusBars colorHex='#b91c1c' active animated={false} />);
    barsOf(container).forEach((bar) => {
      expect(bar.className).not.toContain('animate-eq');
    });
  });
});
