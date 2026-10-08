import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ponytail: ingredients come from the product description ("Carne, queijo e molho."), add an ingredients column if descriptions stop being plain lists
export function ingredients(description: string): string[] {
  return description.replace(/\.$/, "").split(/,\s*|\s+e\s+/).map(part => part.trim()).filter(Boolean);
}
