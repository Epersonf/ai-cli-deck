/** What gets downloaded for speech recognition: pinned, and checked against the sha256 before use. */
export interface Asset {
  url: string;
  sha256: string;
  size: number;
}

const RELEASE = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2';

/** whisper.cpp's Windows build (the other systems use a `whisper-cli` they already have). */
export const WINDOWS_ENGINE: Asset = {
  url: `${RELEASE}/whisper-bin-x64.zip`,
  sha256: '49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a',
  size: 8_194_445,
};

/** The speech model (small, multilingual). */
export const MODEL: Asset = {
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
  size: 487_601_967,
};

export const MODEL_FILE = 'ggml-small.bin';
