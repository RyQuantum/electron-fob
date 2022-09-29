import { Badge, Checkbox, ConfigProvider, Table } from 'antd';
import React, { useCallback, useState } from 'react';
import { useEvent } from 'react-use';
import { useTranslation } from 'react-i18next';
import zhCN from 'antd/es/locale/zh_CN';
import en from 'antd/es/locale/default';

import { Fob } from '../main/db';
import { translateState } from '../i18n';
import './FobTable.css';

const { ipcRenderer } = window.electron;

const FobNumberTitle: React.FC = () => {
  const { t } = useTranslation();
  return <span>{t('fobNumber')}</span>;
};

const StateTitle: React.FC = () => {
  const { t } = useTranslation();
  return <span>{t('state')}</span>;
};

const UploadedTitle: React.FC = () => {
  const { t } = useTranslation();
  return <span>{t('uploaded')}</span>;
};

const columns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
  },
  {
    title: <FobNumberTitle />,
    dataIndex: 'fobNumber',
    key: 'fobNumber',
  },
  {
    title: <StateTitle />,
    dataIndex: 'state',
    key: 'state',
    render: (state: string) => {
      const translatedState = translateState(state);
      return (
        <span>
          {state === 'Add secret - 9000' && (
            <Badge style={{ marginRight: 5 }} status="success" />
          )}
          {translatedState}
        </span>
      );
    },
  },
  {
    title: <UploadedTitle />,
    dataIndex: 'uploaded',
    key: 'uploaded',
    render: (checked: boolean) => <Checkbox checked={checked} />,
  },
];

type DataType = {
  id: number;
  key: number;
  fobNumber: string;
  state?: string;
  uploaded: boolean;
};

const FobTable: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [current, setCurrent] = useState(1);

  const [dataSource, setDataSource] = useState<DataType[]>([]);
  const handleFobsEvent = useCallback((fobs: Fob[]) => {
    const data = fobs.map((fob) => ({
      ...fob,
      key: fob.id,
      fobNumber: parseInt(fob.fobNumber, 16).toString().padStart(10, '0'),
    }));
    setDataSource(data);
    setCurrent(Math.ceil(data.length / 10));
  }, []);
  useEvent('fobs', handleFobsEvent, ipcRenderer);

  const handleFobEvent = useCallback((fob: Fob, direction: string | number) => {
    setDataSource((prevDataSource) => {
      const index = prevDataSource.findIndex((f) => f.id === fob.id);
      const obj = {
        ...fob,
        key: fob.id,
        fobNumber: parseInt(fob.fobNumber, 16).toString().padStart(10, '0'),
      };
      if (index === -1) {
        prevDataSource.push(obj);
      } else {
        prevDataSource[index] = obj;
      }
      if (typeof direction === 'number')
        setCurrent(Math.floor(direction / 10) + 1);
      else setCurrent(Math.ceil(prevDataSource.length / 10));
      return [...prevDataSource];
    });
  }, []);
  useEvent('fob', handleFobEvent, ipcRenderer);

  const handleCardEvent = useCallback((fobId: number, sequence: number) => {
    if (fobId === -1) {
      setSelectedRowKeys([]);
      return;
    }
    setSelectedRowKeys([fobId]);
    setCurrent(Math.floor(sequence / 10) + 1);
  }, []);
  useEvent('found', handleCardEvent, ipcRenderer);

  return (
    <ConfigProvider locale={i18n.language === 'zh' ? zhCN : en}>
      <div id="table">
        <Table
          bordered
          size="middle"
          dataSource={dataSource}
          columns={columns}
          pagination={{
            current,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} ${t('items')}`,
          }}
          onChange={(config) =>
            setCurrent(config.current || Math.ceil(dataSource.length / 10))
          }
          rowSelection={{ type: 'radio', selectedRowKeys }}
        />
      </div>
    </ConfigProvider>
  );
};

export default FobTable;
