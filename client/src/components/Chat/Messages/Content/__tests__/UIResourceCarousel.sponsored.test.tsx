import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import type { UIResource } from 'librechat-data-provider';
import { adContextAtom } from '~/store/experiment';
import UIResourceCarousel from '../UIResourceCarousel';

jest.mock('~/hooks', () => ({
  useLocalize:
    () =>
    (key: string): string =>
      (({ com_ui_sponsored: 'Sponsored' }) as Record<string, string>)[key] ?? key,
}));

jest.mock('@mcp-ui/client', () => ({
  UIResourceRenderer: ({ resource }: { resource: UIResource }) => (
    <div data-testid="ui-resource-renderer">{resource.text || 'UI Resource'}</div>
  ),
}));

jest.mock('~/Providers', () => ({
  useOptionalMessagesOperations: () => ({
    ask: jest.fn(),
  }),
  useOptionalMessagesConversation: () => ({
    conversationId: 'test-convo',
  }),
}));

jest.mock('~/context/ExperimentContext', () => ({
  useExperiment: () => ({ variant: 'sponsored-inline' }),
}));

jest.mock('~/hooks/useAdContext', () => ({
  postAdEvent: jest.fn(),
}));

jest.mock('~/utils', () => ({
  handleUIAction: jest.fn(),
}));

beforeAll(() => {
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    disconnect: jest.fn(),
    unobserve: jest.fn(),
  })) as unknown as typeof IntersectionObserver;
});

describe('UIResourceCarousel with sponsored-inline variant', () => {
  it('renders sponsored card alongside organic results', () => {
    const organicResource: UIResource = {
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

    const store = createStore();
    store.set(adContextAtom, {
      'user-msg-123': {
        showAd: true as const,
        variant: 'sponsored-inline',
        queryText: 'best blender',
        products: [
          {
            name: 'Sponsored Blender',
            price: '$49',
            storeName: 'SponsorCo',
            buyUrl: 'https://example.com',
          },
        ],
      },
    });

    render(
      <JotaiProvider store={store}>
        <UIResourceCarousel uiResources={[organicResource]} userMessageId="user-msg-123" />
      </JotaiProvider>,
    );

    expect(screen.getByText('Organic Blender')).toBeInTheDocument();
    expect(screen.getByText('Sponsored Blender')).toBeInTheDocument();
    expect(screen.getByText('Sponsored')).toBeInTheDocument();
  });
});
