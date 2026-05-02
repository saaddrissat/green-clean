import type { CartItem } from "@/hooks/use-pos-cart";
import { formatMoney } from "@/lib/currency";

type BuildTicketInput = {
  orderId: string;
  companyName: string;
  dueDate: string;
  total: number;
  paymentMethod: string;
  items: CartItem[];
  printedAt?: Date;
};

const encoder = new TextEncoder();

const ESC = 0x1b;
const GS = 0x1d;

const bytes = (...values: number[]) => Uint8Array.from(values);

const joinChunks = (chunks: Uint8Array[]) => {
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

const line = (text = "") => encoder.encode(`${text}\n`);

const alignCenter = bytes(ESC, 0x61, 0x01);
const alignLeft = bytes(ESC, 0x61, 0x00);
const boldOn = bytes(ESC, 0x45, 0x01);
const boldOff = bytes(ESC, 0x45, 0x00);
const doubleSizeOn = bytes(GS, 0x21, 0x11);
const doubleSizeOff = bytes(GS, 0x21, 0x00);
const cutPaper = bytes(GS, 0x56, 0x41, 0x10);

const formatXof = (amount: number) => formatMoney(amount);

const formatDueDate = (value: string) => {
  if (!value) {
    return "Non definie";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
  }).format(date);
};

const padLine = (left: string, right: string, width = 32) => {
  const cleanLeft = left.slice(0, Math.max(0, width - right.length - 1));
  const spaces = Math.max(1, width - cleanLeft.length - right.length);
  return `${cleanLeft}${" ".repeat(spaces)}${right}`;
};

const code128 = (data: string) => {
  const payload = encoder.encode(data);
  return bytes(GS, 0x6b, 0x49, payload.length, ...payload);
};

export const buildEscPosTicket = (input: BuildTicketInput) => {
  const printedAt = input.printedAt ?? new Date();
  const dueDateLabel = formatDueDate(input.dueDate);

  const chunks: Uint8Array[] = [];
  chunks.push(bytes(ESC, 0x40));
  chunks.push(alignCenter, boldOn, line(input.companyName), boldOff);
  chunks.push(line("Pressing & Blanchisserie"));
  chunks.push(line("--------------------------------"));
  chunks.push(alignLeft);
  chunks.push(line(`Commande: ${input.orderId}`));
  chunks.push(line(`Date: ${printedAt.toLocaleString("fr-FR")}`));
  chunks.push(line(`Paiement: ${input.paymentMethod}`));
  chunks.push(line("--------------------------------"));
  chunks.push(boldOn, line("ARTICLES"), boldOff);

  for (const item of input.items) {
    const qtyPrice = padLine(`${item.productName} x${item.quantity}`, formatXof(item.unitPrice * item.quantity));
    chunks.push(line(qtyPrice));
    chunks.push(line(`  - ${item.optionLabel}`));
  }

  chunks.push(line("--------------------------------"));
  chunks.push(doubleSizeOn, boldOn, line(padLine("TOTAL", formatXof(input.total))), boldOff, doubleSizeOff);
  chunks.push(line("--------------------------------"));
  chunks.push(alignCenter, boldOn, line("DATE DE RENDU"), doubleSizeOn, line(dueDateLabel), doubleSizeOff, boldOff);
  chunks.push(line("--------------------------------"));
  chunks.push(line("Code commande"));
  chunks.push(bytes(GS, 0x68, 80));
  chunks.push(bytes(GS, 0x77, 3));
  chunks.push(code128(input.orderId));
  chunks.push(line(input.orderId));
  chunks.push(line(""));
  chunks.push(line("Merci pour votre confiance"));
  chunks.push(line(""));
  chunks.push(cutPaper);

  return joinChunks(chunks);
};

export const buildTicketText = (input: BuildTicketInput) => {
  const dueDateLabel = formatDueDate(input.dueDate);
  const printedAt = (input.printedAt ?? new Date()).toLocaleString("fr-FR");
  const itemLines = input.items
    .map(
      (item) =>
        `${item.productName} x${item.quantity}\n  - ${item.optionLabel}\n  ${formatXof(item.unitPrice * item.quantity)}`,
    )
    .join("\n");

  return [
    input.companyName,
    "Pressing & Blanchisserie",
    "--------------------------------",
    `Commande: ${input.orderId}`,
    `Date: ${printedAt}`,
    `Paiement: ${input.paymentMethod}`,
    "--------------------------------",
    itemLines,
    "--------------------------------",
    `TOTAL: ${formatXof(input.total)}`,
    "================================",
    `DATE DE RENDU: ${dueDateLabel}`,
    `CODE128: ${input.orderId}`,
  ].join("\n");
};
