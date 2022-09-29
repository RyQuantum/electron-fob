import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEvent } from 'react-use';
import { Button, List, Radio } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { Fob } from '../main/db';
import { translateState } from '../i18n';
import './FobLogs.css';
import nfc from '../../assets/nfc.gif';

const { ipcRenderer } = window.electron;

const FobLogs: React.FC = () => {
  const { t } = useTranslation();

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
    (fob: Fob, direction: 'req' | 'res' | number) => {
      fob.state = translateState(fob.state);
      setLogs((prevLogs: string[]) => {
        if (typeof direction === 'number')
          return [...prevLogs, translateState('Uploaded')];
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
    },
    []
  );
  useEvent('fob', handleUsbEvent, ipcRenderer);

  const [isTesting, setIsTesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const handleInterruptEvent = useCallback(() => {
    setIsTesting(false);
    setIsVerifying(false);
  }, []);
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
                onClick={() => {
                  if (isVerifying) {
                    ipcRenderer.sendMessage('stop', []);
                    setIsVerifying(false);
                  } else {
                    ipcRenderer.once('verify', (arg: boolean) =>
                      setIsVerifying(arg)
                    );
                    ipcRenderer.sendMessage('verify', [fobNumber]);
                  }
                }}
                disabled={isTesting}
              >
                {t(isVerifying ? 'stop' : 'verify')}
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
                {`${t('fob')}: ${
                  fobNumber !== '' ? fobNumber : t('notDetected')
                }`}
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
                style={{ minWidth: 65 }}
                onClick={() => {
                  if (isTesting) {
                    ipcRenderer.sendMessage('stop', []);
                    setIsTesting(false);
                  } else {
                    ipcRenderer.once('init', (arg: boolean) =>
                      setIsTesting(arg)
                    );
                    ipcRenderer.sendMessage('init', [fobNumber]);
                  }
                }}
                disabled={isVerifying}
              >
                {t(isTesting ? 'stop' : 'init')}
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

export default FobLogs;
