import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { Button, Form, Modal, Radio, Input, Spin } from 'antd';
import React, { useCallback, useState } from 'react';
import { useEvent } from 'react-use';

import 'antd/dist/antd.css';
import './App.css';
import FobTable from './FobTable';
import FobLogs from './FobLogs';

const { ipcRenderer } = window.electron;

const Content: React.FC = () => {
  const [isUploading, setisUploading] = useState(false);
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
        <FobTable />
        <FobLogs />
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
