import axios from 'axios';
import { ResearchEventQueue } from '../queue';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ResearchEventQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedAxios.post.mockResolvedValue({ data: { inserted: 1, duplicates: 0 } });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('stamps eventId, tsWall, and tsMono at enqueue time', () => {
    const queue = new ResearchEventQueue();
    queue.enqueue({ eventType: 'chat_presence', payload: { active: true } });
    const [buffered] = queue.peek();
    expect(buffered.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(typeof buffered.tsWall).toBe('number');
    expect(typeof buffered.tsMono).toBe('number');
  });

  it('flushes on the interval with one batched POST', async () => {
    const queue = new ResearchEventQueue();
    queue.enqueue({ eventType: 'chat_presence' });
    queue.enqueue({ eventType: 'chat_presence' });
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [url, body] = mockedAxios.post.mock.calls[0] as [string, { events: unknown[] }];
    expect(url).toBe('/api/research/events');
    expect(body.events).toHaveLength(2);
    expect(queue.peek()).toHaveLength(0);
  });

  it('flushes immediately when the batch cap is reached', async () => {
    const queue = new ResearchEventQueue();
    for (let i = 0; i < 50; i++) {
      queue.enqueue({ eventType: 'chat_presence' });
    }
    // cap flush starts synchronously inside enqueue; this only drains the POST microtask
    await jest.advanceTimersByTimeAsync(0);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('drains a >50 burst across a cap flush plus an interval flush', async () => {
    const queue = new ResearchEventQueue();
    for (let i = 0; i < 75; i++) {
      queue.enqueue({ eventType: 'chat_presence' });
    }
    await jest.advanceTimersByTimeAsync(0);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(
      (mockedAxios.post.mock.calls[0] as [string, { events: unknown[] }])[1].events,
    ).toHaveLength(50);
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    expect(
      (mockedAxios.post.mock.calls[1] as [string, { events: unknown[] }])[1].events,
    ).toHaveLength(25);
    expect(queue.peek()).toHaveLength(0);
  });

  it('requeues events when the POST fails', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('network'));
    const queue = new ResearchEventQueue();
    queue.enqueue({ eventType: 'chat_presence' });
    await jest.advanceTimersByTimeAsync(5000);
    expect(queue.peek()).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(5000);
    expect(queue.peek()).toHaveLength(0);
  });
});
