import React from 'react';
import { render, screen } from '@testing-library/react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import MessageParts from '../MessageParts';

jest.mock('~/context/ExperimentContext', () => ({
  useExperiment: jest.fn(),
}));
jest.mock('~/hooks/useAdContext', () => ({
  useAdContext: jest.fn(),
  postAdEvent: jest.fn(),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useMessageHelpers: jest.fn(),
  useAttachments: jest.fn(),
  useContentMetadata: jest.fn(),
}));

jest.mock('recoil', () => ({
  useRecoilValue: jest.fn(() => false),
  atom: jest.fn(() => ({ key: 'mock', default: null })),
  RecoilRoot: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('~/store', () => ({
  default: {
    maximizeChatSpace: { key: 'maximizeChatSpace', default: false },
  },
}));

jest.mock('~/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
  getHeaderPrefixForScreenReader: jest.fn(() => ''),
  getMessageAriaLabel: jest.fn(() => ''),
}));

jest.mock('~/store/fontSize', () => {
  const { atom: jotaiAtom } = jest.requireActual('jotai');
  return { fontSizeAtom: jotaiAtom('text-base') };
});

jest.mock('~/components/Chat/Messages/MessageIcon', () => ({
  __esModule: true,
  default: () => <div data-testid="message-icon" />,
}));

jest.mock('~/components/Chat/Messages/Content/ContentParts', () => ({
  __esModule: true,
  default: () => <div data-testid="content-parts" />,
}));

jest.mock('~/components/Chat/Messages/SiblingSwitch', () => ({
  __esModule: true,
  default: () => <div data-testid="sibling-switch" />,
}));

jest.mock('~/components/Chat/Messages/HoverButtons', () => ({
  __esModule: true,
  default: () => <div data-testid="hover-buttons" />,
}));

jest.mock('~/components/Chat/Messages/SubRow', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sub-row">{children}</div>
  ),
}));

jest.mock('~/components/Chat/Messages/MultiMessage', () => ({
  __esModule: true,
  default: () => <div data-testid="multi-message" />,
}));

jest.mock('~/components/Chat/Messages/SponsoredPanel', () => ({
  __esModule: true,
  default: ({ products }: { products: { name: string }[] }) => (
    <div data-testid="sponsored-panel">{products.map((p) => p.name).join(', ')}</div>
  ),
}));

const { useExperiment } = jest.requireMock('~/context/ExperimentContext');
const { useAdContext } = jest.requireMock('~/hooks/useAdContext');
const { useMessageHelpers, useAttachments, useContentMetadata } = jest.requireMock('~/hooks');

const makeMessage = (overrides: Record<string, unknown> = {}) => ({
  messageId: 'msg-assistant-1',
  parentMessageId: 'msg-user-1',
  text: 'Hello from assistant',
  content: [],
  isCreatedByUser: false,
  endpoint: 'openAI',
  children: [],
  ...overrides,
});

const makeProps = (messageOverrides: Record<string, unknown> = {}) => ({
  message: makeMessage(messageOverrides),
  siblingIdx: 0,
  siblingCount: 1,
  setSiblingIdx: jest.fn(),
  currentEditId: null,
  setCurrentEditId: jest.fn(),
  isSubmitting: false,
});

const mockConversation = {
  conversationId: 'convo-1',
  endpoint: 'openAI',
  model: 'gpt-4',
};

function setupHookMocks() {
  useAttachments.mockReturnValue({ attachments: [], searchResults: [] });
  useContentMetadata.mockReturnValue({ hasParallelContent: false });
  useMessageHelpers.mockReturnValue({
    edit: false,
    index: 0,
    agent: null,
    isLast: true,
    enterEdit: jest.fn(),
    assistant: null,
    handleScroll: jest.fn(),
    conversation: mockConversation,
    isSubmitting: false,
    latestMessageId: 'msg-assistant-1',
    handleContinue: jest.fn(),
    copyToClipboard: jest.fn(),
    regenerateMessage: jest.fn(),
  });
}

describe('MessageParts experiment integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupHookMocks();
  });

  it('does NOT render SponsoredPanel for control variant', () => {
    useExperiment.mockReturnValue({ variant: 'control' });
    useAdContext.mockReturnValue({
      getAdContext: jest.fn(),
      getResult: jest.fn(() => ({ showAd: true, variant: 'control', products: [{ name: 'Product A', price: '$10', storeName: 'Store', buyUrl: 'https://example.com' }] })),
    });

    const store = createStore();
    render(
      <JotaiProvider store={store}>
        <MessageParts {...makeProps()} />
      </JotaiProvider>,
    );

    expect(screen.queryByTestId('sponsored-panel')).toBeNull();
  });

  it('renders SponsoredPanel for sponsored-outside variant when getResult returns showAd: true', () => {
    useExperiment.mockReturnValue({ variant: 'sponsored-outside' });
    useAdContext.mockReturnValue({
      getAdContext: jest.fn(),
      getResult: jest.fn(() => ({
        showAd: true as const,
        variant: 'sponsored-outside',
        products: [{ name: 'Sponsored Widget', price: '$25', storeName: 'AdCo', buyUrl: 'https://adco.com' }],
      })),
    });

    const store = createStore();
    render(
      <JotaiProvider store={store}>
        <MessageParts {...makeProps()} />
      </JotaiProvider>,
    );

    expect(screen.getByTestId('sponsored-panel')).toBeInTheDocument();
    expect(screen.getByText('Sponsored Widget')).toBeInTheDocument();
  });
});
