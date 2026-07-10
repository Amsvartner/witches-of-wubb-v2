import { render } from '@testing-library/react';
import { InstallationPage } from '~/page/InstallationPage';

describe('InstallationPage', () => {
  it('renders the cauldron centerpiece', () => {
    const { getByTestId } = render(<InstallationPage />);

    expect(getByTestId('cauldron')).toBeInTheDocument();
  });
});
