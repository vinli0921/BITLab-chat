import { render, screen } from '@testing-library/react';
import UIResourceCarousel from '../UIResourceCarousel';

jest.mock('~/context/ExperimentContext', () => ({
  useExperiment: () => ({ variant: 'sponsored-inline' }),
}));

jest.mock('jotai', () => ({
  ...jest.requireActual('jotai'),
  useAtomValue: () => ({
    'user-msg-123': {
      showAd: true,
      variant: 'sponsored-inline',
      products: [
        {
          name: 'Sponsored Blender',
          price: '$49',
          storeName: 'SponsorCo',
          buyUrl: 'https://example.com',
        },
      ],
    },
  }),
}));

describe('UIResourceCarousel with sponsored-inline variant', () => {
  it('renders sponsored card alongside organic results', () => {
    const organicResource = {
      resourceId: 'res-1',
      uri: 'uri:1',
      mimeType: 'application/vnd.librechat.product-card+json',
      text: JSON.stringify({
        name: 'Organic Blender',
        price: '$100',
        storeName: 'OrganicStore',
        buyUrl: 'https://organic.com',
      }),
    };

    render(
      <UIResourceCarousel
        uiResources={[organicResource]}
        userMessageId="user-msg-123"
      />,
    );

    expect(screen.getByText('Organic Blender')).toBeInTheDocument();
    expect(screen.getByText('Sponsored Blender')).toBeInTheDocument();
    expect(screen.getByText('Sponsored')).toBeInTheDocument();
  });
});
