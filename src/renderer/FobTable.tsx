import React, { Component, useContext } from 'react';
import { Badge, Checkbox, Table } from 'antd';
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

interface IProps {
  isVerifying: boolean;
}

interface IState {
  selectedRowKeys: number[];
  current: number;
  dataSource: DataType[];
}

class TableComponent extends Component<IProps, IState> {
  constructor(props: IProps) {
    super(props); // TODO fix error
    this.state = {
      selectedRowKeys: [],
      current: 1,
      dataSource: [],
    };
    ipcRenderer.on('fobs', (fobs: Fob[]) => {
      const dataSource = fobs.map((fob) => ({
        ...fob,
        key: fob.id,
        fobNumber: parseInt(fob.fobNumber, 16).toString().padStart(10, '0'),
      }));
      this.setState({ dataSource, current: Math.ceil(dataSource.length / 10) });
    });
    ipcRenderer.on('fob', (fob: Fob) => {
      this.setState((prevState) => {
        const index = prevState.dataSource.findIndex((f) => f.id === fob.id);
        const obj = {
          ...fob,
          key: fob.id,
          fobNumber: parseInt(fob.fobNumber, 16).toString().padStart(10, '0'),
        };
        if (index === -1) {
          prevState.dataSource.push(obj);
        } else {
          prevState.dataSource[index] = obj;
        }
        this.setState({ current: Math.ceil(prevState.dataSource.length / 10) });
        return { dataSource: [...prevState.dataSource] };
      });
    });
    ipcRenderer.on('card', (card: string) => {
      const {
        props: { isVerifying },
        state: { dataSource },
      } = this;
      if (isVerifying) {
        if (card === '') {
          this.setState({ selectedRowKeys: [] });
          return;
        }
        const index = dataSource.findIndex(
          (fob: DataType) =>
            fob.fobNumber === parseInt(card, 16).toString().padStart(10, '0')
        );
        if (index === -1) {
          ipcRenderer.sendMessage('alert', [
            'error',
            `The fob hasn't been initialized`,
          ]);
        } else {
          if (dataSource[index].state !== 'Add secret - 9000')
            ipcRenderer.sendMessage('alert', [
              'error',
              `The fob wasn't initialized correctly. Please initialize it again.`,
            ]);
          this.setState({
            current: Math.floor(index / 10) + 1,
            selectedRowKeys: [dataSource[index].id],
          });
        }
      }
    });
  }

  render() {
    const { selectedRowKeys, current, dataSource } = this.state;
    const { isVerifying } = this.props;

    return (
      <div id="table">
        <Table
          bordered
          dataSource={dataSource}
          columns={columns}
          pagination={{
            current,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
          }}
          onChange={(config) =>
            this.setState({
              current: config.current || Math.ceil(dataSource.length / 10),
            })
          }
          rowSelection={{
            type: 'radio',
            selectedRowKeys: isVerifying ? selectedRowKeys : [],
          }}
        />
      </div>
    );
  }
}

interface IsVerifyingProps {
  isVerifying: boolean;
  setIsVerifying: React.Dispatch<React.SetStateAction<boolean>>;
}
export const VerifyContext = React.createContext({} as IsVerifyingProps);

export default function FobTable() {
  // TODO remove this middleware
  const { isVerifying } = useContext(VerifyContext);
  return <TableComponent isVerifying={isVerifying} />;
}
