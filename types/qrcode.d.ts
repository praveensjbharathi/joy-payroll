declare module "qrcode" {
  export type QRCodeToDataURLOptions = Record<string, unknown>;
  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  export function toDataURL(text: string, callback: (error: Error | null, url: string) => void): void;
  const QRCode: { toDataURL: typeof toDataURL };
  export default QRCode;
}
