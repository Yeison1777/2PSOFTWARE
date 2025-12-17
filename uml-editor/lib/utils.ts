import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function cleanupJsonString(jsonString: string): string {
  if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/```json\n?/, '').replace(/\n?```$/, '')
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```\n?/, '').replace(/\n?```$/, '')
    }
  return jsonString
}