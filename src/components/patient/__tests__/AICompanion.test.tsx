import { useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AICompanion from '../AICompanion';
import { getAICompanionChatResponse } from '../../../services/geminiService';
import { AppProvider, useAppContext } from '../../../context/AppContext';

const voskSpeechMock = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  isReady: vi.fn(() => false),
  getAvailability: vi.fn(async () => ({ available: false, reasonCode: 'not_native', modelDownloaded: false })),
  initialize: vi.fn(async () => ({ success: false, needsDownload: false })),
  ensurePermission: vi.fn(async () => ({ granted: false })),
  startRecognition: vi.fn(async () => {}),
  stopRecognition: vi.fn(async () => {}),
  addResultListener: vi.fn(async () => async () => {}),
  cleanup: vi.fn(async () => {}),
}));

vi.mock('../../../services/geminiService', () => ({
  isGeminiConfigured: true,
  missingApiKeyError: 'missing',
  getAICompanionChatResponse: vi.fn(async (prompt: string) => `AI: ${prompt}`),
}));

vi.mock('../../../services/voskSpeechService', () => ({
  default: voskSpeechMock,
}));

class MockSpeechRecognition {
  static lastInstance: MockSpeechRecognition | null = null;

  continuous = false;
  lang = 'en-US';
  interimResults = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  start = vi.fn(() => {
    this.onstart?.();
  });

  stop = vi.fn(() => {
    this.onend?.();
  });

  constructor() {
    MockSpeechRecognition.lastInstance = this;
  }

  emitResult(transcript: string) {
    this.onresult?.({
      resultIndex: 0,
      results: [{ 0: { transcript }, isFinal: true }],
    });
  }

  emitEnd() {
    this.onend?.();
  }
}

describe('AICompanion', () => {
  const EnableDevMode = () => {
    const { dispatch } = useAppContext();

    useEffect(() => {
      dispatch({ type: 'SET_DEV_MODE', payload: true });
      // AppProvider recreates its wrapped dispatch function on state changes,
      // so we intentionally run this once for test setup only.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
  };

  const renderWithAppProvider = ({ devMode = false }: { devMode?: boolean } = {}) =>
    render(
      <AppProvider>
        {devMode ? <EnableDevMode /> : null}
        <AICompanion onBack={() => {}} />
      </AppProvider>
    );

  beforeEach(() => {
    vi.clearAllMocks();
    MockSpeechRecognition.lastInstance = null;
    (window as any).SpeechRecognition = MockSpeechRecognition;
    (window as any).webkitSpeechRecognition = undefined;
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });

    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn(async () => ({ state: 'prompt' })),
      },
    });

    voskSpeechMock.isNativePlatform.mockReturnValue(false);
    voskSpeechMock.getAvailability.mockResolvedValue({
      available: false,
      reasonCode: 'not_native',
      modelDownloaded: false,
    });
  });

  it('sends typed message on Enter', async () => {
    renderWithAppProvider();

    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'hello there' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(getAICompanionChatResponse).toHaveBeenCalledWith('hello there');
    });

    expect(await screen.findByText('AI: hello there')).toBeInTheDocument();
  });

  it('captures microphone transcript and sends once when recognition ends', async () => {
    renderWithAppProvider();

    const micButton = await screen.findByLabelText('Start listening');
    await waitFor(() => {
      expect(micButton).not.toBeDisabled();
    });
    fireEvent.click(micButton);

    const recognition = MockSpeechRecognition.lastInstance;
    expect(recognition).not.toBeNull();

    act(() => {
      recognition!.emitResult('how are you');
      recognition!.emitEnd();
    });

    await waitFor(() => {
      expect(getAICompanionChatResponse).toHaveBeenCalledTimes(1);
      expect(getAICompanionChatResponse).toHaveBeenCalledWith('how are you');
    });

    expect(await screen.findByText('AI: how are you')).toBeInTheDocument();
  });

  it('shows unavailable mode when speech recognition is not supported', async () => {
    (window as any).SpeechRecognition = undefined;
    (window as any).webkitSpeechRecognition = undefined;

    renderWithAppProvider({ devMode: true });

    expect(await screen.findByText('Voice mode: Unavailable (text only)')).toBeInTheDocument();
    expect(await screen.findByText(/Voice status: text-only \(speech_api_unavailable\)/)).toBeInTheDocument();
  });

  it('shows native mode when Vosk model is downloaded', async () => {
    voskSpeechMock.isNativePlatform.mockReturnValue(true);
    voskSpeechMock.getAvailability.mockResolvedValue({
      available: true,
      reasonCode: 'ok',
      modelDownloaded: true,
    });
    voskSpeechMock.ensurePermission.mockResolvedValue({ granted: true });

    renderWithAppProvider({ devMode: true });

    expect(await screen.findByText(/Voice mode: Native/)).toBeInTheDocument();
    expect(await screen.findByText(/Voice status: native \(ok\)/)).toBeInTheDocument();
  });

  it('shows downloading state when Vosk model is not downloaded', async () => {
    voskSpeechMock.isNativePlatform.mockReturnValue(true);
    voskSpeechMock.getAvailability.mockResolvedValue({
      available: false,
      reasonCode: 'model_not_downloaded',
      modelDownloaded: false,
    });

    renderWithAppProvider({ devMode: true });

    expect(await screen.findByText(/Voice mode: Unavailable/)).toBeInTheDocument();
    expect(await screen.findByText(/Voice status: native \(model_not_downloaded\)/)).toBeInTheDocument();
  });
});
