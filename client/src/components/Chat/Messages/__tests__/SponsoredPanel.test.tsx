import { render, screen, fireEvent } from '@testing-library/react';
import type { ProductCardData } from 'librechat-data-provider';
import SponsoredPanel from '../SponsoredPanel';

const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

beforeAll(() => {
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: mockObserve,
    disconnect: mockDisconnect,
    unobserve: jest.fn(),
  })) as unknown as typeof IntersectionObserver;
});

jest.mock('~/hooks/useAdContext', () => ({
  postAdEvent: jest.fn(),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

const mockProducts: ProductCardData[] = [
  {
    name: 'BlendJet 2',
    price: '$49.95',
    storeName: 'BlendJet',
    buyUrl: 'https://blendjet.com',
  },
  {
    name: 'Vitamix E310',
    price: '$299.95',
    storeName: 'Vitamix',
    buyUrl: 'https://vitamix.com',
  },
];

const mockOnEvent = jest.fn();

describe('SponsoredPanel', () => {
  afterEach(() => mockOnEvent.mockClear());

  it('renders brand name, Sponsored label, products, and disclaimer', () => {
    render(
      <SponsoredPanel
        products={mockProducts}
        messageId="msg-1"
        conversationId="convo-1"
        queryText="best blender"
        onEvent={mockOnEvent}
      />,
    );
    expect(screen.getByText(/com_ui_sponsored/)).toBeInTheDocument();
    expect(screen.getByText('BlendJet 2')).toBeInTheDocument();
    expect(screen.getByText('Vitamix E310')).toBeInTheDocument();
    expect(screen.getByText(/com_ui_ads_disclaimer/i)).toBeInTheDocument();
  });

  it('calls onEvent with link_visit when a product link is clicked', () => {
    render(
      <SponsoredPanel
        products={mockProducts}
        messageId="msg-2"
        conversationId="convo-1"
        queryText="blender"
        onEvent={mockOnEvent}
      />,
    );
    fireEvent.click(screen.getAllByRole('link')[0]);
    expect(mockOnEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'link_visit',
        productName: 'BlendJet 2',
        productSource: 'sponsored',
      }),
    );
  });
});
