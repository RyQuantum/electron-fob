import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { Button, Form, Modal, Radio, Input, Spin } from 'antd';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEvent } from 'react-use';

import FobTable from './FobTable';
import FobLogs from './FobLogs';
import i18n from '../i18n';
import 'antd/dist/antd.css';
import './App.css';

const { ipcRenderer } = window.electron;

const Content: React.FC = () => {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const handleEvent = useCallback(
    (enabled: boolean) => setIsUploading(enabled),
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
      if (!res.success)
        Modal.error({
          title: 'Error',
          content: res.message?.replace(/[\r\n]/g, ''),
        });
      else setOpen(false);
      setLoading(false);
    });
    ipcRenderer.sendMessage('login', [username, password, env]);
  };

  return (
    <Spin spinning={isUploading} tip="Uploading..." size="large">
      <div id="content">
        <Modal
          title={t('login')}
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
            initialValues={{ env: 'Production', lang: 'en' }}
          >
            <Form.Item
              label={t('username')}
              name="username"
              rules={[{ required: true, message: t('inputUsername') }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              label={t('password')}
              name="password"
              rules={[{ required: true, message: t('inputPassword') }]}
            >
              <Input.Password />
            </Form.Item>

            <Form.Item label={t('environment')} name="env">
              <Radio.Group>
                <Radio value="Production">{t('production')}</Radio>
                <Radio value="OSS">OSS</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item label={t('language')} name="lang">
              <Radio.Group
                onChange={(event) => {
                  ipcRenderer.sendMessage('language', event.target.value);
                  i18n.changeLanguage(event.target.value);
                }}
              >
                <Radio value="en">English</Radio>
                <Radio value="zh">中文</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
              <Button type="primary" htmlType="submit" loading={loading}>
                {t('login')}
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
