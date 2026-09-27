import { useState, useEffect } from 'react';

export interface DemoAccessData {
  enabled: boolean;
  badge?: string;
  pin?: string;
}

export function useDemoAccess(): DemoAccessData {
  const [data, setData] = useState<DemoAccessData>({ enabled: false });

  useEffect(() => {
    fetch('/api/alarms/demo-access')
      .then(res => (res.ok ? res.json() : { enabled: false }))
      .then(d => {
        if (d && typeof d.enabled === 'boolean') {
          setData(d);
        }
      })
      .catch(() => setData({ enabled: false }));
  }, []);

  return data;
}
