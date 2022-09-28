import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { IpcMainEvent } from 'electron';
import { Fob } from './db';
import { convertNumberToDecimal } from './util';

let env: string | null;
let accessToken: string | null;

const envs = {
  Production: 'https://app2.keyless.rocks',
  OSS: 'https://keyless.rentlyopensesame.com',
};

const interceptRequest = async ({
  method,
  url,
  headers = {},
  params = {},
  ...rest
}: AxiosRequestConfig) => {
  const config = {
    url,
    method,
    params,
    headers,
    ...rest,
  };
  console.log(
    `---- req:[${method}]:(${
      config.baseURL || ''
    }${url}) params:${JSON.stringify(params)} data:${
      rest.data instanceof URLSearchParams
        ? rest.data.toString()
        : JSON.stringify(rest.data)
    }`
  );
  return config;
};

const interceptResponse = async ({ data, config, ...rest }: AxiosResponse) => {
  console.log(
    `---- res:[${config.method}]:(${config.url}) ${JSON.stringify(data)}`
  );
  return { data, config, ...rest };
};

axios.interceptors.request.use(interceptRequest);
axios.interceptors.response.use(interceptResponse);

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
    let res;
    if (error.response?.data) {
      res = error.response.data;
    } else if (error.response?.status && error.response?.statusText) {
      res = {
        success: false,
        message: `${error.response.status} ${error.response.statusText}`,
      };
    } else {
      res = {
        success: false,
        message: error.message,
      };
    }
    event.reply('login', res);
  }
};

export const upload = async (
  fob: Fob
): Promise<{ success: boolean; message: string }> => {
  const fobNumber = fob.fobNumber.toUpperCase();
  try {
    const { data } = await axios.post(
      `${env}/api/fobs/uploadFob`,
      {
        fobNumber,
        key: `${fob.secret}`,
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
): Promise<{ success: boolean; message: string; remain: number }> => {
  const promises = fobs.map((fob) => upload(fob));
  const results = await Promise.all(promises);
  if (results.every((result) => result.success))
    return { success: true, message: 'All uploaded', remain: 0 };
  const list: number[] = [];
  results.forEach((result, i) => {
    if (!result.success) list.push(i);
  });
  const message = list
    .map(
      (index) =>
        `${convertNumberToDecimal(fobs[index].fobNumber)}: ${
          results[index].message
        }`
    )
    .join('\n');
  return { success: false, message, remain: list.length };
};
