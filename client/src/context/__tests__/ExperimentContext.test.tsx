import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExperimentProvider, useExperiment } from '../ExperimentContext';

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: jest.fn(),
}));

const { useGetStartupConfig } = jest.requireMock('~/data-provider');

function Probe() {
  const { variant } = useExperiment();
  return <div data-testid="variant">{variant ?? 'null'}</div>;
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('ExperimentProvider', () => {
  it('provides variant from startup config', async () => {
    useGetStartupConfig.mockReturnValue({ data: { experimentVariant: 'sponsored-inline' } });
    render(
      <ExperimentProvider>
        <Probe />
      </ExperimentProvider>,
      { wrapper },
    );
    await waitFor(() => expect(screen.getByTestId('variant').textContent).toBe('sponsored-inline'));
  });

  it('provides null variant when config not ready', async () => {
    useGetStartupConfig.mockReturnValue({ data: undefined });
    render(
      <ExperimentProvider>
        <Probe />
      </ExperimentProvider>,
      { wrapper },
    );
    expect(screen.getByTestId('variant').textContent).toBe('null');
  });
});
