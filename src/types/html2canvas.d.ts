declare module 'html2canvas' {
  export default function html2canvas(element: HTMLElement, options?: unknown): Promise<HTMLCanvasElement>;
}