import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { Button, Table, List, Radio, Badge, Checkbox } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useEvent } from 'react-use';

import 'antd/dist/antd.css';
import './App.css';
import { Fob } from '../main/db';
import nfc from '../../assets/nfc.gif';

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
  const [dataSource, setDataSource] = useState<DataType[]>([]);
  const handleEvent = useCallback((fob: Fob) => {
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
      return [...prevDataSource];
    });
  }, []);
  useEvent('log', handleEvent, ipcRenderer);

  return (
    <div id="table">
      <Table bordered dataSource={dataSource} columns={columns} />
    </div>
  );
};

// class FobTable extends Component<any, any> {
//   constructor(props: any) {
//     super(props);
//     ipcRenderer.on('lockInfo', (id, lockMac, imei, provisioning) => {
//       const lock = { id, lockMac, imei, provisioning, key: id };
//       const index = this.state.dataSource.findIndex((lock) => lock.id === id);
//       if (index === -1) {
//         this.state.dataSource.push(lock);
//       } else {
//         this.state.dataSource[index] = lock;
//       }
//       this.setState({ dataSource: [...this.state.dataSource] });
//     });
//     this.state = {
//       fobs: [],
//     };
//   }
//
//   render() {
//     return (
//       <div id="table">
//         <Table bordered dataSource={this.state.fobs} columns={columns} />
//       </div>
//     );
//   }
// }

const FobLogs: React.FC = () => {
  const [fobNumber, setFobNumber] = useState('');
  const handleConnectEvent = useCallback((num: string) => {
    const fobNum = num && parseInt(num, 16).toString().padStart(10, '0');
    setFobNumber(fobNum);
  }, []);
  useEvent('card', handleConnectEvent, ipcRenderer);

  const [isInitializing, setIsInitializing] = useState(false);
  const handleRunningEvent = useCallback((state: boolean) => {
    setIsInitializing(state);
  }, []);
  useEvent('initializing', handleRunningEvent, ipcRenderer);

  const ref = useRef({ fobNumber: '' });
  const [logs, setLogs] = useState<string[]>([]);
  const handleUsbEvent = useCallback((fob: Fob, direction: 'req' | 'res') => {
    setLogs((prevLogs: string[]) => {
      if (fob.fobNumber !== ref.current.fobNumber) {
        ref.current.fobNumber = fob.fobNumber;
        return [fob.state];
      }
      if (direction === 'res') {
        prevLogs[prevLogs.length - 1] = `${fob.state}`;
        return [...prevLogs];
      }
      return [...prevLogs, fob.state];
    });
  }, []);
  useEvent('log', handleUsbEvent, ipcRenderer);

  const [isRunning, setIsRunning] = useState(0); // 0: stopped; 1: running
  const handleInterruptEvent = useCallback(() => setIsRunning(0), []);
  useEvent('interrupt', handleInterruptEvent, ipcRenderer);

  const refs = useRef<HTMLElement[]>([]);
  useEffect(() => refs.current.at(logs.length - 1)?.scrollIntoView(), [logs]);

  return (
    <div id="log">
      <List
        size="small"
        header={
          <div id="header">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Radio checked={fobNumber !== ''}>
                Fob {fobNumber !== '' ? `: ${fobNumber}` : ' not detected'}
              </Radio>
              {isInitializing && (
                <LoadingOutlined style={{ fontSize: '16px' }} />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {
                [null, <img src={nfc} alt="nfc" style={{ height: 22 }} />][
                  isRunning
                ]
              }
              NFC &nbsp;
              <Button
                className="button"
                type="primary"
                style={{ width: 60 }}
                onClick={() => {
                  if (isRunning) {
                    ipcRenderer.sendMessage('stop', []);
                    setIsRunning(0);
                  } else {
                    ipcRenderer.once('start', (arg: number) =>
                      setIsRunning(arg)
                    );
                    ipcRenderer.sendMessage('start', [fobNumber]);
                  }
                }}
              >
                {isRunning ? ' Stop ' : 'Start'}
              </Button>
            </div>
          </div>
        }
        dataSource={logs}
        renderItem={(item, index) => (
          <List.Item
            ref={(elm) => {
              if (elm) {
                refs.current[index] = elm;
              }
            }}
          >
            {item}
          </List.Item>
        )}
      />
    </div>
  );
};

const Content: React.FC = () => {
  return (
    <div id="content">
      <FobTable />
      <FobLogs />
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Content />} />
      </Routes>
    </Router>
  );
}
