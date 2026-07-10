import { render } from '@testing-library/react';
import { InstallationPage } from '~/page/InstallationPage';

describe('InstallationPage', () => {
  it('renders headline', () => {
    const { getByTestId } = render(<InstallationPage />);

    expect(getByTestId('cauldron')).toBeInTheDocument();
  });
});
