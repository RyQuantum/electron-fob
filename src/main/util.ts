/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';
import { BrowserWindow, dialog } from 'electron';

export function delay(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export function convertNumberToDecimal(fobNumber: string) {
  return parseInt(fobNumber, 16).toString().padStart(10, '0');
}

export function convertNumbersToDecimal(fobNumbers: string[]) {
  return fobNumbers.map((fobNumber) =>
    parseInt(fobNumber, 16).toString().padStart(10, '0')
  );
}

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

export async function alert(type: string, message: string) {
  const title = type[0].toUpperCase() + type.slice(1);
  return dialog.showMessageBox(
    new BrowserWindow({
      show: false,
      alwaysOnTop: true,
    }),
    {
      type,
      title,
      message,
    }
  );
}

export async function alertUploadFailed(
  message: string,
  fobNumber: string
): Promise<{ response: number }> {
  const num = convertNumbersToDecimal([fobNumber])[0];
  return dialog.showMessageBox(
    new BrowserWindow({
      show: false,
      alwaysOnTop: true,
    }),
    {
      type: 'error',
      title: 'Error',
      message: `Upload ${num} failed, error: ${message} \nDo you want to retry?`,
      buttons: ['Retry', 'Cancel'],
    }
  );
}

export async function alertExitWarning(
  message: string
): Promise<{ response: number }> {
  return dialog.showMessageBox(
    new BrowserWindow({
      show: false,
      alwaysOnTop: true,
    }),
    {
      type: 'warning',
      title: 'Warning',
      message,
      buttons: ['Yes', 'Cancel'],
    }
  );
}
