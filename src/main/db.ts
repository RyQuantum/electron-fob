import { app } from 'electron';
import { Sequelize, Model, CreationOptional, DataTypes } from 'sequelize';

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
    console.error('Unable to connect to the database:', err);
    return [];
  }
};
