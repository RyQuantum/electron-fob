import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { Button, List, Radio } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import React, {
  useCallback,
  useState,
  useRef,
  useEffect,
  useContext,
} from 'react';
import { useEvent } from 'react-use';

import 'antd/dist/antd.css';
import './App.css';
import { Fob } from '../main/db';
import nfc from '../../assets/nfc.gif';
import FobTable, { VerifyContext } from './FobTable';

const { ipcRenderer } = window.electron;

// const columns = [
//   {
//     title: 'ID',
//     dataIndex: 'id',
//     key: 'id',
//   },
//   {
//     title: 'Fob Number',
//     dataIndex: 'fobNumber',
//     key: 'fobNumber',
//   },
//   {
//     title: 'State',
//     dataIndex: 'state',
//     key: 'state',
//     render: (text: string) => (
//       <span>
//         {text === 'Add secret - 9000' && <Badge status="success" />}
//         {text}
//       </span>
//     ),
//   },
//   {
//     title: 'Uploaded',
//     dataIndex: 'uploaded',
//     key: 'uploaded',
//     render: (checked: boolean) => <Checkbox checked={checked} />,
//   },
// ];
//
// type DataType = {
//   id: number;
//   key: number;
//   fobNumber: string;
//   state?: string;
//   uploaded: boolean;
// };

// const FobTable: React.FC = () => {
//   const { isVerifying } = useContext(VerifyContext);
//
//   const [selectedRowKeys, setSelectedRowKeys] = useState([]);
//   const [current, setCurrent] = useState(1);
//
//   const [dataSource, setDataSource] = useState<DataType[]>([]);
//   const handleFobsEvent = useCallback((fobs: Fob[]) => {
//     const data = fobs.map((fob) => ({
//       ...fob,
//       key: fob.id,
//       fobNumber: parseInt(fob.fobNumber, 16).toString().padStart(10, '0'),
//     }));
//     setDataSource(data);
//     setCurrent(Math.ceil(data.length / 10));
//   }, []);
//   useEvent('fobs', handleFobsEvent, ipcRenderer);
//
//   const handleFobEvent = useCallback((fob: Fob) => {
//     setDataSource((prevDataSource) => {
//       const index = prevDataSource.findIndex((f) => f.id === fob.id);
//       const obj = {
//         ...fob,
//         key: fob.id,
//         fobNumber: parseInt(fob.fobNumber, 16).toString().padStart(10, '0'),
//       };
//       if (index === -1) {
//         prevDataSource.push(obj);
//       } else {
//         prevDataSource[index] = obj;
//       }
//       setCurrent(Math.ceil(prevDataSource.length / 10));
//       return [...prevDataSource];
//     });
//   }, []);
//   useEvent('fob', handleFobEvent, ipcRenderer);
//
//   return (
//     <div id="table">
//       <Table
//         bordered
//         dataSource={dataSource}
//         columns={columns}
//         pagination={{
//           current,
//           showQuickJumper: true,
//           showTotal: (total, range) =>
//             `${range[0]}-${range[1]} of ${total} items`,
//         }}
//         onChange={(config) =>
//           setCurrent(config.current || Math.ceil(dataSource.length / 10))
//         }
//         rowSelection={{ type: 'radio', selectedRowKeys }}
//       />
//     </div>
//   );
// };

const FobLogs: React.FC = () => {
  const { isVerifying, setIsVerifying } = useContext(VerifyContext);

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
  useEvent('fob', handleUsbEvent, ipcRenderer);

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
            <div>
              <Button
                className="button"
                type="primary"
                onClick={() => setIsVerifying(!isVerifying)}
              >
                Verify
              </Button>
              {isVerifying && (
                <LoadingOutlined style={{ fontSize: '16px', marginLeft: 5 }} />
              )}
            </div>
            <div style={{ display: 'flex' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {isInitializing ? (
                  <LoadingOutlined
                    style={{ fontSize: '16px', marginRight: 5 }}
                  />
                ) : (
                  <div style={{ width: '1em' }} />
                )}
                <Radio checked={fobNumber !== ''}>
                  Fob{fobNumber !== '' ? `: ${fobNumber}` : ' not detected'}
                </Radio>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {
                  [
                    <div style={{ width: 20 }} />,
                    <img src={nfc} alt="nfc" style={{ width: 20 }} />,
                  ][isRunning]
                }
                NFC &nbsp;
                <Button
                  className="button"
                  type="primary"
                  style={{ width: 60 }}
                  onClick={() => {
                    // TODO fix conflict of 2 buttons
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
  const [isVerifying, setIsVerifying] = useState(false);
  return (
    <div id="content">
      <VerifyContext.Provider value={{ isVerifying, setIsVerifying }}>
        <FobTable />
        <FobLogs />
      </VerifyContext.Provider>
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
