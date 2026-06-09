import React from 'react';
import { RecoilRoot } from 'recoil';
import { render, screen } from '@testing-library/react';
import { UI_RESOURCE_MARKER } from '~/components/MCPUIResource/plugin';
import { useGetMessagesByConvoId } from '~/data-provider';
import MarkdownLite from '../MarkdownLite';
import { useLocalize } from '~/hooks';
import Markdown from '../Markdown';

// Mocks for hooks used by MCPUIResource when rendered inside Markdown.
// Keep Provider components intact while mocking only the hooks we use.
//
// The mocked hooks resolve their return values through module-scoped `mock*`
// closures rather than per-instance `mockReturnValue`. Loading the full markdown
// pipeline re-enters the `~/Providers` mock factory, so the rendered component
// tree and the test can end up holding different mock instances; sharing the
// closure makes every instance return the same configured value instead of an
// unset `undefined`.
let mockMessageCtx: any = {};
let mockMessagesConvo: any = {};
let mockMessagesOps: any = { getMessages: () => [] };

jest.mock('~/Providers', () => ({
  ...jest.requireActual('~/Providers'),
  useMessageContext: jest.fn(() => mockMessageCtx),
  useOptionalMessagesConversation: jest.fn(() => mockMessagesConvo),
  useOptionalMessagesOperations: jest.fn(() => mockMessagesOps),
}));
jest.mock('~/data-provider');
jest.mock('~/hooks');

// Mock @mcp-ui/client to render identifiable elements for assertions
jest.mock('@mcp-ui/client', () => ({
  UIResourceRenderer: ({ resource }: any) => (
    <div data-testid="ui-resource-renderer" data-resource-uri={resource?.uri} />
  ),
}));

const mockUseGetMessagesByConvoId = useGetMessagesByConvoId as jest.MockedFunction<
  typeof useGetMessagesByConvoId
>;
const mockUseLocalize = useLocalize as jest.MockedFunction<typeof useLocalize>;

describe('Markdown with MCP UI markers (resource IDs)', () => {
  let currentTestMessages: any[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    currentTestMessages = [];

    mockMessageCtx = { messageId: 'msg-weather' };
    mockMessagesConvo = {
      conversation: { conversationId: 'conv1' },
      conversationId: 'conv1',
    };
    mockMessagesOps = {
      ask: jest.fn(),
      getMessages: () => currentTestMessages,
    };
    mockUseLocalize.mockReturnValue(((key: string) => key) as any);
  });

  it('renders two UIResourceRenderer components for markers with resource IDs across separate attachments', () => {
    // Two tool responses, each produced one ui_resources attachment
    const paris = {
      resourceId: 'abc123',
      uri: 'ui://weather/paris',
      mimeType: 'text/html',
      text: '<div>Paris Weather</div>',
    };
    const nyc = {
      resourceId: 'def456',
      uri: 'ui://weather/nyc',
      mimeType: 'text/html',
      text: '<div>NYC Weather</div>',
    };

    currentTestMessages = [
      {
        messageId: 'msg-weather',
        attachments: [
          { type: 'ui_resources', ui_resources: [paris] },
          { type: 'ui_resources', ui_resources: [nyc] },
        ],
      },
    ];

    mockUseGetMessagesByConvoId.mockReturnValue({ data: currentTestMessages } as any);

    const content = [
      'Here are the current weather conditions for both Paris and New York:',
      '',
      '- Paris: Slight rain, 53°F, humidity 76%, wind 9 mph.',
      '- New York: Clear sky, 63°F, humidity 91%, wind 6 mph.',
      '',
      `Browse these weather cards for more details ${UI_RESOURCE_MARKER}{abc123} ${UI_RESOURCE_MARKER}{def456}`,
    ].join('\n');

    render(
      <RecoilRoot>
        <Markdown content={content} isLatestMessage={false} />
      </RecoilRoot>,
    );

    const renderers = screen.getAllByTestId('ui-resource-renderer');
    expect(renderers).toHaveLength(2);
    expect(renderers[0]).toHaveAttribute('data-resource-uri', 'ui://weather/paris');
    expect(renderers[1]).toHaveAttribute('data-resource-uri', 'ui://weather/nyc');
  });
});

describe('Markdown table rendering', () => {
  const tableMarkdown = [
    '| Alpha | Bravo | Charlie | Delta | Echo | Foxtrot | Golf | Hotel |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| one | two | three | four | five | six | seven | eight |',
  ].join('\n');

  it('wraps GFM tables in a horizontally scrollable container', () => {
    render(
      <RecoilRoot>
        <Markdown content={tableMarkdown} isLatestMessage={false} />
      </RecoilRoot>,
    );

    expect(screen.getByRole('table').parentElement).toHaveClass(
      'markdown-table-wrapper',
      'w-full',
      'max-w-full',
    );
  });

  it('wraps lightweight Markdown tables in a horizontally scrollable container', () => {
    render(<MarkdownLite content={tableMarkdown} />);

    expect(screen.getByRole('table').parentElement).toHaveClass(
      'markdown-table-wrapper',
      'w-full',
      'max-w-full',
    );
  });
});
