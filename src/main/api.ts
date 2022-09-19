import axios, { AxiosError } from 'axios';
import { IpcMainEvent } from 'electron';
import { Fob } from './db';
import { convertNumberToDecimal } from './util';

let env: string | null;
let accessToken: string | null;

const envs = {
  Production: 'https://app2.keyless.rocks',
  OSS: 'https://keyless.rentlyopensesame.com',
};

export const login = async (
  event: IpcMainEvent,
  [username, password, envName]: [string, string, 'Production' | 'OSS']
) => {
  env = envs[envName];
  try {
    const { data } = await axios.post(
      `${env}/api/agents`,
      {
        username,
        password,
        grant_type: 'password',
        factory: true,
      },
      { timeout: 20000 }
    );
    accessToken = data.access_token;
    event.reply('login', { success: true });
  } catch (err) {
    const error = err as AxiosError;
    event.reply('login', error.response?.data || error.message);
  }
};

export const upload = async (
  num: string,
  key: string
): Promise<{ success: boolean; message: string }> => {
  const fobNumber = num.toUpperCase();
  try {
    const { data } = await axios.post(
      `${env}/api/fobs/uploadFob`,
      {
        fobNumber,
        key: `${key}`,
      },
      { timeout: 30000, headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return data;
  } catch (err) {
    const error = err as AxiosError;
    return { success: false, message: error.message };
  }
};

export const uploadMany = async (
  fobs: Fob[]
): Promise<{ success: boolean; message: string }> => {
  const promises = fobs.map((fob) => upload(fob.fobNumber, fob.secret));
  const results = await Promise.all(promises);
  if (results.every((result) => result.success))
    return { success: true, message: 'All uploaded' };
  const list: number[] = [];
  results.forEach((result, i) => {
    if (!result.success) list.push(i);
  });
  const message = list
    .map(
      (index) =>
        `${convertNumberToDecimal(fobs[index].fobNumber)}:${
          results[index].message
        }`
    )
    .join('\n');
  return { success: false, message };
};
