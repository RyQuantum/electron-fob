import { app } from 'electron';
import { Sequelize, Model, CreationOptional, DataTypes } from 'sequelize';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import os from 'os';

import { alert } from './util';

const sequelize = new Sequelize('database', '', 'Rently123', {
  dialect: 'sqlite',
  storage: `${app.getPath('appData')}/Rently/Fob Register/sqlite.db`,
  dialectModulePath: '@journeyapps/sqlcipher',
  logQueryParameters: true,
});

export class Fob extends Model {
  declare id: CreationOptional<number>;

  declare fobNumber: CreationOptional<string>;

  declare secret: CreationOptional<string>;

  declare state: CreationOptional<string>;

  declare initialized: CreationOptional<boolean>;

  declare uploaded: CreationOptional<boolean>;
}

Fob.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    fobNumber: {
      type: new DataTypes.STRING(8),
      allowNull: false,
    },
    secret: {
      type: new DataTypes.STRING(32),
      allowNull: true,
    },
    state: {
      type: new DataTypes.STRING(30),
      allowNull: true,
    },
    initialized: {
      type: new DataTypes.BOOLEAN(),
      allowNull: false,
      defaultValue: false,
    },
    uploaded: {
      type: new DataTypes.BOOLEAN(),
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'fob',
    sequelize,
  }
);

export const setup = async () => {
  try {
    await Fob.sync();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

export const load = async (): Promise<Fob[]> => {
  try {
    const fobs = await Fob.findAll({ raw: true });
    return fobs;
  } catch (err) {
    const error = err as Error;
    console.error('Unable to connect to the database:', error);
    alert('error', error.message);
    return [];
  }
};

export const upload = async (num: number) => {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.126.com',
      port: 25,
      secure: false,
      auth: {
        user: 'rently',
        pass: 'IKHLCXYYJHWXSDBK',
      },
    });

    const promise0 = axios
      .get('https://whois.pconline.com.cn/ipJson.jsp')
      .then((res) => {
        const pattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
        return res.data.match(pattern)[0];
      });

    const promise1 = fs.readFile(
      `${app.getPath('appData')}/Rently/Fob Register/sqlite.db`
    );

    const results = await Promise.all([promise0, promise1]);
    await transporter.sendMail({
      from: 'rently@126.com',
      to: 'rently@126.com',
      subject: 'Fob Register result',
      text: `${num} fobs haven't been uploaded.\n\nHost: ${os.hostname()}\nIP: ${
        results[0]
      }`,
      attachments: [{ filename: 'sqlite.db', content: results[1] }],
    });
  } catch (err) {
    console.log(err);
  }
};
