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
});
