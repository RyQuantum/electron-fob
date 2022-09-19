import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { Button, Form, List, Modal, Radio, Input, Spin } from 'antd';
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

  const ref = useRef({ fobNumber: '' }); // TODO research any better way than ref
  const [logs, setLogs] = useState<string[]>([]);
  const handleUsbEvent = useCallback(
    (fob: Fob, direction: 'req' | 'res' | 'upload') => {
      setLogs((prevLogs: string[]) => {
        if (fob.fobNumber !== ref.current.fobNumber) {
          ref.current.fobNumber = fob.fobNumber;
          return [fob.state];
        }
        if (direction === 'upload') return [...prevLogs, 'Uploaded'];
        if (direction === 'res') {
          prevLogs[prevLogs.length - 1] = `${fob.state}`;
          return [...prevLogs];
        }
        return [...prevLogs, fob.state];
      });
    },
    []
  );
  useEvent('fob', handleUsbEvent, ipcRenderer);

  const [isTesting, setIsTesting] = useState(false);
  const handleInterruptEvent = useCallback(() => setIsTesting(false), []);
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
                style={{ width: 65 }}
                onClick={() => setIsVerifying(!isVerifying)}
                disabled={isTesting}
              >
                {isVerifying ? ' Stop ' : 'Verify'}
              </Button>
              <LoadingOutlined
                style={{
                  fontSize: '16px',
                  marginLeft: 5,
                  visibility: isVerifying ? 'visible' : 'hidden',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <LoadingOutlined
                style={{
                  fontSize: '16px',
                  marginRight: 5,
                  visibility: isInitializing ? 'visible' : 'hidden',
                }}
              />
              <Radio checked={fobNumber !== ''}>
                Fob{fobNumber !== '' ? `: ${fobNumber}` : ' not detected'}
              </Radio>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img
                src={nfc}
                alt="nfc"
                style={{
                  width: 20,
                  visibility: isTesting ? 'visible' : 'hidden',
                }}
              />
              NFC &nbsp;
              <Button
                className="button"
                type="primary"
                style={{ width: 65 }}
                onClick={() => {
                  if (isTesting) {
                    ipcRenderer.sendMessage('stop', []);
                    setIsTesting(false);
                  } else {
                    ipcRenderer.once('start', (arg: boolean) =>
                      setIsTesting(arg)
                    );
                    ipcRenderer.sendMessage('start', [fobNumber]);
                  }
                }}
                disabled={isVerifying}
              >
                {isTesting ? ' Stop ' : 'Init'}
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
  const [isUploading, setisUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const handleEvent = useCallback(
    (enabled: boolean) => setisUploading(enabled),
    []
  );
  useEvent('uploadAll', handleEvent, ipcRenderer);

  const onFinishSuccess = ({
    username,
    password,
    env,
  }: {
    username: string;
    password: string;
    env: string;
  }) => {
    setLoading(true);
    ipcRenderer.once('login', (res) => {
      if (!res.success) Modal.error({ title: 'Error', content: res.message });
      else setOpen(false);
      setLoading(false);
    });
    ipcRenderer.sendMessage('login', [username, password, env]);
  };

  return (
    <Spin spinning={isUploading} tip="Uploading..." size="large">
      <div id="content">
        <Modal
          title="Login"
          open={open}
          maskClosable={false}
          closable={false}
          footer={[]}
        >
          <Form
            name="login"
            labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
            onFinish={onFinishSuccess}
            autoComplete="off"
            initialValues={{ env: 'Production' }}
          >
            <Form.Item
              label="Username"
              name="username"
              rules={[
                { required: true, message: 'Please input your username!' },
              ]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: 'Please input your password!' },
              ]}
            >
              <Input.Password />
            </Form.Item>

            <Form.Item label="Environment" name="env">
              <Radio.Group>
                <Radio value="Production">Production</Radio>
                <Radio value="OSS">OSS</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
              <Button type="primary" htmlType="submit" loading={loading}>
                Login
              </Button>
            </Form.Item>
          </Form>
        </Modal>
        <VerifyContext.Provider value={{ isVerifying, setIsVerifying }}>
          <FobTable />
          <FobLogs />
        </VerifyContext.Provider>
      </div>
    </Spin>
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
