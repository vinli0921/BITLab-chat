import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { a as MarkdownA } from '../MarkdownComponents';
import { MessageIdProvider } from '../../MessageIdContext';

jest.mock('~/hooks/useAdContext', () => ({
  postAdEvent: jest.fn(),
}));
jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));
jest.mock('~/hooks/Roles/useHasAccess', () => ({
  __esModule: true,
  default: () => true,
}));
jest.mock('~/data-provider', () => ({
  useFileDownload: () => ({ refetch: jest.fn() }),
}));
jest.mock('~/Providers', () => ({
  useCodeBlockContext: () => ({ getNextIndex: () => 0, resetCounter: () => {} }),
}));
jest.mock('@librechat/client', () => ({
  useToastContext: () => ({ showToast: jest.fn() }),
}));

import { postAdEvent } from '~/hooks/useAdContext';

function renderWithRecoil(ui: React.ReactElement) {
  return render(<RecoilRoot>{ui}</RecoilRoot>);
}

describe('MarkdownComponents <a> tracking', () => {
  afterEach(() => (postAdEvent as jest.Mock).mockClear());

  it('fires response_link_click when a markdown link is clicked', () => {
    renderWithRecoil(
      <MessageIdProvider value={{ messageId: 'm1', conversationId: 'c1' }}>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <MarkdownA href="https://example.com/product/abc">Example</MarkdownA>
      </MessageIdProvider>,
    );
    fireEvent.click(screen.getByText('Example'));
    expect(postAdEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'response_link_click',
        productSource: 'none',
        messageId: 'm1',
        conversationId: 'c1',
        linkUrl: 'https://example.com/product/abc',
      }),
    );
  });

  it('does not fire when rendered outside a MessageIdProvider', () => {
    renderWithRecoil(
      // eslint-disable-next-line i18next/no-literal-string
      <MarkdownA href="https://example.com">Example</MarkdownA>,
    );
    fireEvent.click(screen.getByText('Example'));
    expect(postAdEvent).not.toHaveBeenCalled();
  });

  it('truncates linkUrl to 500 chars', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(600);
    renderWithRecoil(
      <MessageIdProvider value={{ messageId: 'm1', conversationId: 'c1' }}>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <MarkdownA href={longUrl}>Example</MarkdownA>
      </MessageIdProvider>,
    );
    fireEvent.click(screen.getByText('Example'));
    const call = (postAdEvent as jest.Mock).mock.calls[0][0];
    expect(call.linkUrl.length).toBe(500);
    expect(call.linkUrl.startsWith('https://example.com/')).toBe(true);
  });
});
