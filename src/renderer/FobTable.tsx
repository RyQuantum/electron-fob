import { Badge, Checkbox, Table } from 'antd';
import React, { useCallback, useState } from 'react';
import { useEvent } from 'react-use';
import { Fob } from '../main/db';

const { ipcRenderer } = window.electron;

const columns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
  },
  {
    title: 'Fob Number',
    dataIndex: 'fobNumber',
    key: 'fobNumber',
  },
  {
    title: 'State',
    dataIndex: 'state',
    key: 'state',
    render: (text: string) => (
      <span>
        {text === 'Add secret - 9000' && <Badge status="success" />}
        {text}
      </span>
    ),
  },
  {
    title: 'Uploaded',
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
            `${range[0]}-${range[1]} of ${total} items`,
        }}
        onChange={(config) =>
          setCurrent(config.current || Math.ceil(dataSource.length / 10))
        }
        rowSelection={{ type: 'radio', selectedRowKeys }}
      />
    </div>
  );
};

export default FobTable;
