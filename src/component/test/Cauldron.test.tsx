import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import { Cauldron } from '~/component/Cauldron';

describe('Cauldron', () => {
  it('renders a clickable cauldron button', () => {
    const { getByRole } = render(<Cauldron />);
    expect(getByRole('button', { name: 'Cauldron' })).toBeInTheDocument();
  });

  // WOW-007C: onTrigger fires alongside the pre-existing ring animation, not
  // instead of it.
  it('calls onTrigger on click, alongside the existing ring logic', () => {
    const onTrigger = vi.fn();
    const { getByRole } = render(<Cauldron onTrigger={onTrigger} />);

    fireEvent.click(getByRole('button', { name: 'Cauldron' }));

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('does not throw when clicked without an onTrigger handler (optional prop)', () => {
    const { getByRole } = render(<Cauldron />);
    expect(() => fireEvent.click(getByRole('button', { name: 'Cauldron' }))).not.toThrow();
  });

  it('calls onTrigger on every click', () => {
    const onTrigger = vi.fn();
    const { getByRole } = render(<Cauldron onTrigger={onTrigger} />);
    const button = getByRole('button', { name: 'Cauldron' });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(onTrigger).toHaveBeenCalledTimes(2);
  });

  // WOW-007D: the click ring portals straight to document.body so it can
  // render in front of every pillar card, regardless of the cauldron's own
  // stacking context — it's no longer a descendant of the button.
  describe('click ring (portalled to document.body)', () => {
    it('spawns the ring on document.body rather than inside the button', () => {
      const { getByRole } = render(<Cauldron />);
      const button = getByRole('button', { name: 'Cauldron' });

      fireEvent.click(button);

      const ring = document.body.querySelector('[data-testid="cauldron-ring"]');
      expect(ring).toBeInTheDocument();
      expect(button.contains(ring)).toBe(false);
      expect(ring?.parentElement).toBe(document.body);
    });

    it('renders no ring when there is no onTrigger and the cauldron has not been clicked', () => {
      render(<Cauldron />);
      expect(document.body.querySelector('[data-testid="cauldron-ring"]')).not.toBeInTheDocument();
    });

    it('renders no ring at all when animations are disabled', () => {
      const { getByRole } = render(<Cauldron animated={false} />);

      fireEvent.click(getByRole('button', { name: 'Cauldron' }));

      expect(document.body.querySelector('[data-testid="cauldron-ring"]')).not.toBeInTheDocument();
    });

    it('clears the ring from document.body once its one-shot animation ends', () => {
      const { getByRole } = render(<Cauldron />);
      fireEvent.click(getByRole('button', { name: 'Cauldron' }));

      const ring = document.body.querySelector('[data-testid="cauldron-ring"]');
      expect(ring).toBeInTheDocument();
      fireEvent.animationEnd(ring as Element);

      expect(document.body.querySelector('[data-testid="cauldron-ring"]')).not.toBeInTheDocument();
    });
  });
});
