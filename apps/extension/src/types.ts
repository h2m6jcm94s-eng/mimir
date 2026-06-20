export interface CaptureData {
  title: string;
  url: string;
  text: string;
}

export interface CapturePayload {
  content: string;
  tier?: number;
  tags?: string[];
}

export interface CaptureResult {
  itemId: string;
  title: string;
  links: { targetId: string; title: string }[];
}

export interface ExtensionMessage {
  type: 'CAPTURE_PAGE' | 'CAPTURE_SELECTION' | 'PAGE_CAPTURED' | 'CAPTURE_RESULT';
  mode?: 'page' | 'selection';
  data?: CaptureData | CaptureResult | { error: string };
}

export type CaptureMode = 'page' | 'selection';
