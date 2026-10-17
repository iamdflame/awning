import { Archivo, Martian_Mono } from "next/font/google";

/**
 * Awning's two families, self-hosted by next/font: Archivo across its width axis
 * (display 112-125%, body 100%) and Martian Mono for receipts, tx hashes and
 * x402 links. Used only on awning.sh pages, never on storefronts.
 */
export const archivo = Archivo({ subsets: ["latin", "latin-ext"], axes: ["wdth"], display: "swap", fallback: ["ui-sans-serif", "system-ui", "sans-serif"] });
export const martian = Martian_Mono({ subsets: ["latin"], axes: ["wdth"], display: "swap", fallback: ["ui-monospace", "monospace"] });

/** :root variables brand.css reads (--font-archivo, --font-martian). */
export const fontVars = `:root{--font-archivo:${archivo.style.fontFamily};--font-martian:${martian.style.fontFamily}}`;
